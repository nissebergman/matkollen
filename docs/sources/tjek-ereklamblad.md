# Tjek/eReklamblad source

The shared adapter in `src/snapshot/tjek.ts` can be selected as an explicit
fallback for ICA or Hemköp by setting a Location's
`chains.<Chain>.source` to `tjek-ereklamblad`. Change either Chain independently
in `src/snapshot/locations.json`; Linköping now explicitly selects Tjek for ICA
and the first-party source for Hemköp. An explicitly selected ICA or Hemköp
fallback attempts the same Store-specific `fronts` → publication pages → individual `offer`
flow used by Coop. For Hemköp, a 404 from `paged-publications` falls back to
the observed Incito `/offer-ids` route; authorization or rate-limit denials
still stop the refresh. A bounded live ICA check on 2026-11-17 verified one
Store-specific publication and three Offers, including Store association and
date normalization; none contained a member-price field. Coop uses the same
adapter with the compatibility source id `coop-tjek` so existing Coop
Snapshots keep their identity. A complete Coop refresh is documented below,
but a later bounded attempt stopped before a complete Snapshot.

A follow-up ICA check on 2026-11-18 looked up three Offers from pages 12–14 of
Signalen publication `0xK8wQA9`. All three linked to ICA business `9cb4wA` and
that publication, and their validity fell within 2026-11-16 through 2026-11-22.
None contained a member-price field. The previous sample's Offer IDs were not
retained, so distinctness from that sample could not be confirmed.

During Hemköp's permitted window on 2026-11-18, the Lucullus Incito
publication `0Z78Bmhd` returned 74 two-item Offer-ID tuples. Only the first
three individual Offers were requested. All three identified Hemköp business
`d9b6XA`, publication `0Z78Bmhd`, and validity 2026-11-16 through 2026-11-22.
The third was “Ryggfilé 3-pack” with `price: null` and `membershipPrice:
39.95`; no further Offer lookups were made. Its sanitized record is replayed
through the Snapshot job with synthetic Store discovery. This verifies the
observed Offer shape and member-price mapping, not live Store discovery or
broader Hemköp coverage.

## Live compatibility status

The adapter now treats `businesses` as a brand directory, then queries
`stores` with `{businessId, pagination: {offset, limit: 3000}}`, validates
Store records from `value.data` in the `{key, status, value: {data: [...]}}`
response envelope, and applies the configured city and Store overrides.
`name` is parsed as a string in broad Store lists; selected Stores must have a
nonblank name before publication lookup. An anonymous `businesses` response
contained 188 global brands; the Coop entry
was `publicId: "63eeoD", name: "Coop"`, not a local Store. An authorized
anonymous `stores` request for that brand returned 621 records, including
five Linköping Coop Stores. The sanitized one-Store excerpt is
`tests/fixtures/tjek/stores-coop-63eeoD.json`. This verifies discovery for one
Coop brand only; it does not verify response coverage for every Chain.

The current official browser bundle also documents `store` with `{storeId}`
and `fronts` with `{businessIds, localBusinessIds, coordinates}`. A prior
brand-level `fronts` request with `hideInactive: true` returned a current
publication labelled “Coop Järntorget”, not a Linköping Store. The publication
viewer exposes flyer pages with Offer hotspots/IDs. The official client also
uses individual `offer` lookups with `{publicId}`; the bulk `offers` action
uses `{offerIds, pagination, sources: ["publication"]}`.
The Hemköp Lucullus Incito publication exposes Offer IDs at
`/api/incito-publications/{publicationId}/offer-ids`; its observed response
contains two-item tuples. The adapter uses this route only when a Hemköp
`paged-publications` request returns HTTP 404.

The first anonymous `businesses` request returned HTTP 401; an exact retry
authorized by the user returned HTTP 200 with 188 brands. One authorized
`stores` request for Coop brand `63eeoD` returned 621 records, including five
Linköping Stores. A sanitized one-Store excerpt is checked in at
`tests/fixtures/tjek/stores-coop-63eeoD.json`.

An earlier Store-specific `fronts` attempt returned HTTP 401. The user later
authorized one exact retry, which returned HTTP 200 with the current
publication `NV_F04Kb`, labelled “Coop Drottninggatan Linköping” and valid
2026-11-16 through 2026-11-22. The raw `fronts` response envelope was not
saved verbatim, but its observed top-level `{key, status, value}` envelope and
nested `value: [{category, business, publications}]` shape are now captured
in a sanitized fixture. The key, status and category values are redacted or
placeholders. Each front's `business.publicId` is checked against the Coop
business ID associated with the Store before its nested publications are
flattened. The adapter fails closed on unsupported shapes or mismatched
business IDs.

