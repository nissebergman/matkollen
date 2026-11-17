# Coop source: Store-specific flyer PDFs

The `coop-flyer-pdf` adapter discovers Stores from Coop's public store page and
store API, then follows each selected Store's current flyer metadata to its PDF.
The map is filtered by the configured exact-city field and honours the
Location's Store pins and exclusions. Store details are requested using each
record's `ledgerAccountNumber`; flyer start and stop dates are copied to every
Offer extracted from that specific flyer.

The store API requires `Ocp-Apim-Subscription-Key`. The adapter fetches the
public store page and its current `storesApp` script at runtime to read the
page-embedded client configuration. The value is held only in memory and sent
as a request header; it is not checked into source, written to the Snapshot,
or configured as a CI secret. Requests omit cookies and authorization and do
not spoof a browser, retry denials, rotate proxies, or work around blocks.
Requests to the page, script, API, and PDFs are sequential with a one-second
delay. HTTP 401, 403, and 429 stop the Chain refresh immediately.

The endpoints and page configuration have no public API contract or stated
rate limit. Coop's user terms and content rights create uncertainty for
automated reuse; this is not a legal determination. Coop's website robots rules
allow most paths and the observed flyer host rules allow the tested route, but
robots rules are not permission. Use only for the household's personal
Snapshot, seek permission before broader or recurring use where possible, and
never continue after an access denial. Details and the checked response shapes
are recorded in `.scratch/offers-v1/research/coop-offer-data-access.md`.

PDF text is extracted with PDF.js; there is no OCR. The parser recognizes
explicit Swedish price mechanics and requires a product name near each
mechanic. Numeric prices are kept only when the flyer explicitly shows `kr` or
`:-`; a multi-buy unit price is derived from its displayed total and quantity.
Unrecognized, unreadable, missing, or empty current flyers fail Coop rather
than silently publishing a partial refresh. Unknown or absent section headings
map to `Övrigt`. A flyer preview is not used as a product image.

The checked-in PDFs are small, generated text-only fixtures, not copies of
Coop flyers. A read-only retrieval of the Stora Coop Garnisonen flyer on
2026-11-17 returned a 12-page PDF. The initial adapter run exposed prices
preceding product names and the `Jfr-pris` comparison-price label. A later run
preserved the comparison text but encountered a numeric row (`103:15`) that
could not safely be identified as a product, so the adapter failed the Chain
and published zero Offers. The real PDF was not saved. A synthetic fixture
covers the observed Libero row, but accurate extraction across real flyers remains
unverified.

A subsequent bounded attempt on 2026-11-17 received HTTP 200 for Coop's public
Store page and script, but the configured parser found no readable API key in
the public configuration and stopped before calling the Store API. No key,
Store data, or PDF content was retained from that attempt.

A separate two-request diagnostic found public key-marker strings in the
linked script but could not establish their assignment structure or value
types. It sent no key and made no Store API request.
Image-only PDFs, unusual text ordering, and changed layouts may fail parsing;
ambiguous rows must fail rather than be published as Offers. Keep the configured
Coop primary source on Tjek until real-flyer extraction is validated.
