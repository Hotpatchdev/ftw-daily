# HotPatch codebase review

Repository: `Hotpatchdev/ftw-daily`. Reviewed at `master` (`40215a2`, 2022-09-12) with a separate pass over `origin/production` (`f9b7eb5`, 2024-08-09) and `origin/staging` (`4d95d2c`, 2024-10-14). Review date: 2026-09-13. Read-only: no code was changed.

Origin labels: **upstream** means the code is unchanged from Sharetribe's `ftw-daily` v8.1.1 template; **fork** means it was added or changed by HotPatch or its vendors (2020 freelancers, Roobykon 2021-22, Braincrop 2023-24). Judged with `git blame` on the full 6,274-commit history and a diff against an upstream v8.1.1 clone.

---

## 1. Executive summary

**Verdict: the product works, but the codebase is not in a state to build on, and two of its problems cost money today.**

The application is a heavily customised Sharetribe Flex template (React 16, webpack 4, Node 12/14 era) that has passed through three vendors without a maintainer of record. The default branch `master` is two years stale: `production` and `staging` sit 326 and 329 commits ahead of it, and nothing was ever merged back. Every review that starts from `master`, including the top half of this one, describes code that is not what runs on hotpatch.com. The first action is to make `staging` the baseline.

**The three biggest risks**

1. **Anyone can take 10% off any booking.** The server applies a discount whenever the client sends a truthy `promocode` flag. No code is validated. The Voucherify *secret* key is also compiled into the public JavaScript bundle, so the voucher account itself is exposed. Both are fork code and still present on `production`.
2. **Pricing and booking rules are enforced only in the browser.** The server trusts client-supplied booking type and dates, floors weekly and monthly quantities, and never checks minimum booking length, minimum price, or that the dates it prices are the dates it books. Daily bookings are also created at UTC midnight against listings whose availability plans are in local time, which will reject or misplace bookings for part of the year.
3. **No safety net.** The test suite cannot run (46 of 55 client suites fail to start), the deploy pipeline has no build or test gate, production is deployed from a checkout on the staging server using staging credentials, and every deploy runs `pm2 kill`. There is no health check, no rollback procedure, no release tag, and no documentation of any of it.

**The three biggest strengths**

1. Prices are computed server-side from listing data through Flex privileged transitions. A customer cannot set a unit price. The foundation is right; the gaps are in validation on top of it.
2. SSR state injection, JSON-LD, and the new CMS markdown path are all correctly escaped and sanitised. No `dangerouslySetInnerHTML` anywhere. Server secrets never carry the `REACT_APP_` prefix, with the single exception above.
3. The template's structure survived the customisation. Components, containers, ducks, code-splitting, translation conventions, and design tokens are still used consistently, which makes both a clean-up and a later migration tractable.

**Recommendation.** Do not attempt an in-place upgrade to a newer `ftw-daily`; the fork touched 298 upstream files in exactly the areas upstream later rewrote. Do not start a migration to Sharetribe's `web-template` yet either. First, spend roughly one quarter stabilising what exists: fast-forward `master` to `staging`, fix the two revenue-affecting findings, make the tests run, put a build-and-test gate in front of deploys, and document the business rules. Then plan a feature-by-feature port to `web-template`, starting from that stabilised baseline. The `production` branch has already begun borrowing `web-template` code (PageBuilder, hosted assets), which lowers the cost of that path.

---

## 2. Scorecard

| Area | Grade | Justification |
|---|---|---|
| Repository hygiene and fork drift | D | Default branch dead for two years; 74 remote branches; no tags; upstream README, changelog, and Saunatime assets still shipped. |
| Dependencies and toolchain | D | React 16, webpack 4, Jest 26, Enzyme, Node 12/14 targets; build needs a legacy OpenSSL flag on any current Node; 63 critical audit advisories. |
| Security | D | Two critical fork defects (discount bypass, leaked secret) on top of a mostly sound upstream base; open redirect and login CSRF in social login. |
| Multi-currency | D | Option values hard-coded; second currency unvalidated; one listing can hold two currencies; search and filters assume one. |
| Booking, pricing, transaction process | D | Server trusts client dates and type; daily bookings in the wrong timezone; cancellation policy the process cannot execute; process file in repo is not the live one. |
| Data model and configuration | C | Category taxonomy encoded three times and joined by string splitting; category not required on listings. |
| Testing | F | 46 of 55 client suites cannot start; 1 server test asserts removed behaviour; zero tests for any fork feature. |
| CI/CD and operations | D | No gate before deploy; production deployed via staging host and credentials; `pm2 kill`; no health check or rollback; CircleCI config orphaned. |
| Frontend architecture and code quality | C | Structure intact and conventions followed; 215 files fail Prettier; 38 stray `console.log` (one logs the signup form with password); dead components and 394 commented lines in one file. |
| Performance and SEO | C | 1.05 MB gzipped JS on first load; 6 MB of raster images in the bundle; `robots.txt` empty; sitemap lists 20 blog URLs that 404. |
| Internationalisation | C | English is solid; de/es/fr are stale upstream copies that still say Saunatime; five message IDs used in code do not exist. |
| Accessibility | C | Clickable `div`s inside buttons, unlabeled multi-select, mouse-only price slider. Modals and top bar are fine. |
| Documentation and onboarding | F | README, docs, `app.json` are 100% upstream; no business rules, deploy flow, environment, or branch documentation exists. |
| Production branch delta (2023-24 work) | C | Features shipped, no secrets added, CMS path is safe; but 20 new live `console.log`, 565 commented lines, test commits merged as PRs, and commission math now disagrees between server and two client components. |

---

## 3. Verification log

Environment: Node v22.22.2, Yarn 1.22.22, Linux container, clean clone of `master`.

| Command | Result |
|---|---|
| `yarn install --frozen-lockfile` | Passed in 88 s. 1,296 top-level packages. Peer warnings for `@babel/core`, `react-google-maps` types, `jquery`, `typescript`. |
| `yarn format-ci` | **Failed.** 215 files differ from Prettier 1.19.1 output. By last author: 124 roobykon.com, 42 bk.ru, 21 hotpatch.com, 13 gmail.com, 13 local-machine addresses, 2 sharetribe.com. |
| `yarn audit` | **Failed, exit 30.** 2,067 dependencies; 63 critical, 472 high, 260 moderate, 64 low advisories. The bulk is build tooling (`@babel/traverse`, `loader-utils`, `semver`, `minimatch`, `braces`, `postcss`, `browserslist`). Runtime-reachable: `axios` 0.19 (via Flex SDK), `lodash` 4.17.20, `moment` 2.29.1, `express` 4.17.1, `body-parser` 1.19, `url-parse`, `minimist`. |
| `yarn test-server --runInBand` | **1 failed, 29 passed.** `lineItemHelpers.test.js:75` expects `calculateQuantityFromDates` to throw for `line-item/units`; the fork removed that throw and never updated the test. |
| `sharetribe-scripts test --ci --runInBand` | **46 of 55 suites failed; 4 of 198 tests failed.** 45 suites cannot start: `ListingCard.js` imports `react-slick`, which calls `window.matchMedia` at import time, and there is no `src/setupTests.js` mock. The remaining suite, `BookingBreakdown`, crashes in `LineItemTotalPrice.js:37` reading `units.lineTotal` when no `line-item/units` exists. |
| `yarn build-web` | **Failed on Node 22** with `ERR_OSSL_EVP_UNSUPPORTED` (webpack 4). **Passed with `NODE_OPTIONS=--openssl-legacy-provider`** in 84 s, zero warnings. |
| `yarn build-server` | Passed with the same flag. |

