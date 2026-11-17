# Map: Weekly grocery Offers in one view (v1)

Labels: wayfinder:map

## Destination

A handoff-ready **v1 spec** for a mobile-first SPA showing this Offer Week's Offers from every ICA, Coop and Hemköp Store in Linköping in one filterable list. It covers the data sources, the Offer data model, the snapshot pipeline, the filter UX, the stack and the hosting, with nothing left to decide before building.

Spec: [Weekly grocery Offers in one view (v1)](issues/09-v1-spec.md) (`ready-for-agent`).

## Notes

- Domain: Swedish grocery retail. Vocabulary lives in `/GLOSSARY.md` (Offer, Offer Week, Chain, Store, Location); read it every session.
- Skills for every session: `grilling` + `domain-modeling` (default), `research` for research tickets, `prototype` for prototype tickets.
- Tracker: local markdown. Tickets are `issues/NN-<slug>.md` and research findings are `research/<slug>.md`.
- Standing preferences:
  - Personal/household tool; ToS risk is acceptable but should be noted.
  - Linköping is the only Location for now, but the design must allow more Locations later.
  - Member-only prices are ordinary Offers (assume membership in every Chain); no flag.
  - The SPA reads a pre-fetched snapshot produced by a scheduled job. It does not call the Chains' APIs live.
  - v1 filters: Chain, Store, category and free-text search, sorted by price or discount.
  - Mobile-first, Swedish UI, no login.
- Planning only: produce decisions, not the app.

## Decisions so far

- [How can we get this Offer Week's Offers for every ICA Store in Linköping?](issues/01-ica-offer-data-access.md): feasible without login. The store search (with an anonymous token) found 12 Stores, and each Store's public offers page carries its Offers in embedded HTML data, Stammis prices included. Undocumented and brittle, with some ToS risk.
- [How can we get this Offer Week's Offers for every Coop Store in Linköping?](issues/02-coop-offer-data-access.md): the store list is reachable. A key copied from Coop's own web page found 6 Stores. Each Store's Offers exist only as a flyer PDF, though, with no structured feed, so they would have to be parsed from the PDF. Coop's online-shop promotions API has structured data but returned nothing for a physical Linköping Store.
- [How can we get this Offer Week's Offers for every Hemköp Store in Linköping?](issues/03-hemkop-offer-data-access.md): the easiest Chain. Axfood endpoints that need no login give 7 Stores and paginated, structured Offer JSON per Store, Klubbpris included. Undocumented, and robots.txt disallows the offer URL pattern and asks for a 10-second crawl delay.
- [Do third-party sources already aggregate Linköping Offers for ICA, Coop and Hemköp?](issues/04-third-party-offer-sources.md): the research found current per-Store Offers and member prices. Tjek Store discovery is verified for one Coop brand (621 records, including five Linköping Stores); one authorized Store-specific `fronts` retry, publication-page read and sample individual Offer lookups succeeded. The observed nested `fronts` envelope is captured in a sanitized fixture, but full Store/Offer coverage remains unverified, so the configured source remains unchanged and the adapter fails closed on unsupported data. Neither aggregator has a licensed public API or a freshness SLA.

## Not yet specified

- **Category taxonomy**: whether the Chains' categories can be mapped onto one shared list, or whether category filtering degrades to search. Depends on what the sources expose.
- **Refresh cadence**: when each Chain publishes the next Offer Week, how often the snapshot job runs, and how Offers that are valid for less or more than a week are handled.
- **Adding a Location**: how Stores are discovered and configured, so a second Location only needs configuration.
- **Source breakage**: what the app shows when one Chain's source fails or changes shape, such as stale data or a partial snapshot.

## Out of scope

- Cross-Chain product matching (the same product compared between Chains). Ruled out for v1; could be a later effort.
- Shopping lists, favourites, notifications, price history and accounts. Ruled out for v1.
- Store discovery by geolocation. Locations are configured, not searched.
