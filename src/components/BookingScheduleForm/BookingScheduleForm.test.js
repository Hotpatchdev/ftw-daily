import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import '../../util/test-helpers';
import { BookingScheduleFormComponent } from './BookingScheduleForm';
import BookingSchedulePicker from '../BookingSchedulePicker/BookingSchedulePicker';

const schedule = { unit: 'hourly', days: ['2027-02-01'], start: '09:00', end: '15:00', same: true, timeZone: 'Europe/London' };
const listing = { id: { uuid: 'space' }, attributes: { price: { amount: 1000, currency: 'GBP' }, availabilityPlan: { timezone: 'America/New_York' }, publicData: { minBooking: { minBookingType: 'hourlyMinBooking', minBookingCount: 5 } } } };
const quote = { schedule, groups: [{ day: '2027-02-01', start: new Date('2027-02-01T09:00Z'), end: new Date('2027-02-01T15:00Z'), total: 6600, currency: 'GBP', items: [{ code: 'line-item/units', lineTotal: { amount: 6000, currency: 'GBP' } }, { code: 'line-item/customer-commission', lineTotal: { amount: 600, currency: 'GBP' } }] }] };
const props = () => ({ listing, bookingType: 'price', onCheckSchedule: jest.fn().mockResolvedValue(quote), onReview: jest.fn(), history: { replace: jest.fn() }, location: { pathname: '/l/test/space', search: '', state: { returnTo: '/s' } } });
let wrapper;
beforeEach(() => jest.useFakeTimers());
afterEach(() => { if (wrapper) wrapper.unmount(); jest.useRealTimers(); });
const settle = async () => { await act(async () => { jest.advanceTimersByTime(400); await Promise.resolve(); }); wrapper.update(); };
it('appears directly on a listing with the host timezone, minimum and required dates', () => {
  const p = props();
  act(() => { wrapper = mount(<BookingScheduleFormComponent {...p} />); });
  expect(wrapper.text()).toContain('Minimum booking: 5 hours');
  expect(wrapper.find(BookingSchedulePicker).props()).toMatchObject({ showUnits: false, required: true, value: { days: [], end: '14:00', timeZone: 'America/New_York' } });
  expect(wrapper.text()).toContain('Select dates to see availability');
  expect(p.onCheckSchedule).not.toHaveBeenCalled();
});
it('shows the server total and fee before passing exact dates into checkout', async () => {
  const p = props();
  act(() => { wrapper = mount(<BookingScheduleFormComponent {...p} initialSchedule={JSON.stringify(schedule)} />); });
  await settle();
  expect(wrapper.text()).toContain('£60.00');
  expect(wrapper.text()).toContain('Service fee£6.00');
  expect(wrapper.text()).toContain('Total£66.00');
  wrapper.find('button.continue').simulate('click');
  expect(p.history.replace.mock.calls[0][0].search).toContain('schedule=');
  expect(p.onReview).toHaveBeenCalledWith('hourly', quote.groups[0]);
});
it('removes the old quote immediately when an edit is below the minimum', async () => {
  const p = props();
  act(() => { wrapper = mount(<BookingScheduleFormComponent {...p} initialSchedule={JSON.stringify(schedule)} />); });
  await settle();
  act(() => { wrapper.find(BookingSchedulePicker).prop('onChange')({ ...schedule, end: '11:00' }); });
  wrapper.update();
  expect(wrapper.find('button.continue')).toHaveLength(0);
  expect(wrapper.find('[role="alert"]').text()).toContain('minimum');
  expect(p.onCheckSchedule).toHaveBeenCalledTimes(1);
});
it('ignores a slow old quote after the user changes dates', async () => {
  const p = props();
  let resolveOld;
  p.onCheckSchedule.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  act(() => { wrapper = mount(<BookingScheduleFormComponent {...p} initialSchedule={JSON.stringify(schedule)} />); });
  await settle();
  act(() => { wrapper.find(BookingSchedulePicker).prop('onChange')({ ...schedule, days: [] }); });
  await act(async () => { resolveOld(quote); await Promise.resolve(); });
  wrapper.update();
  expect(wrapper.find('button.continue')).toHaveLength(0);
});
