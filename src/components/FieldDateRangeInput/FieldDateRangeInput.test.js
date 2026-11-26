import React from 'react';
import { shallow } from 'enzyme';
import '../../util/test-helpers';
import FieldDateRangeInput, { DateRangeInput } from './FieldDateRangeInput';

it.each([[7, 15], [30, 61]])('preserves %s-day units plus extra days (%s total)', (offsetLength, days) => {
  const onChange = jest.fn();
  const FieldComponent = shallow(<FieldDateRangeInput name="dates" />).prop('component');
  const wrapper = shallow(<FieldComponent
    unitType="line-item/units" input={{ onChange }} meta={{}}
    minimumLength={offsetLength} offsetLength={offsetLength}
  />);
  const dates = { startDate: new Date('2027-02-01T12:00Z'),
    endDate: new Date(Date.parse('2027-02-01T12:00Z') + days * 86400000) };
  wrapper.find(DateRangeInput).prop('onChange')(dates);
  expect(onChange).toHaveBeenCalledWith(dates);
});
