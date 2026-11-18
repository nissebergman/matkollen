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
A bounded ICA Tjek check verified one Store-specific publication and three
Offers, including Store association and date normalization. None contained a
member-price field. Hemköp was not probed. This limited sample does not
establish broader ICA coverage, member-price behavior, or Hemköp compatibility;
keep this ticket in progress.

**Status note (2026-11-18):** Three individual Offer lookups from pages 12–14
of Signalen publication `0xK8wQA9` were linked to ICA business `9cb4wA` and the
same publication; their dates fell within the current Offer Week, and none
contained a member-price field. The prior Offer IDs were not retained, so
distinctness from the earlier sample could not be confirmed. During Hemköp's
permitted window, the Lucullus Incito publication `0Z78Bmhd` returned 74
two-item Offer-ID tuples. The first three individual Offers all identified
Hemköp business `d9b6XA`, that publication, and dates 2026-11-16–22; the third
had `price: null` and `membershipPrice: 39.95`, after which lookups stopped.
The adapter now falls back to Incito Offer IDs only when Hemköp's
`paged-publications` request returns 404; Snapshot tests replay the sanitized
live Offer sample with synthetic Store discovery. Live Store discovery and
broader coverage remain unverified, as does ICA member pricing. Keep this
ticket in progress.

**Status note (2026-11-18, ICA configuration):** ICA is explicitly configured
to use Tjek instead of the denied first-party token endpoint. A bounded check
found 12 Linköping Stores across four ICA brands, each with a current
Store-specific publication. Full Offer coverage and ICA member-price mapping
are still unverified. Tjek's undocumented API and content-reuse risks remain;
there is no automatic source switch on a denial.

- [x] Each Chain can independently select Tjek through Location configuration.
- [x] Each fallback Chain discovers its Stores and produces Offers in the existing Snapshot contract through offline Snapshot-job fixtures.
- [ ] Verify live Store association, member prices, validity and representative mechanics for ICA and Hemköp.
- [x] Switching sources leaves the app unchanged, and failed or blocked sources are reported rather than bypassed.
- [x] Fixture-based tests cover configuration, failure paths and Incito 404 fallback without live requests; synthetic Store discovery remains distinct from the sanitized live Hemköp Offer sample.

## Answer

Merged Tjek fallback support into `integration/offers-v1` as `831a4a2`. Earlier
validation passed: `npm test` (8 files, 61 tests), `npm run build`, and
`git diff --check`. The build reported Rollup warnings about `@__PURE__`
comments in Zod dependencies. The Hemköp adapter now supports the observed
Incito Offer-ID route after a 404 from `paged-publications`; an offline
Snapshot-job test replays the sanitized live member-price Offer with synthetic
Store discovery. The bounded ICA sample still has no member-price field, and
Hemköp Store discovery is not live-verified, so the final live-validation
criterion remains open.
