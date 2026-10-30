const { types } = require('sharetribe-flex-sdk');
const { prepareCombinedBooking } = require('./combinedBooking');
const { calculateTotalForCustomer, calculateTotalForProvider } = require('./lineItemHelpers');

const listing = {
  attributes: {
    price: new types.Money(1000, 'GBP'),
    availabilityPlan: { timezone: 'Europe/London' },
    publicData: {
      pricePerDay: { amount: 10000, currency: 'GBP' },
      minBooking: { minBookingType: 'hourlyMinBooking', minBookingCount: 5 },
    },
  },
};
const schedule = {
  unit: 'hourly',
  days: ['2027-02-01', '2027-02-03'],
  same: true,
  start: '09:00',
  end: '15:00',
  timeZone: 'Europe/London',
};
const options = { now: new Date('2027-01-01T00:00Z'), supportedCurrencies: ['GBP', 'USD'] };

it('prepares one full payment with reservations for only the selected intervals', () => {
  const plan = prepareCombinedBooking(listing, schedule, options);
  expect(plan.customerTotal).toEqual(new types.Money(13200, 'GBP'));
  expect(plan.providerTotal).toEqual(new types.Money(10800, 'GBP'));
  expect(plan.anchor).toEqual({
    start: new Date('2027-02-03T09:00Z'),
    end: new Date('2027-02-03T15:00Z'),
  });
  expect(plan.childSessions).toEqual([
    {
      index: 0,
      start: new Date('2027-02-01T09:00Z'),
      end: new Date('2027-02-01T15:00Z'),
    },
  ]);
  expect(plan.displayStart).toEqual(new Date('2027-02-01T09:00Z'));
  expect(plan.displayEnd).toEqual(plan.anchor.end);
});

it('cannot pool several short sessions to bypass the host minimum', () => {
  expect(() => prepareCombinedBooking(listing, { ...schedule, end: '11:00' }, options)).toThrow(
    'Minimum booking: 5 hours'
  );
});

it('groups daily reservations but enforces their total booked-day minimum once', () => {
  const space = {
    attributes: {
      ...listing.attributes,
      publicData: {
        ...listing.attributes.publicData,
        minBooking: { minBookingType: 'dailyMinBooking', minBookingCount: 2 },
      },
    },
  };
  const daily = { unit: 'daily', days: ['2027-02-01', '2027-02-02', '2027-02-05', '2027-02-06'] };
  const plan = prepareCombinedBooking(space, daily, options);
  expect(plan.sessions).toHaveLength(2);
  expect(plan.childSessions[0].end).toEqual(new Date('2027-02-03T00:00Z'));
  expect(plan.anchor.start).toEqual(new Date('2027-02-05T00:00Z'));
  expect(plan.customerTotal.amount).toBe(44000);
  expect(prepareCombinedBooking(space, { ...daily, days: daily.days.slice(0, 3) }, options).customerTotal.amount).toBe(33000);
  expect(() => prepareCombinedBooking(space,{...daily,days:['2027-02-01']},options)).toThrow('Minimum booking: 2 days');
});

it('prices 15 plus 2 separated euro days as one payment with no reservation or charge for the gap', () => {
  const days=Array.from({length:15},(_,i)=>`2027-02-${String(i+1).padStart(2,'0')}`);
  const space={attributes:{...listing.attributes,publicData:{pricePerDay:{amount:500,currency:'EUR'},minBooking:{minBookingType:'dailyMinBooking',minBookingCount:15}}}};
  const plan=prepareCombinedBooking(space,{unit:'daily',days:[...days,'2027-02-20','2027-02-21']},{now:options.now});
  expect(plan.sessions).toHaveLength(2);
  expect(plan.childSessions[0]).toMatchObject({start:new Date('2027-02-01'),end:new Date('2027-02-16')});
  expect(plan.anchor).toEqual({start:new Date('2027-02-20'),end:new Date('2027-02-22')});
  expect(plan.customerTotal).toEqual(new types.Money(9350,'EUR'));
  expect(()=>prepareCombinedBooking(space,{unit:'daily',days:['2027-02-01','2027-02-21']},{now:options.now})).toThrow('Minimum booking: 15 days');
});

