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

- [ ] Discover the configured Location's Coop Stores and their current Store-specific flyers, obtaining any public-page configuration needed at runtime without storing credentials.
- [ ] Extract representative Offers from flyer PDF fixtures with the correct Store, validity, name and mechanic; preserve available product and price details and never invent a numeric price.
- [ ] The fallback produces the shared Snapshot contract and displays Offers without app changes; configuration can switch back to Tjek.
- [ ] Missing, blocked or unparseable flyers are reported as source failures instead of silently publishing an apparently complete result; source risks are documented and requests remain low-rate and sequential.
- [ ] Fixture-based job and whole-app tests cover representative extracted Offers, source switching and an unparseable or missing flyer without live requests.

## Comments

The implementation was merged into `integration/offers-v1` as `53729cf`. A read-only GET of the Stora Coop Garnisonen flyer returned a PDF, but the parser initially produced incorrect Offers. The parser now preserves a comparison-price line that precedes an Offer and rejects obvious non-product rows rather than publishing them. An end-to-end rerun against the same flyer failed closed on the row `103:15`, publishing zero Offers. The PDF was not saved. Synthetic fixture tests pass, but accurate extraction from actual Coop flyers remains unverified; keep Tjek as the configured primary source.
