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

beforeEach(() => jest.clearAllMocks());

it('selects a dot and opens the carousel at that photo, resetting on another listing', () => {
  const wrapper = shallow(<SectionImages {...props} />);
  const thumbnail = () => wrapper.find('button[aria-pressed]');
  thumbnail()
    .at(2)
    .simulate('click');
  expect(
    thumbnail()
      .at(2)
      .prop('aria-pressed')
  ).toBe(true);
  expect(
    wrapper
      .find(ResponsiveImage)
      .first()
      .prop('image')
  ).toBe(images[2]);
  expect(wrapper.find(ImageCarousel).prop('initialImageIndex')).toBe(2);
  wrapper.find('button[aria-label="View photos of Studio"]').simulate('click');
  expect(props.handleViewPhotosClick).toHaveBeenCalled();
  wrapper.setProps({ listing: { id: { uuid: 'listing-2' }, images } });
  expect(
    thumbnail()
      .first()
      .prop('aria-pressed')
  ).toBe(true);
});

it('handles absent images and single-photo listings without redundant dots', () => {
  const wrapper = shallow(<SectionImages {...props} listing={{ id: { uuid: 'empty' } }} />);
  expect(wrapper.find('button[aria-pressed]').exists()).toBe(false);
  expect(wrapper.find('button[aria-label="View photos of Studio"]').prop('disabled')).toBe(true);
  wrapper.setProps({ listing: { id: { uuid: 'one' }, images: images.slice(0, 1) } });
  expect(wrapper.find('button[aria-pressed]').exists()).toBe(false);
  expect(
    wrapper
      .find(ResponsiveImage)
      .first()
      .prop('image')
  ).toBe(images[0]);
});

const photoButton = wrapper => wrapper.find('button[aria-label="View photos of Studio"]');
const touch = (x, y = 100) => ({ clientX: x, clientY: y });
const swipe = (wrapper, start, end) => {
  photoButton(wrapper).simulate('touchStart', { touches: [start] });
  photoButton(wrapper).simulate('touchEnd', { changedTouches: [end] });
};

it('swipes between photos without opening the viewer and keeps taps usable', () => {
  const wrapper = shallow(<SectionImages {...props} />);
  swipe(wrapper, touch(200), touch(100));
  expect(wrapper.find(ImageCarousel).prop('initialImageIndex')).toBe(1);
  const preventDefault = jest.fn();
  photoButton(wrapper).simulate('click', { detail: 1, preventDefault });
  expect(preventDefault).toHaveBeenCalled();
  expect(props.handleViewPhotosClick).not.toHaveBeenCalled();
  // A new tap after a swipe must open the viewer normally.
  swipe(wrapper, touch(100), touch(100));
  photoButton(wrapper).simulate('click', { detail: 1, preventDefault });
  expect(props.handleViewPhotosClick).toHaveBeenCalledTimes(1);
  wrapper
    .find('button')
    .filterWhere(b => b.text() === 'All photos')
    .simulate('click');
  expect(props.handleViewPhotosClick).toHaveBeenCalledTimes(2);
});

it('allows vertical scrolling, small gestures and cancelled touches without changing photos', () => {
  const wrapper = shallow(<SectionImages {...props} />);
  swipe(wrapper, touch(100, 100), touch(160, 250));
  swipe(wrapper, touch(100), touch(120));
  photoButton(wrapper).simulate('touchStart', { touches: [touch(200)] });
  photoButton(wrapper).simulate('touchCancel');
  photoButton(wrapper).simulate('touchEnd', { changedTouches: [touch(100)] });
  expect(wrapper.find(ImageCarousel).prop('initialImageIndex')).toBe(0);
});

it('supports arrow-key browsing and wraps at either end', () => {
  const wrapper = shallow(<SectionImages {...props} />);
  const preventDefault = jest.fn();
  photoButton(wrapper).simulate('keyDown', { key: 'ArrowLeft', preventDefault });
  expect(wrapper.find(ImageCarousel).prop('initialImageIndex')).toBe(2);
  photoButton(wrapper).simulate('keyDown', { key: 'ArrowRight', preventDefault });
  expect(wrapper.find(ImageCarousel).prop('initialImageIndex')).toBe(0);
  expect(preventDefault).toHaveBeenCalledTimes(2);
});

it('keeps many-photo controls bounded while making every photo reachable', () => {
  const manyImages = Array.from({ length: 30 }, (_, n) => ({ id: { uuid: `image-${n}` } }));
  const wrapper = shallow(
    <SectionImages {...props} listing={{ id: { uuid: 'many' }, images: manyImages }} />
  );
  photoButton(wrapper).simulate('keyDown', { key: 'ArrowLeft', preventDefault: jest.fn() });
  expect(wrapper.find('button[aria-pressed]')).toHaveLength(5);
  expect(wrapper.find('button[aria-pressed=true]').prop('aria-label')).toBe('Show photo 30 of 30');
  expect(wrapper.find('[role="status"]').text()).toBe('Photo 30 of 30');
  expect(wrapper.find(ResponsiveImage)).toHaveLength(1);
});
