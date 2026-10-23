import {
  normaliseSchedule,
  scheduleIntervals,
  meetsListingMinimum,
  slotsCoverSchedule,
} from './bookingSchedule';

const candidateLimit = 200;
const cache = new Map();
const availabilityCache = new Map();
const idOf = entity => entity.id && entity.id.uuid;
const ensureActive = active => {
  if (!active()) throw new Error('Schedule search superseded');
};

export const fetchListingScheduleSlots = async (sdk, listing, schedule, active = () => true) => {
  const key = `${idOf(listing)}:${JSON.stringify(normaliseSchedule(schedule))}`;
  const cached = availabilityCache.get(key);
  if (cached && Date.now() - cached.at < 60000) {
    ensureActive(active);
    return cached.slots;
  }
  const intervals = scheduleIntervals(schedule);
  const start = intervals[0].start;
  const end = intervals[intervals.length - 1].end;
  const slots = [],
    seen = new Set();
  let total = null,
    pages = 1;
  for (let page = 1; page <= pages; page += 1) {
    ensureActive(active);
    const response = await sdk.timeslots.query({
      listingId: listing.id,
      start,
      end,
      per_page: 500,
      page,
    });
    ensureActive(active);
    const { data, meta } = response.data;
    if (
      !Array.isArray(data) ||
      !meta ||
      !Number.isInteger(meta.totalItems) ||
      meta.totalItems < 0 ||
      !Number.isInteger(meta.totalPages) ||
      meta.totalPages < 0 ||
      meta.totalPages > 10 ||
      (total !== null && (total !== meta.totalItems || pages !== meta.totalPages))
    )
      throw new Error('Availability changed or could not be checked completely. Please retry.');
    total = meta.totalItems;
    pages = meta.totalPages;
    data.forEach(slot => {
      const id = idOf(slot);
      if (!id || seen.has(id)) throw new Error('Availability changed. Please retry.');
      seen.add(id);
      slots.push(slot);
    });
  }
  if (slots.length !== total)
    throw new Error('Availability could not be checked completely. Please retry.');
  if (availabilityCache.size >= 300)
    availabilityCache.delete(availabilityCache.keys().next().value);
  availabilityCache.set(key, { at: Date.now(), slots });
  return slots;
};

// Fetch the complete candidate collection before filtering and paginating it.
// This avoids presenting a full result count for a partially checked page.
export const queryScheduledListings = async (
  sdk,
  params,
  active = () => true,
  supportedCurrencies
) => {
  const schedule = normaliseSchedule(params.schedule);
  const intervals = scheduleIntervals(schedule);
  if (
    intervals[0].start.getTime() < Date.now() - 86400000 ||
    intervals[intervals.length - 1].end.getTime() > Date.now() + 365 * 86400000
  )
    throw new Error('Choose future booking dates within the next year.');
  const {
    schedule: ignored,
    dates,
    per_page = 24,
    page = 1,
    start,
    end,
    availability,
    minDuration,
    ...base
  } = params;
  const key = JSON.stringify({ ...base, schedule, supportedCurrencies });
  const cached = cache.get(key);
  let result;
  if (cached && Date.now() - cached.at < 60000) result = cached.result;
  else {
    let first,
      total = null,
      pages = 1;
    const all = [],
      included = new Map(),
      seen = new Set();
    const fields = Array.isArray(base['fields.listing'])
      ? base['fields.listing']
      : ['title', 'geolocation', 'price', 'publicData'];
    for (let candidatePage = 1; candidatePage <= pages; candidatePage += 1) {
      ensureActive(active);
      const response = await sdk.listings.query({
        ...base,
        'fields.listing': Array.from(
          new Set(fields.concat('availabilityPlan', 'publicData', 'price'))
        ),
        per_page: 100,
        page: candidatePage,
      });
      ensureActive(active);
      const { data, meta } = response.data;
      if (
        !Array.isArray(data) ||
        !meta ||
        !Number.isInteger(meta.totalItems) ||
        meta.totalItems < 0 ||
        meta.totalItems > candidateLimit ||
        !Number.isInteger(meta.totalPages) ||
        meta.totalPages < 0 ||
        meta.totalPages > 2 ||
        (total !== null && (total !== meta.totalItems || pages !== meta.totalPages))
      )
        throw new Error(
          'Narrow your location or filters so all session availability can be checked.'
        );
      first = first || response;
      total = meta.totalItems;
      pages = meta.totalPages;
      data.forEach(listing => {
        const id = idOf(listing);
        if (!id || seen.has(id)) throw new Error('Search results changed. Please retry.');
        seen.add(id);
        all.push(listing);
      });
      (response.data.included || []).forEach(entity =>
        included.set(`${entity.type}:${idOf(entity)}`, entity)
      );
    }
    if (all.length !== total)
      throw new Error('Search results could not be checked completely. Please retry.');
    const candidates = all.filter(listing => {
      const attributes = listing.attributes || {};
      const price =
        schedule.unit === 'hourly' ? attributes.price : (attributes.publicData || {}).pricePerDay;
      return (
        price &&
        Number.isSafeInteger(price.amount) &&
        price.amount > 0 &&
        typeof price.currency === 'string' &&
        (!supportedCurrencies || supportedCurrencies.includes(price.currency)) &&
        meetsListingMinimum(listing, schedule)
      );
    });
    const matches = new Set();
    let failed = false;
    const current = () => !failed && active();
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(4, candidates.length) }, async () => {
        while (next < candidates.length) {
          ensureActive(current);
          const listing = candidates[next++];
          let slots;
          try {
            slots = await fetchListingScheduleSlots(sdk, listing, schedule, current);
          } catch (error) {
            failed = true;
            throw error;
          }
          if (slotsCoverSchedule(slots, schedule)) matches.add(idOf(listing));
        }
      })
    );
    ensureActive(active);
    result = {
      response: first,
      listings: all.filter(listing => matches.has(idOf(listing))),
      included: Array.from(included.values()),
    };
    if (cache.size >= 8) cache.delete(cache.keys().next().value);
    cache.set(key, { at: Date.now(), result });
  }
  ensureActive(active);
  const size = Math.min(100, Math.max(1, Number(per_page) || 24));
  const selectedPage = Math.max(1, Number(page) || 1);
  const data = result.listings.slice((selectedPage - 1) * size, selectedPage * size);
  return {
    ...result.response,
    data: {
      ...result.response.data,
      data,
      included: result.included,
      meta: {
        totalItems: result.listings.length,
        totalPages: Math.ceil(result.listings.length / size),
        page: selectedPage,
        perPage: size,
      },
    },
  };
};

export const clearScheduleSearchCache = () => {
  cache.clear();
  availabilityCache.clear();
};
