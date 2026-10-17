import { fetchCompleteReviews, sortedReviews, reviewViewParams } from './reviewsView';
import { types } from './sdkLoader';

const review = (id, rating, day, extra = {}) => ({
  id: new types.UUID(id),
  type: 'review',
  attributes: {
    rating,
    createdAt: new Date(`2026-01-${day}T12:00:00Z`),
    type: 'ofProvider',
    state: 'public',
    content: 'Review text',
    ...extra,
  },
});
const response = (data, totalItems = data.length, totalPages = 1) => ({
  data: { data, meta: { totalItems, totalPages } },
});

describe('complete listing reviews', () => {
  it('loads every API page before returning reviews, excluding private and customer reviews', async () => {
    const a = review('a', 2, '01');
    const b = review('b', 5, '02');
    const query = jest
      .fn()
      .mockResolvedValueOnce(response([a], 4, 2))
      .mockResolvedValueOnce(
        response(
          [
            b,
            review('c', 1, '03', { type: 'ofCustomer' }),
            review('d', 1, '04', { state: 'hidden' }),
          ],
          4,
          2
        )
      );
    const result = await fetchCompleteReviews({ reviews: { query } }, 'space');
    expect(result.map(r => r.id.uuid)).toEqual(['a', 'b']);
    expect(query).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, state: 'public', type: 'ofProvider', listing_id: 'space' })
    );
    expect(query.mock.calls[0][0]).not.toHaveProperty('sort');
  });

  it('sorts the full collection by rating or date without changing the original', () => {
    const reviews = [review('a', 2, '03'), review('b', 5, '01'), review('c', 5, '02')];
    expect(sortedReviews(reviews, 'recent').map(r => r.id.uuid)).toEqual(['a', 'c', 'b']);
    expect(sortedReviews(reviews, 'highest').map(r => r.id.uuid)).toEqual(['c', 'b', 'a']);
    expect(sortedReviews(reviews, 'lowest').map(r => r.id.uuid)).toEqual(['a', 'c', 'b']);
    expect(reviews.map(r => r.id.uuid)).toEqual(['a', 'b', 'c']);
  });

  it('uses stable IDs to break equal rating/date ties', () => {
    expect(
      sortedReviews([review('b', 5, '01'), review('a', 5, '01')], 'highest').map(r => r.id.uuid)
    ).toEqual(['a', 'b']);
  });

  it('normalises invalid sort and page query values', () => {
    expect(reviewViewParams('?sort=unsupported&page=-1')).toEqual({ sort: 'recent', page: 1 });
    expect(reviewViewParams('?sort=lowest&page=2')).toEqual({ sort: 'lowest', page: 2 });
    expect(reviewViewParams('?page=1bad').page).toBe(1);
  });

  it('does not return a partial dataset when a later page fails', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce(response([review('a', 2, '01')], 2, 2))
      .mockRejectedValueOnce(new Error('offline'));
    await expect(fetchCompleteReviews({ reviews: { query } }, 'space')).rejects.toThrow('offline');
  });

  it.each([
    response([review('a', 1, '01')], 2, 1),
    response([review('a', 1, '01'), review('a', 1, '01')]),
    response([review('a', 6, '01')]),
    response([], 10001, 101),
  ])('rejects incomplete, duplicate, invalid or out-of-range collections', async data => {
    await expect(
      fetchCompleteReviews({ reviews: { query: () => Promise.resolve(data) } }, 'space')
    ).rejects.toThrow();
  });

  it('stops a superseded load before making another request', async () => {
    const query = jest.fn();
    await expect(
      fetchCompleteReviews({ reviews: { query } }, 'space', () => false)
    ).rejects.toThrow('superseded');
    expect(query).not.toHaveBeenCalled();
  });
});
