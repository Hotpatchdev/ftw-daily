// Explicit staging smoke test. It creates only dev/test-mode reservations and
// uses the notification-free QA workflow version. It never prints credentials.
process.env.NODE_ENV = 'production';
require('../server/env').configureEnv();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const assert = require('assert');
const moment = require('moment-timezone');
const marketplace = require('sharetribe-flex-sdk');
const integration = require('sharetribe-flex-integration-sdk');
const { BookingStore } = require('../server/combined/store');
const { CombinedCoordinator } = require('../server/combined/coordinator');
const { prepareCombinedBooking } = require('../server/api-util/combinedBooking');
const { slotsCoverSchedule } = require('../src/util/bookingSchedule');
const root = '/home/sharetribe/web/staging.hotpatch.com';
const key = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
assert.strictEqual(process.env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID, 'a187af2a-0454-4bed-abb9-834129ccf241');
assert.ok(String(key).startsWith('pk_test_'), 'Refusing a non-test Stripe key');
assert.ok(fs.realpathSync(process.cwd()).startsWith(root + '/releases/'), 'Refusing a non-staging checkout');
const clientId = process.env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID;
const sdk = marketplace.createInstance({ clientId, clientSecret: process.env.SHARETRIBE_SDK_CLIENT_SECRET });
const integ = integration.createInstance({ clientId: process.env.SHARETRIBE_INTEGRATION_CLIENT_ID,
  clientSecret: process.env.SHARETRIBE_INTEGRATION_CLIENT_SECRET,
  queryLimiter: integration.util.createRateLimiter(integration.util.devQueryLimiterConfig),
  commandLimiter: integration.util.createRateLimiter(integration.util.devCommandLimiterConfig) });
const mid = value => new marketplace.types.UUID(value);
const iid = value => new integration.types.UUID(value);
const api = {
  show: value => integ.transactions.show({ id: iid(value), include: ['booking', 'customer', 'provider', 'listing'] }).then(r => r.data),
  query: params => integ.transactions.query({ ...params, customerId: iid(params.customerId), listingId: iid(params.listingId) }).then(r => r.data),
  transition: (value, transition) => integ.transactions.transition({ id: iid(value), transition, params: {} }, { expand: true }).then(r => r.data),
};
const directory = path.join(root, 'shared', 'combined-qa');
fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
const store = new BookingStore(path.join(directory, 'journal'));
const coordinator = new CombinedCoordinator({ store, integration: api });
const abortAll = async () => {
  for (const record of store.records()) {
    if (!record.parent || record.done) continue;
    try {
      const tx = (await api.show(record.parent)).data;
      const transition = { 'state/pending-payment': 'transition/abort-payment',
        'state/preauthorized': 'transition/operator-decline', 'state/accepted': 'transition/cancel' }[tx.attributes.state];
      if (transition) await api.transition(record.parent, transition);
    } catch (_) { /* sweep retries */ }
  }
  await coordinator.sweep();
};
const stripeConfirm = (payment, method) => new Promise((resolve, reject) => {
  const body = new URLSearchParams({ client_secret: payment.stripePaymentIntentClientSecret, payment_method: method }).toString();
  const req = https.request(`https://api.stripe.com/v1/payment_intents/${payment.stripePaymentIntentId}/confirm`, {
    method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(key + ':').toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
  }, res => {
    let text = ''; res.on('data', chunk => { text += chunk; });
    res.on('end', () => {
      const data = JSON.parse(text);
      if (res.statusCode !== 200) return reject(Object.assign(new Error('Test authorization failed'), { code: data.error && data.error.code }));
      resolve(data.status);
    });
  });
  req.on('error', () => reject(new Error('Test authorization connection failed')));
  req.end(body);
});

