import React, { useState } from 'react';
import moment from 'moment-timezone';
import {
  MAX_SCHEDULE_DATES,
  validScheduleDate,
  normaliseSchedule,
  scheduleSummary,
  dateGroups,
} from '../../util/bookingSchedule';
import SearchTimeFields from '../SearchTimeFields/SearchTimeFields';
import {
  minimumFinishTime,
  minimumDayCount,
  minimumDateSelection,
} from '../../util/bookingMinimumSuggestion';
import css from './BookingSchedulePicker.module.css';

export const emptySchedule = () => ({
  unit: 'hourly',
  days: [],
  same: true,
  start: '09:00',
  end: '15:00',
  timeZone: 'Europe/London',
  overrides: {},
});
export const scheduleDraft = params => {
  if (params.schedule) {
    try {
      return { ...emptySchedule(), ...normaliseSchedule(params.schedule) };
    } catch (e) {
      return emptySchedule();
    }
  }
  const dates = typeof params.dates === 'string' ? params.dates.split(',') : [];
  if (dates.length === 2 && dates.every(validScheduleDate) && dates[0] <= dates[1]) {
    const length = (Date.parse(dates[1]) - Date.parse(dates[0])) / 86400000 + 1;
    if (length <= MAX_SCHEDULE_DATES)
      return {
        ...emptySchedule(),
        unit: 'daily',
        days: Array.from({ length }, (_, i) =>
          moment
            .utc(dates[0])
            .add(i, 'days')
            .format('YYYY-MM-DD')
        ),
      };
  }
  return emptySchedule();
};

