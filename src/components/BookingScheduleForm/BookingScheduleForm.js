import React, { useEffect, useState } from 'react';
import { connect } from 'react-redux';
import moment from 'moment-timezone';
import BookingSchedulePicker, {
  emptySchedule,
  scheduleDraft,
} from '../BookingSchedulePicker/BookingSchedulePicker';
import {
  normaliseSchedule,
  minimumBookingLabel,
  meetsListingMinimum,
  listingMinimum,
} from '../../util/bookingSchedule';
import { minimumFinishTime } from '../../util/bookingMinimumSuggestion';
import { quoteListingSchedule } from '../../util/bookingScheduleQuote';
import { parse, stringify } from '../../util/urlHelpers';
import css from './BookingScheduleForm.module.css';
import { combinedBookingEnabled } from '../../util/api';

const money = (amount, currency) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount / 100);
const itemLabel = code =>
  /commission|fee/.test(code)
    ? 'Service fee'
    : /discount/.test(code)
    ? 'Discount'
    : /units|day|hour|week|month/.test(code)
    ? 'Space hire'
    : 'Adjustment';

export const BookingScheduleFormComponent = ({
  listing,
  bookingType,
  initialSchedule,
  searchDates,
  disabled,
  promocode,
  onCheckSchedule,
  onCombinedReady,
  onReview,
  history,
  location,
}) => {
  let minimum = null;
  try {
    minimum = listingMinimum(listing);
  } catch (e) {
    /* Invalid host rules remain blocked by validation. */
  }
  const [value, setValue] = useState(() => {
    const draft = scheduleDraft({ schedule: initialSchedule, dates: searchDates });
    const zone = (listing.attributes.availabilityPlan || {}).timezone;
    const initial = {
      ...draft,
      timeZone: initialSchedule ? draft.timeZone : zone || emptySchedule().timeZone,
    };
    const finish = minimumFinishTime(initial.start, minimum, initial.days, initial.timeZone);
    return !initialSchedule && finish ? { ...initial, end: finish } : initial;
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);
  const [retry, setRetry] = useState(0);
  const [combinedEnabled, setCombinedEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    if (onCombinedReady) onCombinedReady().then(ready => { if (active) setCombinedEnabled(ready); }).catch(() => {});
    return () => { active = false; };
  }, [onCombinedReady]);
  const unit = bookingType === 'pricePerDay' ? 'daily' : 'hourly';
  const schedule = { ...value, unit };
  let normalised = null,
    validation = null;
  if (schedule.days.length) {
    try {
      normalised = normaliseSchedule(schedule);
      if (!meetsListingMinimum(listing, normalised))
        validation =
          'Your selection is shorter than the host’s minimum. Adjust your dates or hours.';
    } catch (e) {
      validation = e.message;
    }
  }
  const key = normalised
    ? JSON.stringify({
        schedule: normalised,
        listingId: listing.id.uuid,
        pricing: {
          price: listing.attributes.price,
          daily: (listing.attributes.publicData || {}).pricePerDay,
          minimum: (listing.attributes.publicData || {}).minBooking,
        },
        promocode,
      })
    : '';
  useEffect(() => {
    let active = true;
    setError(null);
    setResult(null);
    setChecking(false);
    if (!key || validation || disabled)
      return () => {
        active = false;
      };
    setChecking(true);
    const timer = setTimeout(() => {
      onCheckSchedule(listing, normalised, promocode, () => active)
        .then(quote => {
          if (active) setResult({ key, quote });
        })
        .catch(e => {
          if (active) setError(e.message || 'We could not check this booking. Please retry.');
        })
        .finally(() => {
          if (active) setChecking(false);
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // The key contains the complete normalised selection; other dependencies are stable props.
  }, [key, validation, disabled, retry]);
  const quote = result && result.key === key ? result.quote : null;
  const combined = combinedEnabled && quote && quote.groups.length > 1;
  const needsCombined = quote && quote.requiresCombinedCheckout && !combined;
  const review = (group, all = false) => {
    if (!quote || checking || validation || disabled || needsCombined) return;
    history.replace({
      ...location,
      search: `?${stringify({
        ...parse(location.search),
        schedule: JSON.stringify(quote.schedule),
      })}`,
    });
    if (all) onReview(unit, group, quote.schedule);
    else onReview(unit, group);
  };
  return (
    <section className={css.root} aria-label="Choose your booking schedule">
      <p className={css.minimum}>
        {minimumBookingLabel(listing) || 'Choose the dates and hours you need.'}
      </p>
      <BookingSchedulePicker
        value={schedule}
        onChange={setValue}
        compact
        showUnits={false}
        required
        minimum={minimum}
        initiallySuggested={!initialSchedule}
      />
      {disabled ? <p className={css.error}>Bookings are unavailable for this space.</p> : null}
      {validation ? (
        <p className={css.error} role="alert">
          {validation}
        </p>
      ) : null}
      {checking ? <p role="status">Checking availability and price…</p> : null}
      {error ? (
        <div role="alert" className={css.error}>
          <p>{error}</p>
          <button type="button" onClick={() => setRetry(retry + 1)}>
            Retry availability and price
          </button>
        </div>
      ) : null}
      {quote ? (
        <section className={css.review} aria-label="Booking price review">
          <h3>Review your booking</h3>
          {needsCombined ? <p role="alert" className={css.error}>
            These dates meet the minimum together and need one combined checkout. Combined checkout
            is currently unavailable; please try again later.
          </p> : null}
          {quote.groups.length > 1 && !needsCombined ? (
            <p className={css.hint}>
              {combined
                ? 'All selected sessions will be included in one payment and one host confirmation.'
                : 'Each session or group of consecutive days has a separate checkout, payment and host confirmation.'}
            </p>
          ) : null}
          {quote.groups.map((group, index) => (
            <div key={group.day} className={css.group}>
              <h4>
                {moment.utc(group.day).format('ddd D MMM')}
                {group.lastDay && group.lastDay !== group.day
                  ? ` – ${moment.utc(group.lastDay).format('ddd D MMM')}`
                  : ''}
              </h4>
              {unit === 'hourly' ? (
                <p className={css.hint}>
                  {moment(group.start)
                    .tz(quote.schedule.timeZone)
                    .format('HH:mm')}
                  –
                  {moment(group.end)
                    .tz(quote.schedule.timeZone)
                    .format('HH:mm')}{' '}
                  · {quote.schedule.timeZone.replace(/_/g, ' ')}
                </p>
              ) : (
                <p className={css.hint}>
                  {(group.end - group.start) / 86400000} day
                  {group.end - group.start === 86400000 ? '' : 's'}
                </p>
              )}
              <dl>
                {group.items.map((item, itemIndex) => (
                  <div className={css.priceRow} key={`${item.code}-${itemIndex}`}>
                    <dt>{itemLabel(item.code)}</dt>
                    <dd>{money(item.lineTotal.amount, group.currency)}</dd>
                  </div>
                ))}
                <div className={css.total}>
                  <dt>Total</dt>
                  <dd>{money(group.total, group.currency)}</dd>
                </div>
              </dl>
              {!combined && !needsCombined ? <button
                className={css.continue}
                type="button"
                disabled={checking || !!validation || disabled}
                onClick={() => review(group)}
              >
                {quote.groups.length > 1
                  ? `Continue to checkout ${index + 1}`
                  : 'Continue to checkout'}
              </button> : null}
            </div>
          ))}
          {combined ? <div className={css.group}>
            <dl><div className={css.total}><dt>Total for all sessions</dt>
              <dd>{money(quote.groups.reduce((sum, g) => sum + g.total, 0), quote.groups[0].currency)}</dd>
            </div></dl>
            <button className={css.continue} type="button"
              disabled={checking || !!validation || disabled}
              onClick={() => review(quote.groups[quote.groups.length - 1], true)}>
              Continue to checkout
            </button>
          </div> : null}
          <p className={css.hint}>Availability and price are confirmed again at checkout.</p>
        </section>
      ) : !schedule.days.length ? (
        <p className={css.hint}>Select dates to see availability and the price before checkout.</p>
      ) : null}
    </section>
  );
};

export default connect(null, dispatch => ({
  onCombinedReady: combinedBookingEnabled,
  onCheckSchedule: (listing, schedule, promocode, active) =>
    dispatch((dispatch, getState, sdk) =>
      quoteListingSchedule(sdk, listing, schedule, promocode, active)
    ),
}))(BookingScheduleFormComponent);
