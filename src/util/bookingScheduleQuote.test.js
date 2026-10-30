import { quoteListingSchedule } from './bookingScheduleQuote';
import { transactionLineItems } from './api';
import { fetchListingScheduleSlots } from './scheduleSearch';
jest.mock('../config', () => ({ currency: 'GBP', additionalCurrency: 'USD', additionalCurrencyEuro:'EUR' }));
jest.mock('./api', () => ({ transactionLineItems: jest.fn() }));
jest.mock('./scheduleSearch', () => ({ fetchListingScheduleSlots: jest.fn() }));
const listing = {
  id: { uuid: 'space' },
  attributes: {
    price: { amount: 1000, currency: 'GBP' },
    publicData: {
      pricePerDay: { amount: 10000, currency: 'GBP' },
      minBooking: { minBookingType: 'hourlyMinBooking', minBookingCount: 5 },
    },
  },
};
const schedule = {
  unit: 'hourly',
  days: ['2027-02-01', '2027-02-03'],
  start: '09:00',
  end: '15:00',
  same: true,
  timeZone: 'Europe/London',
};
const item = (code, amount, includeFor = ['customer']) => ({
  code,
  includeFor,
  lineTotal: { amount, currency: 'GBP' },
});
beforeEach(() => {
  jest.clearAllMocks();
  fetchListingScheduleSlots.mockResolvedValue([
    { attributes: { start: new Date('2027-02-01'), end: new Date('2027-02-10'), seats: 1 } },
  ]);
  transactionLineItems.mockResolvedValue({
    data: [
      item('line-item/units', 6000, ['customer', 'provider']),
      item('line-item/customer-commission', 600),
      item('line-item/provider-commission', -600, ['provider']),
    ],
  });
});
it('uses server prices including customer fees and quotes only each chosen interval', async () => {
  const quote = await quoteListingSchedule({}, listing, schedule, false);
  expect(quote.groups.map(group => group.total)).toEqual([6600, 6600]);
  expect(quote.groups[0].items).toHaveLength(2);
  expect(transactionLineItems.mock.calls[1][0].bookingData).toEqual({
    startDate: new Date('2027-02-03T09:00Z'),
    endDate: new Date('2027-02-03T15:00Z'),
    type: 'price',
    promocode: false,
  });
});
it('blocks short sessions before requesting availability or prices', async () => {
  await expect(quoteListingSchedule({}, listing, { ...schedule, end: '11:00' })).rejects.toThrow(
    'minimum'
  );
  expect(fetchListingScheduleSlots).not.toHaveBeenCalled();
  expect(transactionLineItems).not.toHaveBeenCalled();
});
it('blocks unavailable sessions before quoting any price', async () => {
  fetchListingScheduleSlots.mockResolvedValue([]);
  await expect(quoteListingSchedule({}, listing, schedule)).rejects.toThrow('unavailable');
  expect(transactionLineItems).not.toHaveBeenCalled();
});
it('groups consecutive daily dates and never prices the gap', async () => {
  await quoteListingSchedule({}, listing, {
    unit: 'daily',
    days: ['2027-02-01', '2027-02-02', '2027-02-05'],
  });
  expect(transactionLineItems.mock.calls.map(call => call[0].bookingData)).toMatchObject([
    { startDate: new Date('2027-02-01'), endDate: new Date('2027-02-03'), type: 'pricePerDay' },
    { startDate: new Date('2027-02-05'), endDate: new Date('2027-02-06'), type: 'pricePerDay' },
  ]);
});
it('never confirms partial or stale quotes', async () => {
  transactionLineItems.mockRejectedValueOnce(new Error('Price unavailable'));
  await expect(quoteListingSchedule({}, listing, schedule)).rejects.toThrow('Price unavailable');
  await expect(quoteListingSchedule({}, listing, schedule, false, () => false)).rejects.toThrow(
    'changed'
  );
});
it('rejects incomplete prices and mixed currencies', async () => {
  transactionLineItems.mockResolvedValue({ data: [] });
  await expect(quoteListingSchedule({}, listing, schedule)).rejects.toThrow('confirmed');
  transactionLineItems.mockResolvedValue({
    data: [{ ...item('line-item/units', 60), lineTotal: { amount: 60, currency: 'USD' } }],
  });
  await expect(quoteListingSchedule({}, listing, schedule)).rejects.toThrow('confirmed');
});

it('quotes the cricket minimum plus two separate days in euros and requires one combined checkout',async()=>{
  const days=Array.from({length:15},(_,i)=>`2027-02-${String(i+1).padStart(2,'0')}`);
  const daily={unit:'daily',days:[...days,'2027-02-20','2027-02-21']};
  const cricket={...listing,attributes:{...listing.attributes,publicData:{pricePerDay:{amount:500,currency:'EUR'},minBooking:{minBookingType:'dailyMinBooking',minBookingCount:15}}}};
  fetchListingScheduleSlots.mockResolvedValue([{attributes:{start:new Date('2027-02-01'),end:new Date('2027-03-01'),seats:99}}]);
  transactionLineItems.mockImplementation(async({bookingData})=>{
    const hire=(bookingData.endDate-bookingData.startDate)/86400000*500;
    return {data:[{...item('line-item/units',hire),lineTotal:{amount:hire,currency:'EUR'}},{...item('line-item/customer-commission',hire/10),lineTotal:{amount:hire/10,currency:'EUR'}}]};
  });
  const result=await quoteListingSchedule({},cricket,daily);
  expect(result.groups.map(g=>g.total)).toEqual([8250,1100]);
  expect(result.requiresCombinedCheckout).toBe(true);
  expect(transactionLineItems.mock.calls.map(c=>c[0].schedule)).toEqual([daily,daily]);
  expect(transactionLineItems.mock.calls[1][0].bookingData).toMatchObject({startDate:new Date('2027-02-20'),endDate:new Date('2027-02-22')});
});
