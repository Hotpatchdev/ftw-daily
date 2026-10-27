const { BookingStore } = require('./store');
const { CombinedCoordinator } = require('./coordinator');

const DEV_CLIENT = 'a187af2a-0454-4bed-abb9-834129ccf241';
const enabled = () => process.env.COMBINED_BOOKINGS_ENABLED === 'true' &&
  process.env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID === DEV_CLIENT;
let coordinator;
const runtime = () => {
  if (!enabled()) throw new Error('Combined bookings are unavailable.');
  if (coordinator) return coordinator;
  const sdk = require('sharetribe-flex-integration-sdk');
  const integration = sdk.createInstance({ clientId: process.env.SHARETRIBE_INTEGRATION_CLIENT_ID,
    clientSecret: process.env.SHARETRIBE_INTEGRATION_CLIENT_SECRET,
    queryLimiter: sdk.util.createRateLimiter(sdk.util.devQueryLimiterConfig),
    commandLimiter: sdk.util.createRateLimiter(sdk.util.devCommandLimiterConfig) });
  const id = value => new sdk.types.UUID(value);
  // Sharetribe's SDK limiters respect the dev API rate limits. Pass only
  // response data to the coordinator; never persist access tokens.
  const api = {
    show: value => integration.transactions.show({ id: id(value), include: ['booking', 'customer', 'provider', 'listing'] }).then(r => r.data),
    query: params => integration.transactions.query({ ...params, customerId: id(params.customerId), listingId: id(params.listingId) }).then(r => r.data),
    transition: (value, transition) => integration.transactions.transition({ id: id(value), transition, params: {} }, { expand: true }).then(r => r.data),
  };
  coordinator = new CombinedCoordinator({ store: new BookingStore(process.env.COMBINED_BOOKING_STORE_DIR), integration: api });
  return coordinator;
};
let working = false;
const startWorker = () => {
  if (!enabled()) return;
  const run = async () => {
    if (working) return;
    working = true;
    try { await runtime().sweep(); }
    catch (_) { console.error('Combined booking recovery is unavailable; retrying.'); }
    finally { working = false; }
  };
  const timer = setInterval(run, 30000);
  timer.unref();
  run();
};
module.exports = { runtime, enabled, startWorker };
