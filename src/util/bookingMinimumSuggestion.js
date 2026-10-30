import moment from 'moment-timezone';
import {
  validScheduleTime,
  validScheduleDate,
  scheduleInstant,
  MAX_SCHEDULE_DATES,
} from './bookingSchedule';

// Match the existing five-minute time inputs; never round a host minimum down.
export const minimumFinishTime = (start, rule, days = [], timeZone = 'Europe/London') => {
  if (!rule || !validScheduleTime(start)) return null;
  const minutes = Math.ceil((rule.hours * 60) / 5) * 5;
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  const wall = Number(start.slice(0, 2)) * 60 + Number(start.slice(3));
  if (!days.length) {
    const end = wall + minutes;
    return end < 1440
      ? `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
      : null;
  }
  try {
    const finishes = days.map(day => {
      const finish = moment(scheduleInstant(day, start, timeZone)).add(minutes, 'minutes');
      const local = finish.clone().tz(timeZone);
      if (local.format('YYYY-MM-DD') !== day) throw new Error('Minimum crosses midnight');
      const clock = local.format('HH:mm');
      if (scheduleInstant(day, clock, timeZone).getTime() !== finish.valueOf())
        throw new Error('Ambiguous finish');
      return clock;
    });
    // Shared hours must satisfy every selected date, including clock changes.
    const end = finishes.sort().slice(-1)[0];
    if (
      days.some(
        day =>
          (scheduleInstant(day, end, timeZone) - scheduleInstant(day, start, timeZone)) / 60000 <
          minutes
      )
    )
      return null;
    return end;
  } catch (e) {
    return null;
  }
};

export const minimumDayCount = rule => (rule ? Math.max(1, Math.ceil(rule.hours / 24)) : 1);

export const minimumDateSelection = (days, day, rule) => {
  if (!validScheduleDate(day) || days.some(date => !validScheduleDate(date)))
    throw new Error('Choose valid booking dates.');
  const count = minimumDayCount(rule);
  if (count > MAX_SCHEDULE_DATES)
    throw new Error('The host’s minimum exceeds the supported 31-date selection.');
  const proposed = Array.from(new Set([...days, day])).sort();
  const selected = new Set(proposed);
  let next = moment.utc(day);
  while (selected.size < count) {
    selected.add(next.format('YYYY-MM-DD'));
    next.add(1, 'day');
  }
  const extended = Array.from(selected).sort();
  if (
    extended.length > MAX_SCHEDULE_DATES ||
    moment.utc(extended[extended.length - 1]).diff(moment.utc(extended[0]), 'days') > 83
  )
    throw new Error(
      'The host’s minimum does not fit within this selection. Choose another start date.'
    );
  return extended;
};
