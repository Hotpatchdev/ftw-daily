import React from 'react';
import { shallow } from 'enzyme';
import '../../util/test-helpers';
import config from '../../config';
import { DiscoveryFiltersComponent } from './DiscoveryFilters';
import BookingSchedulePicker from '../BookingSchedulePicker/BookingSchedulePicker';

const initial = {
  address: 'Manchester',
  dates: '2026-11-01,2026-11-02',
  pub_category: 'has_any:barber',
  pub_amenities: 'has_all:barber-chair',
};
const setup = () => {
  const onApply = jest.fn();
  const onClose = jest.fn();
  const wrapper = shallow(
    <DiscoveryFiltersComponent
      params={initial}
      filters={config.custom.filters}
      onApply={onApply}
      onOpen={() => {}}
      onClose={onClose}
      onManageDisableScrolling={() => {}}
      onLoadPrices={() => Promise.resolve([])}
      listingsAreLoaded
      resultsCount={12}
    />
  );
  wrapper.find('button.trigger').simulate('click');
  return { wrapper, onApply, onClose };
};
const button = (wrapper, label) =>
  wrapper.find('button').filterWhere(node => node.text() === label);

it('commits the selected schedule and preserves location and existing selections', () => {
  const { wrapper, onApply } = setup();
  wrapper
    .find('.summaryCard')
    .at(1)
    .find('button')
    .simulate('click');
  expect(wrapper.find('.footer button').prop('disabled')).toBe(true);
  wrapper.find(BookingSchedulePicker).prop('onChange')({ unit: 'daily', days: ['2026-11-01', '2026-11-06'] });
  button(wrapper, 'Save dates & times').simulate('click');
  wrapper.find('.footer button').simulate('click');
  const { dates, ...rest } = initial;
  expect(onApply).toHaveBeenCalledWith({ ...rest, schedule: JSON.stringify({ unit: 'daily', days: ['2026-11-01', '2026-11-06'] }) });
});

it('rejects invalid schedules and leaves the editor open', () => {
  const { wrapper, onApply } = setup();
  wrapper
    .find('.summaryCard')
    .at(1)
    .find('button')
    .simulate('click');
  wrapper.find(BookingSchedulePicker).prop('onChange')({ unit: 'hourly', days: ['2026-11-01'], start: '15:00', end: '09:00', timeZone: 'Europe/London' });
  button(wrapper, 'Save dates & times').simulate('click');
  expect(wrapper.find('[role="alert"]').text()).toContain('end time later');
  expect(wrapper.find('.footer button').prop('disabled')).toBe(true);
  expect(onApply).not.toHaveBeenCalled();
});

it('keeps draft amenity edits local until Show spaces, preserving has_all mode', () => {
  const { wrapper, onApply } = setup();
  wrapper.find('.chips button').filterWhere(node => node.key() === 'wifi').simulate('click');
  expect(onApply).not.toHaveBeenCalled();
  wrapper.find('.footer button').simulate('click');
  expect(onApply).toHaveBeenCalledWith({ ...initial, pub_amenities: 'has_all:barber-chair,wifi' });
});

it('cancels without applying draft selections', () => {
  const { wrapper, onApply, onClose } = setup();
  wrapper.find('.chips button').filterWhere(node => node.key() === 'wifi').simulate('click');
  wrapper.find('button.close').simulate('click');
  expect(onClose).toHaveBeenCalled();
  expect(onApply).not.toHaveBeenCalled();
});

it('resets criteria while retaining the chosen location', () => {
  const { wrapper, onApply } = setup();
  button(wrapper, 'Reset').simulate('click');
  wrapper.find('.footer button').simulate('click');
  expect(onApply).toHaveBeenCalledWith({ address: 'Manchester' });
});
