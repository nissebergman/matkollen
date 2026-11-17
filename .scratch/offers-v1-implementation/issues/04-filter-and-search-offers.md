# 04: Filter and search Offers

**What to build:** Let a household member narrow the shared Offer list using Chain, Store, category and text filters together.

**Blocked by:** 01: Show Hemköp Offers end to end.

**Status:** ready-for-agent

- [ ] Chain, Store and shared-category filters support multiple selections, with OR within each filter type and AND between types; no selection means all.
- [ ] The Store choices show only Stores from selected Chains, or all Stores when no Chain is selected.
- [ ] Search matches all entered words across name and brand, ignoring case, and combines with the other filters.
- [ ] Show the matching Offer count and a reset action; when nothing matches, show a Swedish empty state with a way to reset.
- [ ] Whole-app tests exercise filter combinations, Store narrowing, search, counts and reset using a multi-Chain Snapshot fixture.
