import { getAvailablePrices } from './data';
import { groupAmenities } from './amenityGroups';

export const MAX_COMPARED_SPACES = 3;

export const comparisonIds = value =>
  Array.from(new Set((value || '').split(',')))
    .filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    .slice(0, MAX_COMPARED_SPACES);

export const comparisonPrices = listings => {
  const prices = listings.map(listing =>
    getAvailablePrices(listing).filter(
      ({ value }) =>
        value &&
        Number.isSafeInteger(value.amount) &&
        value.amount >= 0 &&
        typeof value.currency === 'string' &&
        /^[A-Z]{3}$/.test(value.currency)
    )
  );
  return ['price', 'pricePerDay', 'pricePerWeek', 'pricePerMonth']
    .map(key => ({
      key,
      values: prices.map(items => {
        const item = items.find(item => item.key === key);
        return item ? item.value : null;
      }),
    }))
    .filter(row => row.values.some(Boolean));
};

export const comparisonAmenities = (listings, options) => {
  const selected = new Set();
  listings.forEach(listing => {
    const amenities = (listing.attributes.publicData || {}).amenities;
    if (Array.isArray(amenities)) amenities.forEach(key => selected.add(key));
  });
  return groupAmenities(options.filter(option => selected.has(option.key)));
};
