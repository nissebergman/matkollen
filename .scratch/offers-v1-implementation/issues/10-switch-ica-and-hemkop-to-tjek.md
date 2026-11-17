# 10: Switch ICA and Hemköp to Tjek when needed

**What to build:** Let the maintainer switch either ICA or Hemköp from its first-party source to Tjek through configuration, without changing the app.

**Blocked by:** 02: Add ICA Offers.

**Status:** in_progress

**Status note (2026-11-17):** Coop is now live-verified, but this ticket has
not yet exhausted its ICA/Hemköp checks. The previous anonymous ICA request
returned HTTP 403 and was not retried; Hemköp was outside its observed access
window. No access denial will be bypassed. Further live checks need explicit
scope and, for Hemköp, the documented window.

**Status note (2026-11-17):** The Tjek adapter can be selected independently by
Chain and now implements a partially verified Coop publication/Offer path.
That evidence does not establish ICA or Hemköp compatibility: no live
ICA/Hemköp Store-specific publication or structured Offer response has been
verified. Keep this ticket blocked.

- [x] Each Chain can independently select Tjek through Location configuration.
- [ ] Each fallback Chain discovers its Stores and produces Offers in the existing Snapshot contract.
- [ ] Verify live Store association, member prices, validity and representative mechanics for ICA and Hemköp.
- [x] Switching sources leaves the app unchanged, and failed or blocked sources are reported rather than bypassed.
- [x] Fixture-based tests cover configuration and failure paths without live requests; synthetic Offers do not verify Tjek compatibility.

## Answer

Merged Tjek fallback support into `integration/offers-v1` as `831a4a2`. Earlier
validation passed: `npm test` (8 files, 61 tests), `npm run build`, and
`git diff --check`. The build reported Rollup warnings about `@__PURE__`
comments in Zod dependencies. The new Coop sample does not change this
ticket's blocked status: ICA and Hemköp Offer behavior remains unverified.
