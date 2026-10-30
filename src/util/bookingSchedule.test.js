import { normaliseSchedule, scheduleInstant, scheduleIntervals, meetsListingMinimum, slotsCoverSchedule, minimumBookingLabel } from './bookingSchedule';

const schedule = { unit: 'hourly', days: ['2027-02-01', '2027-02-03'], start: '09:00', end: '15:00', same: true, timeZone: 'Europe/London' };
const listing = (type, count) => ({ attributes: { publicData: { minBooking: { minBookingType: type, minBookingCount: count } } } });
const slot = (start, end, seats = 1) => ({ attributes: { start: new Date(start), end: new Date(end), seats } });

it('keeps non-consecutive sessions distinct and uses their selected time zone', () => {
  const value = { ...schedule, timeZone: 'America/New_York', same: false, overrides: { '2027-02-03': { start: '10:00', end: '16:00' } } };
  expect(scheduleIntervals(value).map(v => [v.start.toISOString(), v.end.toISOString()])).toEqual([
    ['2027-02-01T14:00:00.000Z', '2027-02-01T20:00:00.000Z'],
    ['2027-02-03T15:00:00.000Z', '2027-02-03T21:00:00.000Z'],
  ]);
});

it('rejects invalid, repeated, oversized and too widely spaced dates', () => {
  [[], ['2027-02-30'], ['2027-02-01', '2027-02-01'], ['2027-02-01', '2027-06-01']].forEach(days => expect(() => normaliseSchedule({ ...schedule, days })).toThrow());
  expect(() => normaliseSchedule('{bad')).toThrow();
  expect(() => normaliseSchedule({ ...schedule, end: '08:00' })).toThrow();
  expect(() => normaliseSchedule({ ...schedule, timeZone: 'Invalid/Zone' })).toThrow();
});

it('rejects missing and repeated clock times at daylight-saving boundaries', () => {
  expect(() => scheduleInstant('2027-03-28', '01:30', 'Europe/London')).toThrow('clocks change');
  expect(() => scheduleInstant('2027-10-31', '01:30', 'Europe/London')).toThrow('clocks change');
  expect(scheduleInstant('2027-03-28', '09:00', 'Europe/London').toISOString()).toBe('2027-03-28T08:00:00.000Z');
});

it('checks the trusted listing minimum against each hourly session', () => {
  expect(meetsListingMinimum(listing('hourlyMinBooking', '5'), schedule)).toBe(true);
  expect(meetsListingMinimum(listing('hourlyMinBooking', 5), { ...schedule, end: '11:00' })).toBe(false);
  expect(meetsListingMinimum(listing('hourlyMinBooking', 5), { ...schedule, same: false, overrides: { '2027-02-03': { start: '09:00', end: '13:00' } } })).toBe(false);
  expect(minimumBookingLabel(listing('hourlyMinBooking', 5))).toBe('Minimum booking: 5 hours');
  expect(meetsListingMinimum(listing('unknown', 5), schedule)).toBe(false);
});

it('counts daily minimums across all booked dates and retains UTC booking-day boundaries', () => {
  const daily = { unit: 'daily', days: ['2027-02-01', '2027-02-02', '2027-02-04', '2027-02-05'] };
  expect(meetsListingMinimum(listing('dailyMinBooking', 2), daily)).toBe(true);
  expect(meetsListingMinimum(listing('dailyMinBooking', 3), daily)).toBe(true);
  expect(meetsListingMinimum(listing('dailyMinBooking', 5), daily)).toBe(false);
  expect(scheduleIntervals(daily)[0]).toMatchObject({ start: new Date('2027-02-01T00:00:00Z'), end: new Date('2027-02-02T00:00:00Z') });
});

it('accepts the cricket minimum plus two separated days without counting the gap', () => {
  const days = Array.from({length:15},(_,i)=>`2027-02-${String(i+1).padStart(2,'0')}`);
  expect(meetsListingMinimum(listing('dailyMinBooking',15),{unit:'daily',days:[...days,'2027-02-20','2027-02-21']})).toBe(true);
  expect(meetsListingMinimum(listing('dailyMinBooking',15),{unit:'daily',days:['2027-02-01','2027-02-28']})).toBe(false);
});

it('allows gaps between sessions but rejects a gap or unavailable seat within one session', () => {
  const slots = [slot('2027-02-01T09:00Z', '2027-02-01T12:00Z'), slot('2027-02-01T12:00Z', '2027-02-01T15:00Z'), slot('2027-02-03T09:00Z', '2027-02-03T15:00Z')];
  expect(slotsCoverSchedule(slots, schedule)).toBe(true);
  expect(slotsCoverSchedule(slots.slice(1), schedule)).toBe(false);
  expect(slotsCoverSchedule([slot('2027-02-01T09:00Z', '2027-02-01T15:00Z', 0), slots[2]], schedule)).toBe(false);
});
