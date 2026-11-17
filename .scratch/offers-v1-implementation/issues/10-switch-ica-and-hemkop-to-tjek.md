# 10: Switch ICA and Hemköp to Tjek when needed

**What to build:** Let the maintainer switch either ICA or Hemköp from its first-party source to Tjek through configuration, without changing the app.

**Blocked by:** 02: Add ICA Offers.

**Status:** resolved

- [x] Each Chain can independently select its primary source or Tjek and produce Stores and Offers in the existing Snapshot contract.
- [x] Tjek Store association, member prices, validity and representative mechanics are preserved for both Chains; source identity and terms risks are recorded.
- [x] Switching a source leaves the app's display and filters working without application changes; failed or blocked sources are reported rather than bypassed.
- [x] Fixture-based tests cover both fallback Chains and switching back to a primary source without live requests.

## Answer

Merged Tjek fallback support into `integration/offers-v1` as `831a4a2`. Validation passed: `npm test` (8 files, 61 tests), `npm run build`, and `git diff --check`. The build reported Rollup warnings about `@__PURE__` comments in Zod dependencies. Tjek fixtures are synthetic, and live Tjek access remains unverified.
