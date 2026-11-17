# Tjek/eReklamblad source

The shared adapter in `src/snapshot/tjek.ts` can supply ICA and Hemköp when a
Location's `chains.<Chain>.source` is set to `tjek-ereklamblad`. Change either
Chain independently in `src/snapshot/locations.json`; the checked-in defaults
remain their first-party sources. Coop uses the same adapter with the
compatibility source id `coop-tjek` so existing Coop Snapshots keep their
identity. The app consumes the existing Snapshot contract and does not need to
change when a source is switched.

The adapter sends anonymous JSON `POST` requests to `https://ereklamblad.se/`
for a business list and then paginated, Store-scoped Offers. The command is
base64-encoded in the request body. Store discovery matches the configured
`storeDiscovery.exactCity` field and value, supports the configured pin and
exclude lists, and verifies each Offer's business association before adding it
to a Store. It retains Offer validity dates, including future start dates, for
the app to hide until they become valid.

Requests omit credentials and authorization, are sequential with at least a
one-second delay, and use pages of 100 Offers with a bounded page count. HTTP
403 and 429 stop the Chain refresh without retries or a switch to another
source. Invalid response data or Store associations are reported as a failed
or stale Chain. Do not copy subscription keys, send cookies, spoof a browser,
rotate proxies, or work around an access denial.

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

The response schema has not been verified against a preserved raw Tjek
response. Automated tests replay secret-free, synthetic fixtures in
`tests/fixtures/tjek/` and `tests/fixtures/coop/`; they never contact Tjek and
do not establish that the undocumented endpoint currently returns the same
shape.
