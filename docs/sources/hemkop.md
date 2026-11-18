# Hemköp source

The Hemköp adapter uses the undocumented first-party store list at
`/axfood/rest/store` and the per-Store campaign response at
`/search/campaigns/offline`. The response is anonymous in the research
observations; the job sends only a normal JSON `GET`, omits credentials, and
does not use account cookies, authorization, proxy rotation, identity spoofing,
or other block workarounds. An HTTP error or invalid response fails the Chain.
HTTP 403 and 429 responses are not retried.

## Terms and robots risk

This is not a supported public API and has no published SLA. Hemköp's
`robots.txt` disallows `/*?q=`, which matches the campaign requests, and states
a 10-second crawl delay and a UTC visiting window of 04:00–08:45. This is a
material access risk; do not disguise or work around the disallowed route.
Recurring use should not be enabled without accepting that risk and, ideally,
obtaining Hemköp's permission. The adapter waits at least ten seconds between
all requests, refuses to start requests outside the stated UTC visit window,
and fails immediately when access is denied.

Hemköp's terms say that Klubbpriser can only be redeemed by logged-in members.
The app's household model assumes membership, but visibility of a price is not
permission to redeem it. Hemköp also warns that e-commerce prices can differ
from physical-Store prices. The app shows the source's Offer text and does not
guarantee shelf prices.

## Refresh and tests

Run `npm run snapshot:hemkop -- [output-directory]` only when the source-access
risk is accepted. The job writes one Snapshot for each configured Location,
even when a Chain is stale or failed, then exits unsuccessfully so the failure
is not hidden. When only one Location is configured, a `.json` argument can
still be used as the exact output path. Automated tests replay trimmed,
secret-free fixtures and never call Hemköp.

Fixture values are based on the observations in
`.scratch/offers-v1/research/hemkop-offer-data-access.md`; synthetic rows and
combinations are identified in `tests/fixtures/hemkop/README.md`. They are not
live verification or a promise that the undocumented response remains stable.

The public refresh on 2026-11-18 failed closed when the first-party campaign
response contained an unsupported `comparePrice` shape at
`results.1.potentialPromotions.0.comparePrice`; no Hemköp Offers were included
in that Snapshot. The generated Snapshot was deployed with the source failure
visible in the app, and the Tjek fallback was not selected automatically.
