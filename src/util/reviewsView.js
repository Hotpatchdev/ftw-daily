import { denormalisedResponseEntities } from './data';

export const REVIEWS_PAGE_SIZE = 10;
export const reviewViewParams = search => {
  const query = new URLSearchParams(search);
  const sort = ['recent', 'highest', 'lowest'].includes(query.get('sort'))
    ? query.get('sort')
    : 'recent';
  const rawPage = query.get('page') || '1';
  const page =
    /^\d+$/.test(rawPage) && Number.isSafeInteger(Number(rawPage)) && Number(rawPage) > 0
      ? Number(rawPage)
      : 1;
  return { sort, page };
};

export const sortedReviews = (reviews, sort) =>
  [...reviews].sort((a, b) => {
    const rating =
      sort === 'highest'
        ? b.attributes.rating - a.attributes.rating
        : sort === 'lowest'
        ? a.attributes.rating - b.attributes.rating
        : 0;
    return (
      rating ||
      b.attributes.createdAt.getTime() - a.attributes.createdAt.getTime() ||
      a.id.uuid.localeCompare(b.id.uuid)
    );
  });

// The review API does not reliably validate sort parameters. Never sort only a
// partially fetched page while describing it as the full listing's reviews.
export const fetchCompleteReviews = async (sdk, listingId, active = () => true) => {
  const collected = [];
  const seen = new Set();
  let expected = null;
  let pages = 1;
  for (let page = 1; page <= pages; page += 1) {
    if (!active()) throw new Error('Review request superseded');
    const response = await sdk.reviews.query({
      listing_id: listingId,
      state: 'public',
      type: 'ofProvider',
      page,
      per_page: 100,
      include: ['author', 'author.profileImage'],
      'fields.image': ['variants.square-small', 'variants.square-small2x'],
    });
    if (!active()) throw new Error('Review request superseded');
    const { data, meta } = response.data;
    if (
      !Array.isArray(data) ||
      !meta ||
      !Number.isInteger(meta.totalItems) ||
      meta.totalItems < 0 ||
      !Number.isInteger(meta.totalPages) ||
      meta.totalPages < 0 ||
      meta.totalPages > 100 ||
      meta.totalItems > 10000 ||
      (expected !== null && expected !== meta.totalItems) ||
      (page > 1 && pages !== meta.totalPages)
    ) {
      throw new Error('A complete review collection is unavailable');
    }
    expected = meta.totalItems;
    pages = meta.totalPages;
    const reviews = denormalisedResponseEntities(response);
    for (const review of reviews) {
      if (
        !review.id ||
        typeof review.id.uuid !== 'string' ||
        !review.id.uuid ||
        seen.has(review.id.uuid)
      )
        throw new Error('Review collection changed');
      seen.add(review.id.uuid);
      collected.push(review);
    }
  }
  if (collected.length !== expected) throw new Error('Review collection is incomplete');
  return collected
    .filter(
      review => review.attributes.state === 'public' && review.attributes.type === 'ofProvider'
    )
    .map(review => {
      const { rating, createdAt } = review.attributes;
      if (
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5 ||
        !(createdAt instanceof Date) ||
        !Number.isFinite(createdAt.getTime())
      ) {
        throw new Error('Invalid review data');
      }
      return review;
    });
};
