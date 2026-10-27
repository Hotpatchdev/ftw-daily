import moment from 'moment-timezone';
import {
  validScheduleTime,
  scheduleInstant,
  dateGroups,
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
  const count = minimumDayCount(rule);
  if (count > MAX_SCHEDULE_DATES)
    throw new Error('The host’s minimum exceeds the supported 31-date selection.');
  const proposed = Array.from(new Set([...days, day])).sort();
  const group = dateGroups(proposed).find(dates => dates.includes(day));
  if (group.length >= count) return proposed;
  const start = group[0];
  const extended = Array.from(
    new Set([
      ...proposed,
      ...Array.from({ length: count }, (_, i) =>
        moment
          .utc(start)
          .add(i, 'days')
          .format('YYYY-MM-DD')
      ),
    ])
  ).sort();
  if (
    extended.length > MAX_SCHEDULE_DATES ||
    moment.utc(extended[extended.length - 1]).diff(moment.utc(extended[0]), 'days') > 83
  )
    throw new Error(
      'The host’s minimum does not fit within this selection. Choose another start date.'
    );
  return extended;
};
