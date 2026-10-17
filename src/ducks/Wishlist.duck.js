import { denormalisedResponseEntities } from '../util/data';
import { storableError } from '../util/errors';
import { currentUserShowSuccess } from './user.duck';
import { addMarketplaceEntities } from './marketplaceData.duck';
import { isListingId, savedListingIds, updatedWishlist, WISHLIST_KEY } from '../util/wishlist';

export const SAVE_REQUEST = 'app/Wishlist/SAVE_REQUEST';
export const SAVE_SUCCESS = 'app/Wishlist/SAVE_SUCCESS';
export const SAVE_ERROR = 'app/Wishlist/SAVE_ERROR';
export const LOAD_REQUEST = 'app/Wishlist/LOAD_REQUEST';
export const LOAD_SUCCESS = 'app/Wishlist/LOAD_SUCCESS';
export const LOAD_ERROR = 'app/Wishlist/LOAD_ERROR';

const initialState = {
  savingId: null,
  saveRequestId: null,
  saveError: null,
  loading: false,
  loaded: false,
  loadError: null,
  resultIds: [],
  loadRequestId: null,
};

let requestSequence = 0;

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case SAVE_REQUEST:
      return { ...state, savingId: action.id, saveRequestId: action.requestId, saveError: null };
    case SAVE_SUCCESS:
      return { ...state, savingId: null, saveRequestId: null, saveError: null };
    case SAVE_ERROR:
      return {
        ...state,
        savingId: null,
        saveRequestId: null,
        saveError: { id: action.id, message: action.message },
      };
    case LOAD_REQUEST:
      return {
        ...state,
        loading: true,
        loaded: false,
        loadError: null,
        resultIds: [],
        loadRequestId: action.requestId,
      };
    case LOAD_SUCCESS:
      return { ...state, loading: false, loaded: true, resultIds: action.ids };
    case LOAD_ERROR:
      return { ...state, loading: false, loaded: false, loadError: action.error };
    default:
      return state;
  }
}

const responseUser = response => {
  const user = denormalisedResponseEntities(response)[0];
  if (!user || user.type !== 'currentUser') throw new Error('Could not load your account.');
  return user;
};

const sameSession = (state, userId) =>
  state.Auth.isAuthenticated &&
  (!state.user.currentUser || state.user.currentUser.id.uuid === userId);

// Serialize profile writes in this client and read fresh server data first.
// Send only our private-data key; Sharetribe merges it with unrelated profile data.
export const setSavedListing = (id, save) => async (dispatch, getState, sdk) => {
  if (!getState().Auth.isAuthenticated || getState().Wishlist.savingId) return false;
  const requestId = ++requestSequence;
  dispatch({ type: SAVE_REQUEST, id, requestId });
  const active = () => getState().Wishlist.saveRequestId === requestId;
  let userId;
  try {
    const user = responseUser(await sdk.currentUser.show());
    userId = user.id.uuid;
    if (!active() || !sameSession(getState(), userId)) return false;
    const ids = savedListingIds(user);
    const next = updatedWishlist(ids, id, save);
    const unchanged =
      next.length === ids.length && next.every((value, index) => value === ids[index]);
    const updated = unchanged
      ? user
      : responseUser(
          await sdk.currentUser.updateProfile(
            { privateData: { [WISHLIST_KEY]: next } },
            { expand: true }
          )
        );
    if (!active() || !sameSession(getState(), userId)) return false;
    dispatch(currentUserShowSuccess(updated));
    dispatch({ type: SAVE_SUCCESS });
    return true;
  } catch (error) {
    if (
      active() &&
      getState().Auth.isAuthenticated &&
      (!userId || sameSession(getState(), userId))
    ) {
      dispatch({
        type: SAVE_ERROR,
        id,
        message:
          error.code === 'wishlist-full'
            ? error.message
            : 'Could not save this space. Please try again.',
      });
    }
    return false;
  } finally {
    if (active()) dispatch({ type: SAVE_SUCCESS });
  }
};

export const loadWishlist = (pendingId = null) => async (dispatch, getState, sdk) => {
  const requestId = ++requestSequence;
  dispatch({ type: LOAD_REQUEST, requestId });
  const active = () => getState().Wishlist.loadRequestId === requestId;
  let userId;
  try {
    const user = responseUser(await sdk.currentUser.show());
    userId = user.id.uuid;
    if (!active() || !sameSession(getState(), userId)) return;
    dispatch(currentUserShowSuccess(user));
    // A guest's Save click survives the existing login redirect; repeated loads are idempotent.
    if (isListingId(pendingId)) {
      const saved = await dispatch(setSavedListing(pendingId, true));
      if (!saved && sameSession(getState(), userId))
        throw new Error('Could not save the selected space.');
    }
    if (!active() || !sameSession(getState(), userId)) return;
    const ids = savedListingIds(getState().user.currentUser);
    if (!ids.length) {
      dispatch({ type: LOAD_SUCCESS, ids: [] });
      return;
    }
    const responses = [];
    for (let index = 0; index < ids.length; index += 100) {
      responses.push(
        await sdk.listings.query({
          ids: ids.slice(index, index + 100),
          per_page: 100,
          include: ['author', 'images'],
          'fields.listing': ['title', 'geolocation', 'price', 'publicData'],
          'fields.user': ['profile.displayName', 'profile.abbreviatedName'],
          'fields.image': ['variants.landscape-crop', 'variants.landscape-crop2x'],
          'limit.images': 1,
        })
      );
    }
    if (!active() || !sameSession(getState(), userId)) return;
    responses.forEach(response => dispatch(addMarketplaceEntities(response)));
    dispatch({
      type: LOAD_SUCCESS,
      ids: responses.reduce(
        (all, response) => all.concat(response.data.data.map(listing => listing.id)),
        []
      ),
    });
  } catch (error) {
    if (
      active() &&
      getState().Auth.isAuthenticated &&
      (!userId || sameSession(getState(), userId))
    ) {
      dispatch({ type: LOAD_ERROR, error: storableError(error) });
    }
  }
};

export const loadData = (params, search) => loadWishlist(new URLSearchParams(search).get('save'));
