import { comparisonIds, comparisonPrices, comparisonAmenities } from './spaceComparison';

const listing = (price, publicData = {}) => ({ attributes: { price, publicData } });
const ids = [1, 2, 3, 4].map(n => `00000000-0000-4000-8000-00000000000${n}`);

describe('saved-space comparison', () => {
  it('deduplicates and limits valid comparison IDs', () => {
    expect(comparisonIds([ids[0], 'invalid', ids[0], ...ids.slice(1)].join(','))).toEqual(
      ids.slice(0, 3)
    );
    expect(comparisonIds(null)).toEqual([]);
  });

  it('keeps every listed rate in its actual currency and booking unit', () => {
    const hourly = { amount: 2500, currency: 'GBP' };
    const daily = { amount: 12000, currency: 'GBP' };
    const monthly = { amount: 250000, currency: 'USD' };
    expect(
      comparisonPrices([
        listing(hourly, { pricePerDay: daily }),
        listing(null, { pricePerMonth: monthly }),
      ])
    ).toEqual([
      { key: 'price', values: [hourly, null] },
      { key: 'pricePerDay', values: [daily, null] },
      { key: 'pricePerMonth', values: [null, monthly] },
    ]);
  });

  it('does not invent a price for missing or invalid amounts, and keeps a valid zero', () => {
    expect(
      comparisonPrices([listing(null, { pricePerDay: { amount: '1000', currency: 'GBP' } })])
    ).toEqual([]);
    const free = { amount: 0, currency: 'GBP' };
    expect(comparisonPrices([listing(free)])).toEqual([{ key: 'price', values: [free] }]);
  });

  it('includes the union of known selected amenities, once each', () => {
    const wifi = { key: 'wifi', label: 'WiFi' };
    const parking = { key: 'free-parking', label: 'Free parking' };
    const options = [wifi, parking, wifi, { key: 'kitchen', label: 'Kitchen' }];
    const groups = comparisonAmenities(
      [
        listing(null, { amenities: ['wifi', 'wifi'] }),
        listing(null, { amenities: ['free-parking', 'unknown'] }),
        listing(null),
      ],
      options
    );
    const keys = groups.reduce(
      (all, group) => all.concat(group.options.map(option => option.key)),
      []
    );
    expect(keys.sort()).toEqual(['free-parking', 'wifi']);
  });
});
