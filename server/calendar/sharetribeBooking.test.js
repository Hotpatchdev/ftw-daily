const { calendarBookingFromSharetribe, calendarActionForTransition } = require('./sharetribeBooking');

const resources = {
  transaction: {
    id: 'a0c5ac24-b53b-4c1a-90d0-53d86424b52f',
    attributes: {
      booking: { start: '2026-11-03T09:00:00.000Z', end: '2026-11-03T12:00:00.000Z' },
    },
  },
  listing: {
    attributes: {
      title: 'Canal-side studio',
      publicData: { location: { address: '123 Example Street, London' } },
    },
  },
  customer: { attributes: { email: 'booker@example.com', profile: { displayName: 'Booker Example' } } },
  provider: { attributes: { email: 'host@example.com' } },
};

describe('calendarBookingFromSharetribe', () => {
  it('maps only the fields used in the current calendar Zap', () => {
    expect(calendarBookingFromSharetribe(resources)).toEqual({
      transactionId: resources.transaction.id,
      listingTitle: 'Canal-side studio',
      address: '123 Example Street, London',
      start: '2026-11-03T09:00:00.000Z',
      end: '2026-11-03T12:00:00.000Z',
      hostEmail: 'host@example.com',
      bookerEmail: 'booker@example.com',
      bookerDisplayName: 'Booker Example',
    });
  });

  it('rejects incomplete data rather than sending an unsafe event', () => {
    expect(() =>
      calendarBookingFromSharetribe({ ...resources, provider: { attributes: { email: '' } } })
    ).toThrow('Sharetribe transaction is missing host email.');
  });
});

describe('calendarActionForTransition', () => {
  it.each([
    ['transition/accept', 'create'],
    ['transition/operator-cancel', 'cancel'],
    ['transition/confirm-payment', null],
  ])('uses the existing Zap transition rule for %s', (transition, expected) => {
    expect(calendarActionForTransition(transition)).toBe(expected);
  });
});
