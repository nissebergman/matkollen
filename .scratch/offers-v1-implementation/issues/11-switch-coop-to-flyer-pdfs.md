# 11: Switch Coop to flyer PDFs when needed

**What to build:** Let the maintainer switch Coop from Tjek to its Store-specific flyer PDFs through configuration, extracting Offers into the same Snapshot and showing them in the app.

**Blocked by:** 03: Add Coop Offers.

**Status:** blocked

**Status note (2026-11-17):** Ticket 03 is now resolved, so this ticket's
dependency is satisfied. One live flyer parse failed closed on an ambiguous
row (`103:15`); the PDF was not saved and accurate real-flyer extraction
remains unverified. Keep Tjek configured until a fresh bounded PDF validation
succeeds.

The next bounded attempt fetched the public Store page and its script
successfully (HTTP 200), but the configured extractor found no readable API
key and stopped before the Store API. No key was sent; no Stores, PDFs or
Offers were fetched. The actual configuration shape was not retained.
A separate two-request diagnostic found public key-marker strings in the
script but could not establish their assignment structure or value types; it
sent no key and called no Store API. The actual PDF fallback therefore remains
unverified and the adapter fails closed before Store discovery. Keep Tjek
configured; no access workaround or further diagnostic was used.

**Status note (2026-11-18):** A direct GET of the previously observed Coop
Vallaplan flyer URL (`056019`) returned HTTP 200 as a 1,025,085-byte PDF. The
production parser used the recorded Store-detail fixture (validity
2026-11-18–24), so live Store discovery and flyer dates were not revalidated.
It emitted one false Offer (`vid inköp för`, 8,000 kr), so this sample did not
validate extraction. A regression now rejects this purchase-threshold pattern
and requires a failed Chain with no Offers; the live PDF was not saved, and
post-fix live validation remains pending. Keep this ticket blocked.

**Status note (2026-11-18, post-fix):** The production adapter obtained the
public Store config without persisting its key, discovered Vallaplan
(`Coop:239`, ledger `056019`), and fetched only its current flyer. The parser
failed the Chain on the ambiguous `vid inköp för` row and published zero
Offers. This confirms one-Store Store-detail/flyer discovery and fail-closed
behavior, but the real flyer still does not parse accurately. Keep Tjek
configured and this ticket blocked.

**Status note (2026-11-18, bounded full-Location check):** The production
flyer-PDF adapter ran for the configured Linköping Location with a 30-request
budget; it used five. The public Store page, its script, the Store map and
one Store-detail request all returned HTTP 200, and live discovery found all
six configured Stores (`Coop:2303`, `239`, `240`, `238`, `3868`, `3867`)
without persisting the key. The first Store's current flyer (Stora Coop
Garnisonen) was fetched, and the parser failed the Chain on the ambiguous row
`103:15`, publishing zero Offers. Store discovery is now verified live for the
whole Location; flyer discovery for the other five Stores and accurate
real-flyer extraction remain unverified. Keep Tjek configured and this ticket
blocked.

- [ ] Discover the configured Location's Coop Stores and their current Store-specific flyers, obtaining any public-page configuration needed at runtime without storing credentials.
- [x] Extract representative Offers from flyer PDF fixtures with the correct Store, validity, name and mechanic; preserve available product and price details and never invent a numeric price.
- [x] The fallback produces the shared Snapshot contract and displays Offers without app changes; configuration can switch back to Tjek.
- [x] Missing, blocked or unparseable flyers are reported as source failures instead of silently publishing an apparently complete result; source risks are documented and requests remain low-rate and sequential.
- [x] Fixture-based job and whole-app tests cover representative extracted Offers, source switching and an unparseable or missing flyer without live requests.

## Comments

The implementation was merged into `integration/offers-v1` as `53729cf`. A read-only GET of the Stora Coop Garnisonen flyer returned a PDF, but the parser initially produced incorrect Offers. The parser now preserves a comparison-price line that precedes an Offer and rejects obvious non-product rows rather than publishing them. An end-to-end rerun against the same flyer failed closed on the row `103:15`, publishing zero Offers. The PDF was not saved. Synthetic fixture tests pass, but accurate extraction from actual Coop flyers remains unverified; keep Tjek as the configured primary source.
