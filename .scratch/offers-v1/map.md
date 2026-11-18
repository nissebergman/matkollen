# Map: Weekly grocery Offers in one view (v1)

Labels: wayfinder:map

## Destination

A delivered, mobile-first SPA showing this Offer Week's Offers from ICA, Coop
and Hemköp Stores in Linköping in one filterable list. Planning questions 05–08
are resolved by the implementation; [the v1 spec](issues/09-v1-spec.md) records
the current behavior and source limitations.

Production: https://nissebergman.github.io/matkollen/

## Notes

- Domain: Swedish grocery retail. Vocabulary lives in `/GLOSSARY.md` (Offer, Offer Week, Chain, Store, Location); read it every session.
- Skills for every session: `grilling` + `domain-modeling` (default), `research` for research tickets, `prototype` for prototype tickets.
- Tracker: local markdown. Planning tickets are `issues/NN-<slug>.md`; delivery/source follow-ups are in `.scratch/offers-v1-implementation/issues/`.
- Standing preferences:
  - Personal/household tool; ToS risk is acceptable but should be noted.
  - Linköping is the only Location for now, but the design must allow more Locations later.
  - Member-only prices are ordinary Offers (assume membership in every Chain); no flag.
  - The SPA reads a pre-fetched snapshot produced by a scheduled job. It does not call the Chains' APIs live.
  - v1 filters: Chain, Store, category and free-text search, sorted by price or discount.
  - Mobile-first, Swedish UI, no login.
- The planning phase is complete. Keep this map and its linked decisions aligned with the running implementation.

## Decisions so far

- [How can we get this Offer Week's Offers for every ICA Store in Linköping?](issues/01-ica-offer-data-access.md): feasible without login. The store search (with an anonymous token) found 12 Stores, and each Store's public offers page carries its Offers in embedded HTML data, Stammis prices included. Undocumented and brittle, with some ToS risk.
- [How can we get this Offer Week's Offers for every Coop Store in Linköping?](issues/02-coop-offer-data-access.md): the store list is reachable. A key copied from Coop's own web page found 6 Stores. Each Store's Offers exist only as a flyer PDF, though, with no structured feed, so they would have to be parsed from the PDF. Coop's online-shop promotions API has structured data but returned nothing for a physical Linköping Store.
- [How can we get this Offer Week's Offers for every Hemköp Store in Linköping?](issues/03-hemkop-offer-data-access.md): the easiest Chain. Axfood endpoints that need no login give 7 Stores and paginated, structured Offer JSON per Store, Klubbpris included. Undocumented, and robots.txt disallows the offer URL pattern and asks for a 10-second crawl delay.
- [Do third-party sources already aggregate Linköping Offers for ICA, Coop and Hemköp?](issues/04-third-party-offer-sources.md): Tjek is configured for ICA and Coop; Hemköp uses Axfood first-party with a bounded Tjek fallback. The adapter validates Store/publication relationships and fails closed on unsupported data. Full rights, freshness and fallback coverage remain limitations.
- Tickets [05](issues/05-choose-source-per-chain.md) through [08](issues/08-filter-view-prototype.md) are resolved by the production source configuration, Snapshot contract, GitHub Pages pipeline and responsive flyer UI.
- Ticket [09](issues/09-v1-spec.md) is resolved: the spec is implemented. Its remaining source validation limits are tracked in [ticket 10](../offers-v1-implementation/issues/10-switch-ica-and-hemkop-to-tjek.md) and [ticket 11](../offers-v1-implementation/issues/11-switch-coop-to-flyer-pdfs.md).

## Not yet specified

- **Source validation:** live ICA Tjek records normalize member prices correctly, but carry no regular price or text mechanics (zero placeholder prices are now left empty); multi-buy mechanics and Hemköp Tjek Store discovery remain unverified (#10). The Coop PDF adapter discovers all six Linköping Stores live but fails closed on the real flyer (#11).
- **Source rights/freshness:** Tjek has no licensed public API or freshness SLA; risks are documented alongside the source adapters.
- **Location scale:** Linköping is the only configured Location; multi-Location behavior is designed but has not been validated with a second live Location.

## Out of scope

- Cross-Chain product matching (the same product compared between Chains). Ruled out for v1; could be a later effort.
- Shopping lists, favourites, notifications, price history and accounts. Ruled out for v1.
- Store discovery by geolocation. Locations are configured, not searched.