Build output, gzipped:

| Asset | Size |
|---|---|
| Vendor chunk `28.*.chunk.js` | 790 KB |
| `main.*.chunk.js` | 263 KB |
| `main.*.css` | 61 KB |
| `SearchPage` chunk | 46 KB |
| `build/` total including source maps | 35 MB |

Vendor chunk composition by source bytes (uncompressed): `react-dates` 425 KB, `lodash` 233 KB, Flex SDK 228 KB, `ajv` 196 KB, `browserify-sign` 193 KB, `pako` 184 KB, `sshpk` 172 KB, `moment` 170 KB, `react-select` 168 KB, `voucherify` 117 KB, `elliptic` 107 KB, `react-slick` 105 KB, `request` 102 KB. The `ajv`, `browserify-sign`, `sshpk`, `elliptic`, `pako`, and `request` entries are Node polyfills dragged in because the Voucherify *server* SDK is bundled into the browser.

Git facts established:

| Fact | Value |
|---|---|
| Commits on `master` | 6,274 (5,523 upstream to v8.1.1, 751 fork) |
| Last upstream sync | 2021-05-24, v8.1.1 |
| Fork commits after `master` on `production` / `staging` | 326 / 329, zero behind |
| `staging` vs `production` content difference | One line: monthly max booking 12 to 2 |
| Remote branches / tags | 74 / 0 |
| Files changed fork vs upstream v8.1.1 | 298 modified, 67 added, 2 removed, +24,033 / −7,715 lines |

---

## 4. Findings by area

Each finding: ID, severity, effort (Small under a day, Medium under a week, Large more than a week), origin, evidence, impact, fix. Line numbers are on `master` unless marked `production`.

### 4.1 Security

**SEC-01 Client-controlled `promocode` flag grants a 10% discount with no validation**
*Severity: Critical · Effort: Medium · Origin: fork*
Evidence: `server/api-util/lineItems.js:40` destructures `promocode` from `bookingData`, which is `req.body.bookingData` in `server/api/initiate-privileged.js:5`, `transition-privileged.js:5`, and `transaction-line-items.js:6`. Lines 88-106 return `lineItemsWithDiscount` (`percentage: -10`, `includeFor: ['customer']`) whenever `promocode` is truthy. The client sends a bare boolean from `src/containers/ListingPage/ListingPage.js:115`. Verified by calling the module directly: `promocode: true` yields a `line-item/discount` of −10%. Still present on `production` (commission is now ±10%, discount unchanged).
Impact: any user can POST `bookingData.promocode: true` and pay 10% less. The provider is still paid in full, so the marketplace absorbs the loss and its 10% margin drops to zero on those bookings.
Fix: send the code string; validate and redeem it server-side against Voucherify with a server-only key; derive the percentage from the voucher; store the code in `protectedData` on both initiate paths.

**SEC-02 Voucherify secret key compiled into the browser bundle**
*Severity: Critical · Effort: Small plus key rotation · Origin: fork*
Evidence: `src/ducks/Promocode.duck.js:3-4` reads `REACT_APP_VOUCHERIFY_SECRET_KEY` and passes it as `clientSecretKey` to the server SDK (line 17), which sends it as `X-App-Token`. CRA inlines every `REACT_APP_` variable at build time. `.env-template:30-31` documents the pattern. The built `main.*.chunk.js` contains the variable reference.
Impact: anyone can read the key from the bundle and list, create, delete, or redeem vouchers and read customer data in the Voucherify account.
Fix: rotate the key today; rename without the `REACT_APP_` prefix; move all Voucherify calls to `server/api/`.

**SEC-03 Client-selected price type plus truncating duration math lets customers underpay**
*Severity: High · Effort: Medium · Origin: fork*
Evidence: `server/api-util/lineItems.js:42-55` takes `type` from the client and prices from `publicData[type]`. `lineItemHelpers.js:108-115` routes to `weeksBetween` (`moment.diff('weeks')`, floors) and `monthsBetween` (`Math.floor(days/30)`) in `dates.js:45-61`. No server check that the duration is a whole number of units, that `minBooking` is respected, or that `bookingData` dates equal the `bookingStart/End` actually sent to Flex (`initiate-privileged.js:5-16`).
Impact: 13 days at the weekly price, 59 days at the monthly price, or a 30-day booking priced as one hour by sending a one-hour `bookingData` with a 30-day `params.bookingStart/End`.
Fix: derive pricing dates from `bodyParams.params`, not `bookingData`; whitelist `type` against prices the listing actually has; require exact multiples or bill the remainder; enforce `minBooking` and a minimum price server-side.

**SEC-04 Production deployed through the staging host with staging credentials, no gate, `pm2 kill`**
*Severity: High · Effort: Medium · Origin: fork*
Evidence: `.github/workflows/ssh-deploy-workflow.yml:53-60`: the production job uses `STAGING_SSH_*` secrets, an SSH alias named `staging`, and runs `cd .../staging.hotpatch.com/public_html && git checkout production && git pull && rvm 2.3.4 do cap production deploy`. `config/deploy/production.rb:12-16` runs `pm2 kill` then `pm2 start`. No job in the workflow builds or tests.
Impact: the staging box holds an SSH key into production, so compromising staging or the one GitHub secret is a production takeover. Anyone who can push to `production` deploys unreviewed code in minutes. `pm2 kill` stops every pm2 process on the target host. A build failure is discovered on the production server.
Fix: separate `PRODUCTION_*` secrets, deploy from the runner, GitHub Environment protection with required reviewers, gate on test and build, `pm2 reload` with an ecosystem file, post-deploy health check.

**SEC-05 Rocket.Chat webhook URL committed**
*Severity: Medium · Effort: Small · Origin: fork*
Evidence: `config/deploy.rb:30`. Present in history since 2022.
Impact: anyone with repo access can post into the former vendor's deploy channel, a phishing vector.
Fix: revoke the hook; read from an environment variable.

**SEC-06 Open redirect through the social login `from` parameter**
*Severity: Medium · Effort: Small · Origin: upstream*
Evidence: `server/api/auth/facebook.js:56-70` and `google.js:57-79` pass `req.query.from` through OAuth state; `loginWithIdp.js:99-103` does `res.redirect(\`${rootUrl}${from}#\`)` with no validation.
Impact: `?from=@evil.com` lands the user on `evil.com` after a successful login.
Fix: accept only relative paths, or resolve with `new URL(from, rootUrl)` and require a matching origin.

**SEC-07 OAuth `state` carries data but is not a CSRF nonce**
*Severity: Medium · Effort: Small · Origin: upstream*
Evidence: strategies are built without `state: true`; `state` is a JSON string forwarded verbatim (`facebook.js:69`, `google.js:78`); passport-oauth2 uses a `NullStore`.
Impact: login CSRF: an attacker can log a victim's browser into the attacker's account.
Fix: bind a random nonce in a short-lived HttpOnly cookie and verify it in the callback, or HMAC-sign the state.

**SEC-08 CSP is non-enforcing and the fork widened it**
*Severity: Medium · Effort: Medium · Origin: mixed*
Evidence: `server/csp.js:161-166` `script-src` includes `unsafe-inline`, `unsafe-eval`, `data:`, and `*.amazonaws.com`. Junk entries: `wwww.voucherify.io` (line 55), `wss://socket.tidio.co` in `font-src` and `style-src`, `staging.hotpatch.com` in the production policy. Mode is driven by `REACT_APP_CSP`; the template ships `report`. Production value unverified.
Impact: the policy would not stop an XSS payload even in block mode.
Fix: remove `data:` and the S3 wildcard from `script-src`; fix malformed entries; move to block mode; plan nonces.

