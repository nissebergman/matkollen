# 12: Show local product illustrations on Offer cards

**What to build:** Give Offer cards an image without loading Chain or aggregator image URLs in the browser (story 11: "see a product image when one is available"). Use a curated local catalogue of CC0 illustrations, matched to Offers by keyword, and fall back to a placeholder when nothing matches.

**Blocked by:** 01: Show Hemköp Offers end to end.

**Status:** resolved

- [x] A local catalogue (`src/images/catalog.json`) records each image's keywords, source and download URLs, author, license and verification date; the importer only accepts CC0.
- [x] `npm run images:sync` downloads originals politely and incrementally and generates 192×192 JPEG derivatives with `sharp`; `npm run images:check` validates the catalogue.
- [x] Offer cards label matched images "Illustrationsbild" and link author, source and license; unmatched Offers or images missing from the build show a placeholder.
- [x] The browser never loads remote Offer `imageUrl`s.
- [x] The publish workflow caches imported images between runs, and image import failures never block Offer publication.

## Answer

Implemented in `972ae81`, `1f37778` and `ca04466`, with coverage recorded in
`1caefd0`. The v1 spec's Decision (2026-11-18) under story 11 approves the
approach; sources and licensing are in
[`docs/sources/product-images.md`](../../../docs/sources/product-images.md).
The images are generic illustrations, not exact products or brands. In the
2026-11-18 Linköping Snapshot, 623 of 1,515 priced Offers (146 of 478 grouped
cards) matched an image.

## Comments

2026-11-18: This ticket was recorded after the work was done. A code review
found that no ticket covered the image catalogue and that the spec decision
was added after implementation. The user chose to keep the feature and record
it here.
