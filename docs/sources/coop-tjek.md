# Coop source: Tjek/eReklamblad

Coop keeps the source id `coop-tjek` for Snapshot compatibility. The adapter
is now shared with the configurable ICA and Hemköp fallback; see the
[Tjek/eReklamblad source note](tjek-ereklamblad.md) for the source-selection
configuration, shared request behavior, and terms risk.

## Current compatibility status

`coop-tjek` remains configured for Linköping. A complete anonymous refresh on
2026-11-17 discovered six configured Linköping Stores across eight Coop brand
IDs, fetched six Store-specific publications and their pages, and retrieved
293 individual Offers. All Store, brand, publication, and Offer associations
matched, and the complete normalized Coop Snapshot passed schema validation.
All requests returned HTTP 200 with at least one-second pacing. The refresh
used 314 requests (414 cumulative across the bounded investigation). Its
normalized Snapshot and summary are retained only under session state; they
are not checked in or published. The adapter still fails closed if the live
envelope differs from the supported shape.

Earlier live checks established the API response shapes and supplied a small
sanitized fixture sample; those samples did not cover all Linköping Stores.

The initial anonymous `businesses` request returned HTTP 401; an exact
user-authorized retry returned HTTP 200 with 188 global brands. A later
Store-specific `fronts` attempt returned HTTP 401; the user later authorized
one exact retry, which returned HTTP 200. The publication ID was
`NV_F04Kb` (2026-11-16 through 2026-11-22). The raw `fronts` envelope was not
saved verbatim, but the observed `{key, status, value: [...]}` envelope and
nested `business.publicId`/`publications` shape are captured in a sanitized
fixture. The key, status and category values are redacted/placeholders. The
adapter checks the front business ID against the Store's business ID and
flattens the nested publications. Publication pages were fetched from the
official viewer; the bulk `offers` request returned no records for known IDs,
while individual `offer` requests returned structured data. Request keys are
redacted.

The first bounded refresh found a blank Store name outside the configured
Location and failed closed; a sanitized structure-only diagnostic led to a
narrow parser adjustment that accepts blank names in unselected Store records
but still rejects a selected Store with no usable name. A subsequent complete
refresh validated all six Stores and 293 Offers. This one successful run does
not establish recurring availability, and it does not verify ICA or Hemköp
compatibility. Do not publish the checked-in demo Snapshot or switch sources
automatically.
Credentials, cookies and access workarounds were not used.

Requests are anonymous JSON `POST`s (plus the publication-viewer GET) with
credentials omitted and at least a one-second delay. The adapter does not
store a key, copy Coop's page-embedded subscription key, send cookies or
authorization, spoof a browser identity, rotate proxies, or retry access
denials. HTTP 401, 403, and 429 stop the Chain refresh immediately. Invalid
JSON, an unexpected schema, or inconsistent Store, brand, publication or
Offer association is reported as a failed or stale Chain.

## Terms and endpoint risk

Tjek's [API/SDK page](https://tjek.com/apis-and-sdks) says API access is
available only to customers, while the consumer endpoint used here is not
documented as a public developer API. Tjek's [terms](https://tjek.com/terms)
§§8.2–8.4 limit customer API use to agreed services and restrict systematic
fetching or reuse in certain circumstances; §11.1 reserves rights in service
content and data. Unauthenticated access does not establish permission to
scrape or reuse this data. There is no freshness SLA. Scheduled use therefore
has material access, availability, and content-rights risk; this is not a
legal determination. Obtain permission before recurring use where possible,
and never work around an access block.

Membership prices are normalized as ordinary Offers when valid source records
are available; no member-only flag is added. The separate `coop-flyer-pdf`
adapter is documented in
[`coop-pdf.md`](coop-pdf.md). Linköping currently selects `coop-tjek` in
`src/snapshot/locations.json`. The PDF source can be selected manually, but it
is experimental and should not replace the configured source without a
separate decision and validation against current real flyers. Source selection
is explicit and does not automatically retry Tjek after a PDF-source failure.

Automated tests replay secret-free fixtures and never contact Tjek. The
sanitized brand fixture is not a Store response. The Store and sampled Offer
fixtures cover only the explicitly checked Coop publication path, not all
Linköping Stores or every Offer.
