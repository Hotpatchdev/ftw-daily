import React from 'react';
import { shallow } from 'enzyme';
import { Form as FinalForm } from 'react-final-form';
import '../../util/test-helpers';
import { fakeIntl } from '../../util/test-data';
import { FieldDateRangeInput } from '../../components';
import { BookingDatesFormComponent } from './BookingDatesForm';

it('does not request an impossible weekly quote, but quotes the next valid full week', () => {
  const onFetchTransactionLineItems = jest.fn();
  const form = shallow(<BookingDatesFormComponent intl={fakeIntl} bookingType="pricePerWeek"
    onSubmit={() => {}} onFetchTransactionLineItems={onFetchTransactionLineItems} />);
  const startDate = new Date('2027-02-01T12:00Z');
  form.instance().handleOnChange({ bookingDates: { startDate, endDate: new Date('2027-02-09T12:00Z') } });
  expect(onFetchTransactionLineItems).not.toHaveBeenCalled();
  form.instance().handleOnChange({ bookingDates: { startDate, endDate: new Date('2027-02-15T12:00Z') } });
  expect(onFetchTransactionLineItems).toHaveBeenCalledTimes(1);
});

it.each([['pricePerWeek', 7, 15], ['pricePerMonth', 30, 61]])(
  'validates %s extra days without modifying selected dates', (bookingType, minimumLength, days) => {
    const dates = { startDate: new Date('2027-02-01T12:00Z'),
      endDate: new Date(Date.parse('2027-02-01T12:00Z') + days * 86400000) };
    const props = { intl: fakeIntl, bookingType, minimumLength, periodCurrency: 'EUR',
      onSubmit: () => {}, onFetchTransactionLineItems: () => {} };
    const render = dailyRate => {
      const form = shallow(<BookingDatesFormComponent {...props} dailyRate={dailyRate} />);
      return shallow(form.find(FinalForm).prop('render')({ ...props, values: { bookingDates: dates },
        formId: 'test', unitType: 'line-item/units' }));
    };
    expect(render(null).find(FieldDateRangeInput).prop('validate')(dates)).toContain('whole');
    expect(render({ amount: 1500, currency: 'EUR' }).find(FieldDateRangeInput).prop('validate')(dates))
      .toBeUndefined();
    expect(render({ amount: 1500, currency: 'GBP' }).find(FieldDateRangeInput).prop('validate')(dates))
      .toContain('whole');
    expect(dates.endDate.getTime() - dates.startDate.getTime()).toBe(days * 86400000);
  }
);
