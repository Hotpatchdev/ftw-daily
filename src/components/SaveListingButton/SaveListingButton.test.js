import React from 'react';
import { mount } from 'enzyme';
import '../../util/test-helpers';
import { SaveListingButtonComponent } from './SaveListingButton';

const id = '00000000-0000-4000-8000-000000000001';
const props = () => ({
  id,
  title: 'Test studio',
  saved: false,
  savingId: null,
  error: null,
  authenticated: true,
  onSave: jest.fn(),
  history: { push: jest.fn() },
});
describe('save listing control', () => {
  it('exposes saved state and toggles saving/removal without navigating the listing', () => {
    const p = props();
    const wrapper = mount(<SaveListingButtonComponent {...p} />);
    expect(wrapper.find('button').prop('aria-pressed')).toBe(false);
    wrapper.find('button').simulate('click');
    expect(p.onSave).toHaveBeenLastCalledWith(id, true);
    wrapper.setProps({ saved: true });
    wrapper.find('button').simulate('click');
    expect(p.onSave).toHaveBeenLastCalledWith(id, false);
    expect(wrapper.find('button').prop('aria-label')).toContain('Remove Test studio');
    expect(p.history.push).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it('keeps a guest save intent in the wishlist login destination', () => {
    const p = { ...props(), authenticated: false };
    const wrapper = mount(<SaveListingButtonComponent {...p} />);
    wrapper.find('button').simulate('click');
    expect(p.history.push).toHaveBeenCalledWith(`/wishlist?save=${id}`);
    expect(p.onSave).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it('disables all save controls during a profile write and announces failure', () => {
    const wrapper = mount(
      <SaveListingButtonComponent
        {...props()}
        savingId={id}
        error={{ message: 'Please try again.' }}
      />
    );
    expect(wrapper.find('button').prop('disabled')).toBe(true);
    expect(wrapper.find('[role="alert"]').text()).toBe('Please try again.');
    wrapper.unmount();
  });
});
