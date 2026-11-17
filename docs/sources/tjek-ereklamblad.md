# Tjek/eReklamblad source

The shared adapter in `src/snapshot/tjek.ts` can be selected as an explicit
fallback for ICA or Hemköp by setting a Location's
`chains.<Chain>.source` to `tjek-ereklamblad`. Change either Chain independently
in `src/snapshot/locations.json`; the checked-in defaults remain their
first-party sources. An explicitly selected ICA or Hemköp fallback now attempts
the same Store-specific `fronts` → publication pages → individual `offer`
flow used by Coop. That shared code path is exercised with synthetic offline
fixtures only; no ICA or Hemköp response compatibility has been verified. Coop
uses the same adapter with the compatibility source id `coop-tjek` so existing
Coop Snapshots keep their identity. The earlier Coop sample is verified, but a
later bounded refresh stopped before a complete Snapshot; full live coverage
is not established.

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

Compatibility remains partial: a later bounded Coop-only refresh reached
only a subset of configured Stores, publications and Offers before the
cumulative request cap. The failed Snapshot did not publish partial Offers.
The exact live `fronts` body was not saved verbatim, but its response and
nested shape are represented in the sanitized fixture. Full Coop coverage,
ICA and Hemköp remain unverified. When either fallback is explicitly selected,
the adapter attempts the shared publication/Offer flow and fails closed on
unsupported responses or mismatched associations. Synthetic fixtures exercise
that path and Snapshot contract only; they are not evidence of live
compatibility. Keep the configured source unchanged; do not claim complete
live coverage or replace failures with synthetic-success data.

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
Hemköp Store/Offer fixtures remain synthetic examples.
Automated tests replay fixtures and never contact Tjek.
