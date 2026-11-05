const { syncTransaction } = require('./calendarSync');

const response = {
  data: {
    id: 'transaction-1',
    attributes: { lastTransition: 'transition/accept', booking: { start: '2026-11-03T09:00:00.000Z', end: '2026-11-03T12:00:00.000Z' } },
    relationships: { listing: { data: { id: 'listing-1' } }, customer: { data: { id: 'customer-1' } }, provider: { data: { id: 'provider-1' } } },
  },
  included: [
    { type: 'listing', id: 'listing-1', attributes: { title: 'Studio', publicData: { location: { address: '1 High Street' } } } },
    { type: 'user', id: 'customer-1', attributes: { email: 'booker@example.com', profile: { displayName: 'Booker' } } },
    { type: 'user', id: 'provider-1', attributes: { email: 'host@example.com' } },
  ],
};

describe('syncTransaction', () => {
  it('creates separate events and retains only their identifiers for later cancellation', async () => {
    const calendar = { create: jest.fn().mockResolvedValue({ internal: 'i', host: 'h', booker: 'b' }), cancel: jest.fn() };
    const integration = { updateMetadata: jest.fn() };
    await expect(syncTransaction({ response, calendar, integration })).resolves.toBe('created');
    expect(calendar.create).toHaveBeenCalledWith(expect.objectContaining({
      host: expect.objectContaining({ attendees: [{ email: 'host@example.com' }] }),
      booker: expect.objectContaining({ attendees: [{ email: 'booker@example.com' }] }),
    }));
    expect(integration.updateMetadata).toHaveBeenCalledWith('transaction-1', { hotpatchCalendar: { internal: 'i', host: 'h', booker: 'b' } });
  });

  it('removes exactly the saved events on cancellation', async () => {
    const cancelled = JSON.parse(JSON.stringify(response));
    cancelled.data.attributes.lastTransition = 'transition/cancel';
    cancelled.data.attributes.metadata = { hotpatchCalendar: { internal: 'i', host: 'h', booker: 'b' } };
    const calendar = { create: jest.fn(), cancel: jest.fn() };
    const integration = { updateMetadata: jest.fn() };
    await expect(syncTransaction({ response: cancelled, calendar, integration })).resolves.toBe('cancelled');
    expect(calendar.cancel).toHaveBeenCalledWith({ internal: 'i', host: 'h', booker: 'b' });
    expect(integration.updateMetadata).toHaveBeenCalledWith('transaction-1', { hotpatchCalendar: null });
  });
});
