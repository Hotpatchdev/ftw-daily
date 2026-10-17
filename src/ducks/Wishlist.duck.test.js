import reducer, {
  setSavedListing,
  loadWishlist,
  SAVE_REQUEST,
  SAVE_ERROR,
  SAVE_SUCCESS,
  LOAD_ERROR,
} from './Wishlist.duck';
import { currentUserShowSuccess } from './user.duck';
import { WISHLIST_KEY } from '../util/wishlist';
import { types } from '../util/sdkLoader';

const { UUID } = types;
const userId = '11111111-1111-4111-8111-111111111111';
const first = '00000000-0000-4000-8000-000000000001';
const second = '00000000-0000-4000-8000-000000000002';
const user = (ids = []) => ({
  id: new UUID(userId),
  type: 'currentUser',
  attributes: {
    profile: {
      displayName: 'Test',
      privateData: { unrelatedSetting: 'keep', [WISHLIST_KEY]: ids },
    },
  },
});
const response = entity => ({ data: { data: entity } });
const setup = (ids = []) => {
  let state = {
    Auth: { isAuthenticated: true },
    user: { currentUser: user(ids) },
    Wishlist: reducer(),
  };
  const actions = [];
  const sdk = {
    currentUser: {
      show: jest.fn().mockResolvedValue(response(user(ids))),
      updateProfile: jest.fn(),
    },
    listings: { query: jest.fn() },
  };
  const getState = () => state;
  const dispatch = action => {
    if (typeof action === 'function') return action(dispatch, getState, sdk);
    actions.push(action);
    state = { ...state, Wishlist: reducer(state.Wishlist, action) };
    if (action.type === currentUserShowSuccess().type) state.user = { currentUser: action.payload };
    return action;
  };
  return {
    dispatch,
    getState,
    sdk,
    actions,
    loginWithoutLoadedProfile: () => {
      state = { ...state, Auth: { isAuthenticated: true }, user: { currentUser: null } };
    },
    logout: () => {
      state = {
        ...state,
        Auth: { isAuthenticated: false },
        user: { currentUser: null },
        Wishlist: reducer(),
      };
    },
  };
};

