# ICA source

The ICA adapter uses ICA's first-party public Store search and each Store's
public Offers page. It obtains the short-lived anonymous public token from
`/e11/public-access-token` at runtime, then uses it only for the Store-search
gateway request. It does not store or log the token, send it to Offers pages,
or use customer credentials, cookies, proxies, identity spoofing, or other
block workarounds.

Store discovery searches the configured city and then requires an exact
`visitingCity` match. The adapter follows Store-search pagination, obtains the
Offers URL from the Store record when available, and otherwise builds the
first-party Offers URL from the Store name and account number. Each page's
`window.__INITIAL_DATA__.offers.weeklyOffers` is parsed as data; scripts are
never executed. Requests are sequential with a one-second delay, and HTTP
403/429 responses or unexpected response shapes fail ICA without retrying or
switching to an undocumented mobile route.

## Terms and source risk

The tested Store-search route is a versioned first-party gateway service
referenced by ICA's web client, but ICA has not published a supported bulk
Offers API contract, schema, SLA, numeric request limit, or endpoint-specific
usage permission in the bounded research. Offers extraction depends on the
undocumented HTML hydration shape of each Store page and may break when ICA
changes its site. Research observed one 403 on a cross-origin Offers-page
probe; it was not retried or worked around. The checked robots.txt had no
general disallow for the Store or Offers routes, but that is not permission
under ICA's terms.
Recurring collection should be treated as an accepted personal-use risk and
should not be relied on for production without confirming ICA's terms or
obtaining an approved feed.

## Refresh and tests

Automated tests replay trimmed, secret-free fixtures and do not call ICA.
`tests/fixtures/ica/README.md` distinguishes the observed Berga example from
synthetic cases. The token response uses a nonfunctional placeholder.
Access-denied and malformed responses are reported in the Snapshot; the job
never falls back to the community-described mobile endpoint.

The public refresh on 2026-11-18 received HTTP 403 while obtaining the
anonymous access token. The request was not retried, and the published Snapshot
records ICA as failed with no Offers; no alternate route was used.
