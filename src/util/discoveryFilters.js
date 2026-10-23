import config from '../config';
import { formatDateStringToUTC, getExclusiveEndDate } from './dates';
import { unitDivisor } from './currency';
import { queryScheduledListings } from './scheduleSearch';

export const priceUnits = [
  { param: 'price', field: 'price', label: 'hour', adjective: 'hourly' },
  { param: 'pub_pricePerDayFilter', field: 'pricePerDay', label: 'day', adjective: 'daily' },
  { param: 'pub_pricePerWeekFilter', field: 'pricePerWeek', label: 'week', adjective: 'weekly' },
  {
    param: 'pub_pricePerMonthFilter',
    field: 'pricePerMonth',
    label: 'month',
    adjective: 'monthly',
  },
];

export const selectedValues = value =>
  typeof value === 'string'
    ? Array.from(
        new Set(
          value
            .replace(/^has_(any|all):/, '')
            .split(',')
            .filter(Boolean)
        )
      )
    : [];

export const toggleFilterValue = (params, param, key, defaultMode = 'has_any') => {
  const values = selectedValues(params[param]);
  const next = values.includes(key) ? values.filter(v => v !== key) : values.concat(key);
  const mode = (String(params[param] || '').match(/^has_(any|all):/) || [`${defaultMode}:`])[0];
  return { ...params, [param]: next.length ? mode + next.join(',') : undefined };
};

export const validDate = value =>
  /^\d{4}-\d{2}-\d{2}$/.test(value || '') &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;

// Match search's date/bounds/category semantics, but exclude the selected price
// range so dragging it never makes the underlying distribution shrink.
export const pricePopulationQuery = params => {
  const query = {};
  ['bounds', 'keywords', 'pub_category', 'pub_amenities'].forEach(key => {
    if (params[key]) query[key] = params[key];
  });
  if (config.sortSearchByDistance && params.origin) query.origin = params.origin;
  if (params.schedule) return { ...query, schedule: params.schedule };
  const dates = typeof params.dates === 'string' ? params.dates.split(',') : [];
  if (dates.length === 2 && dates.every(validDate) && dates[0] <= dates[1]) {
    query.start = formatDateStringToUTC(dates[0]);
    query.end = formatDateStringToUTC(getExclusiveEndDate(dates[1]));
    query.availability = 'full';
  }
  return query;
};

export const pricePopulationKey = params => JSON.stringify(pricePopulationQuery(params));

export const fetchPricePopulation = async (sdk, params, active = () => true) => {
  const collected = [];
  const seen = new Set();
  let expected = null;
  let pages = 1;
  for (let page = 1; page <= pages; page += 1) {
    if (!active()) throw new Error('Price request superseded');
    const request = {
      ...pricePopulationQuery(params),
      page,
      per_page: 100,
      'fields.listing': ['price', 'publicData'],
    };
    const response = await (params.schedule
      ? queryScheduledListings(sdk, request, active, [config.currency, config.additionalCurrency])
      : sdk.listings.query(request));
    if (!active()) throw new Error('Price request superseded');
    const { data, meta } = response.data;
    if (
      !Array.isArray(data) ||
      !meta ||
      !Number.isInteger(meta.totalItems) ||
      meta.totalItems < 0 ||
      meta.totalItems > 5000 ||
      !Number.isInteger(meta.totalPages) ||
      meta.totalPages < 0 ||
      meta.totalPages > 50 ||
      (expected !== null && expected !== meta.totalItems) ||
      (page > 1 && pages !== meta.totalPages)
    )
      throw new Error('Complete price data unavailable');
    expected = meta.totalItems;
    pages = meta.totalPages;
    data.forEach(listing => {
      const id = listing.id && listing.id.uuid;
      if (!id || seen.has(id)) throw new Error('Price collection changed');
      seen.add(id);
      collected.push(listing);
    });
  }
  if (collected.length !== expected) throw new Error('Price collection incomplete');
  return collected;
};

const cache = new Map();
export const loadPricePopulation = (params, force = false, active) => async (
  dispatch,
  getState,
  sdk
) => {
  const key = pricePopulationKey(params);
  const cached = cache.get(key);
  if (!force && cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.listings;
  const listings = await fetchPricePopulation(sdk, params, active);
  if (cache.size >= 8) cache.delete(cache.keys().next().value);
  cache.set(key, { listings, at: Date.now() });
  return listings;
};

export const priceSummary = (listings, field, currency) => {
  const divisor = unitDivisor(currency);
  const values = listings
    .map(listing => {
      const attributes = listing.attributes || {};
      const money = field === 'price' ? attributes.price : (attributes.publicData || {})[field];
      return money &&
        money.currency === currency &&
        Number.isSafeInteger(money.amount) &&
        money.amount >= 0
        ? money.amount / divisor
        : null;
    })
    .filter(value => value !== null);
  return {
    values,
    count: values.length,
    average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
  };
};

export const histogram = (values, max, count = 12) => {
  const bins = Array.from({ length: count }, (_, index) => ({
    min: (index * max) / count,
    max: ((index + 1) * max) / count,
    count: 0,
  }));
  values.forEach(value => {
    if (value >= 0 && value <= max)
      bins[Math.min(count - 1, Math.floor((value / max) * count))].count += 1;
  });
  return bins;
};

export const essentials = [
  { key: 'windows', label: 'Windows', icon: 'sun' },
  { key: 'wifi', label: 'WiFi', icon: 'wifi' },
  { key: 'air-conditioning', label: 'Heating / AC', icon: 'heat' },
  { key: 'free-parking', label: 'Free parking', icon: 'parking' },
  { key: 'toilet', label: 'Toilet / washroom', icon: 'bathroom' },
  { key: 'bathroom', label: 'Bathroom', icon: 'bathroom' },
];
