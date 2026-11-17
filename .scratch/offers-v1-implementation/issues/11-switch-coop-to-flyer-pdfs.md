# 11: Switch Coop to flyer PDFs when needed

**What to build:** Let the maintainer switch Coop from Tjek to its Store-specific flyer PDFs through configuration, extracting Offers into the same Snapshot and showing them in the app.

**Blocked by:** 03: Add Coop Offers.

**Status:** blocked

- [ ] Discover the configured Location's Coop Stores and their current Store-specific flyers, obtaining any public-page configuration needed at runtime without storing credentials.
- [ ] Extract representative Offers from flyer PDF fixtures with the correct Store, validity, name and mechanic; preserve available product and price details and never invent a numeric price.
- [ ] The fallback produces the shared Snapshot contract and displays Offers without app changes; configuration can switch back to Tjek.
- [ ] Missing, blocked or unparseable flyers are reported as source failures instead of silently publishing an apparently complete result; source risks are documented and requests remain low-rate and sequential.
- [ ] Fixture-based job and whole-app tests cover representative extracted Offers, source switching and an unparseable or missing flyer without live requests.

## Comments

The implementation has been merged into `integration/offers-v1` as `53729cf`. The 70-test suite using synthetic fixtures passes. The corrected parser has not been rerun against an actual Coop flyer since the parser change, so real-flyer post-fix accuracy remains unverified. Validation against an actual flyer is still outstanding.
