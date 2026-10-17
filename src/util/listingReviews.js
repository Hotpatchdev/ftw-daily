// Fetch only public reviews of the space/provider. Never use reviews of customers.
// Cache complete summaries and bound both concurrency and pagination so cards
// cannot create an unbounded burst of Marketplace API requests.
export const createReviewSummaryLoader = sdk => {
  const cache = new Map();
  const queue = [];
  let active = 0;
  const run = () => {
    if (active >= 3 || !queue.length) return;
    active += 1;
    const { work, resolve, reject } = queue.shift();
    Promise.resolve()
      .then(work)
      .then(resolve, reject)
      .finally(() => {
        active -= 1;
        run();
      });
  };

  return listingId => {
    const existing = cache.get(listingId);
    if (existing && existing.expires > Date.now()) return existing.promise;
    const promise = new Promise((resolve, reject) => {
      queue.push({
        resolve,
        reject,
        work: async () => {
          let count = 0;
          let sum = 0;
          let total = null;
          const seen = new Set();
          for (let page = 1; page <= 5; page += 1) {
            const response = await sdk.reviews.query({
              listing_id: listingId,
              state: 'public',
              type: 'ofProvider',
              per_page: 100,
              page,
            });
            const { data, meta } = response.data;
            if (
              !Array.isArray(data) ||
              !meta ||
              !Number.isInteger(meta.totalItems) ||
              !Number.isInteger(meta.totalPages) ||
              meta.totalItems > 500 ||
              (total !== null && total !== meta.totalItems)
            ) {
              throw new Error('A complete review summary is unavailable');
            }
            total = meta.totalItems;
            for (const review of data) {
              const { rating, type, state } = review.attributes;
              const id = review.id.uuid;
              if (
                !id ||
                seen.has(id) ||
                type !== 'ofProvider' ||
                state !== 'public' ||
                !Number.isInteger(rating) ||
                rating < 1 ||
                rating > 5
              ) {
                throw new Error('Invalid review summary data');
              }
              seen.add(id);
              count += 1;
              sum += rating;
            }
            if (page >= meta.totalPages) {
              if (count !== total) throw new Error('Incomplete review summary');
              return { count, average: count ? sum / count : null };
            }
          }
          throw new Error('A complete review summary is unavailable');
        },
      });
      run();
    });
    const entry = { promise, expires: Date.now() + 5 * 60 * 1000 };
    cache.set(listingId, entry);
    if (cache.size > 200) cache.delete(cache.keys().next().value);
    promise.catch(() => {
      if (cache.get(listingId) === entry) cache.delete(listingId);
    });
    return promise;
  };
};
