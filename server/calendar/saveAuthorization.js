const fs = require('fs');
const dotenv = require('dotenv');
const ENV_FILE = '/home/sharetribe/web/staging.hotpatch.com/shared/.env';

// The one-time callback writes the token directly to the private staging file.
// Never render a refresh token in the browser or include it in logs.
const saveAuthorization = (refreshToken, env = process.env) => {
  if (env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID !== 'a187af2a-0454-4bed-abb9-834129ccf241' ||
    env.GOOGLE_CALENDAR_OAUTH_ENABLED !== 'true' ||
    env.GOOGLE_CALENDAR_OAUTH_REDIRECT_URI !== 'https://staging.hotpatch.com/api/integrations/google-calendar/callback') {
    throw new Error('Calendar authorization storage is restricted to staging.');
  }
  if (typeof refreshToken !== 'string' || !refreshToken.trim() || /[\r\n]/.test(refreshToken)) {
    throw new Error('Invalid Google refresh token.');
  }
  if (fs.realpathSync(ENV_FILE) !== ENV_FILE) throw new Error('Invalid staging settings path.');
  const original = fs.readFileSync(ENV_FILE, 'utf8');
  const saved = dotenv.parse(original);
  if (saved.REACT_APP_SHARETRIBE_SDK_CLIENT_ID !== env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID ||
    saved.GOOGLE_CALENDAR_CLIENT_ID !== env.GOOGLE_CALENDAR_CLIENT_ID ||
    saved.GOOGLE_CALENDAR_CLIENT_SECRET !== env.GOOGLE_CALENDAR_CLIENT_SECRET) {
    throw new Error('Staging settings changed during authorization.');
  }
  const settings = { GOOGLE_CALENDAR_REFRESH_TOKEN: refreshToken, GOOGLE_CALENDAR_OAUTH_ENABLED: 'false' };
  const retained = original.split(/\r?\n/).filter(line => !/^\s*(?:export\s+)?GOOGLE_CALENDAR_(?:REFRESH_TOKEN|OAUTH_ENABLED)\s*=/.test(line)).join('\n').replace(/\n*$/, '\n');
  const temporary = ENV_FILE + '.oauth-' + process.pid;
  const backup = ENV_FILE + '.before-oauth-' + Date.now();
  fs.copyFileSync(ENV_FILE, backup, fs.constants.COPYFILE_EXCL);
  fs.chmodSync(backup, 0o600);
  const fd = fs.openSync(temporary, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, retained + '\n' + Object.entries(settings).map(([k,v]) => k + '=' + JSON.stringify(v)).join('\n') + '\n');
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
  fs.renameSync(temporary, ENV_FILE);
  env.GOOGLE_CALENDAR_REFRESH_TOKEN = refreshToken;
  env.GOOGLE_CALENDAR_OAUTH_ENABLED = 'false';
};

module.exports = { saveAuthorization };
