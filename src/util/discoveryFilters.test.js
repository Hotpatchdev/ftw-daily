import {
  toggleFilterValue,
  pricePopulationQuery,
  pricePopulationKey,
  fetchPricePopulation,
  priceSummary,
  histogram,
} from './discoveryFilters';

const listing = (id, amount, currency = 'GBP', daily = null) => ({
  id: { uuid: id },
  attributes: {
    price: { amount, currency },
    publicData: daily ? { pricePerDay: { amount: daily, currency } } : {},
  },
});
const response = (data, totalItems, totalPages) => ({
  data: { data, meta: { totalItems, totalPages } },
});

it('preserves matching modes and selections from other amenity groups', () => {
  const original = { pub_amenities: 'has_all:wifi,barber-chair', bounds: 'area' };
  expect(toggleFilterValue(original, 'pub_amenities', 'windows')).toEqual({
    ...original,
    pub_amenities: 'has_all:wifi,barber-chair,windows',
  });
  expect(toggleFilterValue(original, 'pub_amenities', 'wifi').pub_amenities).toBe(
    'has_all:barber-chair'
  );
  expect(original.pub_amenities).toBe('has_all:wifi,barber-chair');
});

it('excludes pricing, pagination and sorting from the population, keeping search criteria', () => {
  const input = {
    keywords: 'salon',
    bounds: 'area',
    dates: '2026-11-01,2026-11-02',
    pub_category: 'has_any:barber',
    pub_amenities: 'has_all:wifi',
    price: '10,50',
    page: 3,
    pub_pricePerWeekFilter: '100,200',
    sort: 'price',
    address: 'London',
  };
  const query = pricePopulationQuery(input);
  expect(query).toEqual(
    expect.objectContaining({
      keywords: 'salon',
      bounds: 'area',
      pub_category: 'has_any:barber',
      pub_amenities: 'has_all:wifi',
      availability: 'full',
    })
  );
  expect(new Date(query.start).toISOString()).toBe('2026-11-01T00:00:00.000Z');
  expect(new Date(query.end).toISOString()).toBe('2026-11-03T00:00:00.000Z');
  expect(query.price).toBeUndefined();
  expect(pricePopulationKey(input)).toBe(pricePopulationKey({ ...input, price: '20,80', page: 8 }));
});

it('collects every result page before calculating statistics', async () => {
  const sdk = {
    listings: {
      query: jest
        .fn()
        .mockResolvedValueOnce(response([listing('a', 1000)], 2, 2))
        .mockResolvedValueOnce(response([listing('b', 3000)], 2, 2)),
    },
  };
  const all = await fetchPricePopulation(sdk, { price: '1,2' });
  expect(all).toHaveLength(2);
  expect(sdk.listings.query.mock.calls[1][0]).toEqual(
    expect.objectContaining({ page: 2, per_page: 100 })
  );
  expect(priceSummary(all, 'price', 'GBP').average).toBe(20);
});

it('rejects partial, changing and oversized populations instead of showing a misleading average', async () => {
  for (const pages of [
    [response([listing('a', 100)], 2, 1)],
    [response([listing('a', 100)], 2, 2), response([listing('a', 100)], 2, 2)],
    [response([], 5001, 51)],
    [response([listing('a', 100)], 2, 2), response([listing('b', 100)], 3, 2)],
  ]) {
    const query = jest.fn();
    pages.forEach(page => query.mockResolvedValueOnce(page));
    await expect(fetchPricePopulation({ listings: { query } }, {})).rejects.toThrow();
  }
});

it('separates actual currencies and units and excludes missing or malformed rates', () => {
  const all = [
    listing('a', 1000, 'GBP', 9000),
    listing('b', 3000),
    listing('c', 100000, 'USD'),
    listing('d', -100),
    listing('e', NaN),
    listing('f', '1500'),
  ];
  expect(priceSummary(all, 'price', 'GBP')).toEqual({ values: [10, 30], count: 2, average: 20 });
  expect(priceSummary(all, 'pricePerDay', 'GBP')).toEqual({ values: [90], count: 1, average: 90 });
  expect(priceSummary([], 'price', 'GBP').average).toBe(null);
});

it('bins each rate once, including zero and the upper boundary', () => {
  const bins = histogram([0, 10, 20, 30], 30, 3);
  expect(bins.map(bin => bin.count)).toEqual([1, 1, 2]);
  expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(4);
});

it('stops collecting when the user closes or changes the filter context', async () => {
  const query = jest.fn().mockResolvedValue(response([listing('a', 100)], 2, 2));
  let active = true;
  query.mockImplementationOnce(async () => {
    active = false;
    return response([listing('a', 100)], 2, 2);
  });
  await expect(fetchPricePopulation({ listings: { query } }, {}, () => active)).rejects.toThrow(
    'superseded'
  );
  expect(query).toHaveBeenCalledTimes(1);
});
