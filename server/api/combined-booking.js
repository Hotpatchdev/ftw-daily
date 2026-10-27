const { types } = require('sharetribe-flex-sdk');
const { getSdk, getTrustedSdk, serialize } = require('../api-util/sdk');
const { prepareCombinedBooking } = require('../api-util/combinedBooking');
const { enabled, runtime } = require('../combined/runtime');
const { PARENT, uuid } = require('../combined/coordinator');
const moment = require('moment-timezone');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = value => {
  const str = uuid(value);
  if (!UUID.test(str)) throw new Error('Invalid booking reference.');
  return new types.UUID(str);
};
const payload = response => ({ status: response.status, statusText: response.statusText, data: response.data });

module.exports = async (req, res) => {
  try {
    if (!enabled()) return res.status(503).json({ error: 'Combined checkout is unavailable.' });
    const sdk = getSdk(req, res);
    const user = (await sdk.currentUser.show()).data.data;
    const body = req.body || {};
    const query = { include: ['booking', 'provider', 'customer'], expand: true };
    let result;
    if (body.action) {
      const transactionId = id(body.transactionId);
      const visible = (await sdk.transactions.show({ id: transactionId })).data.data;
      if (visible.attributes.processName !== PARENT) throw new Error('Invalid combined booking.');
      await runtime().act(transactionId.uuid, user.id.uuid, body.action);
      result = await sdk.transactions.show({ id: transactionId, ...query });
    } else {
      const listingId = id(body.listingId);
      const listing = (await sdk.listings.show({ id: listingId }, { include: ['author'] })).data.data;
      if (listing.relationships.author.data.id.uuid === user.id.uuid) throw new Error('You cannot book your own space.');
      if (body.promocode) throw new Error('Please remove the promotion code before using combined checkout.');
      const plan = prepareCombinedBooking(listing, body.schedule);
      const zone = plan.schedule.unit === 'hourly' ? plan.schedule.timeZone : 'UTC';
      plan.sessions.forEach(s => {
        s.label = plan.schedule.unit === 'hourly'
          ? `${moment(s.start).tz(zone).format('ddd D MMM YYYY, HH:mm')}–${moment(s.end).tz(zone).format('HH:mm')} (${zone})`
          : `${moment.utc(s.start).format('ddd D MMM YYYY')} – ${moment.utc(s.end).subtract(1, 'day').format('ddd D MMM YYYY')}`;
      });
      const payment = {};
      if (body.paymentMethod) {
        if (typeof body.paymentMethod !== 'string' || !/^pm_[A-Za-z0-9]+$/.test(body.paymentMethod)) throw new Error('Invalid payment method.');
        payment.paymentMethod = body.paymentMethod;
      }
      if (body.setupPaymentMethodForSaving === true) payment.setupPaymentMethodForSaving = true;
      const trustedSdk = await getTrustedSdk(req);
      const adapt = value => ({ ...value, params: { ...value.params, listingId } });
      if (body.isSpeculative === true) {
        result = await trustedSdk.transactions.initiateSpeculative(adapt({ processAlias: `${PARENT}/release-1`,
          transition: 'transition/request-payment', params: { bookingStart: plan.anchor.start,
            bookingEnd: plan.anchor.end, bookingDisplayStart: plan.displayStart, bookingDisplayEnd: plan.displayEnd,
            lineItems: plan.lineItems, seats: plan.seats, cardToken: 'CheckoutPage_speculative_card_token',
            protectedData: { combinedBooking: true, schedule: plan.schedule, type: plan.type,
              sessionLabels: plan.sessions.map(s => ({ label: s.label })) } } }), query);
      } else {
        if (body.expectedTotal !== plan.customerTotal.amount || body.currency !== plan.customerTotal.currency)
          throw new Error('The booking price changed. Refresh checkout to review the updated total.');
        const parent = await runtime().start({ customer: user.id.uuid, attempt: body.attempt,
          listing: listingId.uuid, plan, payment,
          trusted: { initiate: value => trustedSdk.transactions.initiate(adapt(value), query).then(r => r.data) } });
        result = await sdk.transactions.show({ id: id(parent), ...query });
      }
    }
    res.status(200).set('Content-Type', 'application/transit+json').send(serialize(payload(result))).end();
  } catch (error) {
    // Do not log request bodies or Stripe client secrets on booking failures.
    const status = error.status === 401 || error.status === 403 ? error.status : 409;
    console.error('Combined booking request failed', status);
    res.status(status).json({ error: 'Combined booking could not be completed.',
      message: error.status ? 'Please refresh the booking and try again.' : error.message });
  }
};
