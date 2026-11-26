import React from 'react';
import { renderShallow } from '../../util/test-helpers';
import { createUser, createListing, fakeIntl } from '../../util/test-data';
import { ListingCardComponent } from './ListingCard';
import { shallow } from 'enzyme';

describe('ListingCard', () => {
  it('shows the numeric EUR daily price instead of an unsupported-currency placeholder', () => {
    const listing = createListing('euro', { price: null,
      publicData: { pricePerDay: { amount: 12500, currency: 'EUR' } } },
      { author: createUser('host') });
    const intl = { ...fakeIntl, formatNumber: (amount, options) =>
      new Intl.NumberFormat('en-GB', options).format(amount) };
    const card = shallow(<ListingCardComponent listing={listing} intl={intl} />);
    expect(card.find('[title="€125.00"]').text()).toBe('€125.00');
  });
  it('matches snapshot', () => {
    const listing = createListing('listing1', { title: 'Studio' }, { author: createUser('user1') });
    const tree = renderShallow(<ListingCardComponent listing={listing} intl={fakeIntl} />);
    expect(tree).toMatchSnapshot();
  });
});
