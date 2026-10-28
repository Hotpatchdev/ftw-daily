const {
  authorizationUrl,
  configFromEnv,
  exchangeCode,
  state,
} = require('../calendar/googleCalendarOAuth');

const COOKIE_NAME = 'hotpatch_calendar_oauth_state';
const allowed = () => process.env.GOOGLE_CALENDAR_OAUTH_ENABLED === 'true' &&
  process.env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID === 'a187af2a-0454-4bed-abb9-834129ccf241' &&
  process.env.GOOGLE_CALENDAR_OAUTH_REDIRECT_URI === 'https://staging.hotpatch.com/api/integrations/google-calendar/callback';
const escapeHtml = value =>
  String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

const start = (req, res) => {
  if (!allowed()) return res.status(404).end();
  try {
    const config = configFromEnv(process.env);
    const oauthState = state();
    res.cookie(COOKIE_NAME, oauthState, {
      httpOnly: true,
      secure: process.env.REACT_APP_SHARETRIBE_USING_SSL === 'true',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
    });
    res.redirect(authorizationUrl({ ...config, state: oauthState }));
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const callback = async (req, res) => {
  if (!allowed()) return res.status(404).end();
  res.set('Cache-Control', 'no-store').set('Referrer-Policy', 'no-referrer');
  const clear = () => res.clearCookie(COOKIE_NAME);
  if (!req.query.state || req.query.state !== req.cookies[COOKIE_NAME]) {
    clear();
    return res.status(400).send('Calendar authorization could not be verified. Please start again.');
  }
  try {
    const config = configFromEnv(process.env);
    const { refreshToken, email } = await exchangeCode(config, req.query.code);
    clear();
    res.type('html').send(`<!doctype html><title>HotPatch Calendar connected</title><h1>Calendar connected</h1><p>Signed in as ${escapeHtml(
      email
    )}. Copy this token into the private staging setting <code>GOOGLE_CALENDAR_REFRESH_TOKEN</code>, then close this page.</p><pre>${escapeHtml(
      refreshToken
    )}</pre>`);
  } catch (error) {
    clear();
    res.status(400).send(`Calendar authorization failed: ${escapeHtml(error.message)}`);
  }
};

module.exports = { callback, start };
