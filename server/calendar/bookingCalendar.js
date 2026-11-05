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
const singleBookingCalendarEvents = booking => {
  const hostEmail = requiredString(booking.hostEmail, 'host email');
  const bookerEmail = requiredString(booking.bookerEmail, 'booker email');
  const listingTitle = requiredString(booking.listingTitle, 'listing title');
  const address = requiredString(booking.address, 'listing address');
  const bookerDisplayName = requiredString(booking.bookerDisplayName, 'booker display name');
  const base = eventBase(booking);
  const ids = eventIdsForTransaction(booking.eventKey || booking.transactionId);

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

const sessionKey = (transactionId, session) => `${transactionId}:${session.start}:${session.end}`;
const sessionEventIds = (transactionId, sessions) => {
  const result = { internal:[],host:[],booker:[] };
  sessions.forEach(session => {
    const ids = eventIdsForTransaction(sessionKey(transactionId, session));
    Object.keys(result).forEach(role => result[role].push(ids[role]));
  });
  return result;
};

const bookingCalendarEvents = booking => {
  if (!booking.sessions) return singleBookingCalendarEvents({ ...booking,
    ...(booking.allDay ? { start:booking.start.slice(0,10),end:booking.end.slice(0,10) } : {}) });
  const result = { internal:[],host:[],booker:[] };
  booking.sessions.forEach(session => {
    const events = singleBookingCalendarEvents({ ...booking, ...session,
      ...(booking.allDay ? { start:session.start.slice(0,10),end:session.end.slice(0,10) } : {}),
      eventKey:sessionKey(booking.transactionId,session) });
    Object.keys(result).forEach(role => result[role].push(events[role]));
  });
  return result;
};

module.exports = { bookingCalendarEvents, eventIdsForTransaction, sessionEventIds };
