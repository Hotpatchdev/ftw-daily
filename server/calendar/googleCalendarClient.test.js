const {
  cancelBookingEvents,
  configFromEnv,
  createBookingEvents,
  createEvent,
  cancelEvent,
} = require('./googleCalendarClient');

const config = configFromEnv({
  GOOGLE_CALENDAR_CLIENT_ID: 'client-id',
  GOOGLE_CALENDAR_CLIENT_SECRET: 'client-secret',
  GOOGLE_CALENDAR_REFRESH_TOKEN: 'refresh-token',
  GOOGLE_CALENDAR_CALENDAR_ID: 'team-calendar@example.com',
});

describe('Calendar retry recovery', () => {
  const booking = { transactionId:'transaction-1',listingTitle:'Studio',address:'1 High Street',
    start:'2026-11-03T09:00:00Z',end:'2026-11-03T12:00:00Z',hostEmail:'host@example.com',bookerEmail:'booker@example.com',bookerDisplayName:'Booker' };
  const events = () => require('./bookingCalendar').bookingCalendarEvents(booking);
  const status = code => Object.assign(new Error('temporary'),{status:code});
  it('recovers partial creation using the same three IDs instead of duplicating invitations',async()=>{
    const saved=new Map();let failed=false;
    const request=async r=>{
      if(r.hostname==='oauth2.googleapis.com')return {access_token:'token'};
      if(r.method==='POST'){
        const body=JSON.parse(r.body);
        if(body.extendedProperties.private.hotpatchAudience==='booker'&&!failed){failed=true;throw status(503);}
        if(saved.has(body.id))throw status(409);saved.set(body.id,body);return body;
      }
      const id=r.path.split('/').pop();return saved.get(id);
    };
    await expect(createBookingEvents(config,events(),request)).rejects.toThrow();
    const ids=await createBookingEvents(config,events(),request);
    expect(saved.size).toBe(3);expect(Object.values(ids).sort()).toEqual([...saved.keys()].sort());
  });
  it('rejects an existing event containing an unexpected attendee',async()=>{
    const wanted=events().host;
    const request=async r=>{
      if(r.hostname==='oauth2.googleapis.com')return {access_token:'token'};
      if(r.method==='POST')throw status(409);
      return {...wanted,attendees:[{email:'wrong@example.com'}]};
    };
    await expect(createEvent(config,wanted,request)).rejects.toThrow('does not match');
  });
  it('treats an already deleted event as a successful cancellation',async()=>{
    const request=async r=>{
      if(r.hostname==='oauth2.googleapis.com')return {access_token:'token'};
      if(r.method==='DELETE')throw status(410);return {};
    };
    await expect(cancelEvent(config,'deleted-id',request)).resolves.toBeUndefined();
  });
  it('does not mistake an inaccessible calendar for an already removed event',async()=>{
    const request=async r=>{
      if(r.hostname==='oauth2.googleapis.com')return {access_token:'token'};
      throw status(404);
    };
    await expect(cancelEvent(config,'missing-id',request)).rejects.toMatchObject({status:404});
  });
});

const event = audience => ({
  summary: 'HotPatch Booking - Example',
  attendees: audience === 'internal' ? undefined : [{ email: `${audience}@example.com` }],
  extendedProperties: { private: { hotpatchAudience: audience } },
});

const successfulRequest = calls => async request => {
  calls.push(request);
  if (request.hostname === 'oauth2.googleapis.com') return { access_token: 'short-lived-token' };
  if (request.method === 'POST') return { id: `event-${calls.filter(call => call.hostname === 'www.googleapis.com').length}` };
  return {};
};

describe('Google Calendar client', () => {
  it('creates three distinct events and sends updates only to each event attendee', async () => {
    const calls = [];
    const ids = await createBookingEvents(config, { internal: event('internal'), host: event('host'), booker: event('booker') }, successfulRequest(calls));
    expect(ids).toEqual({ internal: 'event-1', host: 'event-2', booker: 'event-3' });
    const creates = calls.filter(call => call.hostname === 'www.googleapis.com');
    expect(creates).toHaveLength(3);
    expect(creates.map(call => JSON.parse(call.body).attendees)).toEqual([undefined, [{ email: 'host@example.com' }], [{ email: 'booker@example.com' }]]);
    expect(creates.every(call => call.path.includes('sendUpdates=all'))).toBe(true);
  });

  it('cancels each separately created event', async () => {
    const calls = [];
    await cancelBookingEvents(config, { internal: 'internal-id', host: 'host-id', booker: 'booker-id' }, successfulRequest(calls));
    const deletes = calls.filter(call => call.method === 'DELETE');
    expect(deletes).toHaveLength(3);
    expect(deletes.map(call => call.path)).toEqual(expect.arrayContaining([
      expect.stringContaining('/internal-id?sendUpdates=all'),
      expect.stringContaining('/host-id?sendUpdates=all'),
      expect.stringContaining('/booker-id?sendUpdates=all'),
    ]));
  });
});