const BookingSchedulePicker = ({
  value,
  onChange,
  compact = false,
  idPrefix = 'booking-schedule',
  showUnits = true,
  required = false,
  minimum = null,
  initiallySuggested = false,
}) => {
  const schedule = { ...emptySchedule(), ...value };
  const [month, setMonth] = useState(() =>
    moment
      .utc(schedule.days[0] || new Date())
      .startOf('month')
      .format('YYYY-MM-DD')
  );
  const [mode, setMode] = useState('selected');
  const [anchor, setAnchor] = useState(null);
  const [selectionError, setSelectionError] = useState(null);
  const [finishSuggested, setFinishSuggested] = useState(initiallySuggested);
  const [suggestedLastDay, setSuggestedLastDay] = useState(null);
  const today = moment.utc().startOf('day');
  const lastDay = today.clone().add(365, 'days');
  const current = moment.utc(month);
  const update = next => {
    setSelectionError(null);
    if (next.days.length < schedule.days.length) setSuggestedLastDay(null);
    const finish =
      next.unit === 'hourly' && finishSuggested
        ? minimumFinishTime(next.start, minimum, next.days, next.timeZone)
        : null;
    onChange(finish ? { ...next, end: finish } : next);
  };
  const dailyMinimum = minimumDayCount(minimum);
  const earliestLastDay =
    anchor && schedule.unit === 'daily' && minimum
      ? moment
          .utc(anchor)
          .add(dailyMinimum - 1, 'days')
          .format('YYYY-MM-DD')
      : null;
  const finishHint = minimumFinishTime(schedule.start, minimum, schedule.days, schedule.timeZone);
  const choose = day => {
    setSuggestedLastDay(null);
    if (mode === 'range' && anchor) {
      if (earliestLastDay && day < earliestLastDay) return;
      const first = day < anchor ? day : anchor,
        last = day < anchor ? anchor : day;
      const count = moment.utc(last).diff(moment.utc(first), 'days') + 1;
      if (count > MAX_SCHEDULE_DATES) {
        setSelectionError('Select up to 31 dates per search.');
        return;
      }
      update({
        ...schedule,
        days: Array.from({ length: count }, (_, i) =>
          moment
            .utc(first)
            .add(i, 'days')
            .format('YYYY-MM-DD')
        ),
      });
      setAnchor(null);
    } else if (mode === 'range') {
      let days = [day];
      if (schedule.unit === 'daily' && minimum) {
        try {
          days = minimumDateSelection([], day, minimum);
        } catch (e) {
          setSelectionError(e.message);
          return;
        }
        if (moment.utc(days[days.length - 1]).isAfter(lastDay, 'day')) {
          setSelectionError(
            'The host’s minimum extends beyond the booking window. Choose an earlier date.'
          );
          return;
        }
        setSuggestedLastDay(days[days.length - 1]);
      }
      setAnchor(day);
      update({ ...schedule, days });
    } else {
      let days = schedule.days.includes(day)
        ? schedule.days.filter(date => date !== day)
        : schedule.days.concat(day).sort();
      if (schedule.unit === 'daily' && minimum && !schedule.days.includes(day)) {
        try {
          const suggested = minimumDateSelection(schedule.days, day, minimum);
          if (moment.utc(suggested[suggested.length - 1]).isAfter(lastDay, 'day'))
            throw new Error(
              'The host’s minimum extends beyond the booking window. Choose an earlier date.'
            );
          if (suggested.length > days.length)
            setSuggestedLastDay(
              dateGroups(suggested)
                .find(group => group.includes(day))
                .slice(-1)[0]
            );
          days = suggested;
        } catch (e) {
          setSelectionError(e.message);
          return;
        }
      }
      if (
        days.length > MAX_SCHEDULE_DATES ||
        (days.length && moment.utc(days[days.length - 1]).diff(moment.utc(days[0]), 'days') > 83)
      ) {
        setSelectionError('Select up to 31 dates within a 12-week window.');
        return;
      }
      update({ ...schedule, days });
    }
  };
  const editSession = (day, key, value, times) => {
    const edited = { start: times.start, end: times.end, [key]: value };
    if (key === 'start' && minimum) {
      const previous = minimumFinishTime(times.start, minimum, [day], schedule.timeZone);
      const finish = minimumFinishTime(value, minimum, [day], schedule.timeZone);
      if (finish && (times.end === previous || !times.end || times.end < finish))
        edited.end = finish;
    }
    update({ ...schedule, overrides: { ...schedule.overrides, [day]: edited } });
  };
  let error = selectionError;
  if (!error && schedule.days.length) {
    try {
      normaliseSchedule(schedule);
    } catch (e) {
      error = e.message;
    }
  }
  return (
    <section
      className={`${css.root} ${compact ? css.compact : ''}`}
      aria-label="Booking dates and times"
    >
      {showUnits ? (
        <fieldset className={css.units}>
          <legend>Book by</legend>
          <div className={css.switch}>
            {['hourly', 'daily'].map(unit => (
              <button
                key={unit}
                type="button"
                aria-pressed={schedule.unit === unit}
                onClick={() => update({ ...schedule, unit })}
              >
                {unit === 'hourly' ? 'The hour' : 'The day'}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}
      <div className={css.columns}>
        <div>
          <div className={css.switch}>
            {[
              ['range', 'Date range'],
              ['selected', 'Select dates'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={mode === key}
                onClick={() => {
                  setMode(key);
                  setAnchor(null);
                  setSuggestedLastDay(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={css.month}>
            <button
              type="button"
              aria-label="Previous month"
              disabled={current.isSameOrBefore(today, 'month')}
              onClick={() =>
                setMonth(
                  current
                    .clone()
                    .subtract(1, 'month')
                    .format('YYYY-MM-DD')
                )
              }
            >
              ‹
            </button>
            <h3>{current.format('MMMM YYYY')}</h3>
            <button
              type="button"
              aria-label="Next month"
              disabled={current.isSameOrAfter(lastDay, 'month')}
              onClick={() =>
                setMonth(
                  current
                    .clone()
                    .add(1, 'month')
                    .format('YYYY-MM-DD')
                )
              }
            >
              ›
            </button>
          </div>
          <div className={css.week} aria-hidden="true">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => (
              <span key={i}>{label}</span>
            ))}
          </div>
          <div className={css.days} role="group" aria-label={current.format('MMMM YYYY')}>
            {Array.from({ length: (current.day() + 6) % 7 }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {Array.from({ length: current.daysInMonth() }, (_, i) => {
              const day = current.clone().date(i + 1),
                iso = day.format('YYYY-MM-DD');
              return (
                <button
                  key={iso}
                  type="button"
                  aria-label={day.format('dddd D MMMM YYYY')}
                  aria-pressed={schedule.days.includes(iso)}
                  disabled={
                    day.isBefore(today, 'day') ||
                    day.isAfter(lastDay, 'day') ||
                    !!(earliestLastDay && iso < earliestLastDay)
                  }
                  onClick={() => choose(iso)}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <p className={css.hint}>
            {mode === 'range'
              ? anchor
                ? earliestLastDay
                  ? `Earliest last day: ${moment
                      .utc(earliestLastDay)
                      .format('ddd D MMM')}. Choose this day or a later finish.`
                  : 'Now choose the last day.'
                : 'Choose the first and last day.'
              : 'Choose any dates, including non-consecutive days.'}
          </p>
        </div>
        <div>
          {schedule.unit === 'hourly' ? (
            <>
              <SearchTimeFields
                idPrefix={idPrefix}
                minimumEndTime={finishHint}
                value={{
                  startTime: schedule.start,
                  endTime: schedule.end,
                  timeZone: schedule.timeZone,
                }}
                onChange={times => {
                  const startChanged =
                    times.startTime !== schedule.start || times.timeZone !== schedule.timeZone;
                  const endChanged = times.endTime !== schedule.end;
                  const finish = minimumFinishTime(
                    times.startTime,
                    minimum,
                    schedule.days,
                    times.timeZone
                  );
                  const suggest =
                    !!finish &&
                    startChanged &&
                    !endChanged &&
                    (finishSuggested || !times.endTime || times.endTime < finish);
                  if (endChanged || suggest) setFinishSuggested(suggest);
                  // Commit an explicit end directly so a previous suggestion cannot overwrite it.
                  setSelectionError(null);
                  onChange({
                    ...schedule,
                    start: times.startTime,
                    end: suggest ? finish : times.endTime,
                    timeZone: times.timeZone,
                  });
                }}
              />
              {minimum ? (
                <p className={css.suggestion} aria-live="polite">
                  {finishHint
                    ? `Earliest finish: ${finishHint}.${
                        finishSuggested ? ' Suggested for you; extend it if needed.' : ''
                      }`
                    : 'This minimum cannot be suggested within the same day. Choose an earlier start or different dates.'}
                </p>
              ) : null}
              <label className={css.same}>
                <input
                  type="checkbox"
                  checked={schedule.same !== false}
                  onChange={event =>
                    update({
                      ...schedule,
                      same: event.target.checked,
                      overrides: event.target.checked
                        ? {}
                        : Object.fromEntries(
                            schedule.days.map(day => [
                              day,
                              { start: schedule.start, end: schedule.end },
                            ])
                          ),
                    })
                  }
                />
                Same hours on every selected day
              </label>
            </>
          ) : (
            <>
              <h3>Daily booking</h3>
              <p className={css.hint}>
                Each selected date is one booking day. The minimum counts all selected days in
                this checkout, including days separated by gaps.
              </p>
            </>
          )}
          {schedule.unit === 'daily' && suggestedLastDay ? (
            <p className={css.suggestion} aria-live="polite">
              Suggested through {moment.utc(suggestedLastDay).format('ddd D MMM')} to meet the{' '}
              {dailyMinimum}-day total minimum. The last day is included; you can extend your selection.
            </p>
          ) : null}
        </div>
      </div>
      <div className={css.sessions} aria-label="Selected sessions">
        <div className={css.sessionHeader}>
          <h3>Your schedule</h3>
          <button
            type="button"
            onClick={() => {
              setAnchor(null);
              update({ ...schedule, days: [], overrides: {} });
              setSuggestedLastDay(null);
            }}
          >
            Clear dates
          </button>
        </div>
        {schedule.days.map(day => {
          const times =
            schedule.same !== false ? schedule : (schedule.overrides || {})[day] || schedule;
          return (
            <div className={css.session} key={day}>
              <span>{moment.utc(day).format('ddd D MMM')}</span>
              <span>
                {schedule.unit === 'daily' ? 'Daily booking' : `${times.start}–${times.end}`}
              </span>
              <button
                type="button"
                aria-label={`Remove ${day}`}
                onClick={() =>
                  update({ ...schedule, days: schedule.days.filter(date => date !== day) })
                }
              >
                ×
              </button>
              {schedule.unit === 'hourly' && schedule.same === false ? (
                <div className={css.customTimes}>
                  {['start', 'end'].map(key => (
                    <label key={key}>
                      {key === 'start' ? 'From' : 'To'}
                      <input
                        type="time"
                        step="300"
                        min={
                          key === 'end'
                            ? minimumFinishTime(times.start, minimum, [day], schedule.timeZone) ||
                              undefined
                            : undefined
                        }
                        aria-label={`${key === 'start' ? 'From' : 'To'} time on ${day}`}
                        value={times[key]}
                        onInput={event => editSession(day, key, event.target.value, times)}
                        onChange={event => editSession(day, key, event.target.value, times)}
                      />
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        {!schedule.days.length ? (
          <p className={css.hint}>
            {required
              ? 'Choose your booking dates.'
              : 'Dates are optional. Select dates to check your schedule.'}
          </p>
        ) : null}
      </div>
      {error ? (
        <p className={css.error} role="alert">
          {error}
        </p>
      ) : null}
      <p className={css.total} aria-live="polite">
        {schedule.days.length && !error ? scheduleSummary(schedule) : ''}
      </p>
      <p className={css.hint}>
        {schedule.unit === 'daily'
          ? 'The daily minimum counts all booked days together. Unselected days are not booked or charged.'
          : 'The hourly minimum is checked separately for each session.'}
      </p>
    </section>
  );
};

export default BookingSchedulePicker;