**SEC-09 Auth cookies lack `SameSite`; `secure` depends on env**
*Severity: Medium · Effort: Small · Origin: upstream and SDK*
Evidence: Flex SDK cookie store sets no `httpOnly` or `sameSite`; `secure` only when `REACT_APP_SHARETRIBE_USING_SSL=true`. Fork-owned cookies in `loginWithIdp.js:117-130` and `initiate-login-as.js:66-72` are the same.
Fix: confirm the SSL and trust-proxy variables in production; add `sameSite: 'lax'` and `httpOnly` where the frontend does not need the value.

**SEC-10 Outdated runtime dependencies with known CVEs**
*Severity: Medium · Effort: Medium · Origin: upstream versions never bumped*
Evidence: `express` 4.17.1 (CVE-2024-29041 open redirect, relevant given SEC-06), `body-parser` 1.19.0, `moment` 2.29.1 (ReDoS on client-supplied date strings reachable via `/api/transaction-line-items`), `axios` 0.19.2 via Flex SDK 1.13, `lodash` 4.17.20, `path-to-regexp`. `jose` 3.11.4 and `passport` 0.4.1 have advisories that do not apply to how they are used here.
Fix: bump express, body-parser, moment, lodash; move the Flex SDK forward (production already has 1.21).

**SEC-11 Third-party scripts with full DOM access, no SRI, one protocol-relative**
*Severity: Low · Effort: Small · Origin: fork*
Evidence: `public/index.html:213` loads Tidio over `//`; Google Maps key on every page (line 192); ShareThis, HubSpot, GTM, Hotjar (production).
Fix: `https://` for Tidio; referrer-restrict the Maps key; review GTM publisher rights.

**SEC-12 Internal error details and debug output leak**
*Severity: Low · Effort: Small · Origin: mixed*
Evidence: `server/api-util/sdk.js:74-78` returns raw `error.message` for non-SDK errors; `initiate-privileged.js:31` logs every order's line items; `server/index.js:297` `console.log(!23123123)`.
Fix: generic message to the client, detail to the server log; delete the debug lines.

**SEC-13 Login-as endpoints: acceptable, minor hardening**
*Severity: Low · Origin: upstream*. PKCE S256 with a CSPRNG state is used. `user_id` is interpolated unencoded into the Console URL; cookies are not HttpOnly. Encode and harden.

**SEC-14 No rate limiting on `/api/*`**
*Severity: Low · Origin: upstream*. `transaction-line-items` and `initiate-login-as` are anonymous; combined with SEC-10 this is a cheap DoS.

Strengths: server-side pricing via `privileged-set-line-items`; trusted SDK token exchange stays in memory on the server; `renderer.js:103-110` escapes `<` in preloaded state; JSON-only API on a non-simple content type blocks CSRF; helmet, HTTPS redirect, `no-store` on SSR responses; decimal money math with safe-integer checks.

### 4.2 Booking, pricing, and transaction process

**PAY-01 Promo discount is granted to any truthy flag; Voucherify is consulted only in the browser, and the browser code crashes on error**
*Severity: Critical · Effort: Medium · Origin: fork*
Same root cause as SEC-01 and SEC-02, plus: `Promocode.duck.js:85` calls `log.error` but `log` is never imported, so a failed lookup throws a `ReferenceError` in the catch and the user never sees an error message. Line 13 compares `typeof window` to the value `undefined`, not the string, so the SSR guard never fires. `vouchers.get` only checks existence; the voucher's own discount payload is discarded and there is no redemption, so codes are infinitely reusable.

**PAY-02 Daily, weekly, and monthly bookings are created at 00:00 UTC against listing-timezone availability plans**
*Severity: High · Effort: Medium · Origin: fork*
Evidence: `ListingPage.js:134-135` and `BookingDatesForm.js:71-72` use `moment.utc(date).startOf('day')`. Listings always use a time-based plan in the host's browser timezone with full-day entries (`util/data.js:404-415`, `EditListingAvailabilityPanel.js:21-38`). `process.edn:10-11` observes availability.
Impact: a London listing in BST gets a "Saturday" booking spanning Sat 01:00 to Sun 01:00 local; if Sunday is unavailable, Flex rejects it. For US listings the spill goes into the previous evening. Well-founded from code, not runtime-verified; reproduce with a Dubai or US listing on staging.
Fix: compute day boundaries in `availabilityPlan.timezone` on client and server.

**PAY-03 Availability timezone is silently the host's browser timezone at save time**
*Severity: Medium · Effort: Small · Origin: fork*
Evidence: `util/data.js:401-402` `defaultTimeZone()`; `EditListingAvailabilityPanel.js:116` regenerates the plan on every save; `EditListingPricingPanel.js:149` resets it when a weekly or monthly price is first added; the timezone selector is only in a commented-out panel.
Impact: an admin in London editing a Dubai listing moves its hourly grid to London time.
Fix: persist timezone once, derived from location; never regenerate an existing plan.

**PAY-04 Pricing logic exists in three places; the live client copy hard-codes the commission and crashes**
*Severity: High · Effort: Medium · Origin: fork*
Evidence: `LineItemTotalPrice.js:37` computes the provider total as `units.lineTotal.amount - amount * 5 / 100` in floating point and dereferences `units` without a guard (this is the crash in the test log). On `production` the server is ±10% (`lineItems.js:12-13`), `BreakdownMaybe.js:218` shows 10%, and `LineItemTotalPrice.js` still shows 5%. Dead client pricing also remains in `CheckoutPage.js:550-598` and `EstimatedBreakdownMaybe.js`.
Impact: the provider "Total" is wrong by five points on discounted transactions on production; any transaction without a units line item throws on render.
Fix: render `payoutTotal` and `payinTotal` from the transaction only; delete the client formulas.

**PAY-05 Commission and discount rates are hard-coded and duplicated**
*Severity: Medium · Effort: Small · Origin: fork*. `lineItems.js:12-14`, `LineItemTotalPrice.js:37`, `LineItemPromocodeMaybe.js:22`, and the `commissionFeeNote` copy. One server-side config, surfaced to the client only through the transaction.

**PAY-06 Daily bookings consume the listing's entire seat capacity; day-picker seat check looks inverted**
*Severity: Medium · Effort: Small · Origin: fork*. `CheckoutPage.js:420-432` sends `seats = listing.publicData.seats` for non-hourly bookings without multiplying the price. `DateRangeInput.helpers.js:153-155` uses `<=` where `findFirstInvalid` uses `<`. Decide and document the whole-space rule; fix the comparison.

**PAY-07 Business rules are enforced client-side only**
*Severity: Medium · Effort: Medium · Origin: upstream pattern extended by fork*. Minimum booking, 90-day window, and minimum price (`config.js:75` is 0) exist only in pickers. Hourly listings with a daily minimum accept 30-minute bookings (`util/dates.js:405-410`). Replicate in `transactionLineItems`.

**PAY-08 The published cancellation policy cannot be executed by the transaction process**
*Severity: High · Effort: Large · Origin: fork page, upstream process*
Evidence: `CancellationPage.js:44-67` promises tiered refunds (100% less fees, 50%, non-refundable). `process.edn:76-83` has one cancel transition, operator-only, from `accepted` only, with `calculate-full-refund`. No partial refund, no customer- or provider-initiated cancel. One table row reads "7+ days or less".
Impact: every tiered refund is a manual Stripe operation outside Flex's ledger; "less platform fees" is impossible; legal exposure if the page forms part of the terms.
Fix: add cancel transitions per tier with partial-refund actions, or amend the policy to what the process supports.

