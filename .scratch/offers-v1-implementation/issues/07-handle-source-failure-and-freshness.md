# 07: Keep Offers visible when a source fails

**What to build:** Preserve useful Offers and tell the household when a Chain's data is stale or missing, without letting one source failure take down the other Chains.

**Blocked by:** 01: Show Hemköp Offers end to end.

**Status:** resolved

- [x] A failed or invalid Chain refresh retains that Chain's still-valid previous Offers and marks it stale; without usable previous Offers it is failed, while successful Chains are published normally.
- [x] Each Chain records its source, status, last attempt, last success and a short error when relevant; the job reports an unsuccessful overall run when any Chain is stale or failed.
- [x] The app shows the Snapshot update time, identifies stale or failed Chains and their last successful update when known, and marks stale Offers as potentially outdated.
- [x] Expired Offers disappear even if the Snapshot is not refreshed, and future Offers remain hidden until their start date.
- [x] An unavailable Snapshot or unsupported schema version produces a clear Swedish error state rather than a misleading empty list.
- [x] Fixture-based job and whole-app tests cover a failed source with and without a previous Snapshot, malformed data, unaffected Chains, validity and error banners.

## Answer

Merged as `5c5f156` into `integration/offers-v1`. Validation passed: `npm test` (3 files, 38 tests), `npm run build`, and `git diff --check`. The build emitted two Rollup warnings about comment annotations in Zod's `util.js` and `regexes.js`; Rollup removed those comments from the bundle.
