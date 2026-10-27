const moment = require('moment-timezone');
const { readListingMinimum } = require('./bookingMinimum');

const MAX_SCHEDULE_DATES = 31;
const validScheduleDate = value =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
const validScheduleTime = value =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

// Reject missing/repeated local clock times instead of silently shifting them
// when the selected zone enters or leaves daylight-saving time.
const scheduleInstant = (date, time, timeZone) => {
  if (!validScheduleDate(date) || !validScheduleTime(time) || !moment.tz.zone(timeZone))
    throw new Error('Choose valid dates, times and a time zone.');
  const wall = Date.parse(`${date}T${time}:00Z`);
  const zone = moment.tz.zone(timeZone);
  const offsets = Array.from(
    new Set([-36, 0, 36].map(hours => zone.utcOffset(wall + hours * 3600000)))
  );
  const candidates = offsets
    .map(offset => wall + offset * 60000)
    .filter(
      stamp =>
        moment(stamp)
          .tz(timeZone)
          .format('YYYY-MM-DD HH:mm:ss') === `${date} ${time}:00`
    );
  if (candidates.length !== 1)
    throw new Error(
      'A selected time is missing or occurs twice because the clocks change. Choose another time.'
    );
  return new Date(candidates[0]);
};

const normaliseSchedule = value => {
  let data;
  try {
    data = typeof value === 'string' ? JSON.parse(value) : value;
  } catch (e) {
    throw new Error('The selected schedule is invalid. Choose your dates again.');
  }
  if (
    !data ||
    !['hourly', 'daily'].includes(data.unit) ||
    !Array.isArray(data.days) ||
    data.days.length < 1 ||
    data.days.length > MAX_SCHEDULE_DATES ||
    data.days.some(day => !validScheduleDate(day)) ||
    new Set(data.days).size !== data.days.length
  )
    throw new Error('Choose between 1 and 31 valid booking dates.');
  const days = data.days.slice().sort();
  if ((Date.parse(days[days.length - 1]) - Date.parse(days[0])) / 86400000 > 83)
    throw new Error('Keep the selected dates within a 12-week window.');
  const schedule = { unit: data.unit, days };
  if (data.unit === 'hourly') {
    if (!moment.tz.zone(data.timeZone)) throw new Error('Choose a valid time zone.');
    const same = data.same !== false;
    schedule.same = same;
    schedule.timeZone = data.timeZone;
    schedule.start = data.start;
    schedule.end = data.end;
    if (!validScheduleTime(data.start) || !validScheduleTime(data.end) || data.end <= data.start)
      throw new Error('Choose an end time later than the start time.');
    if (!same) schedule.overrides = {};
    days.forEach(day => {
      const times = same ? data : (data.overrides || {})[day] || data;
      if (
        !validScheduleTime(times.start) ||
        !validScheduleTime(times.end) ||
        times.end <= times.start
      )
        throw new Error(`Choose valid start and end times for ${day}.`);
      scheduleInstant(day, times.start, data.timeZone);
      scheduleInstant(day, times.end, data.timeZone);
      if (!same) schedule.overrides[day] = { start: times.start, end: times.end };
    });
  }
  return schedule;
};

const scheduleIntervals = value => {
  const schedule = normaliseSchedule(value);
  return schedule.days.map(day => {
    if (schedule.unit === 'daily') {
      const start = new Date(`${day}T00:00:00Z`);
      return { day, start, end: new Date(start.getTime() + 86400000) };
    }
    const times = schedule.same ? schedule : schedule.overrides[day];
    return {
      day,
      start: scheduleInstant(day, times.start, schedule.timeZone),
      end: scheduleInstant(day, times.end, schedule.timeZone),
    };
  });
};

const dateGroups = days =>
  days.reduce((groups, day) => {
    const last = groups[groups.length - 1];
    if (last && Date.parse(day) - Date.parse(last[last.length - 1]) === 86400000) last.push(day);
    else groups.push([day]);
    return groups;
  }, []);

const listingMinimum = readListingMinimum;
const minimumBookingLabel = listing => {
  try {
    const rule = listingMinimum(listing);
    return rule
      ? `Minimum booking: ${rule.count} ${rule.count === 1 ? rule.unit.slice(0, -1) : rule.unit}`
      : '';
  } catch (e) {
    return 'Minimum booking: check with the host';
  }
};

const meetsListingMinimum = (listing, value) => {
  const schedule = normaliseSchedule(value);
  let rule;
  try {
    rule = listingMinimum(listing);
  } catch (e) {
    return false;
  }
  if (!rule) return true;
  if (schedule.unit === 'hourly')
    return scheduleIntervals(schedule).every(
      interval => (interval.end - interval.start) / 3600000 >= rule.hours
    );
  return dateGroups(schedule.days).every(group => group.length * 24 >= rule.hours);
};

const scheduleSummary = value => {
  try {
    const schedule = normaliseSchedule(value);
    if (schedule.unit === 'daily')
      return `${schedule.days.length} ${schedule.days.length === 1 ? 'day' : 'days'}`;
    const hours = scheduleIntervals(schedule).reduce(
      (total, interval) => total + (interval.end - interval.start) / 3600000,
      0
    );
    return `${schedule.days.length} ${
      schedule.days.length === 1 ? 'session' : 'sessions'
    } · ${Number(hours.toFixed(2))} hours`;
  } catch (e) {
    return 'Choose dates and times';
  }
};

const slotsCoverSchedule = (slots, value) => {
  const available = slots
    .map(slot => slot.attributes || {})
    .filter(slot => slot.seats > 0)
    .map(slot => ({ start: new Date(slot.start).getTime(), end: new Date(slot.end).getTime() }))
    .filter(
      slot => Number.isFinite(slot.start) && Number.isFinite(slot.end) && slot.end > slot.start
    )
    .sort((a, b) => a.start - b.start);
  return scheduleIntervals(value).every(interval => {
    let cursor = interval.start.getTime();
    for (const slot of available) {
      if (slot.end <= cursor) continue;
      if (slot.start > cursor) return false;
      cursor = Math.max(cursor, slot.end);
      if (cursor >= interval.end.getTime()) return true;
    }
    return false;
  });
};

const scheduleBookingGroups = value => {
  const schedule = normaliseSchedule(value);
  if (schedule.unit === 'hourly') return scheduleIntervals(schedule);
  return dateGroups(schedule.days).map(group => ({
    day: group[0], lastDay: group[group.length - 1],
    start: new Date(`${group[0]}T00:00:00Z`),
    end: new Date(Date.parse(`${group[group.length - 1]}T00:00:00Z`) + 86400000),
  }));
};

// Use the same schedule validation in the browser and trusted server pricing.
module.exports = {
  MAX_SCHEDULE_DATES,
  validScheduleDate,
  validScheduleTime,
  scheduleInstant,
  normaliseSchedule,
  scheduleIntervals,
  dateGroups,
  listingMinimum,
  minimumBookingLabel,
  meetsListingMinimum,
  scheduleSummary,
  slotsCoverSchedule,
  scheduleBookingGroups,
};
