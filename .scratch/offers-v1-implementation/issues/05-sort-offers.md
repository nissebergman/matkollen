# 05: Sort Offers by price or discount

**What to build:** Let a household member order the Offer list by effective price or by the size of the discount.

**Blocked by:** 01: Show Hemköp Offers end to end.

**Status:** resolved

- [x] Lowest-price sorting uses the effective per-item or per-unit price in ascending order, with Offers lacking a usable price last.
- [x] Largest-discount sorting uses the difference between regular and effective prices only when both use the same unit; Offers without a computable discount come last.
- [x] Ties are broken by Offer name, and the selected sort works with the currently visible list.
- [x] Whole-app tests cover both sort orders, ties and missing or incompatible values.

## Answer

Merged as `032adb7` into `integration/offers-v1`. Validation passed: `npm test` (23 tests), `npm run build`, and `git diff --check`. The build emitted two Rollup warnings about pure-comment annotations in Zod's `regexes.js` and `util.js`; both comments were removed from the bundle.