**PAY-09 The process file in the repo is not the live process**
*Severity: High · Effort: Small · Origin: fork*
Evidence: `ext/transaction-process/process.edn` is byte-identical to upstream's day-based `flex-default-process`. `src/config.js:35` uses `preauth-hourly-process/release-1`. `.gitignore:19-42` ignores a `/process/` directory where someone pulled the real one and never committed it. Client transition names in `util/transaction.js` do match the upstream file exactly (17 transitions), so the deployed process is probably a renamed copy, but the repo cannot prove it.
Fix: `flex-cli process pull` into `ext/` and commit; document the push workflow.

**PAY-10 Email templates never render the fork's line items and show UTC dates**
*Severity: Medium · Effort: Small · Origin: upstream templates unadapted*. Templates branch on `line-item/night`; the fork emits `line-item/units`. Discount and customer commission rows never appear. Dates render `tz="Etc/UTC"` with no time, so a 23:00 BST hourly booking shows the wrong day.

**PAY-11 Smaller defects**
*Severity: Low · Origin: fork*. `server/api-util/currency.js:67-69` calls an undefined `isNumber`. `EditListingPricingForm.js:38-42` passes a 0-based month to a 1-based helper. `transition/expire` uses booking end plus one day, so a provider can accept a two-hour booking a day after it passed. Promo code is stored in `protectedData` on only one of two initiate paths. Booking horizon is 90 days in one picker and 180 in the other.

Strengths: `util/transaction.js` matches the process file completely; hourly slot generation is timezone-aware with DST de-duplication; commission goes through Flex `includeFor`, so Flex's ledger stays authoritative; Decimal.js with `ROUND_HALF_UP` everywhere on the server.

### 4.3 Multi-currency

**CUR-01 Currency select option values are hard-coded while labels come from config**
*Severity: High · Effort: Small · Origin: fork*
Evidence: `EditListingPricingForm.js:211-212` renders `value='GBP'` labelled `config.currency` and `value='USD'` labelled `config.additionalCurrency`. On `production` a third hard-coded `EUR` was added (`:228-236`) and `BookingPanel.js:34-45` still accepts only the two configured currencies, so a EUR listing renders "Unsupported currency".
Impact: works only because production happens to be GBP plus USD; any other configuration submits the wrong code.
Fix: one `supportedCurrencies` array from env used by the form, `priceData`, and `getMainCurrency`.

**CUR-02 The additional currency is never validated**
*Severity: Medium · Effort: Small · Origin: fork*. `config.js:68` reads it raw; `getMainCurrency` hard-codes two decimals; `formatMoney` throws for any code absent from `currency-config.js`. Setting `AED` (Dubai was just added to the footer) blanks search and listing pages.

**CUR-03 One listing can hold prices in two currencies; the lock lives on the user profile**
*Severity: Medium · Effort: Medium · Origin: fork*. `EditListingPricingForm.js:74-77` pins the hourly currency to the existing price but lets day, week, and month prices fall back to `userPublicData.currency`. `EditListingWizardTab.js:142-144` writes the profile currency on every pricing save, unawaited, with errors swallowed. The same listing can then be charged in different currencies depending on booking type, and nobody can change the profile currency in the UI.

**CUR-04 Search price filter, sort, and `*Filter` fields assume one currency**
*Severity: Medium · Effort: Medium · Origin: upstream design plus fork*. `SearchPage.duck.js:130-138`, `marketplace-custom-config.js:82-98`, `EditListingPricingPanel.js:118` (currency-less float). A £100 and a $100 listing are equal to the filter. `getLowestPrice` returns the first price, not the lowest.

**CUR-05 Server is currency-agnostic; Stripe and Flex implications unverified**
*Severity: Medium · Effort: Small for validation · Origin: fork*. Nothing under `server/` references the second currency. Whether USD payment intents to GB-based connected accounts are auto-converted with FX fees, and whether Flex Console's single-currency setting accepts them, needs confirming with Sharetribe and Stripe.

**CUR-06 Leftovers**
*Severity: Low · Origin: fork*. `ListingPage.js:386` logs price on every render; `EstimatedBreakdownMaybe.js` hard-codes `'GBP'` initial state and references an unimported `config`; the env variable is absent from `.env-template`, `app.json`, and `docs/env.md`; safety guards in `FieldCurrencyInput.js:58-62` and `EditListingPricingPanel.js:128-129` were commented out rather than adapted; map pins render the literal string `GBP` as a fallback.

### 4.4 Data model and configuration

**CFG-01 Category taxonomy is encoded three times and stitched with string operations**
*Severity: High · Effort: Medium · Origin: fork*
Evidence: `marketplace-custom-config.js` defines eight category filters each with `config.catKeys` as a comma-joined string duplicating its own `options[].key` list (line 128 and siblings). `generalCategories` (lines 489-503) uses those strings as option keys. Consumers re-split: `MainPanel.js:177-184` does eight literal `find(...).config.catKeys.split(',')` calls; `SearchPage.helpers.js:196-235` hard-codes further arrays with keys such as `beauty-treatment-room` that exist in no options list; `TopbarDesktop.js:55-57` looks categories up by display label.
Impact: renaming a category or its label silently breaks topbar search, SEO titles, and the mobile category panel.
Fix: one `categories` array with `id`, `label`, `options`; derive `catKeys`; look up by id; add a test that every referenced key exists.

**CFG-02 Category is not required on the description step**
*Severity: Medium · Effort: Small · Origin: fork*. `EditListingDescriptionForm.js:124-125` has no validator; `EditListingDescriptionPanel.js:80-82` writes `category: null`; search code assumes every listing has one.

**CFG-03 Option labels are untranslatable; a migration hack runs forever**
*Severity: Low · Origin: fork*. 169 option keys with English-only `label` and a duplicated `metaLabel`. `EditListingPricingPanel.js:145` writes `unitType: null` on every save to clean up an old field.

### 4.5 Testing

**TEST-01 The client suite cannot run**
*Severity: High · Effort: Small · Origin: fork*
Evidence: 45 suites fail at import because `ListingCard.js` imports `react-slick`, which needs `window.matchMedia`; no `src/setupTests.js` exists on `master`, `staging`, or `production`. Fix is a ten-line mock.

**TEST-02 Tests that assert removed behaviour and snapshots that were never committed**
*Severity: Medium · Effort: Small · Origin: fork*. `server/api-util/lineItemHelpers.test.js:75` contradicts the fork's `switch` default. The two fork-added snapshot tests (`BookingTimeForm`, `NewsletterForm`) have no committed snapshots, and `test-ci` lacks `--ci`, so CI would silently write them rather than fail.

**TEST-03 Zero coverage of fork business logic**
*Severity: High · Effort: Large · Origin: fork*. 55 of 58 test files are byte-identical to upstream; one is modified by one line; two are copied from ftw-hourly. Nothing tests `lineItems.js`, `weeksBetween`, `monthsBetween`, `hoursBeetwen` (sic), promo codes, the second currency, category filters, availability panels, seats, or static pages. The `production` branch adds one copied template test.

**TEST-04 The test stack is a dead end**
*Severity: Medium · Effort: Large · Origin: upstream*. Enzyme with the React 16 adapter has no path to React 17 or later; a React upgrade means rewriting every component test.

### 4.6 CI/CD and operations

**CI-01 No test, lint, or build gate before deploy** *(High, Medium, fork)*. Covered in SEC-04. The build runs on the server inside Capistrano.

**CI-02 `pm2 kill` on every deploy, no zero-downtime, no health check, no rollback doc** *(High, Small, fork)*. `keep_releases 3` means `cap deploy:rollback` would work; nothing mentions it. No `/healthz`.

