// Shared by search and the server's trusted-listing price calculation.
const minimumTypes = {
  hourlyMinBooking: { unit: 'hours', multiplier: 1 },
  dailyMinBooking: { unit: 'days', multiplier: 1 },
  weeklyMinBooking: { unit: 'weeks', multiplier: 7 },
  // Retain the existing 30-day monthly booking convention (getTypeDuration).
  monthlyMinBooking: { unit: 'months', multiplier: 30 },
};

const readListingMinimum = listing => {
  const raw = ((listing.attributes || {}).publicData || {}).minBooking || {};
  if (!raw.minBookingType) return null;
  const type = minimumTypes[raw.minBookingType];
  const count = Number(raw.minBookingCount);
  if (
    !type ||
    !Number.isFinite(count) ||
    count <= 0 ||
    (type.unit !== 'hours' && !Number.isInteger(count))
  )
    throw new Error('This space has an invalid minimum booking setting.');
  return {
    count,
    unit: type.unit,
    hours: type.unit === 'hours' ? count : count * type.multiplier * 24,
  };
};

const validateBookingMinimum = (listing, bookingData) => {
  const { startDate, endDate, type } = bookingData || {};
  if (startDate == null || endDate == null) throw new Error('Choose booking start and end times.');
  const start = new Date(startDate),
    end = new Date(endDate);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start)
    throw new Error('Choose valid booking start and end times.');
  if (!['price', 'pricePerDay', 'pricePerWeek', 'pricePerMonth'].includes(type))
    throw new Error('Choose a valid booking unit.');
  const rule = readListingMinimum(listing);
  if (rule && (end - start) / 3600000 < rule.hours)
    throw new Error(
      `Minimum booking: ${rule.count} ${rule.unit}. Update your booking dates or times.`
    );
};

const validateBookingRequest = (bookingData, bodyParams) => {
  const params = (bodyParams || {}).params || {};
  const protectedType = (params.protectedData || {}).type;
  const matches =
    new Date(params.bookingStart).getTime() === new Date((bookingData || {}).startDate).getTime() &&
    new Date(params.bookingEnd).getTime() === new Date((bookingData || {}).endDate).getTime();
  if (
    !matches ||
    (params.type && params.type !== bookingData.type) ||
    (protectedType && protectedType !== bookingData.type)
  )
    throw new Error('The priced schedule must match the booking dates, times and unit.');
};

module.exports = { readListingMinimum, validateBookingMinimum, validateBookingRequest };
