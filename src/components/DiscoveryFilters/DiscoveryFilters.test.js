import React from 'react';
import { shallow } from 'enzyme';
import '../../util/test-helpers';
import config from '../../config';
import { DiscoveryFiltersComponent } from './DiscoveryFilters';

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

it('commits native date input events and preserves location and existing selections', () => {
  const { wrapper, onApply } = setup();
  wrapper
    .find('.summaryCard')
    .at(1)
    .find('button')
    .simulate('click');
  expect(wrapper.find('.footer button').prop('disabled')).toBe(true);
  wrapper
    .find('input[type="date"]')
    .at(1)
    .simulate('input', { target: { value: '2026-11-06' } });
  button(wrapper, 'Save dates').simulate('click');
  wrapper.find('.footer button').simulate('click');
  expect(onApply).toHaveBeenCalledWith({ ...initial, dates: '2026-11-01,2026-11-06' });
});

it('rejects incomplete/reversed dates and leaves the editor open', () => {
  const { wrapper, onApply } = setup();
  wrapper
    .find('.summaryCard')
    .at(1)
    .find('button')
    .simulate('click');
  wrapper
    .find('input[type="date"]')
    .first()
    .simulate('input', { target: { value: '2026-11-05' } });
  button(wrapper, 'Save dates').simulate('click');
  expect(wrapper.find('[role="alert"]').text()).toContain('valid start and end date');
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
