import React from 'react';
import moment from 'moment-timezone';
import css from './SearchTimeFields.module.css';

export const quickTimes = [
  { label: 'Morning (8am – 12pm)', start: '08:00', end: '12:00' },
  { label: 'Afternoon (1pm – 5pm)', start: '13:00', end: '17:00' },
  { label: 'Evening (6pm – 10pm)', start: '18:00', end: '22:00' },
  { label: 'Working Day (9am – 5pm)', start: '09:00', end: '17:00' },
];

// Controlled fields are shared by the homepage and the search filter draft.
const SearchTimeFields = ({ value, onChange, idPrefix, minimumEndTime }) => {
  const { startTime = '', endTime = '', timeZone = 'Europe/London' } = value;
  return (
    <section className={css.root} aria-labelledby={`${idPrefix}-title`}>
      <h3 id={`${idPrefix}-title`}>What time works?</h3>
      <div className={css.fields}>
        <label>
          From time
          <input
            type="time"
            value={startTime}
            step="300"
            onInput={event => onChange({ ...value, startTime: event.target.value })}
            onChange={event => onChange({ ...value, startTime: event.target.value })}
          />
        </label>
        <label>
          To time
          <input
            type="time"
            value={endTime}
            min={minimumEndTime || undefined}
            step="300"
            onInput={event => onChange({ ...value, endTime: event.target.value })}
            onChange={event => onChange({ ...value, endTime: event.target.value })}
          />
        </label>
      </div>
      <p className={css.label}>Quick select duration</p>
      <div className={css.choices}>
        {quickTimes.map(option => (
          <button
            key={option.start}
            type="button"
            aria-pressed={startTime === option.start && endTime === option.end}
            onClick={() => onChange({ ...value, startTime: option.start, endTime: option.end })}
          >
            {option.label}
          </button>
        ))}
      </div>
      <label className={css.zone}>
        Time zone
        <select
          value={timeZone}
          onChange={event => onChange({ ...value, timeZone: event.target.value })}
        >
          {moment.tz.names().map(zone => (
            <option key={zone} value={zone}>
              {zone.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </label>
      <button
        className={css.reset}
        type="button"
        onClick={() => onChange({ ...value, startTime: '', endTime: '' })}
      >
        Reset times
      </button>
    </section>
  );
};

export default SearchTimeFields;
