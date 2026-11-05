import React from 'react';
import { mount, shallow } from 'enzyme';
import { BookingInfoMaybe } from './InboxPage';
import { BookingTimeInfo } from '../../components';
import { TestProvider } from '../../util/test-helpers';
import { IntlProvider } from '../../util/reactIntl';
import messages from '../../translations/en.json';
import { createTransaction, fakeIntl } from '../../util/test-data';
import { LINE_ITEM_DAY } from '../../util/types';

const labels = ['Fri 6 Nov – Fri 20 Nov', 'Wed 25 Nov – Thu 26 Nov', 'Mon 30 Nov'];
const PreviewProvider = ({ children }) => (
  <TestProvider><IntlProvider locale="en" messages={messages}>{children}</IntlProvider></TestProvider>
);
const props = (data, isOrder = true) => {
  const tx = createTransaction({ id: 'combined-inbox', lastTransition: 'transition/operator-confirm-payment' });
  tx.attributes.protectedData = data;
  return { intl: fakeIntl, isOrder, unitType: LINE_ITEM_DAY, tx };
};

it.each([true, false])('shows separated dates instead of an overall interval (customer=%s)', isOrder => {
  const wrapper = mount(<PreviewProvider><BookingInfoMaybe {...props({ combinedBooking: true,
    sessionLabels: labels.slice(0, 2).map(label => ({ label })) }, isOrder)} /></PreviewProvider>);
  expect(wrapper.text()).toContain('2 sessions · one booking');
  labels.slice(0, 2).forEach(label => expect(wrapper.text()).toContain(label));
  expect(wrapper.find(BookingTimeInfo)).toHaveLength(0);
  wrapper.unmount();
});

it('keeps long schedules compact and makes additional sessions explicit', () => {
  const wrapper = mount(<PreviewProvider><BookingInfoMaybe {...props({ combinedBooking: true,
    sessionLabels: labels.map(label => ({ label })) })} /></PreviewProvider>);
  expect(wrapper.text()).toContain('3 sessions · one booking');
  expect(wrapper.text()).toContain('+1 more session');
  expect(wrapper.text()).not.toContain(labels[2]);
  wrapper.unmount();
});

it('does not substitute an overall interval if combined labels are unavailable', () => {
  const wrapper = mount(<PreviewProvider><BookingInfoMaybe {...props({ combinedBooking: true })} /></PreviewProvider>);
  expect(wrapper.text()).toContain('Multiple sessions · one booking');
  expect(wrapper.find(BookingTimeInfo)).toHaveLength(0);
  wrapper.unmount();
});

it('preserves the standard date summary for a single booking', () => {
  const wrapper = shallow(<BookingInfoMaybe {...props({ type: 'pricePerDay' })} />);
  expect(wrapper.find(BookingTimeInfo)).toHaveLength(1);
});
