const https = require('https');

const required = (value, name) => {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`Missing ${name}.`);
  return value.trim();
};

const configFromEnv = env => ({
  clientId: required(env.GOOGLE_CALENDAR_CLIENT_ID, 'GOOGLE_CALENDAR_CLIENT_ID'),
  clientSecret: required(env.GOOGLE_CALENDAR_CLIENT_SECRET, 'GOOGLE_CALENDAR_CLIENT_SECRET'),
  refreshToken: required(env.GOOGLE_CALENDAR_REFRESH_TOKEN, 'GOOGLE_CALENDAR_REFRESH_TOKEN'),
  calendarId: required(env.GOOGLE_CALENDAR_CALENDAR_ID, 'GOOGLE_CALENDAR_CALENDAR_ID'),
});

const requestJson = ({ hostname, path, method = 'GET', headers = {}, body }) =>
  new Promise((resolve, reject) => {
    const request = https.request({ hostname, path, method, headers }, response => {
      let responseBody = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { responseBody += chunk; });
      response.on('end', () => {
        let data;
        try { data = responseBody ? JSON.parse(responseBody) : {}; } catch (error) { return reject(new Error('Google Calendar returned an invalid response.')); }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const error = new Error('Google Calendar request failed.');
          error.status = response.statusCode;
          return reject(error);
        }
        resolve(data);
      });
    });
    request.on('error', reject);
    request.setTimeout(20000, () => request.destroy(new Error('Google Calendar request timed out.')));
    if (body) request.write(body);
    request.end();
  });

const accessToken = async (config, request = requestJson) => {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
    grant_type: 'refresh_token',
  }).toString();
  const response = await request({
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
    body,
  });
  return required(response.access_token, 'Google Calendar access token');
};

const calendarPath = (calendarId, suffix = '') =>
  `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events${suffix}`;

const createEvent = async (config, event, request = requestJson) => {
  const token = await accessToken(config, request);
  const body = JSON.stringify(event);
  let response;
  try { response = await request({
    hostname: 'www.googleapis.com',
    path: `${calendarPath(config.calendarId)}?sendUpdates=all`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
    body,
  }); } catch (error) {
    if (error.status !== 409 || !event.id) throw error;
    response = await request({ hostname: 'www.googleapis.com',
      path: calendarPath(config.calendarId, `/${encodeURIComponent(event.id)}`),
      headers: { Authorization: `Bearer ${token}` } });
    const emails = value => (value.attendees || []).map(a => a.email.toLowerCase()).sort().join(',');
    const privateFields = response.extendedProperties && response.extendedProperties.private || {};
    if (response.status === 'cancelled' || privateFields.hotpatchTransactionId !== event.extendedProperties.private.hotpatchTransactionId ||
      privateFields.hotpatchAudience !== event.extendedProperties.private.hotpatchAudience || emails(response) !== emails(event) ||
      response.guestsCanModify !== false || response.guestsCanSeeOtherGuests !== false) {
      throw new Error('Existing calendar event does not match this booking.');
    }
  }

  return required(response.id, 'Google Calendar event id');
};

const cancelEvent = async (config, eventId, request = requestJson) => {
  const token = await accessToken(config, request);
  try { await request({
    hostname: 'www.googleapis.com',
    path: `${calendarPath(config.calendarId, `/${encodeURIComponent(required(eventId, 'Google Calendar event id'))}`)}?sendUpdates=all`,
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }); } catch (error) {
    if (![404, 410].includes(error.status)) throw error;
    // A wrong/inaccessible calendar also returns 404. Do not erase metadata
    // unless the calendar is still accessible and the event itself is absent.
    if (error.status === 404) await request({ hostname: 'www.googleapis.com',
      path: `${calendarPath(config.calendarId)}?maxResults=1`, headers: { Authorization: `Bearer ${token}` } });
  }
};

const createBookingEvents = async (config, events, request = requestJson) => ({
  internal: await createEvent(config, events.internal, request),
  host: await createEvent(config, events.host, request),
  booker: await createEvent(config, events.booker, request),
});

const cancelBookingEvents = async (config, eventIds, request = requestJson) => {
  for (const eventId of [eventIds.internal, eventIds.host, eventIds.booker]) {
    await cancelEvent(config, eventId, request);
  }
};

module.exports = { accessToken, cancelBookingEvents, cancelEvent, configFromEnv, createBookingEvents, createEvent };
