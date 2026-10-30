import config from '../config';
import { transactionLineItems } from './api';
import {
  normaliseSchedule,
  meetsListingMinimum,
  slotsCoverSchedule,
  scheduleBookingGroups,
  listingMinimum,
} from './bookingSchedule';
import { fetchListingScheduleSlots } from './scheduleSearch';

export const quoteListingSchedule = async (sdk, listing, value, promocode, active = () => true) => {
  const schedule = normaliseSchedule(value);
  const groups = scheduleBookingGroups(schedule);
  const assertActive = () => {
    if (!active()) throw new Error('Booking selection changed.');
  };
  assertActive();
  if (
    groups.some(
      group => group.start <= new Date() || group.end > new Date(Date.now() + 365 * 86400000)
    )
  )
    throw new Error('Choose future dates within the next year.');
  if (!meetsListingMinimum(listing, schedule))
    throw new Error(
      'Your selection is shorter than the host’s minimum. Adjust your dates or hours.'
    );
  const type = schedule.unit === 'hourly' ? 'price' : 'pricePerDay';
  const price =
    type === 'price' ? listing.attributes.price : listing.attributes.publicData.pricePerDay;
  if (
    !price ||
    !Number.isSafeInteger(price.amount) ||
    price.amount <= 0 ||
    ![config.currency, config.additionalCurrency, config.additionalCurrencyEuro].includes(price.currency)
  )
    throw new Error('This space does not offer a supported rate for this booking.');
  const slots = await fetchListingScheduleSlots(sdk, listing, schedule, active);
  assertActive();
  if (!slotsCoverSchedule(slots, schedule))
    throw new Error(
      'This space is unavailable for part of your selection. Choose different dates or hours.'
    );
  const quotes = new Array(groups.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, groups.length) }, async () => {
      while (next < groups.length) {
        assertActive();
        const index = next++,
          group = groups[index];
        const response = await transactionLineItems({
          listingId: listing.id,
          isOwnListing: false,
          ...(schedule.unit === 'daily' ? { schedule } : {}),
          bookingData: { startDate: group.start, endDate: group.end, type, promocode },
        });
        assertActive();
        const items = response.data;
        if (!Array.isArray(items) || !items.length)
          throw new Error('The price could not be confirmed. Please retry.');
        const customerItems = items.filter(
          item =>
            Array.isArray(item.includeFor) && item.includeFor.includes('customer') && !item.reversal
        );
        if (
          !customerItems.length ||
          customerItems.some(
            item =>
              !item.lineTotal ||
              !Number.isSafeInteger(item.lineTotal.amount) ||
              item.lineTotal.currency !== price.currency
          )
        )
          throw new Error('The price could not be confirmed. Please retry.');
        const total = customerItems.reduce((sum, item) => sum + item.lineTotal.amount, 0);
        if (!Number.isSafeInteger(total) || total < 0)
          throw new Error('The price could not be confirmed. Please retry.');
        quotes[index] = { ...group, items: customerItems, total, currency: price.currency };
      }
    })
  );
  assertActive();
  const minimum = listingMinimum(listing);
  const requiresCombinedCheckout = schedule.unit === 'daily' && groups.length > 1 && minimum &&
    groups.some(group => (group.end - group.start) / 3600000 < minimum.hours);
  return { schedule, groups: quotes, requiresCombinedCheckout: !!requiresCombinedCheckout };
};
