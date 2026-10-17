import { types } from '../util/sdkLoader';
import { denormalisedResponseEntities } from '../util/data';
import { fetchCompleteReviews } from '../util/reviewsView';
import { storableError } from '../util/errors';
import { isListingId } from '../util/wishlist';

export const REQUEST = 'app/ListingReviews/REQUEST';
export const SUCCESS = 'app/ListingReviews/SUCCESS';
export const ERROR = 'app/ListingReviews/ERROR';
const initialState = {
  listingId: null,
  listing: null,
  reviews: [],
  loading: false,
  loaded: false,
  error: null,
  requestId: null,
  fetchedAt: 0,
};
let sequence = 0;

export default function reducer(state = initialState, action = {}) {
  if (action.type === REQUEST)
    return {
      ...initialState,
      listingId: action.listingId,
      requestId: action.requestId,
      loading: true,
    };
  if (action.requestId !== state.requestId) return state;
  if (action.type === SUCCESS)
    return {
      ...state,
      listing: action.listing,
      reviews: action.reviews,
      loading: false,
      loaded: true,
      fetchedAt: action.fetchedAt,
    };
  if (action.type === ERROR) return { ...state, loading: false, error: action.error };
  return state;
}

export const loadReviews = (listingId, force = false) => async (dispatch, getState, sdk) => {
  const current = getState().ListingReviews;
  if (
    !force &&
    current.listingId === listingId &&
    current.loaded &&
    Date.now() - current.fetchedAt < 5 * 60 * 1000
  )
    return;
  const requestId = ++sequence;
  dispatch({ type: REQUEST, listingId, requestId });
  const active = () => getState().ListingReviews.requestId === requestId;
  try {
    if (!isListingId(listingId))
      throw Object.assign(new Error('Listing not found'), { status: 404 });
    const response = await sdk.listings.show({
      id: new types.UUID(listingId),
      include: ['author', 'author.profileImage', 'images'],
    });
    if (!active()) return;
    const listing = denormalisedResponseEntities(response)[0];
    if (!listing || listing.id.uuid !== listingId || listing.attributes.deleted)
      throw new Error('Listing unavailable');
    const reviews = await fetchCompleteReviews(sdk, new types.UUID(listingId), active);
    if (active()) dispatch({ type: SUCCESS, requestId, listing, reviews, fetchedAt: Date.now() });
  } catch (error) {
    if (active()) dispatch({ type: ERROR, requestId, error: storableError(error) });
  }
};

export const loadData = params => loadReviews(params.id);
