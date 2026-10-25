import React, { useState } from 'react';
import moment from 'moment-timezone';
import {
  MAX_SCHEDULE_DATES,
  validScheduleDate,
  normaliseSchedule,
  scheduleSummary,
} from '../../util/bookingSchedule';
import SearchTimeFields from '../SearchTimeFields/SearchTimeFields';
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
  const today = moment.utc().startOf('day');
  const lastDay = today.clone().add(365, 'days');
  const current = moment.utc(month);
  const update = next => {
    setSelectionError(null);
    onChange(next);
  };
  const choose = day => {
    if (mode === 'range' && anchor) {
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
      setAnchor(day);
      update({ ...schedule, days: [day] });
    } else {
      const days = schedule.days.includes(day)
        ? schedule.days.filter(date => date !== day)
        : schedule.days.concat(day).sort();
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
      {showUnits ? <fieldset className={css.units}>
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
      </fieldset> : null}
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
                  disabled={day.isBefore(today, 'day') || day.isAfter(lastDay, 'day')}
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
                ? 'Now choose the last day.'
                : 'Choose the first and last day.'
              : 'Choose any dates, including non-consecutive days.'}
          </p>
        </div>
        <div>
          {schedule.unit === 'hourly' ? (
            <>
              <SearchTimeFields
                idPrefix={idPrefix}
                value={{
                  startTime: schedule.start,
                  endTime: schedule.end,
                  timeZone: schedule.timeZone,
                }}
                onChange={times =>
                  update({
                    ...schedule,
                    start: times.startTime,
                    end: times.endTime,
                    timeZone: times.timeZone,
                  })
                }
              />
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
                Each selected date is one booking day. Availability and minimum booking lengths are
                checked for each space.
              </p>
            </>
          )}
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
                        aria-label={`${key === 'start' ? 'From' : 'To'} time on ${day}`}
                        value={times[key]}
                        onInput={event =>
                          update({
                            ...schedule,
                            overrides: {
                              ...schedule.overrides,
                              [day]: {
                                start: times.start,
                                end: times.end,
                                [key]: event.target.value,
                              },
                            },
                          })
                        }
                        onChange={event =>
                          update({
                            ...schedule,
                            overrides: {
                              ...schedule.overrides,
                              [day]: {
                                start: times.start,
                                end: times.end,
                                [key]: event.target.value,
                              },
                            },
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        {!schedule.days.length ? (
          <p className={css.hint}>{required ? 'Choose your booking dates.' : 'Dates are optional. Select dates to check your schedule.'}</p>
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
        Each space’s minimum is checked for every session or consecutive group of days.
      </p>
    </section>
  );
};

export default BookingSchedulePicker;
