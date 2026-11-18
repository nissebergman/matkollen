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

**Status note (2026-11-18, full refresh):** A subsequent production refresh
published 787 ICA Offers across all 12 discovered Stores, with each Store
represented. The adapter validated Store, business and publication associations
and validity. ICA member-price behavior and Hemköp's live Tjek Store discovery
remain unverified, so this ticket remains in progress.

**Status note (2026-11-18, bounded ICA Offer validation):** A 50-request
anonymous check, with at least 1.25 seconds between requests and no retries,
covered four ICA businesses and all 12 Linköping Stores. All 12 Stores had a
current publication whose label matched the queried Store. Twenty-one
individual Offer lookups across those Stores matched the expected business and
publication and had validity in the current Offer Week; two included a
member-price field, and all 21 included at least one Offer text/mechanic field.
None matched a simple `N för M` text check. No raw Offer records were retained,
so this does not establish broad coverage, mechanic prevalence, or normalization
of those specific live records. No Hemköp Tjek requests were made because its
documented visit window was closed. Keep the remaining live-validation
criterion open.

**Status note (2026-11-18, bounded ICA normalization check):** The production
Tjek adapter ran end to end against live data, limited by a request-budget
wrapper to three Linköping Stores and 12 Offer IDs per publication (47
requests, no retries, adapter delays unchanged). ICA finished `ok` with 36
Offers. Unlike earlier samples, the raw Offer records were retained (outside
the repository) and compared with the normalized output:
- 11 of 36 records had `membershipPrice` and no `price`; each normalized to the
  member price as the Offer price, with `unitPrice` and `priceUnit` taken from
  the source. Member pricing for ICA via Tjek now works on live records.
- No record carried text mechanics (`offerText`, `priceText`, member-price
  text) or a multi-buy, so `mechanicText` is always generated from the numeric
  price (for example "33 kr", "20 kr/kg"). Multi-buy mechanics remain
  unverified live.
- No record carried `regularPrice`, `ordinaryPrice` or `originalPrice`, so ICA
  Offers via Tjek never show a discount.
- One record (`LJUSSLINGOR`) had only `unitPrice: 0`. The adapter normalized
  it to price 0 and "0 kr/st"; the app hides zero-price Offers, so no false
  price is shown, but the Offer is silently dropped. This conflicted with
  "Parsing must never invent a price". Fixed: the adapter now treats a zero
  Tjek amount as a placeholder, leaves the numeric price fields empty and
  shows "Se reklambladet" when nothing else is displayable; a Snapshot-job
  regression covers it.
Hemköp was not probed: its documented visit window (04:00–08:45 UTC) was
closed. Keep the live-validation criterion open for Hemköp Store discovery and
multi-buy mechanics.

- [x] Each Chain can independently select Tjek through Location configuration.
- [x] Each fallback Chain discovers its Stores and produces Offers in the existing Snapshot contract through offline Snapshot-job fixtures.
- [x] A bounded ICA sample verifies current Store-labeled publications and 21 Offer associations/validity; two samples included a member-price field.
- [ ] Verify Hemköp live Store discovery and broader member-price/mechanic compatibility for both Chains.
- [x] Switching sources leaves the app unchanged, and failed or blocked sources are reported rather than bypassed.
- [x] Fixture-based tests cover configuration, failure paths and Incito 404 fallback without live requests; synthetic Store discovery remains distinct from the sanitized live Hemköp Offer sample.

## Answer

Merged Tjek fallback support into `integration/offers-v1` as `831a4a2`. Earlier
validation passed: `npm test` (8 files, 61 tests), `npm run build`, and
`git diff --check`. The build reported Rollup warnings about `@__PURE__`
comments in Zod dependencies. The Hemköp adapter now supports the observed
Incito Offer-ID route after a 404 from `paged-publications`; an offline
Snapshot-job test replays the sanitized live member-price Offer with synthetic
Store discovery. The earlier bounded ICA sample had no member-price field; a
later 50-request sample found fields in 2 of 21 Offer lookups but did not retain
the raw Offer records or verify their normalization. Hemköp Store discovery is
not live-verified, so the final live-validation criterion remains open.
