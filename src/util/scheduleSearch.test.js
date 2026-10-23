import { queryScheduledListings, fetchListingScheduleSlots, clearScheduleSearchCache } from './scheduleSearch';

const schedule = JSON.stringify({ unit: 'hourly', days: ['2027-02-01', '2027-02-03'], start: '09:00', end: '15:00', timeZone: 'Europe/London', same: true });
const listing = (id, minimum = 0) => ({ id: { uuid: id }, type: 'listing', attributes: { price: { amount: 2000, currency: 'GBP' }, publicData: { minBooking: minimum ? { minBookingType: 'hourlyMinBooking', minBookingCount: minimum } : {} } } });
const response = (data, total = data.length, pages = 1) => ({ data: { data, meta: { totalItems: total, totalPages: pages }, included: [] } });
const slots = id => response(['01', '03'].map(day => ({ id: { uuid: `${id}-${day}` }, attributes: { start: new Date(`2027-02-${day}T09:00Z`), end: new Date(`2027-02-${day}T15:00Z`), seats: 1 } })));
beforeEach(clearScheduleSearchCache);

it('filters every session and the real minimum before counting and paginating results', async () => {
  const sdk = { listings: { query: jest.fn().mockResolvedValue(response([listing('yes'), listing('too-short', 8), listing('unavailable')])) }, timeslots: { query: jest.fn(({ listingId }) => Promise.resolve(listingId.uuid === 'yes' ? slots('yes') : response([]))) } };
  const result = await queryScheduledListings(sdk, { schedule, per_page: 24, page: 1 });
  expect(result.data.data.map(l => l.id.uuid)).toEqual(['yes']);
  expect(result.data.meta.totalItems).toBe(1);
  expect(sdk.timeslots.query).toHaveBeenCalledTimes(2);
  expect(sdk.listings.query.mock.calls[0][0].schedule).toBeUndefined();
  await queryScheduledListings(sdk, { schedule, per_page: 24, page: 1 });
  expect(sdk.timeslots.query).toHaveBeenCalledTimes(2);
});

it('fetches all candidate pages and preserves their ordering', async () => {
  const sdk = { listings: { query: jest.fn(({ page }) => Promise.resolve(response(page === 1 ? [listing('first')] : [listing('second')], 2, 2))) }, timeslots: { query: jest.fn(({ listingId }) => Promise.resolve(slots(listingId.uuid))) } };
  const result = await queryScheduledListings(sdk, { schedule, page: 2, per_page: 1 });
  expect(result.data.data[0].id.uuid).toBe('second');
  expect(result.data.meta).toMatchObject({ totalItems: 2, totalPages: 2, page: 2 });
});

it('rejects incomplete/changing candidate collections and overly broad searches', async () => {
  for (const result of [response([listing('one')], 2), response([], 201, 3)]) {
    const sdk = { listings: { query: jest.fn().mockResolvedValue(result) } };
    await expect(queryScheduledListings(sdk, { schedule })).rejects.toThrow();
  }
});

it('rejects failed and incomplete availability instead of returning partial matches', async () => {
  const sdk = { listings: { query: jest.fn().mockResolvedValue(response([listing('one')])) }, timeslots: { query: jest.fn().mockResolvedValue(response([], 1, 1)) } };
  await expect(queryScheduledListings(sdk, { schedule })).rejects.toThrow('completely');
  sdk.timeslots.query.mockRejectedValue(new Error('Network failed'));
  await expect(queryScheduledListings(sdk, { schedule })).rejects.toThrow('Network failed');
});

it('checks every availability page and rejects duplicates or a cancelled request', async () => {
  const sdk = { timeslots: { query: jest.fn(({ page }) => Promise.resolve(response(page === 1 ? [slots('a').data.data[0]] : [slots('a').data.data[1]], 2, 2))) } };
  expect(await fetchListingScheduleSlots(sdk, listing('a'), JSON.parse(schedule))).toHaveLength(2);
  await expect(fetchListingScheduleSlots(sdk, listing('cancelled'), JSON.parse(schedule), () => false)).rejects.toThrow('superseded');
});
