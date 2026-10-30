import { minimumFinishTime, minimumDateSelection } from './bookingMinimumSuggestion';
import { readListingMinimum } from './bookingMinimum';
const hours = count => ({ hours: count });
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
