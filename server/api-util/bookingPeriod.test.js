const { types } = require('sharetribe-flex-sdk');
const { transactionLineItems } = require('./lineItems');
const { calculateTotalForCustomer, calculateTotalForProvider } = require('./lineItemHelpers');
const { bookingPeriod } = require('../../src/util/bookingPeriod');

const space = dailyRate => ({ attributes: { publicData: {
  pricePerWeek: { amount: 7000, currency: 'EUR' },
  pricePerMonth: { amount: 30000, currency: 'EUR' },
  pricePerDay: dailyRate,
} } });
const daily = { amount: 1500, currency: 'EUR' };
const dates = days => ({ startDate: new Date('2027-02-01T00:00Z'),
  endDate: new Date(Date.parse('2027-02-01T00:00Z') + days * 86400000) });

it.each([['pricePerWeek', 15, 2, 1, 15500], ['pricePerMonth', 62, 2, 2, 63000]])(
  'charges full periods plus actual daily-priced extra days for %s', (type, days, units, extra, subtotal) => {
    const items = transactionLineItems(space(daily), { ...dates(days), type });
    expect(items[0].quantity).toBe(units);
    expect(items[1]).toEqual({ code: 'line-item/additional-days',
      unitPrice: new types.Money(1500, 'EUR'), quantity: extra, includeFor: ['customer', 'provider'] });
    expect(calculateTotalForCustomer(items).amount).toBe(subtotal * 1.1);
    expect(calculateTotalForProvider(items).amount).toBe(subtotal * 0.9);
  }
);

it.each([undefined, { amount: 0, currency: 'EUR' }, { amount: 1500, currency: 'GBP' }])(
  'rejects extra days without a usable daily rate in the same currency', dailyRate => {
    expect(() => transactionLineItems(space(dailyRate), { ...dates(15), type: 'pricePerWeek' }))
      .toThrow('whole weeks only');
    expect(() => transactionLineItems(space(dailyRate), { ...dates(31), type: 'pricePerMonth' }))
      .toThrow('whole 30-day months only');
    expect(transactionLineItems(space(dailyRate), { ...dates(14), type: 'pricePerWeek' })[0].quantity).toBe(2);
  }
);

it('uses the full hire subtotal for discounts and preserves the host minimum', () => {
  const listing = space(daily);
  const items = transactionLineItems(listing, { ...dates(15), type: 'pricePerWeek', promocode: 'TEST' });
  expect(items.find(item => item.code === 'line-item/discount').unitPrice.amount).toBe(15500);
  listing.attributes.publicData.minBooking = { minBookingType: 'weeklyMinBooking', minBookingCount: 3 };
  expect(() => transactionLineItems(listing, { ...dates(15), type: 'pricePerWeek' })).toThrow('Minimum booking');
});

it('does not round partial booking days into a free or shorter period', () => {
  expect(() => bookingPeriod('2027-02-01T00:00Z', '2027-02-16T12:00Z', 'pricePerWeek', daily, 'EUR'))
    .toThrow('whole booking days');
});
