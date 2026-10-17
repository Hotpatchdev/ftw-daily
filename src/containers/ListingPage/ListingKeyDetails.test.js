import React from 'react';
import { shallow } from 'enzyme';
import '../../util/test-helpers';
import ListingKeyDetails from './ListingKeyDetails';
import ListingReviewSummary from '../../components/ListingReviewSummary/ListingReviewSummary';

it('shows real capacity including one and omits invalid or absent values', () => {
  const wrapper = shallow(<ListingKeyDetails publicData={{ capacity: '1' }} />);
  expect(wrapper.text()).toContain('Capacity: 1');
  ['unknown', '', '-1', '1.5', '0'].forEach(capacity => {
    wrapper.setProps({ publicData: { capacity } });
    expect(wrapper.text()).not.toContain('Capacity:');
  });
});

it('links to the approximate map without exposing the street address and only rates published listings', () => {
  const wrapper = shallow(
    <ListingKeyDetails
      listingId="id"
      title="Studio"
      geolocation={{ lat: 51, lng: 0 }}
      publicData={{ location: { address: 'Private street address' } }}
      published
    />
  );
  expect(wrapper.find('a').prop('href')).toBe('#listing-location');
  expect(wrapper.text()).not.toContain('Private street address');
  expect(wrapper.find(ListingReviewSummary).prop('listingId')).toBe('id');
  wrapper.setProps({ published: false, geolocation: null });
  expect(wrapper.find(ListingReviewSummary).exists()).toBe(false);
  expect(wrapper.find('a').exists()).toBe(false);
});
