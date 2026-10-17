import React from 'react';
import { shallow } from 'enzyme';
import '../../util/test-helpers';
import SectionImages from './SectionImages';
import { ResponsiveImage, ImageCarousel } from '../../components';

const images = [1, 2, 3].map(n => ({ id: { uuid: `image-${n}` } }));
const props = {
  title: 'Studio',
  listing: { id: { uuid: 'listing-1' }, images },
  handleViewPhotosClick: jest.fn(),
};

it('selects a preview and opens the carousel at that photo, resetting on another listing', () => {
  const wrapper = shallow(<SectionImages {...props} />);
  const thumbnail = () => wrapper.find('button[aria-pressed]');
  thumbnail().at(2).simulate('click');
  expect(thumbnail().at(2).prop('aria-pressed')).toBe(true);
  expect(wrapper.find(ResponsiveImage).first().prop('image')).toBe(images[2]);
  expect(wrapper.find(ImageCarousel).prop('initialImageIndex')).toBe(2);
  wrapper.find('button[aria-label="View photos of Studio"]').simulate('click');
  expect(props.handleViewPhotosClick).toHaveBeenCalled();
  wrapper.setProps({ listing: { id: { uuid: 'listing-2' }, images } });
  expect(thumbnail().first().prop('aria-pressed')).toBe(true);
});

it('handles absent images and single-photo listings without redundant thumbnails', () => {
  const wrapper = shallow(<SectionImages {...props} listing={{ id: { uuid: 'empty' } }} />);
  expect(wrapper.find('button[aria-pressed]').exists()).toBe(false);
  expect(wrapper.find('button[aria-label="View photos of Studio"]').prop('disabled')).toBe(true);
  wrapper.setProps({ listing: { id: { uuid: 'one' }, images: images.slice(0, 1) } });
  expect(wrapper.find('button[aria-pressed]').exists()).toBe(false);
  expect(wrapper.find(ResponsiveImage).first().prop('image')).toBe(images[0]);
});
