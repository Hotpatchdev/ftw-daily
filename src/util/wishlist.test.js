import { savedListingIds, updatedWishlist, WISHLIST_KEY, MAX_SAVED_SPACES } from './wishlist';

const id = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
describe('wishlist data', () => {
  it('reads only the private account field and ignores malformed or duplicate ids', () => {
    expect(savedListingIds(null)).toEqual([]);
    expect(
      savedListingIds({
        attributes: {
          profile: {
            publicData: { [WISHLIST_KEY]: [other] },
            privateData: { [WISHLIST_KEY]: [id, id, null, '<invalid>'] },
          },
        },
      })
    ).toEqual([id]);
  });
  it('adds idempotently and removes a selected space without changing others', () => {
    expect(updatedWishlist([id], id, true)).toEqual([id]);
    expect(updatedWishlist([id], other, true)).toEqual([id, other]);
    expect(updatedWishlist([id, other], id, false)).toEqual([other]);
  });
  it('rejects malformed ids and prevents oversize saves while allowing removals', () => {
    expect(() => updatedWishlist([], 'bad-id', true)).toThrow();
    const ids = Array.from(
      { length: MAX_SAVED_SPACES },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`
    );
    expect(() => updatedWishlist(ids, '11111111-1111-4111-8111-111111111111', true)).toThrow(
      'wishlist is full'
    );
    expect(updatedWishlist(ids, ids[0], false)).toHaveLength(MAX_SAVED_SPACES - 1);
  });
});
