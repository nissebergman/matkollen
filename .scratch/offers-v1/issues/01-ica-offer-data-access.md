# How can we get this Offer Week's Offers for every ICA Store in Linköping?

Type: research
Status: resolved
Blocked by:
Parent: ../map.md

## Question

How can a scheduled job programmatically fetch (a) the list of ICA Stores in Linköping and (b) each Store's current Offers, including member (Stammis) prices? Cover:
- endpoints, whether they are official or unofficial, and whether they need authentication
- the fields available: name, brand, price, offer mechanic such as "2 för 30", comparison/unit price, validity dates, category, image
- per-Store versus national Offers
- rate limits, ToS or robots.txt concerns, and how stable the source looks

## Answer

ICA's first-party `storesearch/v1/searchbyquery` endpoint lists stores; the site obtains its required bearer token from `/e11/public-access-token`, which worked anonymously without a customer login.
Filtering the Linköping search results by exact `visitingCity` returned 12 Stores; IDs and account numbers are in the research file.
Fetch each Store's official `/erbjudanden/{slug}-{accountNumber}/` page; its public HTML contains `offers.weeklyOffers`, including visible Stammis prices (personal offers still require sign-in).
Observed fields include name, brand, mechanic/price text, regular and comparison prices, validity end, category, image references, and a Stammis trait.
Offers are presented per selected Store; no complete national feed was established. The unofficial mobile API is not recommended as a supported source.
The store endpoint has permissive CORS; offers-page CORS was not verified. No numeric rate limit or endpoint-specific usage permission was found; robots.txt does not disallow these pages.
Use low request rates and caching: store search is versioned but undocumented, while HTML offer extraction is brittle; recurring collection has ToS/stability risk even for personal use.

See [ICA offer data access research](../research/ica-offer-data-access.md) for endpoints, sample fields, Store IDs, and citations.
