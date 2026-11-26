// Period bookings retain the existing seven-day week / thirty-day month convention.
const bookingPeriod = (startDate, endDate, type, dailyRate, currency) => {
  const length = type === 'pricePerWeek' ? 7 : type === 'pricePerMonth' ? 30 : null;
  if (!length) return null;
  const days = (new Date(endDate) - new Date(startDate)) / 86400000;
  if (!Number.isInteger(days) || days < length)
    throw new Error(`Choose at least ${length} whole booking days.`);
  const units = Math.floor(days / length);
  const extraDays = days % length;
  if (extraDays && (!dailyRate || !Number.isSafeInteger(dailyRate.amount) ||
      dailyRate.amount <= 0 || dailyRate.currency !== currency)) {
    throw new Error(`This Patch offers whole ${length === 7 ? 'weeks' : '30-day months'} only. Choose a duration in multiples of ${length} days.`);
  }
  return { units, extraDays };
};

module.exports = { bookingPeriod };