let phase = 'prepare';
(async () => {
  // Never resume an old test with live holds.
  await abortAll();
  const profileFile = path.join(directory, 'customer.json');
  let profile;
  if (fs.existsSync(profileFile)) profile = JSON.parse(fs.readFileSync(profileFile, 'utf8'));
  else {
    profile = { email: `hotpatch-combined-qa-${Date.now()}@example.com`, password: crypto.randomBytes(32).toString('hex') };
    const user = await sdk.currentUser.create({ email: profile.email, password: profile.password,
      firstName: 'Combined', lastName: 'QA', displayName: 'Combined checkout QA' }, { expand: true });
    profile.id = user.data.data.id.uuid;
    fs.writeFileSync(profileFile, JSON.stringify(profile), { mode: 0o600, flag: 'wx' });
  }
  phase = 'verify customer';
  if (!(await integ.users.show({ id: iid(profile.id) })).data.data.attributes.emailVerified)
    await integ.users.verifyEmail({ id: iid(profile.id), email: profile.email });
  phase = 'sign in';
  await sdk.login({ username: profile.email, password: profile.password });
  phase = 'trusted token';
  const exchange = await sdk.exchangeToken();
  const tokenStore = marketplace.tokenStore.memoryStore(); tokenStore.setToken(exchange.data);
  const trustedSdk = marketplace.createInstance({ clientId, tokenStore });
  const trusted = { initiate: body => trustedSdk.transactions.initiate({ ...body,
    params: { ...body.params, listingId: mid(body.params.listingId) } }, { expand: true, include: ['booking'] }).then(r => r.data) };
  const listingId = '6273aafd-fe77-499e-b00d-6c3b9f2db05b';
  phase = 'read listing';
  const listing = (await sdk.listings.show({ id: mid(listingId) })).data.data;
  const zone = listing.attributes.availabilityPlan.timezone;
  const start = moment().add(14, 'days').startOf('day').toDate();
  const end = moment(start).add(21, 'days').toDate();
  phase = 'read availability';
  const slotsResponse = await sdk.timeslots.query({ listingId: mid(listingId), start, end, per_page: 500 });
  const slots = slotsResponse.data.data;
  const days = [];
  for (let date = moment(start).tz(zone); date.isBefore(end); date.add(1, 'day')) {
    const day = date.format('YYYY-MM-DD');
    const candidate = { unit: 'hourly', days: [day], start: '09:00', end: '12:00', same: true, timeZone: zone };
    if (slotsCoverSchedule(slots, candidate)) days.push(day);
  }
  assert.ok(days.length >= 3, 'Need three available dev dates');
  const selected = [days[0], days[days.length - 1]];
  const gap = days.find(day => day > selected[0] && day < selected[1]);
  assert.ok(gap, 'Need an available gap between the sessions');
  const schedule = { unit: 'hourly', days: selected, start: '09:00', end: '12:00', same: true, timeZone: zone };
  const plan = prepareCombinedBooking(listing, schedule);
  const attempt = crypto.randomBytes(16).toString('hex');
  phase = 'reserve sessions';
  const parentId = await coordinator.start({ customer: profile.id, attempt, listing: listingId, plan, trusted });
  const record = store.records().find(r => r.parent === parentId);
  const parent = (await api.show(parentId)).data;
  assert.strictEqual(parent.attributes.processVersion, 2, 'QA must use the notification-free process version');
  assert.strictEqual(record.children.length, 1);
  assert.strictEqual(parent.attributes.payinTotal.amount, plan.customerTotal.amount);
  assert.strictEqual(await coordinator.start({ customer: profile.id, attempt, listing: listingId, plan, trusted }), parentId);
  const after = (await sdk.timeslots.query({ listingId: mid(listingId), start, end, per_page: 500 })).data.data;
  const seatsAt = (values, instant) => {
    const slot = values.find(value => new Date(value.attributes.start) <= instant && new Date(value.attributes.end) > instant);
    return slot ? slot.attributes.seats : 0;
  };
  for (const session of plan.sessions) assert.strictEqual(seatsAt(after, session.start), seatsAt(slots, session.start) - 1, 'Each session must reserve one hourly seat');
  assert.ok(slotsCoverSchedule(after, { ...schedule, days: [gap] }), 'The unselected gap must remain bookable');
  console.log('Dev check: one payment, exact reservations, gap availability and retry passed');
  phase = 'test authorization';
  const payment = parent.attributes.protectedData.stripePaymentIntents.default;
  assert.strictEqual(await stripeConfirm(payment, 'pm_card_visa'), 'requires_capture');
  // The worker recovers authorization even without the browser's confirm call.
  await coordinator.sweep();
  assert.strictEqual((await api.show(parentId)).data.attributes.state, 'state/preauthorized');
  await coordinator.act(parentId, parent.relationships.provider.data.id.uuid, 'accept');
  assert.strictEqual((await api.show(parentId)).data.attributes.state, 'state/accepted');
  for (const child of record.children) assert.strictEqual((await api.show(child.id)).data.attributes.state, 'state/accepted');
  console.log('Dev check: test card authorization, background confirmation and single capture passed');
  await api.transition(parentId, 'transition/cancel');
  await coordinator.sweep();
  assert.strictEqual((await api.show(parentId)).data.attributes.state, 'state/cancelled');
  for (const child of record.children) assert.strictEqual((await api.show(child.id)).data.attributes.state, 'state/released');
  const released = (await sdk.timeslots.query({ listingId: mid(listingId), start, end, per_page: 500 })).data.data;
  assert.ok(slotsCoverSchedule(released, schedule), 'Cancellation must release every session');
  console.log('Dev check: whole-booking refund and calendar release passed');
  await abortAll();
  console.log('COMBINED_DEV_CHECK_PASSED');
})().catch(async error => {
  console.error('COMBINED_DEV_CHECK_FAILED', phase, error.message, error.code || error.status || '');
  if (error.data && error.data.errors) console.error('API codes:', error.data.errors.map(e => e.code).join(','));
  try { await abortAll(); } catch (_) { console.error('Dev reservation cleanup needs retry'); }
  process.exitCode = 1;
});
