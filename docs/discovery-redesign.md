# Search and discovery staging preview

First implementation of the March 2026 HotPatch presentation, based on the existing staging branch. The supplied amenities reorganisation and usability report inform the filter layout. This is an incremental preview, not the complete prototype. The wishlist iteration is documented below.

## Included

- Responsive homepage with a keyword, Google location, and optional inclusive date-range search.
- Validation for unselected location text, incomplete dates, and reversed ranges.
- Dark navigation and higher-contrast search/filter controls.
- Keyword, dates, and price ahead of mobile category choices; categories collapsed initially.
- Collapsible amenity groups, with category-specific headings inspired by the supplied guide.
- Existing amenity keys and query semantics retained so current listings remain searchable. New facilities in the guide require host-data collection before becoming filters.
- Listing cards place the title/host before clearly separated pricing, preserving the actual hour/day/week/month unit. No ratings, availability, response times, booking totals, or fee estimates are invented.

## Remaining prototype work

Time-of-day search with listing-timezone handling; booking-count/popularity aggregation and ranking; verified ratings/host response statistics; price totals including fees; the detailed map, listing and messaging flows. The annotations PDF and FigJam upload exceeded the workspace's 32 MiB transfer limit. The Figma archive, presentation, amenities documents, and usability report were received.

## Validation

Install using Yarn 1 and the committed lockfile. Node 16.20.2 was used for cloud validation; the existing staging deployment pins Node 14.15.4 and was not changed.

```
yarn install --frozen-lockfile --non-interactive
yarn build
CI=true yarn test --watch=false --runInBand src/components/SectionHero/SectionHero.test.js src/util/discoverySearch.test.js src/util/amenityGroups.test.js --moduleNameMapper '{"^axios$":"<rootDir>/node_modules/axios/dist/node/axios.cjs","^.+\\.module\\.(css|sass|scss)$":"identity-obj-proxy"}'
```

The Jest mapper selects Axios's real CommonJS export, which this older Jest does not resolve automatically, while retaining the existing CSS module mock. It does not mock API behaviour or disable assertions. The hero snapshot was intentionally updated for the new design.

Browser checks cover mobile/desktop layout without overflow, keyword/date navigation, a real Sharetribe listing query, and amenity selection. In the cloud browser, external certificate/network restrictions affect Maps, Stripe, images, and optional integrations. API checks used curl's configured CA trust to bridge Sharetribe responses into the browser with TLS verification intact. Full browser behaviour still needs checking on staging.

## Deployment

Only the `staging` branch triggers the staging deployment job in `.github/workflows/ssh-deploy-workflow.yml`. Production deploys from a separate `production` branch. Do not push this preview to production.

The existing Capistrano pipeline builds before switching releases and restarts PM2. Neither deployment scripts nor credentials were changed. A successful Git push alone is not evidence of a successful deployment: check the GitHub Actions run and staging homepage/search afterward. The original staging base for this preview was `4d95d2c195612c762cceaa763af6f2e65b719994`.

## Wishlist iteration

The second iteration adds a Save heart beside each search card, a Saved spaces link in desktop/mobile navigation, and an authenticated `/wishlist` page. The card link and Save button are siblings so saving does not navigate to the listing.

Saved IDs live in `currentUser.attributes.profile.privateData.hotpatchSavedListingIds`, with a 100-space limit. The client reads fresh account data before a change and updates only that private-data key. Existing profile data is preserved by Sharetribe's field merge. Save requests are serialized within the client. Request identifiers discard stale reads/writes after logout or a new session. Simultaneous writes from different browsers remain subject to the API's normal last-write behaviour for a profile field.

Guests are sent through the existing login flow with an idempotent pending save. Failed writes retain the previous heart state and offer a retry. An unavailable listing stays saved and can be removed from an unavailable-spaces section. An API failure is shown as an error, not an empty wishlist. No database migration, deployment-script change, or new credential is required.

Focused tests cover validation, private-data handling, failed saves, rapid clicks, logout/relogin races, empty/unavailable lists, guest-save completion, and the accessible Save control. Existing card/navigation snapshots were updated intentionally. Browser checks use isolated account/API fixtures to exercise save, reload, failed removal, retry, guest redirect, post-login saving, and desktop/mobile layout. They do not validate real account writes; a signed-in staging account check remains required after deployment.

Run the focused checks with the same Jest mapper above and include:

```
src/util/wishlist.test.js
src/ducks/Wishlist.duck.test.js
src/components/SaveListingButton/SaveListingButton.test.js
src/components/ListingCard/ListingCard.test.js
src/components/TopbarDesktop/TopbarDesktop.test.js
```

Visual refinements are deferred at the user's request. Time-of-day search, ranking, fee-inclusive comparison totals, and booking/messaging changes remain for later iterations.

## Listing-page amenities

