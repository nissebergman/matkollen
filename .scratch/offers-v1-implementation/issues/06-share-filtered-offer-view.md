# 06: Share a filtered Offer view

**What to build:** Keep the household member's filters and sort order in the page address so a reload or shared link restores the same Offer view.

**Blocked by:** 04: Filter and search Offers; 05: Sort Offers by price or discount.

**Status:** resolved

- [x] Changes to Chain, Store, category, search and sort state update the address.
- [x] Opening or reloading a link restores the selected controls, matching Offers and order.
- [x] Resetting filters updates the address and restores the unfiltered list without unexpectedly changing the sort order.
- [x] Whole-app tests exercise a shared link, reload and reset.

## Answer

Merged as `79b4cb7` into `integration/offers-v1`. Validation passed: `npm test` (5 files, 47 tests), `npm run build`, and `git diff --check`. The build emitted two Rollup warnings about annotation comments in Zod's `regexes.js` and `util.js`; Rollup removed those comments.
