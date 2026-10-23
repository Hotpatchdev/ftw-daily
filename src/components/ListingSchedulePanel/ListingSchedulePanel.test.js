import React from 'react';
import { shallow } from 'enzyme';
import '../../util/test-helpers';
import ListingSchedulePanel, { scheduleBookingGroups } from './ListingSchedulePanel';

const hourly = { unit: 'hourly', days: ['2027-02-01', '2027-02-03'], start: '09:00', end: '15:00', same: true, timeZone: 'Europe/London' };
const listing = { attributes: { price: { amount: 2000, currency: 'GBP' }, publicData: { minBooking: { minBookingType: 'hourlyMinBooking', minBookingCount: 5 } } } };

it('hands each hourly session to checkout as its own precise interval', () => {
  const onReview = jest.fn();
  const wrapper = shallow(<ListingSchedulePanel listing={listing} value={JSON.stringify(hourly)} onReview={onReview} />);
  wrapper.find('.group button').at(1).simulate('click');
  expect(onReview).toHaveBeenCalledWith('hourly', { day: '2027-02-03', start: new Date('2027-02-03T09:00Z'), end: new Date('2027-02-03T15:00Z') });
  expect(wrapper.text()).toContain('own checkout, payment and host confirmation');
});
it('groups consecutive daily dates without booking gaps between date groups', () => {
  expect(scheduleBookingGroups({ unit: 'daily', days: ['2027-02-01', '2027-02-02', '2027-02-05'] })).toEqual([
    { day: '2027-02-01', lastDay: '2027-02-02', start: new Date('2027-02-01T00:00Z'), end: new Date('2027-02-03T00:00Z') },
    { day: '2027-02-05', lastDay: '2027-02-05', start: new Date('2027-02-05T00:00Z'), end: new Date('2027-02-06T00:00Z') },
  ]);
});
it('blocks checkout when the current host minimum is not met or booking is disabled', () => {
  const wrapper = shallow(<ListingSchedulePanel listing={listing} value={{ ...hourly, end: '11:00' }} onReview={() => {}} />);
  expect(wrapper.find('.group button').everyWhere(button => button.prop('disabled'))).toBe(true);
  expect(wrapper.find('[role="alert"]').text()).toContain('minimum');
  const disabled = shallow(<ListingSchedulePanel listing={listing} value={hourly} onReview={() => {}} disabled />);
  expect(disabled.find('.group button').everyWhere(button => button.prop('disabled'))).toBe(true);
});
