const { syncTransaction } = require('./calendarSync');
const { calendarActionForTransition } = require('./sharetribeBooking');

const idOf = value => value && (value.uuid || value);

// Process ordered events, not a query of historic accepted bookings. Checkpoint
// only after Calendar and transaction metadata both succeed.
class CalendarWorker {
  constructor({ integration, calendar, checkpoint, startAt, transactionIds }) {
    Object.assign(this, { integration, calendar, checkpoint, startAt, transactionIds });
    this.working = false;
  }

  async sweep() {
    if (this.working) return;
    this.working = true;
    try {
      let cursor = await this.checkpoint.read();
      for (let batch = 0; batch < 10; batch++) {
        const events = await this.integration.events(cursor == null
          ? { createdAtStart: new Date(this.startAt), eventTypes: ['transaction'], perPage: 100 }
          : { startAfterSequenceId: cursor, eventTypes: ['transaction'], perPage: 100 });
        for (const event of events) {
          const a = event.attributes;
          if (!Number.isSafeInteger(a.sequenceId) || (cursor != null && a.sequenceId <= cursor)) {
            throw new Error('Calendar event sequence is invalid.');
          }
          const eventDate = new Date(a.createdAt).getTime();
          if (!Number.isFinite(eventDate)) throw new Error('Calendar event timestamp is invalid.');
          const id = idOf(a.resourceId);
          const transition = a.resource && a.resource.attributes && a.resource.attributes.lastTransition;
          if (eventDate >= new Date(this.startAt).getTime() && this.transactionIds.includes(id) &&
            calendarActionForTransition(transition)) {
            const response = await this.integration.show(id);
            // Fetch current state so a queued acceptance cannot recreate an
            // already-cancelled booking. Child reservation processes are not invitations.
            const tx = response.data;
            if (tx.attributes.processName === 'hotpatch-combined-reservation') throw new Error('Reservation child is not a calendar booking.');
            const bookingId = tx.relationships && tx.relationships.booking && tx.relationships.booking.data;
            const booking = (response.included || []).find(r => r.type === 'booking' && idOf(r.id) === idOf(bookingId && bookingId.id));
            if (booking && booking.attributes.state === 'cancelled') tx.attributes.lastTransition = 'transition/cancel';
            else if (!calendarActionForTransition(tx.attributes.lastTransition) && booking && booking.attributes.state === 'accepted') tx.attributes.lastTransition = 'transition/accept';
            await syncTransaction({ response, calendar: this.calendar, integration: this.integration });
          }
          await this.checkpoint.write(a.sequenceId);
          cursor = a.sequenceId;
        }
        if (events.length < 100) break;
      }
    } finally { this.working = false; }
  }
}

module.exports = { CalendarWorker };
