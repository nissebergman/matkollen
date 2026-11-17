# 03: Add Coop Offers

**What to build:** Show current Coop Offers from every discovered Linköping Store alongside the other Chains, using Tjek as Coop's primary source.

**Blocked by:** 01: Show Hemköp Offers end to end.

**Status:** resolved

**Historical status note (earlier on 2026-11-17):** Store discovery was verified for Coop brand
`63eeoD`, including five Linköping Stores. One user-authorized Store-specific
`fronts` retry returned publication `NV_F04Kb`, valid 2026-11-16 through
2026-11-22. Its pages exposed Offer IDs and individual lookups returned
structured Offers; three sanitized examples now exercise the adapter.
The observed `{key, status, value: [{business, publications}]}` envelope is
now represented in a sanitized fixture, and the adapter verifies each front's
business ID against the Store's associated Coop brand ID. However, only one
of five Stores and a small sample of Offers had been checked; full Store/Offer
coverage was still unverified at that point.

**Update (2026-11-17):** A complete anonymous Coop refresh subsequently
validated all six configured Linköping Stores, six publications and 293
individual Offers. Store, publication and Offer associations matched; all
Offers had valid date ranges, categories, mechanics and Store associations.
One Offer had no numeric price and retained its mechanic without inventing
one. A previously verified live sample confirms structured member-price
precedence. The normalized Snapshot remains under session state and has not
been published. This update supersedes the earlier blocked status note.

- [x] Discover and filter Coop Store records for the configured city across all discovered Coop brands.
- [x] Verify Store associations and complete publication/Offer coverage for every discovered Coop Store.
- [x] Verify live member-price precedence, mechanics, validity, categories and product details in the shared Snapshot.
- [x] Confirm Coop Offers use the ordinary Offer contract in the app and future/expired Offers follow the validity rule.
- [x] Requests are sequential and low-rate; blocked or malformed responses fail closed, and Tjek's access and terms risks are documented.
- [x] Fixture-based job and whole-app tests run without live requests or stored credentials; sanitized Coop Offer fixtures cover only one verified publication sample.

## Answer

Merged as `19cc614` into `integration/offers-v1`. Validation passed: `npm test` (6 files, 52 tests), `npm run build`, and `git diff --check`. The build emitted two Rollup warnings about annotation comments in Zod's `regexes.js` and `util.js`; Rollup removed those comments.
