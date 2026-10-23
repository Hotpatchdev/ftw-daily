import React from 'react';
import { shallow } from 'enzyme';
import '../../util/test-helpers';
import BookingSchedulePicker from './BookingSchedulePicker';

const value = { unit: 'hourly', days: ['2027-02-01', '2027-02-03'], start: '09:00', end: '15:00', timeZone: 'Europe/London', same: true, overrides: {} };
const labelledButton = (wrapper, label) => wrapper.find('button').filterWhere(button => button.prop('aria-label') === label);

it('selects and removes individual dates without selecting intervening days', () => {
  const onChange = jest.fn();
  const wrapper = shallow(<BookingSchedulePicker value={value} onChange={onChange} />);
  labelledButton(wrapper, 'Friday 5 February 2027').simulate('click');
  expect(onChange.mock.calls[0][0].days).toEqual(['2027-02-01', '2027-02-03', '2027-02-05']);
  labelledButton(wrapper, 'Monday 1 February 2027').simulate('click');
  expect(onChange.mock.calls[1][0].days).toEqual(['2027-02-03']);
});

it('selects every day between the first and last date in range mode', () => {
  const onChange = jest.fn();
  const wrapper = shallow(<BookingSchedulePicker value={value} onChange={onChange} />);
  wrapper.find('button').filterWhere(button => button.text() === 'Date range').simulate('click');
  labelledButton(wrapper, 'Friday 5 February 2027').simulate('click');
  labelledButton(wrapper, 'Monday 8 February 2027').simulate('click');
  expect(onChange.mock.calls[1][0].days).toEqual(['2027-02-05', '2027-02-06', '2027-02-07', '2027-02-08']);
});

it('edits one session without changing the other selected dates', () => {
  const onChange = jest.fn();
  const wrapper = shallow(<BookingSchedulePicker value={{ ...value, same: false }} onChange={onChange} />);
  wrapper.find('input').filterWhere(input => input.prop('aria-label') === 'To time on 2027-02-03').simulate('input', { target: { value: '17:00' } });
  expect(onChange.mock.calls[0][0].overrides).toEqual({ '2027-02-03': { start: '09:00', end: '17:00' } });
});

it('clears the selected dates and keeps the selected time zone', () => {
  const onChange = jest.fn();
  const wrapper = shallow(<BookingSchedulePicker value={value} onChange={onChange} />);
  wrapper.find('button').filterWhere(button => button.text() === 'Clear dates').simulate('click');
  expect(onChange.mock.calls[0][0]).toMatchObject({ days: [], timeZone: 'Europe/London' });
});
