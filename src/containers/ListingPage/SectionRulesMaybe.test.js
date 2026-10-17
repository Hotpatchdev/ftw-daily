import React from 'react';
import { shallow } from 'enzyme';
import '../../util/test-helpers';
import SectionRulesMaybe from './SectionRulesMaybe';

it('keeps short rules complete and hides blank sections', () => {
  const wrapper = shallow(<SectionRulesMaybe publicData={{ rules: 'No smoking.' }} />);
  expect(wrapper.find('p').text()).toBe('No smoking.');
  expect(wrapper.find('button').exists()).toBe(false);
  wrapper.setProps({ publicData: { rules: '  ' } });
  expect(wrapper.isEmptyRender()).toBe(true);
});

it('previews three lines and allows the full unmodified rules to be expanded and collapsed', () => {
  const rules = 'First rule\nSecond rule\nThird rule\nFourth rule';
  const wrapper = shallow(<SectionRulesMaybe publicData={{ rules }} />);
  expect(wrapper.find('p').text()).toBe('First rule\nSecond rule\nThird rule…');
  expect(wrapper.find('button').prop('aria-expanded')).toBe(false);
  expect(wrapper.find('button').prop('aria-controls')).toBe(wrapper.find('p').prop('id'));
  wrapper.find('button').simulate('click');
  expect(wrapper.find('p').text()).toBe(rules);
  expect(wrapper.find('button').prop('aria-expanded')).toBe(true);
  wrapper.find('button').simulate('click');
  expect(wrapper.find('p').text()).not.toContain('Fourth rule');
});

it('also limits long single paragraphs and resets expansion when the rules change', () => {
  const wrapper = shallow(
    <SectionRulesMaybe publicData={{ rules: 'Please keep the space tidy. '.repeat(30) }} />
  );
  expect(wrapper.find('p').text().length).toBeLessThanOrEqual(401);
  wrapper.find('button').simulate('click');
  wrapper.setProps({ publicData: { rules: 'Another set of rules. '.repeat(40) } });
  expect(wrapper.find('button').prop('aria-expanded')).toBe(false);
});
