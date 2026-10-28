const { bookingCalendarEvents } = require('./bookingCalendar');

const booking = {
  transactionId: 'a0c5ac24-b53b-4c1a-90d0-53d86424b52f',
  listingTitle: 'Canal-side studio',
  address: '123 Example Street, London',
  start: '2026-11-03T09:00:00.000Z',
  end: '2026-11-03T12:00:00.000Z',
  timeZone: 'Europe/London',
  hostEmail: 'host@example.com',
  bookerEmail: 'booker@example.com',
  bookerDisplayName: 'Booker Example',
};

describe('bookingCalendarEvents', () => {
  it('creates an internal event plus separate host and booker invitations', () => {
    const { internal, host, booker } = bookingCalendarEvents(booking);
    expect(internal.attendees).toBeUndefined();
    expect(host.attendees).toEqual([{ email: booking.hostEmail }]);
    expect(booker.attendees).toEqual([{ email: booking.bookerEmail }]);
  });

  it('never puts the host and booker on the same invitation', () => {
    const { host, booker } = bookingCalendarEvents(booking);
    expect(host.attendees).not.toContainEqual({ email: booking.bookerEmail });
    expect(booker.attendees).not.toContainEqual({ email: booking.hostEmail });
    expect(host.guestsCanSeeOtherGuests).toBe(false);
    expect(booker.guestsCanSeeOtherGuests).toBe(false);
  });

  it('matches the established Zap titles without exposing either attendee externally', () => {
    const { internal, host, booker } = bookingCalendarEvents(booking);
    expect(internal.summary).toBe('Booker Example - Canal-side studio');
    expect(internal.description).toBe(booking.transactionId);
    expect(host.summary).toBe('HotPatch Booking - Canal-side studio');
    expect(booker.summary).toBe('HotPatch Booking - Canal-side studio');
    expect(host.description).toBeUndefined();
    expect(booker.description).toBeUndefined();
  });

  it('uses date-only Calendar fields for all-day bookings', () => {
    const { host } = bookingCalendarEvents({
      ...booking,
      allDay: true,
      start: '2026-11-03',
      end: '2026-11-04',
    });
    expect(host.start).toEqual({ date: '2026-11-03' });
    expect(host.end).toEqual({ date: '2026-11-04' });
  });

  it('rejects missing participant details', () => {
    expect(() => bookingCalendarEvents({ ...booking, hostEmail: '' })).toThrow(
      'Missing calendar booking host email.'
    );
  });
});
