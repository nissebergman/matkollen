# 08: Configure additional Locations and Store overrides

**What to build:** Let the maintainer add a Location and correct its discovered Stores through configuration, without changing application code.

**Blocked by:** 01: Show Hemköp Offers end to end.

**Status:** resolved

- [x] A Location config supplies its id, display name, Chain sources, exact-city discovery criteria and optional per-Chain Store pin and exclude lists.
- [x] The job discovers Stores rather than relying on a hard-coded Linköping list, applies overrides and produces a separate Snapshot for each configured Location.
- [x] The app loads the Location specified in the page address, defaulting to the only configured Location; it shows no Location picker while there is only one.
- [x] Fixture-based tests demonstrate city matching, pinning and excluding Stores, and producing and loading a second Location without code changes.

## Answer

Merged as `a505dc7` into `integration/offers-v1`. Validation passed: `npm test` (3 files, 31 tests), `npm run build`, and `git diff --check`. The build emitted two Rollup warnings about comment annotations in Zod's `regexes.js` and `util.js`; both comments were removed from the bundle.
