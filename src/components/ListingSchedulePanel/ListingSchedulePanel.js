import React from 'react';
import moment from 'moment-timezone';
import { NamedLink } from '../../components';
import config from '../../config';
import {
  normaliseSchedule,
  scheduleIntervals,
  dateGroups,
  meetsListingMinimum,
  minimumBookingLabel,
  scheduleSummary,
} from '../../util/bookingSchedule';
import { parse, stringify } from '../../util/urlHelpers';
import css from './ListingSchedulePanel.module.css';

export const scheduleBookingGroups = value => {
  const schedule = normaliseSchedule(value);
  if (schedule.unit === 'hourly') return scheduleIntervals(schedule);
  return dateGroups(schedule.days).map(group => ({
    day: group[0],
    lastDay: group[group.length - 1],
    start: new Date(`${group[0]}T00:00:00Z`),
    end: new Date(Date.parse(`${group[group.length - 1]}T00:00:00Z`) + 86400000),
  }));
};

const ListingSchedulePanel = ({ listing, value, onReview, disabled, searchReturnTo }) => {
  let schedule;
  try {
    schedule = normaliseSchedule(value);
  } catch (e) {
    return (
      <section className={css.root}>
        <p role="alert">{e.message}</p>
        <NamedLink name="SearchPage">Choose your schedule</NamedLink>
      </section>
    );
  }
  const groups = scheduleBookingGroups(schedule);
  const attributes = listing.attributes || {};
  const price =
    schedule.unit === 'daily' ? (attributes.publicData || {}).pricePerDay : attributes.price;
  const hasPrice =
    price &&
    Number.isSafeInteger(price.amount) &&
    price.amount > 0 &&
    [config.currency, config.additionalCurrency].includes(price.currency);
  const eligible = meetsListingMinimum(listing, schedule);
  const canReview = !disabled && eligible && hasPrice;
  return (
    <section className={css.root} aria-label="Your selected booking schedule">
      <h2>Your schedule</h2>
      <p>{scheduleSummary(schedule)}</p>
      {schedule.unit === 'hourly' ? (
        <p className={css.hint}>{schedule.timeZone.replace(/_/g, ' ')}</p>
      ) : null}
      {minimumBookingLabel(listing) ? (
        <p className={css.minimum}>{minimumBookingLabel(listing)}</p>
      ) : null}
      {!eligible ? (
        <p className={css.error} role="alert">
          This schedule does not meet the host’s minimum. Update your dates or hours before booking.
        </p>
      ) : null}
      {!hasPrice ? (
        <p className={css.error}>
          This space does not offer a supported rate for the selected booking unit.
        </p>
      ) : null}
      {groups.length > 1 ? (
        <p className={css.hint}>
          Each session or date group has its own checkout, payment and host confirmation.
        </p>
      ) : null}
      {groups.map((group, index) => {
        const times = schedule.same ? schedule : (schedule.overrides || {})[group.day] || schedule;
        return (
          <div className={css.group} key={group.day}>
            <h3>
              {moment.utc(group.day).format('ddd D MMM')}
              {group.lastDay && group.lastDay !== group.day
                ? ` – ${moment.utc(group.lastDay).format('ddd D MMM')}`
                : ''}
            </h3>
            <p>
              {schedule.unit === 'hourly'
                ? `${times.start}–${times.end}`
                : `${(group.end - group.start) / 86400000} daily booking units`}
            </p>
            <button
              type="button"
              disabled={!canReview}
              onClick={() => onReview(schedule.unit, group)}
            >
              {groups.length > 1 ? `Review booking ${index + 1}` : 'Review booking'}
            </button>
          </div>
        );
      })}
      <p className={css.hint}>Availability and the full price are confirmed again at checkout.</p>
      <NamedLink
        name="SearchPage"
        to={{
          search: `?${stringify({
            ...parse((searchReturnTo || {}).search || ''),
            page: undefined,
            schedule: JSON.stringify(schedule),
          })}`,
        }}
      >
        Edit dates and times
      </NamedLink>
    </section>
  );
};

export default ListingSchedulePanel;
