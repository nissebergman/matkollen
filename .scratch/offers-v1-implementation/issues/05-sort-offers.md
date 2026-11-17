# 05: Sort Offers by price or discount

**What to build:** Let a household member order the Offer list by effective price or by the size of the discount.

**Blocked by:** 01: Show Hemköp Offers end to end.

**Status:** ready-for-agent

- [ ] Lowest-price sorting uses the effective per-item or per-unit price in ascending order, with Offers lacking a usable price last.
- [ ] Largest-discount sorting uses the difference between regular and effective prices only when both use the same unit; Offers without a computable discount come last.
- [ ] Ties are broken by Offer name, and the selected sort works with the currently visible list.
- [ ] Whole-app tests cover both sort orders, ties and missing or incompatible values.
