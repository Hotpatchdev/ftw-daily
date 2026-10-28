const DEFAULT_TIME_ZONE = 'Europe/London';
const crypto = require('crypto');
const eventIdsForTransaction = transactionId => Object.fromEntries(['internal', 'host', 'booker'].map(role =>
  [role, crypto.createHash('sha256').update(`hotpatch-calendar-v1:${transactionId}:${role}`).digest('hex')]));

const requiredString = (value, name) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing calendar booking ${name}.`);
  }
  return value.trim();
};

const eventTimes = ({ start, end, allDay, timeZone }) => {
  const zone = timeZone || DEFAULT_TIME_ZONE;
  if (allDay) {
    return {
      start: { date: requiredString(start, 'start date') },
      end: { date: requiredString(end, 'end date') },
    };
  }

  return {
    start: { dateTime: requiredString(start, 'start time'), timeZone: zone },
    end: { dateTime: requiredString(end, 'end time'), timeZone: zone },
  };
};

const eventBase = ({ transactionId, start, end, allDay, timeZone }) => ({
  ...eventTimes({ start, end, allDay, timeZone }),
  guestsCanModify: false,
  guestsCanSeeOtherGuests: false,
  guestsCanInviteOthers: false,
  extendedProperties: {
    private: {
      hotpatchTransactionId: transactionId,
    },
  },
});

/**
 * Produces the three separate Google Calendar events for a confirmed booking.
 *
 * Never merge the host and booker into one event. Google Calendar attendees can
 * otherwise discover each other's identity, even if the event body is private.
 */
const bookingCalendarEvents = booking => {
  const hostEmail = requiredString(booking.hostEmail, 'host email');
  const bookerEmail = requiredString(booking.bookerEmail, 'booker email');
  const listingTitle = requiredString(booking.listingTitle, 'listing title');
  const address = requiredString(booking.address, 'listing address');
  const bookerDisplayName = requiredString(booking.bookerDisplayName, 'booker display name');
  const base = eventBase(booking);
  const ids = eventIdsForTransaction(booking.transactionId);

  return {
    internal: {
      ...base,
      id: ids.internal,
      summary: `${bookerDisplayName} - ${listingTitle}`,
      description: booking.transactionId,
      extendedProperties: {
        private: { ...base.extendedProperties.private, hotpatchAudience: 'internal' },
      },
    },
    host: {
      ...base,
      id: ids.host,
      summary: `HotPatch Booking - ${listingTitle}`,
      location: address,
      attendees: [{ email: hostEmail }],
      extendedProperties: {
        private: { ...base.extendedProperties.private, hotpatchAudience: 'host' },
      },
    },
    booker: {
      ...base,
      id: ids.booker,
      summary: `HotPatch Booking - ${listingTitle}`,
      location: address,
      attendees: [{ email: bookerEmail }],
      extendedProperties: {
        private: { ...base.extendedProperties.private, hotpatchAudience: 'booker' },
      },
    },
  };
};

module.exports = { bookingCalendarEvents, eventIdsForTransaction };
