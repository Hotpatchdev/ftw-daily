const { validateBookingMinimum, validateBookingRequest } = require('../../src/util/bookingMinimum');
const { transactionLineItems } = require('./lineItems');
const { types } = require('sharetribe-flex-sdk');

const listing = count => ({ attributes: { price: new types.Money(2000, 'GBP'), publicData: { minBooking: { minBookingType: 'hourlyMinBooking', minBookingCount: count } } } });
const booking = { startDate: new Date('2027-02-01T09:00Z'), endDate: new Date('2027-02-01T15:00Z'), type: 'price' };

it('prices a valid individual session using the actual listing rate', () => {
  const items = transactionLineItems(listing(5), booking);
  expect(items[0].quantity).toBe(6);
  expect(items[0].unitPrice.amount).toBe(2000);
});
it('rechecks the current minimum on the server, even if it changed after search', () => {
  expect(() => transactionLineItems(listing(8), booking)).toThrow('Minimum booking: 8 hours');
});
it('checks real daily minimums against the submitted consecutive date group', () => {
  const space = { attributes: { publicData: { minBooking: { minBookingType: 'dailyMinBooking', minBookingCount: '5' } } } };
  expect(() => validateBookingMinimum(space, { type: 'pricePerDay', startDate: '2027-02-01', endDate: '2027-02-06' })).not.toThrow();
  expect(() => validateBookingMinimum(space, { type: 'pricePerDay', startDate: '2027-02-01', endDate: '2027-02-05' })).toThrow('Minimum booking');
});
it('rejects invalid dates, units and malformed minimum rules', () => {
  expect(() => validateBookingMinimum(listing(5), { ...booking, startDate: null })).toThrow();
  expect(() => validateBookingMinimum(listing(5), { ...booking, endDate: booking.startDate })).toThrow();
  expect(() => validateBookingMinimum(listing(5), { ...booking, type: 'fake' })).toThrow();
  expect(() => validateBookingMinimum(listing('bad'), booking)).toThrow();
});
it('requires the reservation dates and unit to match the priced booking', () => {
  const body = { params: { bookingStart: booking.startDate, bookingEnd: booking.endDate, type: 'price', protectedData: { type: 'price' } } };
  expect(() => validateBookingRequest(booking, body)).not.toThrow();
  expect(() => validateBookingRequest(booking, { params: { ...body.params, bookingEnd: new Date('2027-02-01T10:00Z') } })).toThrow('must match');
  expect(() => validateBookingRequest(booking, { params: { ...body.params, type: 'pricePerDay' } })).toThrow('must match');
});
