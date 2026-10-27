const { types } = require('sharetribe-flex-sdk');
const { normaliseSchedule, scheduleBookingGroups } = require('../../src/util/bookingSchedule');
const { transactionLineItems } = require('./lineItems');
const {
  calculateLineTotal,
  calculateTotalForCustomer,
  calculateTotalForProvider,
} = require('./lineItemHelpers');

const DAY = 86400000;

// Pure preparation only: availability must still be reserved atomically for each
// interval by Sharetribe before the payment may be confirmed.
const prepareCombinedBooking = (
  listing,
  value,
  {
    now = new Date(),
    // The caller must authorize any promotion; this helper is not a public endpoint.
    promocode = false,
    supportedCurrencies = [
      process.env.REACT_APP_SHARETRIBE_MARKETPLACE_CURRENCY,
      process.env.REACT_APP_SHARETRIBE_ADDITIONAL_MARKETPLACE_CURRENCY,
    ]
      .filter(Boolean)
      .map(currency => currency.toUpperCase()),
  } = {}
) => {
  const schedule = normaliseSchedule(value);
  const attributes = (listing || {}).attributes || {};
  const publicData = attributes.publicData || {};
  const listingZone = (attributes.availabilityPlan || {}).timezone;
  if (schedule.unit === 'hourly' && (!listingZone || schedule.timeZone !== listingZone))
    throw new Error('Choose booking times in the space’s time zone.');

  const type = schedule.unit === 'hourly' ? 'price' : 'pricePerDay';
  // Match the existing daily checkout: reserve the whole space's capacity.
  const seats = schedule.unit === 'hourly' ? 1 : Number(publicData.seats || 1);
  if (!Number.isSafeInteger(seats) || seats < 1) throw new Error('This space has an invalid booking capacity.');
  const price = type === 'price' ? attributes.price : publicData.pricePerDay;
  if (
    !price ||
    !Number.isSafeInteger(price.amount) ||
    price.amount <= 0 ||
    !supportedCurrencies.includes(price.currency)
  )
    throw new Error('This space does not offer a supported rate for this booking.');

  const clock = now.getTime();
  if (!Number.isFinite(clock)) throw new Error('The booking time could not be checked.');
  const sessions = scheduleBookingGroups(schedule).map((group, index) => {
    if (group.start.getTime() <= clock || group.end.getTime() > clock + 365 * DAY)
      throw new Error('Choose future dates within the next year.');
    // This checks the current host minimum independently for each selected group.
    const items = transactionLineItems(listing, {
      startDate: group.start,
      endDate: group.end,
      type,
      promocode,
    });
    return {
      index,
      start: group.start,
      end: group.end,
      items,
      customerTotal: calculateTotalForCustomer(items),
      providerTotal: calculateTotalForProvider(items),
    };
  });

  // Preserve the existing per-session fee/discount rounding while keeping the
  // payment below Sharetribe's 50-line-item limit, even for 31 selected dates.
  const totals = new Map();
  sessions.forEach(session => {
    session.items.forEach(item => {
      const amount = calculateLineTotal(item);
      if (amount.currency !== price.currency || !Number.isSafeInteger(amount.amount))
        throw new Error('The price could not be confirmed.');
      const includeFor = item.includeFor.slice().sort();
      const key = JSON.stringify([item.code, includeFor]);
      const previous = totals.get(key);
      const sum = (previous ? previous.unitPrice.amount : 0) + amount.amount;
      if (!Number.isSafeInteger(sum)) throw new Error('The booking total is too large.');
      totals.set(key, {
        code: item.code,
        unitPrice: new types.Money(sum, price.currency),
        quantity: 1,
        includeFor,
      });
    });
  });
  const lineItems = Array.from(totals.values());
  const customerTotal = calculateTotalForCustomer(lineItems);
  const providerTotal = calculateTotalForProvider(lineItems);
  if (customerTotal.amount <= 0 || providerTotal.amount < 0)
    throw new Error('The price could not be confirmed.');

  // The payment transaction can own the LAST real session, letting its native
  // booking-end time control payout. Earlier sessions need child reservations.
  // Never create a single reservation spanning the gaps between selected dates.
  const anchor = sessions[sessions.length - 1];
  return {
    schedule,
    type,
    seats,
    sessions,
    anchor: { start: anchor.start, end: anchor.end },
    childSessions: sessions.slice(0, -1).map(({ index, start, end }) => ({ index, start, end })),
    displayStart: sessions[0].start,
    displayEnd: anchor.end,
    lineItems,
    customerTotal,
    providerTotal,
  };
};

module.exports = { prepareCombinedBooking };
