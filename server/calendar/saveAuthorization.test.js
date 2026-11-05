jest.mock('fs');
const fs = require('fs');
const { saveAuthorization } = require('./saveAuthorization');
const path = '/home/sharetribe/web/staging.hotpatch.com/shared/.env';
const settings = () => ({
  REACT_APP_SHARETRIBE_SDK_CLIENT_ID:'a187af2a-0454-4bed-abb9-834129ccf241',
  GOOGLE_CALENDAR_CLIENT_ID:'test-client', GOOGLE_CALENDAR_CLIENT_SECRET:'test-secret',
  GOOGLE_CALENDAR_OAUTH_ENABLED:'true',
  GOOGLE_CALENDAR_OAUTH_REDIRECT_URI:'https://staging.hotpatch.com/api/integrations/google-calendar/callback',
});
beforeEach(() => {
  jest.resetAllMocks();
  fs.realpathSync.mockReturnValue(path);
  fs.readFileSync.mockReturnValue(Object.entries(settings()).map(([k,v])=>k+'='+v).join('\n')+'\nKEEP_SETTING=unchanged\nGOOGLE_CALENDAR_REFRESH_TOKEN=old-token\n');
  fs.constants = { COPYFILE_EXCL:1 };
  fs.openSync.mockReturnValue(1);
});
it('stores the token privately, preserving other settings and closing OAuth', () => {
  const env=settings(); saveAuthorization('new-test-token',env);
  const output=fs.writeFileSync.mock.calls[0][1];
  expect(output).toContain('KEEP_SETTING=unchanged');
  expect(output).toContain('GOOGLE_CALENDAR_REFRESH_TOKEN="new-test-token"');
  expect(output).not.toContain('old-token');
  expect(output).toContain('GOOGLE_CALENDAR_OAUTH_ENABLED="false"');
  expect(fs.openSync).toHaveBeenCalledWith(expect.any(String),'wx',0o600);
  expect(fs.fsyncSync).toHaveBeenCalledWith(1);
  expect(fs.renameSync).toHaveBeenCalledWith(expect.any(String),path);
  expect(env.GOOGLE_CALENDAR_OAUTH_ENABLED).toBe('false');
});
it('refuses a production identity before writing anything', () => {
  expect(()=>saveAuthorization('test-token',{...settings(),REACT_APP_SHARETRIBE_SDK_CLIENT_ID:'production'})).toThrow('restricted to staging');
  expect(fs.writeFileSync).not.toHaveBeenCalled();
});
it('refuses changed credentials and invalid tokens', () => {
  expect(()=>saveAuthorization('test-token',{...settings(),GOOGLE_CALENDAR_CLIENT_SECRET:'different'})).toThrow('changed');
  expect(()=>saveAuthorization('invalid\ntoken',settings())).toThrow('Invalid');
  expect(fs.writeFileSync).not.toHaveBeenCalled();
});
