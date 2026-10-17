// Only retain an internal search route, never an arbitrary navigation destination.
export const validSearchLocation = value =>
  value &&
  value.pathname === '/s' &&
  typeof value.search === 'string' &&
  (!value.search || value.search.charAt(0) === '?')
    ? { pathname: '/s', search: value.search }
    : null;

export const searchReturnLocation = location =>
  validSearchLocation(location) ||
  validSearchLocation(location && location.state && location.state.searchReturnTo);

export const listingLinkDestination = (name, to = {}, location) => {
  const searchReturnTo = searchReturnLocation(location);
  return searchReturnTo &&
    ['ListingPage', 'ListingPageCanonical', 'ListingReviewsPage'].includes(name)
    ? { ...to, state: { ...to.state, searchReturnTo } }
    : to;
};
