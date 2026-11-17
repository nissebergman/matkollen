# 04: Filter and search Offers

**What to build:** Let a household member narrow the shared Offer list using Chain, Store, category and text filters together.

**Blocked by:** 01: Show Hemköp Offers end to end.

**Status:** resolved

- [x] Chain, Store and shared-category filters support multiple selections, with OR within each filter type and AND between types; no selection means all.
- [x] The Store choices show only Stores from selected Chains, or all Stores when no Chain is selected.
- [x] Search matches all entered words across name and brand, ignoring case, and combines with the other filters.
- [x] Show the matching Offer count and a reset action; when nothing matches, show a Swedish empty state with a way to reset.
- [x] Whole-app tests exercise filter combinations, Store narrowing, search, counts and reset using a multi-Chain Snapshot fixture.

**Resolution:** Merged into `integration/offers-v1` in merge commit `a25420b`. Validation passed: `npm test` (3 files, 28 tests), `npm run build`, and `git diff --check`. The build emitted two Rollup warnings for comments in the installed Zod dependency; it completed successfully.
