# 05: Sort Offers by price or discount

**What to build:** Let a household member order the Offer list by effective price or by the size of the discount.

**Blocked by:** 01: Show Hemköp Offers end to end.

**Status:** resolved

- [x] Lowest-price sorting uses the purchase price shown on the card, falling back to the numeric unit price only when no purchase price exists; missing prices come last.
- [x] Largest-discount sorting uses the discount in SEK (`regularPrice − unitPrice`, per the v1 spec's Snapshot contract) only when both use the same unit; Offers without a computable discount come last.
- [x] Ties are broken by Offer name, and the selected sort works with the currently visible list.
- [x] Whole-app tests cover both sort orders, ties and missing or incompatible values.

## Answer

Merged as `032adb7` into `integration/offers-v1`. Validation passed: `npm test` (23 tests), `npm run build`, and `git diff --check`. The build emitted two Rollup warnings about pure-comment annotations in Zod's `regexes.js` and `util.js`; both comments were removed from the bundle.

## Comments

2026-11-18: Corrected the later user-reported mismatch between the displayed
purchase price and the previous comparison-unit-price ordering. A failing
whole-app regression reproduced 25 kr appearing before 6 kr. Sorting now shares
the card's purchase-price accessor. Equivalent Offers are aggregated after
Store filtering; discount sorting uses the smallest reduction available across
all listed Stores, and differing regular prices are displayed as a range.

2026-11-18: Code review found that this ticket's percentage-based discount
contradicted the v1 spec ("Discount is `regularPrice − unitPrice` in SEK").
The user chose the spec. Discount is now computed, shown ("Spara 12,50 kr",
with `/kg` or `/l` for unit-priced Offers) and sorted ("Största rabatt (kr)")
in SEK. Aggregated Offers still use the smallest saving across listed Stores.
