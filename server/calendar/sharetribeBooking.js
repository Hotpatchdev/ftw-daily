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
  const data = valueAt(transaction, ['attributes', 'protectedData']) || {};
  const sessions = data.combinedBooking ? calendarSessions(transaction) : null;

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
    ...(sessions ? { sessions } : {}),
    ...(data.type === 'pricePerDay' || data.isDaily ? { allDay:true } : {}),
    ...(valueAt(listing, ['attributes', 'availabilityPlan', 'timezone']) ?
      { timeZone:listing.attributes.availabilityPlan.timezone } : {}),
  };
};

// These are the exact, server-reserved intervals stored by combined checkout.
// Never use displayStart/displayEnd: those span the unbooked gaps.
const calendarSessions = transaction => {
  const sessions = valueAt(transaction, ['attributes', 'protectedData', 'sessions']);
  if (!Array.isArray(sessions) || !sessions.length || sessions.length > 31) throw new Error('Missing reserved calendar sessions.');
  let end = -Infinity;
  return sessions.map(session => {
    const start = new Date(session.start), finish = new Date(session.end);
    if (!Number.isFinite(+start) || !Number.isFinite(+finish) || +finish <= +start || +start < end) throw new Error('Invalid reserved calendar session.');
    end = +finish;
    return { start:start.toISOString(),end:finish.toISOString() };
  });
};

const calendarActionForTransition = transition => {
  if (typeof transition !== 'string') return null;
  if (['transition/accept', 'transition/operator-accept'].includes(transition)) return 'create';
  if (['transition/cancel', 'transition/operator-cancel'].includes(transition)) return 'cancel';
  return null;
};

module.exports = { calendarBookingFromSharetribe, calendarActionForTransition, calendarSessions };
