# How can we get this Offer Week's Offers for every Coop Store in Linköping?

Type: research
Status: resolved
Blocked by:
Parent: ../map.md

## Question

How can a scheduled job programmatically fetch (a) the list of Coop Stores in Linköping (all formats: Stora Coop, Coop, Coop Konsum, and so on) and (b) each Store's current Offers, including member prices? Cover:
- endpoints, whether they are official or unofficial, and whether they need authentication or API keys
- the fields available: name, brand, price, offer mechanic, comparison/unit price, validity dates, category, image
- per-Store versus national Offers
- rate limits, ToS or robots.txt concerns, and how stable the source looks

## Answer

- Use Coop's first-party store-map API, then request each store's details by its `ledgerAccountNumber`; the detail response includes current flyer metadata.
- A Coop page-configured `Ocp-Apim-Subscription-Key` is required (no key returned 401); requests worked without a member login. This is not a published third-party API agreement.
- The live map returned six Linköping Coop stores. Each store has its own flyer PDF; no national physical-store product feed was found.
- Physical-store product Offers are not structured in the detail JSON; parse the store's flyer/page, including member prices.
- A separate online-promotions API returns structured product/promotion fields, including `medMeraRequired`, but returned zero results for Linköping physical store `2303`.
- CORS preflights allowed `https://www.coop.se` but not `http://localhost:5173`; the scheduled server-side job avoids browser CORS.
- No published rate limit or API-use permission was found; Coop's terms and the undocumented, versioned endpoints leave ToS and stability risk.

Full findings: [Coop offer-data access research](../research/coop-offer-data-access.md).
