import { createReviewSummaryLoader } from './listingReviews';

const review = (id, rating) => ({
  id: { uuid: id },
  attributes: { rating, type: 'ofProvider', state: 'public' },
});
const response = (data, totalItems = data.length, totalPages = 1) => ({
  data: { data, meta: { totalItems, totalPages } },
});

describe('public listing review summaries', () => {
  it('combines all pages and caches the result for the same listing', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce(response([review('a', 5)], 2, 2))
      .mockResolvedValueOnce(response([review('b', 4)], 2, 2));
    const load = createReviewSummaryLoader({ reviews: { query } });
    const pending = load('listing');
    expect(load('listing')).toBe(pending);
    expect(await pending).toEqual({ average: 4.5, count: 2 });
    expect(await load('listing')).toEqual({ average: 4.5, count: 2 });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenLastCalledWith({
      listing_id: 'listing',
      state: 'public',
      type: 'ofProvider',
      per_page: 100,
      page: 2,
    });
  });

  it('distinguishes a genuinely unreviewed listing from an API failure', async () => {
    const query = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(response([], 0, 0));
    const load = createReviewSummaryLoader({ reviews: { query } });
    await expect(load('listing')).rejects.toThrow('offline');
    await expect(load('listing')).resolves.toEqual({ average: null, count: 0 });
  });

  it.each([
    response([review('a', 0)]),
    response([
      { ...review('a', 5), attributes: { rating: 5, type: 'ofCustomer', state: 'public' } },
    ]),
    response([review('a', 5), review('a', 5)]),
    response([review('a', 5)], 2),
    response([review('a', 5)], 501, 6),
  ])('never presents an invalid, partial or oversized dataset as a full rating', async data => {
    const load = createReviewSummaryLoader({ reviews: { query: () => Promise.resolve(data) } });
    await expect(load('listing')).rejects.toThrow();
  });

  it('limits simultaneous requests when many cards enter view', async () => {
    let active = 0;
    let maximum = 0;
    const query = () => {
      active += 1;
      maximum = Math.max(maximum, active);
      return new Promise(resolve =>
        setTimeout(() => {
          active -= 1;
          resolve(response([]));
        }, 1)
      );
    };
    const load = createReviewSummaryLoader({ reviews: { query } });
    await Promise.all(Array.from({ length: 12 }, (_, i) => load(String(i))));
    expect(maximum).toBe(3);
  });
});
