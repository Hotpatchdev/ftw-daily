const crypto = require('crypto');
const https = require('https');

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const IDENTITY_SCOPES = ['openid', 'email'];

const required = (value, name) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing ${name}.`);
  }
  return value.trim();
};

const configFromEnv = env => ({
  clientId: required(env.GOOGLE_CALENDAR_CLIENT_ID, 'GOOGLE_CALENDAR_CLIENT_ID'),
  clientSecret: required(env.GOOGLE_CALENDAR_CLIENT_SECRET, 'GOOGLE_CALENDAR_CLIENT_SECRET'),
  ownerEmail: required(env.GOOGLE_CALENDAR_OWNER_EMAIL, 'GOOGLE_CALENDAR_OWNER_EMAIL').toLowerCase(),
  redirectUri: required(env.GOOGLE_CALENDAR_OAUTH_REDIRECT_URI, 'GOOGLE_CALENDAR_OAUTH_REDIRECT_URI'),
});

const authorizationUrl = ({ clientId, redirectUri, state }) => {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: [CALENDAR_SCOPE, ...IDENTITY_SCOPES].join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  }).toString();
  return url.toString();
};

const requestJson = ({ hostname, path, method = 'GET', headers = {}, body }) =>
  new Promise((resolve, reject) => {
    const request = https.request({ hostname, path, method, headers }, response => {
      let responseBody = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        responseBody += chunk;
      });
      response.on('end', () => {
        let data;
        try {
          data = responseBody ? JSON.parse(responseBody) : {};
        } catch (error) {
          return reject(new Error('Google returned an invalid response.'));
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          return reject(new Error(data.error_description || data.error || 'Google authorization failed.'));
        }
        resolve(data);
      });
    });
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });

const exchangeCode = async (config, code, request = requestJson) => {
  const body = new URLSearchParams({
    code: required(code, 'authorization code'),
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
  }).toString();
  const tokens = await request({
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
    body,
  });
  const emailData = await request({
    hostname: 'openidconnect.googleapis.com',
    path: '/v1/userinfo',
    headers: { Authorization: `Bearer ${required(tokens.access_token, 'Google access token')}` },
  });
  const email = required(emailData.email, 'Google account email').toLowerCase();
  if (email !== config.ownerEmail) throw new Error('Sign in with the HotPatch calendar account.');
  return { refreshToken: required(tokens.refresh_token, 'Google refresh token'), email };
};

const state = () => crypto.randomBytes(32).toString('hex');

module.exports = { authorizationUrl, configFromEnv, exchangeCode, state };
