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
2026-11-17 returned a 12-page PDF. Running the adapter exposed a failure on
price-before-name text and the `Jfr-pris` comparison-price label. The parser
was updated for those observed structures, and a synthetic two-page fixture
captures short extracted text fragments for offline regression coverage. The
real PDF was not saved, and the updated parser has not been re-run against it;
this fixture does not establish full real-flyer fidelity. Image-only PDFs,
unusual text ordering, or changed layouts can still fail parsing. The adapter
reports such failures and does not publish an apparently complete result.
