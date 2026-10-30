import React from 'react';
import { shallow } from 'enzyme';
import '../../util/test-helpers';
import BookingSchedulePicker from './BookingSchedulePicker';
import SearchTimeFields from '../SearchTimeFields/SearchTimeFields';

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

it('suggests a minimum finish after a start-time change, while preserving an explicit longer finish', () => {
  const onChange = jest.fn();
  const wrapper = shallow(<BookingSchedulePicker value={{...value,end:'14:00'}} onChange={onChange} minimum={{hours:5}} initiallySuggested />);
  wrapper.find(SearchTimeFields).prop('onChange')({startTime:'10:00',endTime:'14:00',timeZone:value.timeZone});
  expect(onChange.mock.calls[0][0].end).toBe('15:00');
  wrapper.find(SearchTimeFields).prop('onChange')({startTime:'09:00',endTime:'18:00',timeZone:value.timeZone});
  wrapper.setProps({value:{...value,end:'18:00'}});
  wrapper.find(SearchTimeFields).prop('onChange')({startTime:'10:00',endTime:'18:00',timeZone:value.timeZone});
  expect(onChange.mock.calls[2][0].end).toBe('18:00');
});

it('suggests each individual session finish without changing other session overrides', () => {
  const onChange=jest.fn();
  const wrapper=shallow(<BookingSchedulePicker value={{...value,same:false,end:'14:00',overrides:{'2027-02-03':{start:'09:00',end:'14:00'}}}} onChange={onChange} minimum={{hours:5}} />);
  wrapper.find('input').filterWhere(input=>input.prop('aria-label')==='From time on 2027-02-03').simulate('input',{target:{value:'10:00'}});
  expect(onChange.mock.calls[0][0].overrides['2027-02-03']).toEqual({start:'10:00',end:'15:00'});
});

it('suggests the inclusive daily minimum and blocks earlier range finishes', () => {
  const onChange=jest.fn();
  const wrapper=shallow(<BookingSchedulePicker value={{...value,unit:'daily',days:[]}} onChange={onChange} minimum={{hours:72}} />);
  wrapper.find('button').filterWhere(b=>b.text()==='Date range').simulate('click');
  // The initial month follows today when no dates have been chosen.
  wrapper.setProps({value:{...value,unit:'daily',days:['2027-02-01']}});
  while(!labelledButton(wrapper,'Monday 1 February 2027').length) labelledButton(wrapper,'Next month').simulate('click');
  labelledButton(wrapper,'Monday 1 February 2027').simulate('click');
  expect(onChange.mock.calls[0][0].days).toEqual(['2027-02-01','2027-02-02','2027-02-03']);
  expect(labelledButton(wrapper,'Tuesday 2 February 2027').prop('disabled')).toBe(true);
  expect(wrapper.text()).toContain('Earliest last day: Wed 3 Feb');
});

it('adds just two separated days to an already valid fifteen-day booking',()=>{
  const onChange=jest.fn();
  const days=Array.from({length:15},(_,i)=>`2027-02-${String(i+1).padStart(2,'0')}`);
  const daily={...value,unit:'daily',days};
  const wrapper=shallow(<BookingSchedulePicker value={daily} onChange={onChange} minimum={{hours:360}} />);
  labelledButton(wrapper,'Saturday 20 February 2027').simulate('click');
  const sixteen=onChange.mock.calls[0][0];expect(sixteen.days).toEqual([...days,'2027-02-20']);
  wrapper.setProps({value:sixteen});
  labelledButton(wrapper,'Sunday 21 February 2027').simulate('click');
  expect(onChange.mock.calls[1][0].days).toEqual([...days,'2027-02-20','2027-02-21']);
  expect(wrapper.text()).toContain('minimum counts all selected days');
});
