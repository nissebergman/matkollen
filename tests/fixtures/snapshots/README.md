# Snapshot fixtures

`linkoping.json` is a fixture-backed Snapshot for whole-app tests and the local
demo file in `public/snapshots/`. It includes ICA, Hemköp and Coop Offers, and
composes observed source field examples with synthetic product/promotion
associations and validity-boundary rows; it is not a captured live Snapshot.
The public file identifies its sources as fixtures, and the app labels it as
example data.

`linkoping-multi-chain.json` adds ICA and Coop fixtures for whole-app tests of
filter combinations, Store narrowing, search, counts and reset. It also
includes a future-start Offer to verify that it stays hidden until valid.

`coop-flyer-pdf.json` is a synthetic Coop-only Snapshot used to verify that
PDF-source Offers render in the app and future Store-specific validity dates
remain hidden until they begin.