**CI-03 CircleCI config is orphaned** *(Medium, Small, upstream)*. `.circleci/config.yml` is upstream's; the README badge points at Sharetribe's project; the `audit` job is defined but not in the workflow. No evidence CircleCI is connected to this repository.

**CI-04 Node version disagrees in five places** *(Medium, Small, fork)*. `engines` says 12 or 14; CircleCI uses 12.19; Capistrano pins 14.15.4; no `.nvmrc`; webpack 4 needs a legacy flag on anything newer. The `production` branch's "babel fix" commits and `@babel/core` pinned as a runtime dependency are symptoms.

**CI-05 Ruby 2.3.4 Capistrano with no Gemfile** *(Medium, Small, fork)*. `.ruby-version` names a Ruby that reached end of life in 2019; the `Capfile` requires three gems that are pinned nowhere. Deploy tooling is whatever was hand-installed on the staging host.

**CI-06 Staging and production deploy targets are managed by hand-editing the workflow** *(Low, fork)*. Five workflow commits in six days in August 2024 flipped branch names between `production`, `production-test`, and `staging`.

Target pipeline: one protected integration branch; on every PR install, format, test, build, audit; deploy job needs those; ship the built artifact, not a `git pull`; `pm2 reload` with an ecosystem file; health check with automatic rollback; per-environment secrets; drop Ruby and Capistrano; Sentry release tagging.

### 4.7 Repository hygiene and fork drift

**REPO-01 The default branch is dead** *(Critical, Small to decide, fork)*. `master` is 326 commits behind `production` and 329 behind `staging`, with zero commits the other way. Fast-forward to `staging`: it is a strict descendant, the merge is conflict-free by construction, and the only content it has beyond `production` is the intentional monthly-max fix from PR #348.

**REPO-02 Upstream artefacts shipped as HotPatch's** *(Medium, Small, upstream leftovers)*. `README.md`, `CHANGELOG.md`, `app.json` ("Saunatime!"), `docs/README.md`, the issue template, and the CircleCI badge are byte-identical to upstream. `heroku-postbuild` remains though Heroku is not used. `saunatime*.jpg` and `Hero-Image-Desktop.png` (1.1 MB) are unreferenced. `fr.json` still says Saunatime to French users.

**REPO-03 Branch sprawl and history quality** *(Medium, Small, fork)*. 74 remote branches; revert-of-revert-of-revert branches; 11 commits titled `test` or similar each merged through its own PR in February 2024; six revert PRs on one day in June 2024 netting to +99/−43. No tags. Version stays `8.1.1` on every branch.

**REPO-04 `.gitignore` contradictions** *(Medium, Small, fork)*. It lists `yarn.lock`, which is tracked; it ignores 22 specific `/process/templates/**` files and `/process/process.edn` (see PAY-09) and five `.idea` entries.

**REPO-05 Stray artefacts** *(Low, Small, fork)*. Empty file `grep` at the root from a redirection accident in PR #198. `src/IconSocialMediaTwitter/` is an orphaned copy of a component that also lives under `src/components`.

Upgrade path: an in-place merge to `ftw-daily` v10.1.0 is not realistic; the fork modified 298 upstream files and rewrote the same areas (dates, availability, pricing, search filters, CSP, renderer) that upstream v9 and v10 changed. A port to `web-template` v12 is a re-implementation of the fork's features on a new base, not a merge: booking types and minimums, customer commission and promo line items, second currency, category filters with images, static pages, HubSpot, ShareThis, Tidio, seats and capacity, HotPatch styling. Order of magnitude: months for one engineer. Start from the stabilised `staging`.

### 4.8 Dependencies and toolchain

**DEP-01 The entire build stack is end-of-life** *(High, Large, upstream frozen by fork)*. `sharetribe-scripts` 5.0.0 is CRA 4 on webpack 4.44, Babel 7.12, Jest 26; React 16.14; targets Node 12. Latest `sharetribe-scripts` is 7.0.0, latest Flex SDK 1.24.

**DEP-02 Dead and duplicate libraries** *(Medium, Small, fork)*. `@material-ui/core` plus `@emotion/react` and `@emotion/styled` are pulled in for one `<Link>` in a misspelt file `FiledDiscount.js`. Two carousel libraries (`react-slick`, `react-alice-carousel`) for three components. `react-google-maps` has zero imports. `reqwest` appears only in a comment. Four es-shim polyfills duplicate `core-js`. `jstimezonedetect` can be replaced by `Intl`. The Voucherify server SDK in the browser drags in `request`, `sshpk`, `elliptic`, `ajv`, and `pako`.

**DEP-03 Stale `resolutions`** *(Low, Small, upstream)*. `serialize-javascript ^2.1.1` pins an old major; `react-dates/lodash ^4.17.19` does not force the CVE-fixed 4.17.21.

**DEP-04 Babel pinned as runtime dependencies on `production`** *(Low to Medium, Small, fork)*. `@babel/core`, `preset-env`, `preset-react` at `7.16.0` in `dependencies` plus a conflicting `^7.16.0` resolution, added across three "babel fix" commits on 2024-08-07 with no recorded reason. Two copies of `@babel/core` resolve in the lockfile.

**DEP-05 Audit job never runs** *(Low, Small, upstream)*. `.auditrc` is the empty example; the CircleCI `audit` job is not in the workflow.

### 4.9 Frontend architecture and code quality

**ARCH-01 Dead availability panels still exported and bundled** *(Medium, Small, fork)*. `EditListingAvailabilityPanelDay` and `PanelHour` (471 lines) are commented out of the wizard (`EditListingWizardTab.js:14-16, 303-323`) but exported from the barrel; no `sideEffects` field, so they ship.

**ARCH-02 Prop drilling through wizard and panels** *(Medium, Large, upstream widened by fork)*. `EditListingWizard.js` 42 props, `EditListingWizardTab.js` 39, `TransactionPanel.js` 36, `ListingPage.js` 32, `CheckoutPage.js` 31. The listing wizard now updates the user profile from inside a listing save.

**ARCH-03 `CheckoutPage.js` at 1,092 lines mixes UI, dead line-item math, and promo logic** *(Medium, Medium, fork)*.

**ARCH-04 Unused components and forms** *(Low, Small, mixed)*. `IconCloseCustom` duplicates `IconClose`; `FieldBoolean`, `IconSearch`, `OrderDiscussionPanel`, `SectionLocations` (with Finnish images), `SectionThumbnailLinks`, `TabNavHorizontal`, `PayoutDetailsForm`, `NewsletterForm`, and `Newsletter.duck.js` (a thunk that never resolves, 50 commented lines) are dead. The live newsletter path is HubSpot.

**QUAL-01 Debug logging in hot paths, including the signup form** *(Medium, Small, fork)*. `AuthenticationPage.js:174` logs the signup values including the password. `InboxPage.js:174` logs every transaction row. `ListingPage.js:386` logs on every render. On `production`, 20 more were added and the final commit, "add console to breakdown", re-enables one; `TransactionPanel.js:257` prints full transaction objects to every visitor's console. There is no ESLint config beyond the CRA default, so `no-console` never runs.

**QUAL-02 215 files fail Prettier** *(Medium, Small, fork)*. The config is in `package.json`; it is simply not run. Fork files mix quote styles, indent widths, and trailing spaces in data (`"Free Parking "`).

**QUAL-03 Large commented-out blocks** *(Low, Small, fork)*. `src/stripe-config.js:349-742` is 394 commented lines; `production` adds 565 more across `UserCard.js`, `SectionHero.js`, `moneyHelpers.js`, and others.

