const { authorizationUrl, configFromEnv, exchangeCode } = require('./googleCalendarOAuth');

const env = {
  GOOGLE_CALENDAR_CLIENT_ID: 'client-id',
  GOOGLE_CALENDAR_CLIENT_SECRET: 'client-secret',
  GOOGLE_CALENDAR_OWNER_EMAIL: 'hotpatch@hotpatch.com',
  GOOGLE_CALENDAR_OAUTH_REDIRECT_URI: 'https://staging.hotpatch.com/api/integrations/google-calendar/callback',
};

describe('Google Calendar OAuth', () => {
  it('requests only event access and a refresh token', () => {
    const url = new URL(authorizationUrl({ ...configFromEnv(env), state: 'test-state' }));
    expect(url.searchParams.get('scope')).toBe(
      'https://www.googleapis.com/auth/calendar.events openid email'
    );
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
  });

  it('only accepts the HotPatch calendar account', async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce({ access_token: 'access-token', refresh_token: 'refresh-token' })
      .mockResolvedValueOnce({ email: 'someone@example.com' });
    await expect(exchangeCode(configFromEnv(env), 'code', request)).rejects.toThrow(
      'Sign in with the HotPatch calendar account.'
    );
  });
});
