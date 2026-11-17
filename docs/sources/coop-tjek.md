# Coop source: Tjek/eReklamblad

Coop keeps the source id `coop-tjek` for Snapshot compatibility. The adapter
is now shared with the configurable ICA and Hemköp fallback; see the
[Tjek/eReklamblad source note](tjek-ereklamblad.md) for the source-selection
configuration, shared request behavior, and terms risk.

The Coop adapter uses Tjek/eReklamblad's undocumented consumer endpoint at
`https://ereklamblad.se/`. It requests the business list and then paginated,
Store-scoped Offers using each business's public ID. Store discovery requires
an exact city match to the configured Location. Offers are joined back to the
queried business before they are normalized, so a response that does not
identify its Coop Store fails instead of being assigned by guesswork.

The research notes did not preserve raw Tjek business responses. The adapter
expects an exact city in a business city/address field and fails discovery if
none is present; it does not infer a Store's city from its name. Fixture
metadata exercises this matching behavior but is not live-schema verification.

Requests are anonymous JSON `POST`s with credentials omitted. The adapter does
not store a key, copy Coop's page-embedded subscription key, send cookies or
authorization, spoof a browser identity, rotate proxies, or retry access
denials. Requests are sequential with a one-second delay; HTTP 403 and 429 stop
the Chain refresh immediately. Invalid JSON, an unexpected schema, or
inconsistent Store association is reported as a failed or stale Chain.

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

Membership prices are normalized as ordinary Offers; no member-only flag is
added. The separate `coop-flyer-pdf` adapter is documented in
[`coop-pdf.md`](coop-pdf.md). Linköping currently selects that source in
`src/snapshot/locations.json`; set the Coop `source` back to `coop-tjek` to
select this adapter. Source selection is explicit and does not automatically
retry Tjek after a PDF-source failure.

Automated tests replay the secret-free fixtures in `tests/fixtures/coop/` and
never contact Tjek. Their representative data is not proof that the
undocumented endpoint still has the same response shape.
