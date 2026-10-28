const valueAt = (object, path) => path.reduce((value, key) => (value == null ? undefined : value[key]), object);
const resourceId = resource => resource && resource.id && (resource.id.uuid || resource.id);
const timestamp = value => value instanceof Date ? value.toISOString() : value;

const required = (value, name) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Sharetribe transaction is missing ${name}.`);
  }
  return value.trim();
};

/**
 * Select only the fields used by the existing HotPatch calendar Zap.
 * The caller must supply a transaction fetched with booking, listing, customer
 * and provider included; there is deliberately no fallback to user-entered data.
 */
const calendarBookingFromSharetribe = ({ transaction, listing = {}, customer = {}, provider = {}, booking: includedBooking }) => {
  const booking = includedBooking && includedBooking.attributes || valueAt(transaction, ['attributes', 'booking']) || transaction.booking;
  const publicData = valueAt(listing, ['attributes', 'publicData']) || listing.publicData || {};
  const customerProfile = valueAt(customer, ['attributes', 'profile']) || customer.profile || {};
  if (valueAt(transaction, ['attributes', 'protectedData', 'combinedBooking'])) {
    throw new Error('Combined calendar schedules require a separate staging review.');
  }

  return {
    transactionId: required(resourceId(transaction), 'transaction ID'),
    listingTitle: required(
      valueAt(listing, ['attributes', 'title']) || listing.title,
      'listing title'
    ),
    address: required(valueAt(publicData, ['location', 'address']), 'listing address'),
    start: required(timestamp(booking && booking.start), 'booking start'),
    end: required(timestamp(booking && booking.end), 'booking end'),
    hostEmail: required(valueAt(provider, ['attributes', 'email']) || provider.email, 'host email'),
    bookerEmail: required(valueAt(customer, ['attributes', 'email']) || customer.email, 'booker email'),
    bookerDisplayName: required(customerProfile.displayName, 'booker display name'),
  };
};

const calendarActionForTransition = transition => {
  if (typeof transition !== 'string') return null;
  if (['transition/accept', 'transition/operator-accept'].includes(transition)) return 'create';
  if (['transition/cancel', 'transition/operator-cancel'].includes(transition)) return 'cancel';
  return null;
};

module.exports = { calendarBookingFromSharetribe, calendarActionForTransition };
