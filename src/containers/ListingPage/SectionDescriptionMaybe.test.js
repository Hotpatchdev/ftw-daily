import React from 'react';
import { shallow } from 'enzyme';
import '../../util/test-helpers';
import SectionDescriptionMaybe from './SectionDescriptionMaybe';

it('keeps short descriptions complete and hides empty sections', () => {
  expect(shallow(<SectionDescriptionMaybe description="" />).isEmptyRender()).toBe(true);
  const wrapper = shallow(<SectionDescriptionMaybe description="A bright studio." />);
  expect(wrapper.find('p').text()).toBe('A bright studio.');
  expect(wrapper.find('button').exists()).toBe(false);
});

it('expands the complete host description, collapses it, and resets for another space', () => {
  const description = 'A bright studio with natural light. '.repeat(30) + '\nHost details at the end.';
  const wrapper = shallow(<SectionDescriptionMaybe description={description} />);
  expect(wrapper.find('p').text()).not.toContain('Host details at the end.');
  expect(wrapper.find('button').prop('aria-expanded')).toBe(false);
  expect(wrapper.find('button').prop('aria-controls')).toBe(wrapper.find('p').prop('id'));
  wrapper.find('button').simulate('click');
  expect(wrapper.find('p').text()).toBe(description);
  expect(wrapper.find('button').prop('aria-expanded')).toBe(true);
  wrapper.find('button').simulate('click');
  expect(wrapper.find('p').text()).not.toContain('Host details at the end.');
  wrapper.find('button').simulate('click');
  wrapper.setProps({ description: 'Another space. '.repeat(80) });
  expect(wrapper.find('button').prop('aria-expanded')).toBe(false);
});
