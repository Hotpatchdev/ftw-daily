const { bookingCalendarEvents, eventIdsForTransaction } = require('./bookingCalendar');
const { calendarActionForTransition, calendarBookingFromSharetribe } = require('./sharetribeBooking');

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
    await calendar.cancel(eventIds || eventIdsForTransaction(resourceId(transaction)));
    await integration.updateMetadata(transaction.id, { hotpatchCalendar: null });
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
