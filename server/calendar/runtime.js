const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { CalendarWorker } = require('./worker');
const google = require('./googleCalendarClient');

const DEV_CLIENT = 'a187af2a-0454-4bed-abb9-834129ccf241';
const STAGING_SHARED = '/home/sharetribe/web/staging.hotpatch.com/shared/';
const enabled = (env = process.env) => env.GOOGLE_CALENDAR_SYNC_ENABLED === 'true' &&
  env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID === DEV_CLIENT;

const settings = (env, now = Date.now()) => {
  const startAt = env.GOOGLE_CALENDAR_SYNC_START_AT;
  const start = Date.parse(startAt);
  if (!startAt || !/^\d{4}-\d\d-\d\dT.*Z$/.test(startAt) || !Number.isFinite(start) || start > now) throw new Error('Set the calendar cutover timestamp explicitly.');
  const transactionIds = (env.GOOGLE_CALENDAR_SYNC_TRANSACTION_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!transactionIds.length || transactionIds.some(s => !/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(s))) throw new Error('Nominate the controlled staging transactions first.');
  const directory = env.GOOGLE_CALENDAR_SYNC_STORE_DIR;
  if (!directory || !path.resolve(directory).startsWith(STAGING_SHARED) || path.resolve(directory) === STAGING_SHARED.slice(0, -1)) throw new Error('Use a private staging shared calendar store.');
  return { startAt, transactionIds, directory };
};

const checkpointStore = ({ directory, startAt, transactionIds }, calendarId) => {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
  const filename = path.join(directory, 'cursor.json');
  const signature = crypto.createHash('sha256').update(JSON.stringify([startAt, transactionIds, calendarId])).digest('hex');
  return {
    read: () => {
      if (!fs.existsSync(filename)) {
        if (Date.now() - Date.parse(startAt) > 6 * 86400000) throw new Error('Calendar cutover exceeds dev event retention.');
        return null;
      }
      const saved = JSON.parse(fs.readFileSync(filename, 'utf8'));
      if (saved.signature !== signature || !Number.isSafeInteger(saved.sequenceId) || Date.now() - saved.updatedAt > 6 * 86400000) throw new Error('Calendar checkpoint requires operator review.');
      return saved.sequenceId;
    },
    write: sequenceId => {
      const fd = fs.openSync(filename + '.tmp', 'w', 0o600);
      try { fs.writeFileSync(fd, JSON.stringify({ signature, sequenceId, updatedAt: Date.now() })); fs.fsyncSync(fd); }
      finally { fs.closeSync(fd); }
      fs.renameSync(filename + '.tmp', filename);
      const directoryFd = fs.openSync(directory, 'r');
      try { fs.fsyncSync(directoryFd); } finally { fs.closeSync(directoryFd); }
    },
  };
};

let timer;
const startWorker = () => {
  if (!enabled() || timer) return;
  try {
    const config = google.configFromEnv(process.env);
    const options = settings(process.env);
    const sdk = require('sharetribe-flex-integration-sdk');
    const integration = sdk.createInstance({ clientId: process.env.SHARETRIBE_INTEGRATION_CLIENT_ID,
      clientSecret: process.env.SHARETRIBE_INTEGRATION_CLIENT_SECRET,
      queryLimiter: sdk.util.createRateLimiter(sdk.util.devQueryLimiterConfig),
      commandLimiter: sdk.util.createRateLimiter(sdk.util.devCommandLimiterConfig) });
    const worker = new CalendarWorker({ ...options, checkpoint: checkpointStore(options, config.calendarId),
      integration: {
        events: params => integration.events.query(params).then(r => r.data.data),
        show: id => integration.transactions.show({ id: new sdk.types.UUID(id), include: ['booking', 'listing', 'customer', 'provider'] }).then(r => r.data),
        updateMetadata: (id, metadata) => integration.transactions.updateMetadata({ id, metadata }),
      },
      calendar: { create: events => google.createBookingEvents(config, events), cancel: ids => google.cancelBookingEvents(config, ids) },
    });
    const run = () => worker.sweep().catch(() => console.error('Staging calendar sync failed; checkpoint retained for retry.'));
    timer = setInterval(run, 30000); timer.unref(); run();
  } catch (_) { console.error('Staging calendar sync remains off; configuration requires review.'); }
};

module.exports = { enabled, settings, checkpointStore, startWorker };