**QUAL-04 Copy-paste and typo smells** *(Low, fork)*. Filter id `kitchensand_pop_ups`; `FilterForm.js:83` toggles the same class on and off; `SearchPage.helpers.js:180` string-compares `"United Kingdom"`; `TopbarDesktop.js:48-49` forces re-render with a `useState({})` hack; image files named `Hero 11.jpg` with spaces.

**QUAL-05 `UserDisplayName` lost its CSS classes on `production`** *(Low, Trivial, fork)*. Commit `f7613301` replaced `<span className={classes}>` with a bare span while adding a log.

### 4.10 Performance and SEO

**PERF-01 1.05 MB of gzipped JavaScript on first load** *(High, Medium, mixed)*. Vendor 790 KB plus main 263 KB. Largest contributors listed in the verification log. `react-dates` (425 KB source) is abandoned upstream; the Voucherify polyfill chain is entirely avoidable by moving it server-side (SEC-02).

**PERF-02 6 MB of raster images bundled, 1.1 MB unused** *(High, Small, fork)*. `Hero-Image-Desktop.png` 1.1 MB unreferenced; a 650 KB *mobile* hero slide; five desktop slides between 170 and 420 KB all imported eagerly in `SectionHero.js:10-14`; no `srcSet`, no lazy loading, `alt="avatar"`.

**PERF-03 `robots.txt` is empty and the sitemap is wrong** *(High for SEO, Small, fork)*. `public/robots.txt` is zero bytes. `server/sitemap.js:57-100` lists twenty `/blog/...` URLs that no route serves, plus auth-only pages, while listing and category search pages are absent. On `production`, one listing UUID is hard-coded in.

**PERF-04 Third-party weight on every page** *(Medium, Medium, fork)*. Google Maps and Stripe load synchronously in `<head>` on all pages; slick, alice-carousel, and react-dates CSS load globally; ShareThis, HubSpot, GTM, Tidio, Hotjar. One full `import { isEmpty } from 'lodash'` in `AuthenticationPage.js:8` against 64 correct per-method imports.

**PERF-05 Schema markup errors** *(Low, Small, fork)*. `FaqPage.js:19` uses `'FaqPage'` (the type is `FAQPage` and needs `mainEntity`); `FeesPage.js:19` uses a non-existent type; the FAQ page has three `<h1>` elements; the fees page has duplicate ids.

**PROD-08 Environment-specific hard-coding on `production`** *(Low, fork)*. `Footer.js` embeds around forty absolute `https://www.hotpatch.com/s?...` links, so staging's footer links to production; `SectionHero.js:75-76` hard-codes United Kingdom bounds; Hotjar id in `index.html`.

### 4.11 Internationalisation

**I18N-01 Five message IDs used in code do not exist in `en.json`** *(Medium, Small, fork)*. `EditListingCapacityPanel.createListingTitle` (shown on every new listing), `EditListingAvailabilityExceptionForm.updateFailed`, `PaymentMethodsForm.missingStripeKey`, `StripeConnectAccountForm.submitButtonText`, `FieldDateInput.placeholder`. react-intl renders the raw id.

**I18N-02 de, es, fr are stale upstream copies; the app is English-only by construction** *(Low today, Large if localisation is a goal, upstream neglect)*. `config.js:11` hard-codes `'en'`. The three files are missing 386, 261, and 261 keys respectively, contain "Saunatime", and never mention HotPatch. Hard-coded English exists in `FiledDiscount.js`, `EditListingCapacityPanel.js:41`, `FilterPlain.js:150`, all static pages, and all 169 option labels. Decide: delete the three locales or regenerate them.

Strength: the fork's landing-page sections (`SectionWhatIsHotpatch`, `SectionPatchCategories`, `SectionHowItWorks`, `Footer`, `TopbarDesktop`) use `FormattedMessage` exclusively, and `en.json` has no Saunatime or Sharetribe residue.

### 4.12 Accessibility

**A11Y-01 Clickable `div` and `span` elements without role or keyboard support** *(High, Small, fork)*. `FilterPlain.js:157-162` nests a clickable `div` inside a `button`; `SearchFiltersPrimary.js:85` close control is a `div` inside an `h3`; `SearchFiltersMobile.js:136,158`; `FilterForm.js:83,91`; `SectionHowItWorks.js:60-70` custom toggle wrapping an unlabeled checkbox; `FiledDiscount.js:52,58` renders anchors with no `href`.

**A11Y-02 `FieldMultiSelect` label is not associated with its input** *(Medium, Small, fork)*. `FieldMultiSelect.js:92-97` sets `id` on the react-select container; the input needs `inputId`. This is the category picker on listing creation.

**A11Y-03 Price slider handles are mouse-only** *(Medium, Medium, upstream)*. `RangeSlider/Handle.js:104-116` has `role="button"`, no `tabIndex`, no ARIA values, no key handling.

**A11Y-04 Meaningless alt text and heading structure** *(Low, Small, fork)*. Hero slides `alt="avatar"`; category images repeat visible labels; FAQ page has three `<h1>`; `<br></br>` for spacing.

Strengths: `Modal.js` traps focus and closes on Escape; the top bar uses `<nav>` and real buttons; booking forms pass labels.

### 4.13 Documentation and onboarding

**DOC-01 README and docs are 100% upstream** *(High, Medium, upstream leftovers)*. The README clones `sharetribe/ftw-daily`, offers a Heroku button, and points to Sharetribe's Slack. Twenty-one of twenty-two `docs/*.md` files are three-line "moved to Flex Docs" stubs.

**DOC-02 Nothing documents what a new engineer needs** *(High, Medium, fork)*. Missing: which branch is real; the branch and deploy flow; host layout and pm2 names; rollback; a complete `.env` including GTM, Pixel, Hotjar, Voucherify, second currency (`REACT_APP_SHARETRIBE_ADDITIONAL_MARKETPLACE_CURRENCY`, `REACT_APP_GOOGLE_TAG_MANAGER_ID`, and `REACT_APP_FACEBOOK_PIXEL_ID` are used in code and documented nowhere); which Flex Console environment maps to staging versus production; how the live transaction process is deployed; the business rules (commissions, discount, minimum booking, month equals 30 days, hourly granularity 30 minutes, 15-minute payment window, 6-day acceptance window, daily bookings take all seats, currency locked per host); third-party setup for Voucherify, HubSpot, Tidio, ShareThis, Sentry, and the OAuth apps.

### 4.14 Observability and privacy

**OBS-01 Trackers fire before and regardless of cookie consent** *(High, Medium, fork)*. Tidio loads unconditionally from `public/index.html:213`; Facebook Pixel is injected server-side into every response by `server/renderer.js:130-149`; GTM initialises at module load in `src/index.js:39`; HubSpot and ShareThis set cookies; Hotjar on `production`. `CookieConsent.js` only writes `euCookiesAccepted=1` and nothing reads it. HotPatch serves the UK, so UK GDPR applies. Gate everything behind consent, ideally through GTM Consent Mode, and remove the server-side Pixel injection.

**OBS-02 Error logging is optional Sentry v5 and nothing else** *(Medium, Medium, upstream)*. No request logging, no structured logs, no release tagging, no health endpoint. Sentry v5's server handlers were removed in v8.

**OBS-03 Contact-info blocker is client-side only and was toggled per environment by editing code on `production`** *(Medium, Small to Medium, fork)*. `ListingPage.js:300-322` and `TransactionPanel.js:151-195` regex-block emails, phones, and URLs in messages via a SweetAlert2 dialog. Commits "regex is temporarily removed to deploy in production" and "regex is live for staging" flipped it by code edit. The phone regex also matches "2 rooms 100 sqm 2024". Any direct SDK call bypasses it. Keep the hint client-side; enforce server-side; drive with an env flag.

