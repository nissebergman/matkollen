# Do third-party sources already aggregate Linköping Offers for ICA, Coop and Hemköp?

Type: research
Status: resolved
Implementation status: partial (complete Coop refresh and bounded ICA sample; Hemköp unprobed; broader compatibility incomplete)
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

## Current Tjek adapter status (2026-11-17)

The research finding remains resolved, but it does not establish a stable
runtime contract. The adapter now queries the documented `stores` action and
validates Store records. An authorized anonymous request for Coop brand
`63eeoD` returned 621 records, including five Linköping Coop Stores. The
sanitized fixture `stores-coop-63eeoD.json` retains one Store row.

The first anonymous `businesses` request returned HTTP 401; an exact
user-authorized retry returned HTTP 200 with 188 global brand entries. An
authorized exact retry of a Store-specific `fronts` request returned the
current publication `NV_F04Kb`, labelled “Coop Drottninggatan Linköping” and
valid 2026-11-16 through 2026-11-22. Its publication pages exposed Offer
hotspots. A bulk `offers` lookup returned an empty data array for known IDs,
but individual `offer` lookups returned structured records identifying both
the Coop brand and publication. Three sanitized individual Offer fixtures
now cover sample normalization.

The observed `{key, status, value: [{category, business, publications}]}` shape
is now represented in a sanitized fixture; the key, status and category
values are redacted/placeholders. The adapter verifies each front's business
ID against the brand ID associated with its Store before flattening nested
publications. A complete Coop refresh subsequently validated all six
configured Linköping Stores, six publications and 293 Offers; the saved
sanitized fixture still captures one Store/publication sample. A bounded ICA
check verified one Store-specific publication and three Offers with Store
association and date normalization, but none contained a member-price field.
Hemköp was not probed. Broader ICA coverage/member-price behavior and Hemköp
compatibility remain unverified. The adapter fails closed on unsupported or
inconsistent responses. Keep the existing source configuration unchanged;
Tjek compatibility remains partial rather than complete across all Chains.
