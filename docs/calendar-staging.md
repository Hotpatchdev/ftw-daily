# Calendar staging migration

Calendar syncing and OAuth are off by default and restricted to the verified dev Marketplace client. No production changes or Zapier shutdown are part of this release.

Each accepted single-session booking creates an internal diary entry, a host invitation and a booker invitation. Each invitation has one attendee; neither contains the other participant's details. Guests cannot modify events, invite others or see other guests. Transaction metadata stores only the three event IDs.

The runner reads Sharetribe transaction events from an explicit cutover timestamp, checkpoints only after successful syncing and retries failures. Deterministic Google event IDs recover partial creation and failed metadata writes. Cancellation also removes partially created events. A cursor outside dev event retention stops for operator review; it never silently skips forward.

Before enabling, obtain owner confirmation and privately configure:

- Existing Google settings supplied in the handover, including the diary ID from the Zapier export. No tokens or secrets in Git/chat.
- `GOOGLE_CALENDAR_OAUTH_ENABLED=true` temporarily, then authorise `hotpatch@hotpatch.com` at `/api/integrations/google-calendar/start`. The registered callback is `/api/integrations/google-calendar/callback`. Save the refresh token privately and switch OAuth off.
- `GOOGLE_CALENDAR_SYNC_START_AT`: an explicit UTC ISO timestamp immediately before the controlled test.
- `GOOGLE_CALENDAR_SYNC_TRANSACTION_IDS`: comma-separated nominated staging transaction UUIDs. All other transactions are ignored.
- `GOOGLE_CALENDAR_SYNC_STORE_DIR=/home/sharetribe/web/staging.hotpatch.com/shared/calendar-sync`.
- `GOOGLE_CALENDAR_SYNC_ENABLED=true` only after confirmation. Restart staging only. The current file checkpoint assumes the existing single app process.

Controlled test: nominate a single-session staging transaction, accept it, verify all three separate events and invitation privacy, cancel it, verify all three disappear. Check retry behaviour and record results before proposing production. Do not disable the live Zapier automation during staging testing.

Combined schedules are deliberately blocked from calendar creation pending a separate review of multiple dates and varying session lengths. Child reservation transactions must never generate duplicate invitations. Resolve this before any production rollout.

References: [Sharetribe Integration API](https://www.sharetribe.com/api-reference/integration.html), [Google event insertion](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert).
