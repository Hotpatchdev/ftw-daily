import React from 'react';
import { mount } from 'enzyme';
import Decimal from 'decimal.js';
import { fakeIntl, createBooking } from '../../util/test-data';
import { TestProvider } from '../../util/test-helpers';
import { types } from '../../util/sdkLoader';
import { LINE_ITEM_UNITS } from '../../util/types';
import { BookingBreakdownComponent } from './BookingBreakdown';
const { Money, UUID } = types;
it('lists each selected session and the actual combined total without a misleading hourly quantity', () => {
  const transaction = {id:new UUID('combined-example'),type:'transaction', attributes:{
    createdAt:new Date('2027-01-01'),lastTransitionedAt:new Date('2027-01-01'),transitions:[],lastTransition:'transition/operator-confirm-payment',
    protectedData:{combinedBooking:true,type:'price',sessionLabels:[{label:'Mon 1 Feb 2027, 09:00–12:00'},{label:'Wed 3 Feb 2027, 10:00–13:00'}]},
    payinTotal:new Money(6600,'GBP'),payoutTotal:new Money(5400,'GBP'),
    lineItems:[{code:LINE_ITEM_UNITS,includeFor:['customer','provider'],quantity:new Decimal(1),unitPrice:new Money(6000,'GBP'),lineTotal:new Money(6000,'GBP'),reversal:false},
      {code:'line-item/customer-commission',includeFor:['customer'],quantity:new Decimal(1),unitPrice:new Money(600,'GBP'),lineTotal:new Money(600,'GBP'),reversal:false}]
  }};
  const wrapper=mount(<TestProvider><BookingBreakdownComponent userRole="customer" unitType={LINE_ITEM_UNITS} transaction={transaction}
    booking={createBooking('combined-booking',{start:new Date('2027-02-03T10:00Z'),end:new Date('2027-02-03T13:00Z')})} intl={fakeIntl}/></TestProvider>);
  const text=wrapper.text();
  wrapper.unmount();
  expect(text).toContain('Mon 1 Feb 2027, 09:00–12:00');
  expect(text).toContain('Wed 3 Feb 2027, 10:00–13:00');
  expect(text).toContain('sessions · one booking');
  expect(text).not.toContain('BookingBreakdown.quantity');
  expect(text).toContain('66');
});
