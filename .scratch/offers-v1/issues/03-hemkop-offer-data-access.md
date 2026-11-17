# How can we get this Offer Week's Offers for every Hemköp Store in Linköping?

Type: research
Status: resolved
Blocked by:
Parent: ../map.md

## Question

How can a scheduled job programmatically fetch (a) the list of Hemköp Stores in Linköping and (b) each Store's current Offers, including Hemköp Klubb prices? Hemköp is part of Axfood, so check whether its platform is shared with Willys. Cover:
- endpoints, whether they are official or unofficial, and whether they need authentication
- the fields available: name, brand, price, offer mechanic, comparison/unit price, validity dates, category, image
- per-Store versus national Offers
- rate limits, ToS or robots.txt concerns, and how stable the source looks

## Answer

- Unauthenticated first-party requests to `/axfood/rest/store` provide store records; filtering `address.town` gives seven Linköping Stores: 4552, 4701, 4193, 4277, 4225, 4738, and 4757.
- Fetch each Store's offers from `/search/campaigns/offline?q={storeId}&type=PERSONAL_GENERAL&page={page}&size=30`; follow `pagination`.
- Offer JSON includes product name/brand, price, mechanics, comparison price, dates, category and image; `LOYALTY`/`Klubbpris` values are present without login.
- GET responses included `Access-Control-Allow-Origin: *`; tested OPTIONS preflight returned 403. A scheduled server-side job does not depend on browser CORS.
- The endpoint is undocumented and unversioned; no rate-limit contract was found. Hemköp `robots.txt` explicitly disallows the offer URL's `?q=` pattern and specifies a 10-second crawl delay.
- Results are Store-keyed, but the response does not establish whether an Offer is Store-specific or national; Hemköp cautions e-commerce prices may differ from in-store prices.
- This is technically feasible but has material robots/terms and stability risks for recurring use. See the [detailed research](../research/hemkop-offer-data-access.md).