**OBS-04 Universal Analytics handler is dead** *(Low, upstream)*. `ga('send','pageview')` targets a product shut down in 2024.

---

## 5. Strengths worth preserving

- **Server-side pricing through privileged transitions.** `server/api/initiate-privileged.js:12-30` and `transition-privileged.js:12-29` fetch the listing and overwrite `params.lineItems`; `process.edn:12,21` uses `privileged-set-line-items`. Keep this shape and add validation to it.
- **Money arithmetic.** Decimal.js with `ROUND_HALF_UP`, `Money` types end to end, safe-integer checks in `server/api-util/currency.js:14-19`.
- **Escaping and sanitisation.** `server/renderer.js:103-110` escapes preloaded state; `Page.js:224-226` escapes JSON-LD; the `production` CMS path runs `rehype-sanitize` and `sanitizeUrl`; SweetAlert2 is only ever called with `text`.
- **Secrets hygiene, one exception aside.** `.env` is ignored and never tracked; Capistrano links it rather than copying; the Flex client secret, OAuth secrets, and RSA keys are server-only.
- **Client and process agree.** `util/transaction.js` matches all 17 transitions in the process file.
- **Timezone-aware hourly flow.** Slot generation, DST de-duplication, and picker-to-listing-timezone conversion in `FieldDateAndTimeInput.js` are correct; the daily flow is what needs fixing.
- **Template structure intact.** Components, containers, ducks, forms, barrel exports, `loadable()` on all 27 page containers with prefetch on Listing and Search, 243 of 243 action constants following the `app/Duck/NAME` convention, 1,368 design-token references versus 52 raw hex colours.
- **Translation discipline in fork UI.** Landing-page sections and the top bar use `FormattedMessage` exclusively.
- **Ticket-traceable history.** Branch names and merge commits carry ticket numbers, so intent is recoverable even without a changelog.
- **Later work already leans toward `web-template`.** PageBuilder, hosted assets, and the newer SDK on `production` reduce the cost of the recommended migration.

---

## 6. Prioritised roadmap

Order dependencies: baseline first, then revenue fixes, then the safety net, then dependency work, then the migration decision. Do not start the migration before the safety net exists; you would be porting untested behaviour.

### Now (this week to two weeks)

1. **Rotate the Voucherify key** and remove it from the client build. SEC-02, PAY-01.
2. **Fast-forward `master` to `origin/staging`**, tag it, make it the protected default, and open a CHANGELOG. REPO-01. Everything below happens on that baseline.
3. **Close the discount bypass**: validate and redeem codes server-side, derive the percentage from the voucher, store the code in `protectedData`. SEC-01, PAY-01.
4. **Validate booking requests server-side**: price from `params.bookingStart/End`, whitelist `type`, require whole units, enforce `minBooking`, set a minimum price. SEC-03, PAY-07.
5. **Fix the provider total display**: render `payoutTotal`, guard the missing line item, delete client fee formulas. PAY-04.
6. **Make the tests run**: add `src/setupTests.js` with a `matchMedia` mock, fix or delete the stale server test, add `--ci`, commit the two missing snapshots. TEST-01, TEST-02.
7. **Gate deploys**: a GitHub Actions job that installs, formats, tests, builds, and audits, with both deploy jobs depending on it. Separate production secrets and deploy from the runner. Replace `pm2 kill` with `pm2 reload`. Add `/healthz`. SEC-04, CI-01, CI-02.
8. **Remove debug logging**, including the signup-form log, and add `no-console` to ESLint. QUAL-01.
9. **Run Prettier once** and enforce it in the gate. QUAL-02.
10. **Restore `robots.txt`**, drop the blog entries from the sitemap. PERF-03.
11. **Revoke the Rocket.Chat webhook.** SEC-05.
12. **Delete the stray `grep` file, unused images, and the orphaned component copy.** REPO-05, PERF-02.

### Next (this quarter)

13. **Reproduce and fix the daily-booking timezone bug** on staging with a non-UK listing; persist the listing timezone. PAY-02, PAY-03.
14. **Commit the live transaction process** from Flex Console into `ext/` and document the push workflow. PAY-09.
15. **Decide the cancellation policy**: either add tiered cancel transitions with partial refunds, or rewrite the page. Product and legal call. PAY-08.
16. **Fix email templates** for `line-item/units`, discount rows, and local times. PAY-10.
17. **Consent-gate all trackers** and remove server-side Pixel injection. OBS-01.
18. **Currency clean-up**: one `supportedCurrencies` list from env; validate the second currency; one currency per listing; decide with Stripe and Sharetribe whether the second currency is viable at all. CUR-01 to CUR-05.
19. **Single category source of truth** with a test; make category required. CFG-01, CFG-02.
20. **Social login hardening**: validate `from`, add a real state nonce, `sameSite` on fork cookies. SEC-06, SEC-07, SEC-09.
21. **Dependency pruning**: drop Material UI and emotion, one carousel, `react-google-maps`, `reqwest`, `jstimezonedetect`, es-shims; bump express, body-parser, moment, lodash; move Babel out of `dependencies` on the baseline. DEP-02, DEP-03, DEP-04, SEC-10.
22. **Accessibility pass** on filters, multi-select, and the hero. A11Y-01, A11Y-02, A11Y-04.
23. **Write the docs**: README for HotPatch, `docs/business-rules.md`, `docs/deploy.md`, complete `.env-template`. DOC-01, DOC-02.
24. **Add tests** for `lineItems.js`, duration helpers, promo validation, and the category map. TEST-03.
25. **Fix the five missing translation keys** and decide whether de, es, fr live or die. I18N-01, I18N-02.
26. **Image diet**: compress hero and category images, lazy-load slides. PERF-02.

### Later (strategic)

27. **Migrate to Sharetribe `web-template`** as a feature-by-feature port from the stabilised baseline. This is the only realistic route to React 18, a supported build chain, a maintained date picker, and a test stack that is not Enzyme. DEP-01, TEST-04, ARCH-02.
28. **Replace Capistrano and Ruby** with artifact-based deploys or containers. CI-05.
29. **Externalise static page copy** and option labels so marketing can edit without a deploy. ROUTE, CFG-03.
30. **Move the contact-info rule server-side** if it stays a product requirement. OBS-03.
31. **Structured logging, Sentry release tagging, and uptime monitoring.** OBS-02.
32. **Branch clean-up**: delete the 70-odd merged and abandoned branches. REPO-03.

---

## 7. Open questions for the product owner

1. Is the second currency (USD, and EUR on `production`) live for real bookings? Has Stripe confirmed how USD or EUR payment intents settle to GB-based connected accounts, and does the Flex Console currency setting accept them?
2. Which Flex Console environment does `preauth-hourly-process/release-1` live in, and is there a test-environment copy for staging? Who can run `flex-cli` today?
3. Do `www.hotpatch.com` and `staging.hotpatch.com` share a host? This decides how much damage `pm2 kill` on a staging deploy can do.
4. What are the actual production values of `REACT_APP_CSP`, `REACT_APP_SHARETRIBE_USING_SSL`, `SERVER_SHARETRIBE_TRUST_PROXY`, and `REACT_APP_SENTRY_DSN`?
5. Is the Google Maps key referrer-restricted in Google Cloud?
6. Is CircleCI connected to this repository at all, or is the config a leftover?
7. Is branch protection enabled on `production` and `staging`?
8. Is the cancellation page part of the terms of service, and who is currently processing tiered refunds in Stripe?
9. Is the daily-booking behaviour "one booking takes the whole space" intentional?
10. Who owns Voucherify, HubSpot, Tidio, Hotjar, ShareThis, Sentry, and the Facebook and Google OAuth apps, and are any of them still wanted?
11. Was the Braincrop engagement handed over, and does anyone hold the reason for the August 2024 Babel pin?
12. Is localisation into German, Spanish, or French a goal, or can those files be removed?

