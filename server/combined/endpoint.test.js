jest.mock('../api-util/sdk', () => ({ getSdk: jest.fn(), getTrustedSdk: jest.fn(), serialize: x => JSON.stringify(x) }));
jest.mock('./runtime', () => ({ enabled: jest.fn(), runtime: jest.fn() }));
const { getSdk, getTrustedSdk } = require('../api-util/sdk');
const { enabled, runtime } = require('./runtime');
const endpoint = require('../api/combined-booking');
const { types } = require('sharetribe-flex-sdk');
const listingId = new types.UUID('6273aafd-fe77-499e-b00d-6c3b9f2db05b');
const customer = new types.UUID('60d48989-7868-427b-a0e3-39d33c634f12');
const parent = '6273aafd-fe77-499e-b00d-6c3b9f2db05c';
let sdk, service, res;
const schedule = { unit:'hourly',days:['2027-02-01','2027-02-03'],same:true,start:'09:00',end:'12:00',timeZone:'Europe/London' };
beforeEach(() => {
  process.env.REACT_APP_SHARETRIBE_MARKETPLACE_CURRENCY='GBP';
  service={ start:jest.fn().mockResolvedValue(parent),act:jest.fn() }; runtime.mockReturnValue(service);enabled.mockReturnValue(true);
  sdk={ currentUser:{show:jest.fn().mockResolvedValue({data:{data:{id:customer}}})},
    listings:{show:jest.fn().mockResolvedValue({data:{data:{id:listingId,relationships:{author:{data:{id:listingId}}},
      attributes:{price:new types.Money(1000,'GBP'),availabilityPlan:{timezone:'Europe/London'},publicData:{minBooking:{minBookingType:'hourlyMinBooking',minBookingCount:2.5}}}}}})},
    transactions:{show:jest.fn().mockResolvedValue({status:200,data:{data:{id:new types.UUID(parent),attributes:{processName:'hotpatch-combined-booking'}}}})} };
  getSdk.mockReturnValue(sdk);getTrustedSdk.mockResolvedValue({transactions:{}});
  res={status:jest.fn().mockReturnThis(),json:jest.fn().mockReturnThis(),set:jest.fn().mockReturnThis(),send:jest.fn().mockReturnThis(),end:jest.fn()};
});
it('does not create a payment when the displayed amount differs from the trusted total',async()=>{
  await endpoint({body:{listingId,schedule,expectedTotal:1,currency:'GBP'}},res);
  expect(res.status).toHaveBeenCalledWith(409);expect(service.start).not.toHaveBeenCalled();
});
it('does not allow client supplied promotion discounts',async()=>{
  await endpoint({body:{listingId,schedule,promocode:true}},res);
  expect(service.start).not.toHaveBeenCalled();expect(res.status).toHaveBeenCalledWith(409);
});
it('passes only verified listing pricing and whitelisted payment fields to the coordinator',async()=>{
  await endpoint({body:{listingId,schedule,expectedTotal:6600,currency:'GBP',attempt:'checkout-reference-123456789',
    lineItems:[],processAlias:'other/process',protectedData:{combinedParentId:'forged'}}},res);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(sdk.listings.show).toHaveBeenCalledWith({ id:listingId,include:['author'] });
  expect(service.start).toHaveBeenCalledWith(expect.objectContaining({customer:customer.uuid,listing:listingId.uuid,
    payment:{},plan:expect.objectContaining({customerTotal:new types.Money(6600,'GBP')})}));
});
it('leaves the feature unavailable until staging validation is complete',async()=>{
  enabled.mockReturnValue(false);await endpoint({body:{listingId,schedule}},res);
  expect(res.status).toHaveBeenCalledWith(503);expect(service.start).not.toHaveBeenCalled();
});
it('requires a signed-in customer before reserving any session',async()=>{
  sdk.currentUser.show.mockRejectedValue({status:401});await endpoint({body:{listingId,schedule}},res);
  expect(res.status).toHaveBeenCalledWith(401);expect(service.start).not.toHaveBeenCalled();
});
