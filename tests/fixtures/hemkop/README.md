# Hemköp source fixtures

These are secret-free, trimmed test responses shaped from the field observations in `.scratch/offers-v1/research/hemkop-offer-data-access.md`. The Linköping Store names, ids and addresses, and the named product examples and quoted source fields, come from that research note. The page excerpts are deliberately small; the three-page pagination values mirror the observed Lucullus response. Some combinations and the rows named “Kampanjprodukt”, “Två för 22”, “Nästa vecka” and “Utgånget exempel” are synthetic test cases, not captured offers. The fixtures are not evidence of a current live endpoint response.

The Norrköping test Store and its product are entirely synthetic. They exercise Location configuration, pinning and Store discovery; they do not represent a real Store or current Offer.

Automated tests replay these files through an injected fetcher. They make no network requests.
