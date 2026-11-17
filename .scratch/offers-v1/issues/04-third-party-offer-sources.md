# Do third-party sources already aggregate Linköping Offers for ICA, Coop and Hemköp?

Type: research
Status: resolved
Blocked by:
Parent: ../map.md

## Question

Do third-party aggregators or flyer platforms (for example Matpriskollen, eTilbudsavis/Tjek, Shopgun, or open-source scrapers on GitHub) expose this Offer Week's per-Store Offers for ICA, Coop and Hemköp in Linköping in a form a scheduled job can consume? For each one, give its coverage, fields, access method, freshness, and ToS concerns. Also note existing open-source projects whose code shows how each Chain's data is fetched today.

## Answer

- Yes—Matpriskollen and Tjek/eReklamblad exposed this Offer Week’s per-Store Offers in Linköping through fetchable JSON/publication endpoints; Shopgun redirected to eTilbudsavis.
- Matpriskollen’s 5 km search returned 9 ICA, 5 Coop and 7 Hemköp Stores, but does not establish full-city coverage.
- Tjek listed 12 ICA, 6 Coop and 7 Hemköp locations with current publications; its structured records include member-price fields.
- Neither source showed a freshness SLA or a clearly licensed public API, so scheduled reuse has material ToS/content-rights and endpoint-breakage risks.
- OSS examples show Matpriskollen, Tjek and all three Chain fetch methods; the chain-specific repo uses Uppsala Stores, and the ICA example now requires a browser upload.
- See [third-party offer source research](../research/third-party-offer-sources.md).
