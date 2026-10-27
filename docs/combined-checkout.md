# Combined booking checkout

One space, multiple hourly sessions or daily groups, one payment and one host decision.
Each session/group must meet the host's minimum. Gaps remain available.

The server recalculates current prices and compares them with the reviewed total.
One parent transaction pays for all sessions and reserves the final session; child
transactions reserve earlier sessions without payments, emails or inbox entries.
Host acceptance captures the single payment only after all reservations are accepted.
The first session limits the acceptance deadline; the final session controls payout.
Whole-booking operator cancellation uses the existing full-refund behaviour. Partial
session cancellation/refunds and promotion codes are not enabled for combined bookings.

A restricted, atomic journal in staging's shared directory records checkout references,
transaction IDs and decisions. A server worker reconciles interrupted requests every
30 seconds and releases reservations following decline, expiry or cancellation.
The journal contains no user tokens, card data or Stripe client secrets. This version
requires the existing single staging Node process; move the journal and locking to a
shared database before running multiple application processes.

Staging uses hotpatch-dev. The new processes are hotpatch-combined-booking and
hotpatch-combined-reservation; the existing preauth-hourly-process remains unchanged.
The Integration API credentials are server-only. COMBINED_BOOKINGS_ENABLED defaults
false and is additionally restricted to the verified dev Marketplace client ID.
COMBINED_BOOKING_STORE_DIR must point outside numbered releases. The booking form
reads the server capability flag, so it keeps the existing checkout until enabled.
Production is out of scope.

Validation: 35 server checks and 20 focused interface checks pass. Legacy nightly
booking-breakdown snapshots have pre-existing date/label/subtotal differences; they
were not rewritten. scripts/verify-combined-dev.cjs checks native dev reservations,
gaps, duplicate retries, Stripe test authorization/capture, worker recovery and full
cancellation/refund with booking notifications disabled. Enable only after it passes.
