export const WISHLIST_KEY = 'hotpatchSavedListingIds';
export const MAX_SAVED_SPACES = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isListingId = value => typeof value === 'string' && UUID.test(value);

export const savedListingIds = user => {
  const profile = user && user.attributes && user.attributes.profile;
  const values = profile && profile.privateData && profile.privateData[WISHLIST_KEY];
  return Array.isArray(values) ? Array.from(new Set(values.filter(isListingId))) : [];
};

export const updatedWishlist = (ids, id, save) => {
  if (!isListingId(id)) throw new Error('This space cannot be saved.');
  if (!save) return ids.filter(value => value !== id);
  if (ids.includes(id)) return ids;
  if (ids.length >= MAX_SAVED_SPACES) {
    const error = new Error('Your wishlist is full. Remove a space before saving another.');
    error.code = 'wishlist-full';
    throw error;
  }
  return ids.concat(id);
};
