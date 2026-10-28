const { CalendarWorker } = require('./worker');
const { enabled, settings, checkpointStore, startWorker } = require('./runtime');
const fs = require('fs');
const os = require('os');
const path = require('path');
const startAt = '2026-10-27T12:00:00Z';
const tx = 'a0c5ac24-b53b-4c1a-90d0-53d86424b52f';
const event = (sequenceId, transition = 'transition/accept', id = tx) => ({ attributes: {
  sequenceId, createdAt: new Date('2026-10-27T13:00:00Z'), resourceId: { uuid:id },
  resource: { attributes: { lastTransition:transition } },
} });
const response = () => ({ data: { id:{uuid:tx}, attributes:{ lastTransition:'transition/accept' },
  relationships:Object.fromEntries(['booking','listing','customer','provider'].map(k=>[k,{data:{id:{uuid:k}}}])) },
  included:[
    {type:'booking',id:{uuid:'booking'},attributes:{state:'accepted',start:new Date('2026-11-03T09:00:00Z'),end:new Date('2026-11-03T12:00:00Z')}},
    {type:'listing',id:{uuid:'listing'},attributes:{title:'Studio',publicData:{location:{address:'1 High Street'}}}},
    {type:'user',id:{uuid:'customer'},attributes:{email:'booker@example.com',profile:{displayName:'Booker'}}},
    {type:'user',id:{uuid:'provider'},attributes:{email:'host@example.com'}},
  ] });
let integration,calendar,checkpoint,worker;
beforeEach(()=>{
  integration={events:jest.fn().mockResolvedValue([event(100)]),show:jest.fn().mockImplementation(async()=>response()),updateMetadata:jest.fn()};
  calendar={create:jest.fn().mockResolvedValue({internal:'i',host:'h',booker:'b'}),cancel:jest.fn()};
  checkpoint={read:jest.fn().mockReturnValue(null),write:jest.fn()};
  worker=new CalendarWorker({integration,calendar,checkpoint,startAt,transactionIds:[tx]});
});
it('starts at the explicit cutover and maps real SDK UUIDs and included booking Dates',async()=>{
  await worker.sweep();
  expect(integration.events).toHaveBeenCalledWith({createdAtStart:new Date(startAt),eventTypes:['transaction'],perPage:100});
  expect(calendar.create).toHaveBeenCalledWith(expect.objectContaining({host:expect.objectContaining({start:expect.objectContaining({dateTime:'2026-11-03T09:00:00.000Z'})})}));
  expect(checkpoint.write).toHaveBeenCalledWith(100);
});
it('ignores historic events and transactions outside the controlled test list',async()=>{
  const historic=event(100);historic.attributes.createdAt=new Date('2026-10-26T13:00:00Z');
  integration.events.mockResolvedValue([historic,event(101,'transition/accept','other')]);
  await worker.sweep();expect(integration.show).not.toHaveBeenCalled();expect(calendar.create).not.toHaveBeenCalled();
});
it('retains the cursor after a failed metadata write so the same events retry',async()=>{
  integration.updateMetadata.mockRejectedValueOnce(new Error('temporary'));
  await expect(worker.sweep()).rejects.toThrow('temporary');expect(checkpoint.write).not.toHaveBeenCalled();
  await worker.sweep();expect(checkpoint.write).toHaveBeenCalledWith(100);expect(calendar.create).toHaveBeenCalledTimes(2);
});
it('resumes after the saved sequence without replaying historic bookings',async()=>{
  checkpoint.read.mockReturnValue(99);await worker.sweep();
  expect(integration.events).toHaveBeenCalledWith({startAfterSequenceId:99,eventTypes:['transaction'],perPage:100});
});
it('does not recreate an already cancelled booking from a queued acceptance',async()=>{
  const r=response();r.included[0].attributes.state='cancelled';integration.show.mockResolvedValue(r);
  await worker.sweep();expect(calendar.create).not.toHaveBeenCalled();expect(calendar.cancel).toHaveBeenCalled();
});
it('keeps the worker off by default and rejects production even with a true flag',()=>{
  expect(enabled({})).toBe(false);expect(enabled({GOOGLE_CALENDAR_SYNC_ENABLED:'true',REACT_APP_SHARETRIBE_SDK_CLIENT_ID:'production'})).toBe(false);
  const old=process.env.GOOGLE_CALENDAR_SYNC_ENABLED;delete process.env.GOOGLE_CALENDAR_SYNC_ENABLED;
  expect(startWorker()).toBeUndefined();if(old!==undefined)process.env.GOOGLE_CALENDAR_SYNC_ENABLED=old;
});
it('requires an explicit cutover, private store and nominated staging transaction',()=>{
  expect(()=>settings({})).toThrow('cutover');
  expect(()=>settings({GOOGLE_CALENDAR_SYNC_START_AT:startAt},Date.parse(startAt))).toThrow('Nominate');
});
it('persists the cursor across restarts and rejects changes to its calendar scope',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'hp-calendar-'));
  try{
    const opts={directory,startAt,transactionIds:[tx]};checkpointStore(opts,'diary').write(100);
    expect(checkpointStore(opts,'diary').read()).toBe(100);
    expect(()=>checkpointStore(opts,'different').read()).toThrow('operator review');
    expect(fs.statSync(path.join(directory,'cursor.json')).mode&0o777).toBe(0o600);
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
