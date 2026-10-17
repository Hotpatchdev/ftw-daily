import { listingLinkDestination, searchReturnLocation } from './searchReturn';

const search =
  '?keywords=studio&dates=2026-11-01%2C2026-11-03&pub_amenities=has_all%3Awifi&bounds=51%2C1%2C50%2C0&mapSearch=true&page=2';
const location = { pathname: '/s', search };

it('retains the complete query and existing destination state for listing links', () => {
  const to = listingLinkDestination(
    'ListingPage',
    { hash: '#photos', state: { extra: 1 } },
    location
  );
  expect(to).toEqual({ hash: '#photos', state: { extra: 1, searchReturnTo: location } });
  expect(searchReturnLocation({ pathname: '/l/studio/id', state: to.state })).toEqual(location);
});

it('retains search context through reviews and back without attaching it to unrelated links', () => {
  const listingLocation = { pathname: '/l/studio/id', state: { searchReturnTo: location } };
  expect(
    listingLinkDestination('ListingReviewsPage', {}, listingLocation).state.searchReturnTo
  ).toEqual(location);
  expect(listingLinkDestination('LoginPage', {}, listingLocation)).toEqual({});
  expect(
    listingLinkDestination('ListingPage', {}, { pathname: '/wishlist', search: '?compare=a,b' })
  ).toEqual({});
});

it('rejects external and malformed return destinations', () => {
  ['https://example.com/s', '//example.com/s', '/wishlist', '/s/other'].forEach(pathname => {
    expect(searchReturnLocation({ state: { searchReturnTo: { pathname, search } } })).toBe(null);
  });
  expect(
    searchReturnLocation({ state: { searchReturnTo: { pathname: '/s', search: '//example.com' } } })
  ).toBe(null);
  expect(searchReturnLocation(null)).toBe(null);
});
