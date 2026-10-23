import React from 'react';
import { shallow, configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';
import SearchTimeFields, { quickTimes } from './SearchTimeFields';

configure({ adapter: new Adapter() });

it('uses the annotated quick choices and keeps the selected time zone', () => {
  const value = { startTime: '', endTime: '', timeZone: 'America/New_York' };
  const onChange = jest.fn();
  const wrapper = shallow(<SearchTimeFields value={value} onChange={onChange} idPrefix="test" />);
  quickTimes.forEach((option, index) => {
    wrapper.find('.choices button').at(index).simulate('click');
    expect(onChange).toHaveBeenLastCalledWith({
      ...value, startTime: option.start, endTime: option.end,
    });
  });
});

it('accepts native time input events and clears both times together', () => {
  const value = { startTime: '09:00', endTime: '17:00', timeZone: 'Europe/London' };
  const onChange = jest.fn();
  const wrapper = shallow(<SearchTimeFields value={value} onChange={onChange} idPrefix="test" />);
  wrapper.find('input').first().simulate('input', { target: { value: '10:30' } });
  expect(onChange).toHaveBeenLastCalledWith({ ...value, startTime: '10:30' });
  wrapper.find('button.reset').simulate('click');
  expect(onChange).toHaveBeenLastCalledWith({ ...value, startTime: '', endTime: '' });
});
