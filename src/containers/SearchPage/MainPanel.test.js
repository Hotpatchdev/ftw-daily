import React from 'react';
import { shallow } from 'enzyme';
import '../../util/test-helpers';
import MainPanel from './MainPanel';
import DiscoveryFilters from '../../components/DiscoveryFilters/DiscoveryFilters';
import ActiveFilterTags from '../../components/ActiveFilterTags/ActiveFilterTags';
import { SortBy } from '../../components';
import { parse } from '../../util/urlHelpers';

const initial = {
  address: 'Ancoats, Manchester',
  keywords: 'salon',
  dates: '2026-11-01,2026-11-02',
  pub_category: 'has_any:barber',
  pub_amenities: 'has_all:wifi,barber-chair',
  page: 3,
};
const setup = () => {
  const push = jest.fn();
  const wrapper = shallow(
    <MainPanel
      h1="Spaces"
      urlQueryParams={initial}
      searchParamsForPagination={initial}
      history={{ push }}
      searchInProgress={false}
      searchParamsAreInSync
      onActivateListing={() => {}}
      onManageDisableScrolling={() => {}}
      onOpenModal={() => {}}
      onCloseModal={() => {}}
      onMapIconClick={() => {}}
      pagination={{ page: 3, perPage: 24, totalItems: 70, totalPages: 3 }}
    />
  );
  return { wrapper, push, query: () => parse(push.mock.calls[0][0].split('?')[1]) };
};

it('applies the unified panel without dropping location, dates or shared amenity selections', () => {
  const { wrapper, query } = setup();
  wrapper.find(DiscoveryFilters).prop('onApply')({ ...initial, price: '20,80', page: undefined });
  expect(query()).toEqual(
    expect.objectContaining({
      address: initial.address,
      dates: initial.dates,
      pub_category: initial.pub_category,
      pub_amenities: initial.pub_amenities,
      price: '20,80',
    })
  );
  expect(query().page).toBeUndefined();
});

it('removes only the selected amenity chip while preserving the matching mode and other filters', () => {
  const { wrapper, query } = setup();
  wrapper.find(ActiveFilterTags).prop('onRemove')({
    param: 'pub_amenities',
    type: 'option',
    value: 'wifi',
  });
  expect(query().pub_amenities).toBe('has_all:barber-chair');
  expect(query().dates).toBe(initial.dates);
  expect(query().address).toBe(initial.address);
  expect(query().page).toBeUndefined();
});

it('resets pagination when changing sort while keeping the search context', () => {
  const { wrapper, query } = setup();
  wrapper.find(SortBy).prop('onSelect')('sort', '-price');
  expect(query()).toEqual(
    expect.objectContaining({ sort: '-price', address: initial.address, dates: initial.dates })
  );
  expect(query().page).toBeUndefined();
});