The publication's `validUntil` was `2026-11-22T23:00:00.000Z`, an exclusive
midnight boundary in Stockholm. The adapter normalizes that to the last
validity day, 2026-11-22, rather than treating November 23 as active.

An anonymous GET to
`/api/paged-publications/NV_F04Kb/pages?from=1&to=20` returned page hotspots
with Offer IDs. A bulk `offers` lookup for known hotspot IDs returned an empty
data array, so the adapter uses the observed individual `offer` action
instead. The individual action returned structured records identifying both
`businessPublicId: "63eeoD"` and `publicationPublicId: "NV_F04Kb"`. One
verified record was “Färsk fläskfilé” at 79.9 with base unit kilogram; three
additional sanitized Offer records are replayed from fixtures for “Färdigkokt
julskinka”, “Snacktomater” and “Kexchoklad”. Request keys are redacted.

The adapter now validates the Offer ID, brand ID and publication ID, filters
publication and Offer validity, and maps the sampled unit prices, package
sizes, limits and categories. It makes anonymous sequential requests with at
least a one-second delay, including the publication viewer GET, and does not
use the empty bulk-Offer result as a success fallback. A missing current
publication, a current publication without hotspot IDs, or a refresh with no
current Offers fails closed. Automated end-to-end tests replay sanitized
fixtures and never contact Tjek.

Compatibility remains partial. A complete Coop refresh on 2026-11-17 verified
all six configured Linköping Stores, six publications and 293 Offers; a later
bounded Coop-only attempt reached only a subset before the cumulative request
cap, so one complete refresh does not establish ongoing completeness. Earlier
ICA samples verified Store/publication association and date normalization but
did not include member-price fields. On 2026-11-18 a bounded ICA discovery
check found 12 Linköping Stores across four ICA brands, each with a current
Store-specific publication, and a subsequent full refresh published 787 ICA
Offers across those Stores. A separate bounded check made 50 anonymous,
sequential requests at least 1.25 seconds apart: all 12 publication labels
matched their queried Store names, and 21 individual Offer samples across all
12 Stores matched their business/publication associations and had validity in
the current Offer Week. Two samples included a member-price field, and all 21
included at least one Offer text/mechanic field; none matched a simple
`N för M` text check. No raw Offer records were retained. This verifies only
the sampled fields, not broad coverage, mechanic prevalence, or normalization
of those particular live records. The Hemköp sample verified three Offers and
one member price, but its Store discovery was not live-validated; no Hemköp
Tjek requests were made during this check because the documented visit window
was closed. The exact live `fronts` body was not saved verbatim, but its
response and nested shape are represented in the sanitized fixture. When an
ICA or Hemköp fallback is explicitly selected, the adapter attempts the shared
publication/Offer flow and fails closed on unsupported responses or mismatched
associations. Offline fixtures exercise Store discovery and Snapshot
normalization; only the separate sanitized Hemköp Offer sample reflects live
Offer data. Do not claim complete live coverage or replace failures with
synthetic-success data.

The adapter sends anonymous JSON `POST` requests to `https://ereklamblad.se/`
with a base64-encoded command, plus a GET to the observed publication-pages
route. Runtime requests are sequential with at least a one-second delay. HTTP
401, 403, and 429 stop the Chain refresh without retries or a source switch.
Invalid response data or Store, brand, publication, or Offer associations are
reported as a failed or stale Chain.

Requests omit credentials and authorization. Do not copy subscription keys,
send cookies, spoof a browser, rotate proxies, or work around an access denial.

## Terms and endpoint risk

Tjek's [API/SDK page](https://tjek.com/apis-and-sdks) says API access is
available only to customers, while the consumer endpoint used here is not
documented as a public developer API. Tjek's [terms](https://tjek.com/terms)
§§8.2–8.4 limit customer API use to agreed services and restrict systematic
fetching or reuse in certain circumstances; §11.1 reserves rights in service
content and data. Unauthenticated access does not establish permission to
scrape or reuse this data. There is no freshness SLA. Scheduled use therefore
has material access, availability, and content-rights risk; this is not a
legal determination. Obtain permission before recurring use where possible.

`tests/fixtures/tjek/businesses-coop-brand.json` is a sanitized excerpt of the
observed Coop brand entry. `stores-coop-63eeoD.json` contains one sanitized
Store row from the authorized 621-record response. The publication and
individual-Offer fixtures preserve sanitized samples; the `fronts` shape is
observed but its key/status/category values are not retained. The ICA and
Hemköp Store-discovery fixtures remain synthetic examples;
`hemkop-incito-offer-2026-11-18.json` is a sanitized live Offer sample.
Automated tests replay fixtures and never contact Tjek.