---

## 8. Appendix

### 8.1 Largest source files on `master`

| Lines | File |
|---|---|
| 1,092 | `src/containers/CheckoutPage/CheckoutPage.js` |
| 899 | `src/util/dates.js` |
| 778 | `src/containers/TransactionPage/TransactionPage.duck.js` |
| 769 | `src/containers/EditListingPage/EditListingPage.duck.js` |
| 742 | `src/stripe-config.js` (394 commented) |
| 738 | `src/containers/ListingPage/ListingPage.js` |
| 682 | `src/forms/EditListingAvailabilityExceptionForm/EditListingAvailabilityExceptionForm.js` |
| 644 | `src/forms/BookingTimeForm/FieldDateAndTimeInput.js` |
| 596 | `src/components/TransactionPanel/TransactionPanel.js` |
| 596 | `src/components/SearchMap/SearchMapWithGoogleMaps.js` |
| 575 | `src/components/LocationAutocompleteInput/LocationAutocompleteInputImpl.js` |
| 573 | `src/components/EditListingWizard/EditListingWizard.js` |
| 565 | `src/util/types.js` |
| 551 | `src/forms/StripePaymentForm/StripePaymentForm.js` |
| 550 | `src/containers/SearchPage/MainPanel.js` |
| 537 | `src/marketplace-custom-config.js` |

Totals: 73,577 lines of JavaScript under `src/` (62,442 excluding tests and examples); 21,862 lines of CSS across 221 files; 156 component directories, 27 containers, 34 forms, 27 ducks.

### 8.2 Dependency status

| Package | Pinned on `master` | Latest known | Status |
|---|---|---|---|
| react, react-dom | 16.14.0 | 19.x | Unsupported since 2022; blocks everything else |
| sharetribe-scripts | 5.0.0 | 7.0.0 | CRA 4, webpack 4, Jest 26 |
| sharetribe-flex-sdk | 1.13.0 (1.21.1 on production) | 1.24.x | Behind |
| react-router-dom | 5.2.0 | 7.x | Maintenance only |
| react-intl | 3.12.1 | 7.x | Unsupported |
| react-dates | 21.8.0 | 21.8.0 final | Abandoned by Airbnb; 425 KB of the vendor bundle |
| @sentry/browser, @sentry/node | 5.20.1 | 9.x | End of life; server handler API removed in v8 |
| @material-ui/core, @emotion/* | 4.12.3, 11.4.1 | @mui 7.x | Used in one file for one link |
| moment, moment-timezone | 2.29.1, 0.5.33 | 2.30, 0.5.x | Maintenance mode; 2.29.1 has ReDoS and path traversal CVEs |
| passport | 0.4.1 | 0.7.x | Session fixation CVE not reachable here |
| jose | 3.11.4 | 6.x | Unsupported; advisory not reachable here |
| express | 4.17.1 | 4.21 / 5.x | Open redirect and other CVEs fixed in 4.19 to 4.21 |
| body-parser | 1.19.0 | 1.20.3 | DoS CVE |
| helmet | 4.6.0 | 8.x | Unsupported |
| dotenv | 6.2.0 | 16.x | Old, harmless |
| enzyme | 3.11.0 | none | Dead; no adapter beyond React 16 |
| prettier | 1.19.1 | 3.x | Rules changed |
| lodash | 4.17.20 | 4.17.21 | 4.17.21 fixes CVE-2021-23337 |
| voucherify | 5.2.0 | 5.x | Server SDK used in the browser |
| react-google-maps | 9.4.5 | dead | Zero imports |
| reqwest | 2.0.5 | dead | Only in a comment |
| react-slick, react-alice-carousel | 0.28.1, 2.5.1 | | Two carousels |
| jstimezonedetect | 1.0.7 | dead | Replace with `Intl` |
| Node target | 12.19 (CI), 14.15.4 (deploy) | 22 LTS | Both end of life |
| Ruby (Capistrano) | 2.3.4 | 3.x | End of life 2019; no Gemfile |

### 8.3 Environment variables

Used in code but undocumented: `REACT_APP_SHARETRIBE_ADDITIONAL_MARKETPLACE_CURRENCY`, `REACT_APP_GOOGLE_TAG_MANAGER_ID`, `REACT_APP_FACEBOOK_PIXEL_ID`, `REACT_APP_SHARETRIBE_SDK_BASE_URL`, `SERVER_SHARETRIBE_CONSOLE_URL`, `RSA_PRIVATE_KEY`, `RSA_PUBLIC_KEY`, `KEY_ID`, `REACT_APP_MAILCHIMP_API_KEY` (dead).

Documented and used: `REACT_APP_SHARETRIBE_SDK_CLIENT_ID`, `SHARETRIBE_SDK_CLIENT_SECRET`, `REACT_APP_STRIPE_PUBLISHABLE_KEY`, `REACT_APP_MAPBOX_ACCESS_TOKEN`, `REACT_APP_GOOGLE_MAPS_API_KEY`, `REACT_APP_SHARETRIBE_MARKETPLACE_CURRENCY`, `REACT_APP_CANONICAL_ROOT_URL`, `REACT_APP_ENV`, `REACT_APP_CSP`, `REACT_APP_SHARETRIBE_USING_SSL`, `SERVER_SHARETRIBE_TRUST_PROXY`, `REACT_APP_SENTRY_DSN`, `BASIC_AUTH_USERNAME`, `BASIC_AUTH_PASSWORD`, `REACT_APP_GOOGLE_ANALYTICS_ID`, `REACT_APP_FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `REACT_APP_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `REACT_APP_VOUCHERIFY_APP_ID`, `REACT_APP_VOUCHERIFY_SECRET_KEY` (must lose the prefix), `REACT_APP_AVAILABILITY_ENABLED`, `REACT_APP_DEFAULT_SEARCHES_ENABLED`, `REACT_APP_SHARETRIBE_SDK_TRANSIT_VERBOSE`.

Documented but unused: none.

Hard-coded identifiers that should be configuration: HubSpot portal and form ids (`SectionNewsletter.js:73-75`), Mailchimp list URL (`Newsletter.duck.js:11`), Tidio site key (`public/index.html:213`), Facebook domain verification (`public/index.html:27`), Hotjar id (`production`).

### 8.4 Test inventory

58 test files: 55 byte-identical to upstream v8.1.1, 1 modified by one line (`BookingBreakdown.test.js`), 2 fork-added without committed snapshots (`BookingTimeForm`, `NewsletterForm`). 39 snapshot directories, two of which still reference Saunatime assets. `production` adds one copied template test (`PageBuilder/Field/Field.helpers.test.js`). Fork features with tests: none.

### 8.5 Production branch feature inventory (2023-24)

Hosted assets and CMS pages copied from `web-template` (73 files, about 6,100 lines, Roobykon 2023); Hotjar; signup fields for phone, purpose, referral source, and interested categories; landing-page category and location search with a React context; client-side contact-info blocker on messages; enquiry flow storing dates in `protectedData` with a client-computed breakdown popup; EUR as a third hard-coded currency; commission raised to 10% each side; around 400 lines of hard-coded footer SEO links; Flex SDK 1.21; SweetAlert2; Babel pinned as runtime dependencies. No new server endpoints, no auth changes, no secrets added.
