const { bookingCalendarEvents, eventIdsForTransaction, sessionEventIds } = require('./bookingCalendar');
const { calendarActionForTransition, calendarBookingFromSharetribe, calendarSessions } = require('./sharetribeBooking');

const resourceId = resource => resource && resource.id && (resource.id.uuid || resource.id);
const includedResource = (response, type, id) =>
  (response.included || []).find(resource => resource.type === type && resourceId(resource) === id);
const relatedResource = (response, transaction, name, type) => {
  const relationship = transaction.relationships && transaction.relationships[name];
  return includedResource(response, type, relationship && resourceId(relationship.data));
};
const currentIds = transaction =>
  transaction.attributes && transaction.attributes.metadata && transaction.attributes.metadata.hotpatchCalendar;

/**
 * Retries safely using deterministic Calendar IDs. Event identifiers are
 * retained as transaction metadata solely so a later cancellation can remove
 * precisely the three invitations it created.
 */
const syncTransaction = async ({ response, calendar, integration }) => {
  const transaction = response.data;
  const action = calendarActionForTransition(transaction.attributes && transaction.attributes.lastTransition);
  const eventIds = currentIds(transaction);
  if (!action || (action === 'create' && eventIds)) return 'skipped';

  if (action === 'cancel') {
    // Also remove any events created before a failed metadata write.
    const data = transaction.attributes.protectedData || {};
    const fallback = () => data.combinedBooking
      ? sessionEventIds(resourceId(transaction), calendarSessions(transaction))
      : eventIdsForTransaction(resourceId(transaction));
    await calendar.cancel(eventIds || fallback());
    // Metadata writes emit transaction events too. Do not keep emitting a new
    // cancellation event after these identifiers have already been cleared.
    if (eventIds) await integration.updateMetadata(transaction.id, { hotpatchCalendar: null });
    return 'cancelled';
  }

  const booking = calendarBookingFromSharetribe({
    transaction,
    listing: relatedResource(response, transaction, 'listing', 'listing'),
    customer: relatedResource(response, transaction, 'customer', 'user'),
    provider: relatedResource(response, transaction, 'provider', 'user'),
    booking: relatedResource(response, transaction, 'booking', 'booking'),
  });
  const ids = await calendar.create(bookingCalendarEvents(booking));
  await integration.updateMetadata(transaction.id, { hotpatchCalendar: ids });
  return 'created';
};

module.exports = { syncTransaction };