describe('account-backed wishlist', () => {
  it('reads fresh server data and updates only the namespaced private field', async () => {
    const t = setup();
    t.sdk.currentUser.show.mockResolvedValue(response(user([first])));
    t.sdk.currentUser.updateProfile.mockResolvedValue(response(user([first, second])));
    expect(await t.dispatch(setSavedListing(second, true))).toBe(true);
    expect(t.sdk.currentUser.updateProfile).toHaveBeenCalledWith(
      { privateData: { [WISHLIST_KEY]: [first, second] } },
      { expand: true }
    );
    expect(t.getState().user.currentUser.attributes.profile.privateData.unrelatedSetting).toBe(
      'keep'
    );
    expect(t.getState().Wishlist.savingId).toBeNull();
  });
  it('does not rewrite a space already saved after a login redirect', async () => {
    const t = setup([first]);
    expect(await t.dispatch(setSavedListing(first, true))).toBe(true);
    expect(t.sdk.currentUser.updateProfile).not.toHaveBeenCalled();
  });
  it('leaves the existing saved list intact when an API write fails and permits retry', async () => {
    const t = setup([first]);
    t.sdk.currentUser.updateProfile.mockRejectedValue(new Error('Network unavailable'));
    expect(await t.dispatch(setSavedListing(second, true))).toBe(false);
    expect(t.getState().user.currentUser.attributes.profile.privateData[WISHLIST_KEY]).toEqual([
      first,
    ]);
    expect(t.actions.some(action => action.type === SAVE_ERROR)).toBe(true);
    expect(t.actions.some(action => action.type === SAVE_SUCCESS)).toBe(false);
    t.sdk.currentUser.updateProfile.mockResolvedValue(response(user([first, second])));
    expect(await t.dispatch(setSavedListing(second, true))).toBe(true);
  });
  it('serializes saves so rapid clicks cannot overwrite another local change', async () => {
    const t = setup();
    let resolve;
    t.sdk.currentUser.show.mockImplementation(
      () =>
        new Promise(done => {
          resolve = done;
        })
    );
    const pending = t.dispatch(setSavedListing(first, true));
    expect(await t.dispatch(setSavedListing(second, true))).toBe(false);
    expect(t.sdk.currentUser.show).toHaveBeenCalledTimes(1);
    t.sdk.currentUser.updateProfile.mockResolvedValue(response(user([first])));
    resolve(response(user()));
    expect(await pending).toBe(true);
  });
  it('does not restore a previous account into the store after logout', async () => {
    const t = setup();
    let resolve;
    t.sdk.currentUser.show.mockImplementation(
      () =>
        new Promise(done => {
          resolve = done;
        })
    );
    const pending = t.dispatch(setSavedListing(first, true));
    t.logout();
    resolve(response(user()));
    expect(await pending).toBe(false);
    expect(t.getState().user.currentUser).toBeNull();
    expect(t.sdk.currentUser.updateProfile).not.toHaveBeenCalled();
  });
  it('discards an old save when a different login begins before its profile is loaded', async () => {
    const t = setup();
    let resolve;
    t.sdk.currentUser.show.mockImplementation(
      () =>
        new Promise(done => {
          resolve = done;
        })
    );
    const pending = t.dispatch(setSavedListing(first, true));
    t.logout();
    t.loginWithoutLoadedProfile();
    resolve(response(user()));
    expect(await pending).toBe(false);
    expect(t.sdk.currentUser.updateProfile).not.toHaveBeenCalled();
    expect(t.getState().user.currentUser).toBeNull();
  });
  it('fulfils a guest save intent once and then loads that space', async () => {
    const t = setup();
    let ids = [];
    t.sdk.currentUser.show.mockImplementation(() => Promise.resolve(response(user(ids))));
    t.sdk.currentUser.updateProfile.mockImplementation(payload => {
      ids = payload.privateData[WISHLIST_KEY];
      return Promise.resolve(response(user(ids)));
    });
    t.sdk.listings.query.mockResolvedValue({
      data: { data: [{ id: new UUID(first), type: 'listing', attributes: { title: 'Space' } }] },
    });
    await t.dispatch(loadWishlist(first));
    await t.dispatch(loadWishlist(first));
    expect(t.sdk.currentUser.updateProfile).toHaveBeenCalledTimes(1);
    expect(t.getState().Wishlist.loaded).toBe(true);
    expect(t.getState().user.currentUser.attributes.profile.privateData[WISHLIST_KEY]).toEqual([
      first,
    ]);
  });
  it('does not request every marketplace listing for an empty wishlist', async () => {
    const t = setup();
    await t.dispatch(loadWishlist());
    expect(t.sdk.listings.query).not.toHaveBeenCalled();
    expect(t.getState().Wishlist.loaded).toBe(true);
  });
  it('loads only saved ids, retaining unavailable ids on the private list', async () => {
    const t = setup([first, second]);
    t.sdk.listings.query.mockResolvedValue({
      data: { data: [{ id: new UUID(first), type: 'listing', attributes: { title: 'Space' } }] },
    });
    await t.dispatch(loadWishlist());
    expect(t.sdk.listings.query.mock.calls[0][0].ids).toEqual([first, second]);
    expect(t.getState().Wishlist.resultIds.map(id => id.uuid)).toEqual([first]);
    expect(t.getState().user.currentUser.attributes.profile.privateData[WISHLIST_KEY]).toEqual([
      first,
      second,
    ]);
  });
  it('reports a failed wishlist load instead of treating it as an empty list', async () => {
    const t = setup([first]);
    t.sdk.listings.query.mockRejectedValue(new Error('Offline'));
    await t.dispatch(loadWishlist());
    expect(t.actions.some(action => action.type === LOAD_ERROR)).toBe(true);
    expect(t.getState().Wishlist.loaded).toBe(false);
  });
});