it('uses each date’s time-zone offset and rejects missing or repeated clock times', () => {
  const plan = prepareCombinedBooking(
    listing,
    {
      ...schedule,
      days: ['2027-03-27', '2027-03-29'],
    },
    options
  );
  expect(plan.sessions.map(s => s.start.toISOString())).toEqual([
    '2027-03-27T09:00:00.000Z',
    '2027-03-29T08:00:00.000Z',
  ]);
  ['2027-03-28', '2027-10-31'].forEach(day => {
    expect(() =>
      prepareCombinedBooking(
        listing,
        {
          ...schedule,
          days: [day],
          start: '01:30',
          end: '10:00',
        },
        options
      )
    ).toThrow('clocks change');
  });
});

it('rejects client time zones that do not match the current listing', () => {
  expect(() =>
    prepareCombinedBooking(listing, { ...schedule, timeZone: 'America/New_York' }, options)
  ).toThrow('space’s time zone');
});

it('rejects past dates, dates beyond the booking horizon and duplicate dates', () => {
  expect(() =>
    prepareCombinedBooking(listing, { ...schedule, days: ['2026-12-31'] }, options)
  ).toThrow('future dates');
  expect(() =>
    prepareCombinedBooking(listing, { ...schedule, days: ['2028-01-02'] }, options)
  ).toThrow('within the next year');
  expect(() =>
    prepareCombinedBooking(listing, { ...schedule, days: ['2027-02-01', '2027-02-01'] }, options)
  ).toThrow('valid booking dates');
});

it('preserves per-session rounding rather than changing fees when combining the payment', () => {
  const space = { attributes: { ...listing.attributes, price: new types.Money(1001, 'GBP') } };
  const plan = prepareCombinedBooking(space, { ...schedule, end: '14:00' }, options);
  expect(plan.customerTotal.amount).toBe(11012);
  expect(calculateTotalForCustomer(plan.lineItems)).toEqual(plan.customerTotal);
  expect(calculateTotalForProvider(plan.lineItems)).toEqual(plan.providerTotal);
  expect(plan.sessions.reduce((sum, s) => sum + s.customerTotal.amount, 0)).toBe(
    plan.customerTotal.amount
  );
});

it('preserves existing discount amounts for a server-authorized promotion', () => {
  const plan = prepareCombinedBooking(listing, schedule, { ...options, promocode: true });
  expect(plan.customerTotal.amount).toBe(12000);
  expect(plan.providerTotal.amount).toBe(10800);
  expect(plan.lineItems.find(item => item.code === 'line-item/discount').unitPrice.amount).toBe(
    -1200
  );
});

it('keeps 31 sessions within the payment line-item limit', () => {
  const days = Array.from({ length: 31 }, (_, i) => `2027-03-${String(i + 1).padStart(2, '0')}`);
  const plan = prepareCombinedBooking(listing, { ...schedule, days }, options);
  expect(plan.sessions).toHaveLength(31);
  expect(plan.childSessions).toHaveLength(30);
  expect(plan.lineItems).toHaveLength(3);
  expect(plan.customerTotal.amount).toBe(204600);
});

it('rejects invalid or unsupported rates and leaves input data unchanged', () => {
  [
    new types.Money(0, 'GBP'),
    { amount: 1000, currency: 'EUR' },
    { amount: 1.5, currency: 'GBP' },
  ].forEach(price => {
    expect(() =>
      prepareCombinedBooking({ attributes: { ...listing.attributes, price } }, schedule, options)
    ).toThrow('supported rate');
  });
  const before = JSON.stringify({ listing, schedule });
  prepareCombinedBooking(listing, schedule, options);
  expect(JSON.stringify({ listing, schedule })).toBe(before);
});
it('preserves the existing whole-space capacity for daily bookings', () => {
  const dailyListing = {...listing, attributes:{...listing.attributes, publicData:{...listing.attributes.publicData,seats:4,minBooking:{}}}};
  const result=prepareCombinedBooking(dailyListing,{unit:'daily',days:['2027-02-01','2027-02-03']},options);
  expect(result.seats).toBe(4);
  expect(prepareCombinedBooking(dailyListing,schedule,options).seats).toBe(1);
});
