const fs = require('fs');
const os = require('os');
const path = require('path');
const { BookingStore } = require('./store');
const { CombinedCoordinator, PARENT, CHILD } = require('./coordinator');
let directory, store, coordinator, api, trusted, transactions, calls, serial;
const customer = 'customer', provider = 'provider', listing = 'listing';
const attempt = 'checkout-reference-123456789';
const sessions = [1, 3, 5].map(day => ({ start: new Date(`2027-02-0${day}T09:00:00Z`), end: new Date(`2027-02-0${day}T15:00:00Z`) }));
const plan = { schedule: { unit: 'hourly', days: ['2027-02-01', '2027-02-03', '2027-02-05'] },
  sessions, childSessions: sessions.slice(0, -1), anchor: sessions[2], displayStart: sessions[0].start, displayEnd: sessions[2].end, type: 'price', lineItems: [] };
const start = () => coordinator.start({ customer, attempt, listing, plan, trusted });
const relations = id => Object.fromEntries(Object.entries({ customer, provider, listing, booking: 'booking-' + id }).map(([k,v]) => [k, {data: {id:v}}]));
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hp-combined-test-'));
  store = new BookingStore(directory); transactions = new Map(); calls = []; serial = 0;
  trusted = { initiate: jest.fn(async body => {
    const id = String(++serial), isParent = body.processAlias.startsWith(PARENT);
    const tx = { id, relationships: relations(id), attributes: {
      processName: isParent ? PARENT : CHILD, state: isParent ? 'state/pending-payment' : 'state/pending',
      protectedData: body.params.protectedData } };
    transactions.set(id, { data: tx, included: [{type:'booking', id:'booking-'+id,
      attributes:{start:body.params.bookingStart, end:body.params.bookingEnd}}] });
    calls.push({id, body}); return {data:tx};
  }) };
  api = { show: jest.fn(async id => transactions.get(id)),
    query: jest.fn(async ({processNames}) => ({data:[...transactions.values()].map(r=>r.data).filter(t=>processNames.includes(t.attributes.processName)),meta:{totalPages:1}})),
    transition: jest.fn(async (id, transition) => {
      const tx = transactions.get(id).data;
      calls.push({id,transition});
      const next = { 'transition/hold-session':'state/held', 'transition/accept-session':'state/accepted',
        'transition/operator-confirm-payment':'state/preauthorized', 'transition/operator-accept':'state/accepted',
        'transition/operator-decline':'state/declined', 'transition/abort-payment':'state/payment-expired',
        'transition/release-pending-session':'state/released','transition/release-held-session':'state/released', 'transition/cancel-session':'state/released' }[transition];
      if (!next) throw new Error(transition);
      tx.attributes.state = next; return {data:tx};
    }) };
  coordinator = new CombinedCoordinator({store, integration:api, now:()=>new Date('2027-01-01T00:00Z')});
});
afterEach(() => fs.rmSync(directory,{recursive:true,force:true}));
it('reserves only the chosen intervals and creates just one payment transaction', async () => {
  const parent = await start();
  expect(calls.filter(c=>c.body).map(c=>[c.body.params.bookingStart,c.body.params.bookingEnd])).toEqual([ [sessions[2].start,sessions[2].end], [sessions[0].start,sessions[0].end], [sessions[1].start,sessions[1].end] ]);
  expect(calls.filter(c=>c.body && c.body.params.lineItems)).toHaveLength(1);
  expect(await start()).toBe(parent); expect(trusted.initiate).toHaveBeenCalledTimes(3);
});
it('serializes simultaneous retries into one checkout', async () => {
  expect(await Promise.all([start(),start(),start()])).toEqual(['1','1','1']);
  expect(trusted.initiate).toHaveBeenCalledTimes(3);
});
it('recovers a lost parent response without a second payment intent', async () => {
  const original = trusted.initiate.getMockImplementation(); let lost = true;
  trusted.initiate.mockImplementation(async body=>{const result=await original(body);if(lost){lost=false;throw new Error('timeout');}return result;});
  await expect(start()).rejects.toThrow('timeout');
  expect(await start()).toBe('1'); expect(trusted.initiate).toHaveBeenCalledTimes(3);
});
it('persists decisions so a new process finishes after the browser closes', async () => {
  const parent=await start();
  await coordinator.act(parent,customer,'confirm');
  const real=api.transition.getMockImplementation(); let failed=true;
  api.transition.mockImplementation(async (id,t)=>{if(t==='transition/operator-accept' && failed){failed=false;throw new Error('offline');}return real(id,t);});
  await expect(coordinator.act(parent,provider,'accept')).rejects.toThrow('offline');
  const restarted=new CombinedCoordinator({store:new BookingStore(directory),integration:api,now:()=>new Date('2027-01-01')});
  await restarted.sweep();
  expect(transactions.get(parent).data.attributes.state).toBe('state/accepted');
  expect([...transactions.values()].every(r=>r.data.attributes.state==='state/accepted')).toBe(true);
});
it('accepts every reservation before capturing the one parent payment', async () => {
  const parent=await start(); await coordinator.act(parent,customer,'confirm');
  await coordinator.act(parent,provider,'accept');
  const actions=calls.filter(c=>c.transition).map(c=>c.transition);
  expect(actions.slice(-3)).toEqual(['transition/accept-session','transition/accept-session','transition/operator-accept']);
  await coordinator.act(parent,provider,'accept');
  expect(api.transition.mock.calls.filter(c=>c[1]==='transition/operator-accept')).toHaveLength(1);
});
it('blocks a different customer or host from confirming or accepting', async () => {
  const parent=await start();
  await expect(coordinator.act(parent,provider,'confirm')).rejects.toThrow('not available');
  await coordinator.act(parent,customer,'confirm');
  await expect(coordinator.act(parent,customer,'accept')).rejects.toThrow('not available');
});
it('does not confirm payment if any held interval has expired', async () => {
  const parent=await start(); transactions.get('2').data.attributes.state='state/released';
  await expect(coordinator.act(parent,customer,'confirm')).rejects.toThrow('could not be reserved');
  expect(transactions.get(parent).data.attributes.state).toBe('state/pending-payment');
});
it('releases accepted children following an operator cancellation', async () => {
  const parent=await start(); await coordinator.act(parent,customer,'confirm'); await coordinator.act(parent,provider,'accept');
  transactions.get(parent).data.attributes.state='state/cancelled'; await coordinator.sweep();
  expect(transactions.get('2').data.attributes.state).toBe('state/released');
  expect(transactions.get('3').data.attributes.state).toBe('state/released');
});
it('releases all children when payment expires or the host declines', async () => {
  const parent=await start(); await coordinator.act(parent,customer,'confirm'); await coordinator.act(parent,provider,'decline');
  expect(transactions.get(parent).data.attributes.state).toBe('state/declined');
  expect(transactions.get('2').data.attributes.state).toBe('state/released');
  expect(transactions.get('3').data.attributes.state).toBe('state/released');
});
it('refuses reuse of a checkout reference for a changed schedule', async () => {
  await start(); await expect(coordinator.start({customer,attempt,listing,plan:{...plan,schedule:{unit:'daily'}},trusted})).rejects.toThrow('selection changed');
});
it('rejects corrupted reservation links before confirming payment', async () => {
  const parent=await start(); transactions.get('2').data.attributes.protectedData.combinedParentId='other';
  await expect(coordinator.act(parent,customer,'confirm')).rejects.toThrow('could not be reserved');
});
it('rolls back the other holds when a competing booking takes one interval', async () => {
  const original=trusted.initiate.getMockImplementation();
  trusted.initiate.mockImplementation(async body=>{
    if(body.params.protectedData.sessionIndex===1) throw Object.assign(new Error('unavailable'),{status:409});
    return original(body);
  });
  await expect(start()).rejects.toThrow('unavailable');
  expect(transactions.get('1').data.attributes.state).toBe('state/payment-expired');
  expect(transactions.get('2').data.attributes.state).toBe('state/released');
});
it('releases a child whose successful creation response was lost', async () => {
  const original=trusted.initiate.getMockImplementation();
  trusted.initiate.mockImplementation(async body=>{
    const result=await original(body);
    if(body.params.protectedData.sessionIndex===0) throw new Error('timeout after creation');
    return result;
  });
  await expect(start()).rejects.toThrow('timeout');
  await coordinator.sweep();
  expect(transactions.get('1').data.attributes.state).toBe('state/payment-expired');
  expect(transactions.get('2').data.attributes.state).toBe('state/released');
});
it('does not reuse a definitively failed checkout reference on a later retry', async () => {
  trusted.initiate.mockRejectedValue(Object.assign(new Error('unavailable'),{status:409}));
  await expect(start()).rejects.toThrow('unavailable');
  await expect(start()).rejects.toThrow('could not reserve');
  expect(trusted.initiate).toHaveBeenCalledTimes(1);
});
it('does not capture payment after the first booked session has started', async () => {
  const parent=await start(); await coordinator.act(parent,customer,'confirm');
  coordinator.now=()=>new Date('2027-02-01T09:01Z');
  await coordinator.act(parent,provider,'accept');
  expect(transactions.get(parent).data.attributes.state).toBe('state/declined');
  expect(api.transition.mock.calls.some(c=>c[1]==='transition/operator-accept')).toBe(false);
});
