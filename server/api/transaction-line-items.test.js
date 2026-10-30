jest.mock('../api-util/sdk',()=>({getSdk:jest.fn(),serialize:value=>value,
  handleError:(res,error)=>res.status(400).send({error:error.message}).end()}));
const {getSdk}=require('../api-util/sdk');
const endpoint=require('./transaction-line-items');
const days=Array.from({length:15},(_,i)=>`2027-02-${String(i+1).padStart(2,'0')}`);
const schedule={unit:'daily',days:[...days,'2027-02-20','2027-02-21']};
const listing={attributes:{publicData:{pricePerDay:{amount:500,currency:'EUR'},minBooking:{minBookingType:'dailyMinBooking',minBookingCount:15}}}};
const request=body=>new Promise(resolve=>{
  let status,payload;const res={status(value){status=value;return this;},set(){return this;},send(value){payload=value;return this;},end(){resolve({status,payload});}};
  endpoint({body:{listingId:'space',isOwnListing:false,...body}},res);
});
beforeEach(()=>getSdk.mockReturnValue({listings:{show:jest.fn().mockResolvedValue({data:{data:listing}})}}));
it('prices the two-day group inside a valid 17-day schedule',async()=>{
  const result=await request({schedule,bookingData:{type:'pricePerDay',startDate:'2027-02-20',endDate:'2027-02-22'}});
  expect(result.status).toBe(200);expect(result.payload.data[0].quantity.toString()).toBe('2');
  expect(result.payload.data[0].lineTotal.amount).toBe(1000);
});
it('does not count intervening unselected days toward the total minimum',async()=>{
  const result=await request({schedule:{unit:'daily',days:['2027-02-01','2027-02-21']},bookingData:{type:'pricePerDay',startDate:'2027-02-21',endDate:'2027-02-22'}});
  expect(result.status).toBe(400);expect(result.payload.error).toContain('Minimum booking');
});
it('rejects a priced interval that includes the unbooked gap',async()=>{
  const result=await request({schedule,bookingData:{type:'pricePerDay',startDate:'2027-02-15',endDate:'2027-02-22'}});
  expect(result.status).toBe(400);expect(result.payload.error).toContain('must match');
});
it('keeps the minimum for a standalone quote without a combined schedule',async()=>{
  const result=await request({bookingData:{type:'pricePerDay',startDate:'2027-02-20',endDate:'2027-02-22',schedule}});
  expect(result.status).toBe(400);expect(result.payload.error).toContain('Minimum booking');
});
