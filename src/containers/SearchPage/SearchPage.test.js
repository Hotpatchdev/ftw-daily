import React from 'react';
import { shallow } from 'enzyme';
import '../../util/test-helpers';
import { fakeIntl } from '../../util/test-data';
import { SearchPageComponent } from './SearchPage';
import MainPanel from './MainPanel';

const noop = () => null;
const props = {
  location: { search: '?keywords=salon&dates=2026-11-01%2C2026-11-02' },
  history: { push: jest.fn() },
  pagination: { page: 1, perPage: 24, totalItems: 22, totalPages: 1 },
  searchParams: { keywords: 'salon', dates: '2026-11-01,2026-11-02' },
  tab: 'listings',
  scrollingDisabled: false,
  searchInProgress: false,
  intl: fakeIntl,
  onActivateListing: noop,
  onManageDisableScrolling: noop,
  onSearchMapListings: noop,
};

it('passes the originating search and result state to the filter/results panel', () => {
  const tree = shallow(<SearchPageComponent {...props} />);
  const panel = tree.find(MainPanel);
  expect(panel.prop('searchParamsForPagination')).toEqual({
    keywords: 'salon',
    dates: '2026-11-01,2026-11-02',
  });
  expect(panel.prop('pagination')).toEqual(props.pagination);
  expect(panel.prop('searchParamsAreInSync')).toBe(true);
  expect(panel.prop('onManageDisableScrolling')).toBe(noop);
});

it('synchronizes category context after navigation, including clearing the selection', () => {
  const page = new SearchPageComponent(props);
  const setSelectedPubCat = jest.fn();
  page.context = { setSelectedPubCat };
  page.componentDidMount();
  page.props = { ...props, searchParams: { pub_category: 'has_any:barber' } };
  page.componentDidUpdate(props);
  expect(setSelectedPubCat).toHaveBeenLastCalledWith('has_any:barber');
  const previous = page.props;
  page.props = props;
  page.componentDidUpdate(previous);
  expect(setSelectedPubCat).toHaveBeenLastCalledWith('');
});