Listing pages now reuse the common amenity headings from search, with alphabetical items inside each group. Only the listing's existing selected amenities appear, once each; an empty amenity section is hidden. The existing two-column desktop layout and single-column mobile layout are retained. No listing data or booking behaviour changes.

Validation: the two existing amenity-group tests and the full web/server build passed. Local browser checks with a fixture listing at 390px and 1440px confirmed selected amenities appear once, unselected amenities are absent, and the page has no horizontal overflow.

## Host amenities and review cards

The host amenity editor reuses the common and category-specific search groups. All groups still edit the same existing `amenities` array, with unique checkbox IDs. General amenities start expanded; category sections remain expandable. Existing hidden selections, custom amenities and equipment text are preserved on save. Editor styles are scoped to the editor instead of applying to all page backgrounds and disclosure controls. Common grouping also distinguishes wheelchair access, washrooms and handwashing facilities from room/chair layouts.

Search and saved-space cards now show the mean rating and review count from public `ofProvider` reviews for that listing. A verified empty result says “Not yet reviewed”. A failed or incomplete request leaves the metric absent. Reviews of customers and private reviews are never used. Loading starts when cards approach the viewport, with three requests active at most, a five-minute in-memory cache, and all review pages checked before displaying an average. To bound browser/API work, listings above 500 reviews do not show a summary; larger datasets should use a maintained backend aggregate rather than a partial average.

Host response times remain blocked: no trustworthy response-time field or service was found, and the available SDK/configuration does not provide access to all hosts' private message histories for aggregation. No estimated response statistic is displayed. “Most booked” ranking likewise requires a reliable aggregate booking-count source. Fee-inclusive comparison totals need a defined booking period; the existing booking breakdown remains in place.

Validation: 31 tests passed across seven suites, including pagination, rejected datasets, request concurrency, caching, amenity preservation, wishlist regressions and the card snapshot. Controlled desktop/mobile browser checks covered host saving/reloading (including hidden values and custom text), unique checkbox IDs, paginated rating averages, empty reviews, failed review requests and layout overflow. A read-only request to the real public review API succeeded. Account writes in browser checks used local fixtures, not real hosts' listings.

## Saved-space comparison

The Figma archive contains a “Flow and Annotations” page, including notes for “Add to Compare” selections and a side-by-side comparison of amenities and prices. Those notes are accessible even though the separately uploaded annotations PDF exceeded the transfer limit.

Saved spaces now have comparison checkboxes. Choose two or three available saved spaces and open a comparison table. The selection in the comparison URL survives reloads and supports browser Back. A comparison can only display listings in the signed-in account's loaded wishlist; arbitrary unsaved IDs and unavailable listings are excluded. Selecting, clearing or comparing spaces does not write to account data or change the saved list.

The table shows every listed hourly, daily, weekly and monthly rate separately, retaining its currency and amount. No conversion, ranking by incomparable rates, availability claim or estimated booking total is added. Amenity rows use the union of known selected amenities, grouped consistently with listing pages; “Not listed” is distinct from a claim that a facility is unavailable. Custom amenity and equipment text is included when present. Each title links to its listing, and public review summaries are reused. On mobile, the table scrolls inside a labelled keyboard-focusable region, with row labels remaining visible.

Validation: 35 tests passed across eight suites. Controlled browser checks at 390px and 1440px covered the selection limit, real booking units, amenity differences, URL reload/back navigation, clearing selection, exclusion of unsaved/unavailable spaces, no account writes and no page overflow. Existing browser checks for saving, retrying failed removal, guest login and post-login saving also passed. Full web/server builds passed; real signed-in staging use still needs a live check outside the network-restricted workspace.

## Removable applied-filter tags

The Figma annotations specify applied-filter chips above the results that users can tap to remove. Search results now show tags for keyword, dates, the active hourly/daily/weekly/monthly price range, individual categories and individual known amenities. Shared filter definitions and repeated values do not produce duplicate tags. Removing one category or amenity preserves all other values and the original `has_any`/`has_all` matching mode. Clear filters removes these search criteria, including custom price variants, while retaining the chosen location/map area and ordinary sorting. A changed filter resets pagination.

Filter-panel state and category context are synchronized with committed URL changes so reopening the panel or using browser Back/Forward does not restore stale selections. Keyboard focus moves to the next tag after removal and to the results heading after the last tag is cleared. Labels wrap on narrow screens. Invalid date/range data and unknown options are not presented as valid selections. No search endpoint, booking logic or listing data is changed.

Validation: 44 tests passed across nine suites and the full web/server build passed. Controlled browser checks at 390px and 1440px covered individual removal, preservation of location and other selections, daily price labels, pagination reset, Back/Forward, reopening the mobile panel, Clear filters, keyboard focus and long-label overflow. External map services remain unavailable in this cloud browser; map error UI there is not a successful live-map check.
