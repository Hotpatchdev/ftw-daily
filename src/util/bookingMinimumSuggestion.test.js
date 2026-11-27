import { minimumFinishTime, minimumDateSelection, availableMinimumFinish } from './bookingMinimumSuggestion';
import { readListingMinimum } from './bookingMinimum';
const hours = count => ({ hours: count });
const slot = (start, end, seats = 1) => ({ attributes: { start, end, seats } });
it('requires five uninterrupted available hours and allows finishing exactly at closing', () => {
  const slots = [slot('2027-02-01T09:00Z', '2027-02-01T17:00Z')];
  const finish = start => availableMinimumFinish(start, hours(5), ['2027-02-01'], 'Europe/London', slots);
  expect(finish('09:00')).toBe('14:00');
  expect(finish('12:00')).toBe('17:00');
  expect(finish('14:00')).toBeNull();
  expect(availableMinimumFinish('09:00', hours(5), ['2027-02-01'], 'Europe/London', [
    slot('2027-02-01T09:00Z', '2027-02-01T12:00Z'),
    slot('2027-02-01T13:00Z', '2027-02-01T17:00Z'),
  ])).toBeNull();
});
it('checks every selected day, time zone, bookings and pending availability', () => {
  const slots = [slot('2027-02-01T14:00Z', '2027-02-01T22:00Z')];
  expect(availableMinimumFinish('09:00', hours(5), ['2027-02-01'], 'America/New_York', slots)).toBe('14:00');
  expect(availableMinimumFinish('09:00', hours(5), ['2027-02-01', '2027-02-03'], 'America/New_York', slots)).toBeNull();
  expect(availableMinimumFinish('09:00', hours(5), ['2027-02-01'], 'America/New_York', slots.map(s => ({attributes:{...s.attributes,seats:0}})))).toBeNull();
  expect(availableMinimumFinish('09:00', hours(5), ['2027-02-01'], 'America/New_York', null)).toBeNull();
});
it('suggests 14:00 from 09:00 for a five-hour minimum and supports fractional hours', () => {
  expect(minimumFinishTime('09:00', hours(5))).toBe('14:00');
  expect(minimumFinishTime('09:00', hours(2.5))).toBe('11:30');
  expect(minimumFinishTime('09:00', hours(2.01))).toBe('11:05');
});
it('never rolls a same-day booking into the following day', () => {
  expect(minimumFinishTime('22:00', hours(5))).toBeNull();
  expect(minimumFinishTime('bad', hours(5))).toBeNull();
  expect(minimumFinishTime('09:00', null)).toBeNull();
});
it('uses elapsed hours across clock changes and avoids ambiguous suggestions', () => {
  expect(minimumFinishTime('00:30', hours(2), ['2027-03-28'], 'Europe/London')).toBe('03:30');
  expect(minimumFinishTime('00:30', hours(2), ['2027-10-31'], 'Europe/London')).toBeNull();
  expect(minimumFinishTime('00:30', hours(2), ['2027-03-27','2027-03-28'], 'Europe/London')).toBe('03:30');
});
it('suggests the total minimum once and adds separated days without another full minimum', () => {
  expect(minimumDateSelection([], '2027-02-01', hours(72))).toEqual(['2027-02-01','2027-02-02','2027-02-03']);
  expect(minimumDateSelection(['2027-02-01','2027-02-02','2027-02-03'], '2027-02-08', hours(72))).toEqual(['2027-02-01','2027-02-02','2027-02-03','2027-02-08']);
  expect(minimumDateSelection(['2027-02-01'], '2027-02-08', hours(72))).toEqual(['2027-02-01','2027-02-08','2027-02-09']);
});
it('extends an existing valid daily group without adding unnecessary extra days', () => {
  expect(minimumDateSelection(['2027-02-01','2027-02-02','2027-02-03'], '2027-02-04', hours(72))).toEqual(['2027-02-01','2027-02-02','2027-02-03','2027-02-04']);
});
it('keeps suggestions within the supported booking limits', () => {
  expect(() => minimumDateSelection([], 'bad-date', hours(72))).toThrow('valid booking dates');
  expect(() => minimumDateSelection([], '2027-02-01', hours(32*24))).toThrow('minimum');
  expect(() => minimumDateSelection(['2027-02-01'], '2027-06-01', hours(72))).toThrow('minimum');
});

it('uses actual weekly and monthly host rules when suggesting daily dates', () => {
  [['weeklyMinBooking',7],['monthlyMinBooking',30]].forEach(([minBookingType,count])=>{
    const rule=readListingMinimum({attributes:{publicData:{minBooking:{minBookingType,minBookingCount:1}}}});
    const days=minimumDateSelection([], '2027-02-01', rule);
    expect(days).toHaveLength(count);
  });
});
