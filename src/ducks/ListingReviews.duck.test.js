import reducer, { loadReviews } from './ListingReviews.duck';
import { types } from '../util/sdkLoader';
const first = '00000000-0000-4000-8000-000000000001';
const second = '00000000-0000-4000-8000-000000000002';
const listing = id => ({
  data: {
    data: {
      id: new types.UUID(id),
      type: 'listing',
      attributes: { title: 'Studio', publicData: {} },
    },
  },
});
const empty = { data: { data: [], meta: { totalItems: 0, totalPages: 0 } } };
const setup = () => {
  let state = { ListingReviews: reducer() };
  const sdk = {
    listings: { show: jest.fn().mockResolvedValue(listing(first)) },
    reviews: { query: jest.fn().mockResolvedValue(empty) },
  };
  const getState = () => state;
  const dispatch = action => {
    if (typeof action === 'function') return action(dispatch, getState, sdk);
    state = { ListingReviews: reducer(state.ListingReviews, action) };
    return action;
  };
  return { sdk, dispatch, getState };
};
describe('listing reviews loading', () => {
  it('caches complete data for local sorting and pagination but permits a forced refresh', async () => {
    const t = setup();
    await t.dispatch(loadReviews(first));
    expect(t.getState().ListingReviews.loaded).toBe(true);
    await t.dispatch(loadReviews(first));
    expect(t.sdk.reviews.query).toHaveBeenCalledTimes(1);
    await t.dispatch(loadReviews(first, true));
    expect(t.sdk.reviews.query).toHaveBeenCalledTimes(2);
  });
  it('shows a failed review load as an error rather than an empty success', async () => {
    const t = setup();
    t.sdk.reviews.query.mockRejectedValueOnce(new Error('offline'));
    await t.dispatch(loadReviews(first));
    expect(t.getState().ListingReviews.loaded).toBe(false);
    expect(t.getState().ListingReviews.error).toBeTruthy();
    await t.dispatch(loadReviews(first, true));
    expect(t.getState().ListingReviews.loaded).toBe(true);
  });
  it('ignores a response after navigating to another listing', async () => {
    const t = setup();
    let resolveOld;
    t.sdk.listings.show
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveOld = resolve;
          })
      )
      .mockResolvedValueOnce(listing(second));
    const old = t.dispatch(loadReviews(first));
    await t.dispatch(loadReviews(second));
    resolveOld(listing(first));
    await old;
    expect(t.getState().ListingReviews.listingId).toBe(second);
    expect(t.getState().ListingReviews.listing.id.uuid).toBe(second);
    expect(t.sdk.reviews.query).toHaveBeenCalledTimes(1);
  });
  it('handles malformed listing IDs without calling the API', async () => {
    const t = setup();
    await t.dispatch(loadReviews('invalid'));
    expect(t.getState().ListingReviews.error.status).toBe(404);
    expect(t.sdk.listings.show).not.toHaveBeenCalled();
  });
});
