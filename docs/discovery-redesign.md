# Search and discovery staging preview

First implementation of the March 2026 HotPatch presentation, based on the existing staging branch. The supplied amenities reorganisation and usability report inform the filter layout. This is an incremental preview, not the complete prototype.

## Included

- Responsive homepage with a keyword, Google location, and optional inclusive date-range search.
- Validation for unselected location text, incomplete dates, and reversed ranges.
- Dark navigation and higher-contrast search/filter controls.
- Keyword, dates, and price ahead of mobile category choices; categories collapsed initially.
- Collapsible amenity groups, with category-specific headings inspired by the supplied guide.
- Existing amenity keys and query semantics retained so current listings remain searchable. New facilities in the guide require host-data collection before becoming filters.
- Listing cards place the title/host before clearly separated pricing, preserving the actual hour/day/week/month unit. No ratings, availability, response times, booking totals, or fee estimates are invented.

## Remaining prototype work

Time-of-day search with listing-timezone handling; account-backed wishlists; booking-count/popularity aggregation and ranking; verified ratings/host response statistics; price totals including fees; the detailed map, listing and messaging flows. The annotations PDF and FigJam upload exceeded the workspace's 32 MiB transfer limit. The Figma archive, presentation, amenities documents, and usability report were received.

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
