# Product image sources

Research checked 2026-11-18. Recommendation: use a small, curated Wikimedia
Commons manifest for **generic category illustrations**, not for matching
offers to exact products or brands. The five JPEGs below have Commons API
metadata declaring CC0 1.0; each entry records its file page, direct original
URL, author, and license. These are Commons' uploader-supplied records, not an
independent legal guarantee.

The source investigation used Commons HTML/API metadata only. The subsequent
local implementation downloaded the five originals once and generated the
derivatives described under “Local catalogue implementation” below.

## Verified starter metadata

The canonical source URLs are the Commons file-description pages. Direct image
URLs are copied verbatim from `imageinfo.url` (including Commons query
parameters); do not derive them from filenames. `pageid` identifies each
record in the linked, five-file API response.

| Curated alias | Title and Commons description | Author | Canonical source page | Original image URL (`imageinfo.url`) | Commons API `pageid` / license verification |
|---|---|---|---|---|---|
| `chips` | **Potato chips - Massachusetts.jpg** — “Potato chips - Massachusetts, USA.” | Daderot | https://commons.wikimedia.org/wiki/File:Potato_chips_-_Massachusetts.jpg | https://upload.wikimedia.org/wikipedia/commons/f/f1/Potato_chips_-_Massachusetts.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original | `143017941`; `LicenseShortName=CC0`, `UsageTerms=Creative Commons Zero, Public Domain Dedication`, `AttributionRequired=false`; `LicenseUrl=http://creativecommons.org/publicdomain/zero/1.0/deed.en` |
| `deli-meat` | **Coupe jambon de pays.jpg** — “French ham (jambon de pays).” | Tejoja | https://commons.wikimedia.org/wiki/File:Coupe_jambon_de_pays.jpg | https://upload.wikimedia.org/wikipedia/commons/d/dd/Coupe_jambon_de_pays.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original | `143108704`; `LicenseShortName=CC0`, `UsageTerms=Creative Commons Zero, Public Domain Dedication`, `AttributionRequired=false`; `LicenseUrl=http://creativecommons.org/publicdomain/zero/1.0/deed.en` |
| `bread` | **Loaf Of Bread.jpg** — “Loaf Of Bread.” | congerdesign | https://commons.wikimedia.org/wiki/File:Loaf_Of_Bread.jpg | https://upload.wikimedia.org/wikipedia/commons/2/2c/Loaf_Of_Bread.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original | `126743919`; `LicenseShortName=CC0`, `UsageTerms=Creative Commons Zero, Public Domain Dedication`, `AttributionRequired=false`; `LicenseUrl=http://creativecommons.org/publicdomain/zero/1.0/deed.en` |
| `tomatoes` | **Tomato Fruit.jpg** — “Harvest tomato fruits for sale.” | Judethedeus | https://commons.wikimedia.org/wiki/File:Tomato_Fruit.jpg | https://upload.wikimedia.org/wikipedia/commons/4/4d/Tomato_Fruit.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original | `162902625`; `LicenseShortName=CC0`, `UsageTerms=Creative Commons Zero, Public Domain Dedication`, `AttributionRequired=false`; `LicenseUrl=http://creativecommons.org/publicdomain/zero/1.0/deed.en` |
| `fruit` | **Apples fruit.jpg** — “green and red apples.” | safaritravelplus | https://commons.wikimedia.org/wiki/File:Apples_fruit.jpg | https://upload.wikimedia.org/wikipedia/commons/0/00/Apples_fruit.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original | `115211959`; `LicenseShortName=CC0`, `UsageTerms=Creative Commons Zero, Public Domain Dedication`, `AttributionRequired=false`; `LicenseUrl=http://creativecommons.org/publicdomain/zero/1.0/deed.en` |

**Verification response:** [Commons Action API, `pageids=143017941|143108704|126743919|162902625|115211959`](https://commons.wikimedia.org/w/api.php?action=query&pageids=143017941%7C143108704%7C126743919%7C162902625%7C115211959&prop=imageinfo&iiprop=url%7Csize%7Cmime%7Cextmetadata&iiextmetadatafilter=Artist%7CImageDescription%7CObjectName%7CLicenseShortName%7CLicenseUrl%7CUsageTerms%7CAttributionRequired&format=json). The response returned `mime=image/jpeg` for all five. Original dimensions/sizes were: chips 1998×1998 / 1,059,405 bytes; ham 512×224 / 23,421 bytes; bread 1920×1320 / 473,213 bytes; tomatoes 3024×4032 / 3,028,772 bytes; apples 3984×2656 / 4,259,763 bytes.

These aliases deliberately denote food categories, not SKUs or brands. In
particular, the ham photo is French ham, not a particular deli item. I did not
include a milk image: the suitable CC0 candidate returned by the bounded search
was explicitly described as Good Karma vanilla flaxmilk, so it would be a
specific product image rather than a neutral dairy illustration
([Commons file page](https://commons.wikimedia.org/wiki/File:Flax_milk_2.jpg)).

## API and local-pipeline guidance

The Commons API root is `https://commons.wikimedia.org/w/api.php`. The
five-page metadata request above uses `action=query&pageids=...&prop=imageinfo`
and requests `url`, `size`, `mime`, and selected `extmetadata` fields. For
future discovery, MediaWiki documents `generator=search` and the namespace
filter; for verification, prefer a small grouped `pageids` request. The
`imageinfo.url` is the original file URL; `descriptionurl` is the canonical
file page. `extmetadata` is HTML-formatted, expensive to request, and the API
docs specifically advise asking for only a few results at a time
([API:Search](https://www.mediawiki.org/wiki/API:Search);
[API:Imageinfo](https://www.mediawiki.org/wiki/API:Imageinfo)).

For the local pipeline, treat this as static source metadata: preserve title,
author, Commons page, license name/URL, and original URL in the manifest, then
have the existing local script create the JPEG derivative. If rechecking the
manifest, use a descriptive Wikimedia-compliant User-Agent, make requests
serially, cache results, and use `maxlag` for non-interactive work. Wikimedia
documents **no hard speed limit on read requests**, but asks API users to be
considerate, issue requests in series, and group items where possible; that is
not a blanket permission for high-volume collection
([API:Etiquette](https://www.mediawiki.org/wiki/API:Etiquette)). This research
made bounded, low-rate metadata-only requests.

## License and source choice

CC0 is the simplest fit for this category catalogue: its legal code waives
copyright and related rights to the extent allowed by law and permits copying,
modification, and distribution, including commercially, without asking
permission. Attribution is not a CC0 condition, but keeping author/title/source
metadata is useful provenance. CC0 gives no warranty and does not clear
trademark, privacy, publicity, or other third-party rights
([CC0 1.0 deed](https://creativecommons.org/publicdomain/zero/1.0/)).

“Public domain” and CC0 are not interchangeable labels. Public domain is a
copyright status, not a reusable license; attribution requirements can vary by
jurisdiction. Commons recommends crediting provenance even where it is not
legally required, says each file has its own license terms, and disclaims any
warranty that its licensing information is correct. Verify the file page when
adding or refreshing an asset
([Commons reuse guidance](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia)).
These five candidates were chosen because their API metadata explicitly says
CC0, rather than relying on a generic “free” or public-domain assumption.

By contrast, CC BY-SA requires appropriate credit and a license link; CC BY-SA
3.0 requires change notices for adaptations, which must be shared under the
same or a compatible license. This is more operational work for cropped/resized assets
([CC BY-SA 3.0 deed](https://creativecommons.org/licenses/by-sa/3.0/)).
Whether a particular resize/crop is an adaptation is not determined here, so
prefer CC0 when avoiding attribution/share-alike handling is important.

## Optional Open Food Facts path

Open Food Facts is a better conceptual fit only when an image must match an
identified product/barcode; its product photos are not generic category
illustrations. Its official API documentation says v3.6 is current and
recommended (v2 is deprecated), product images are CC BY-SA 3.0, and image
assets may also contain separately protected graphical elements. It separately
licenses the database under ODbL 1.0 and individual database contents under
DBCL 1.0, so those database terms must not be mistaken for the photo license.
The documented read route is
`GET https://world.openfoodfacts.org/api/v3.6/product/{barcode}.json`; read
requests do not require authentication, but the service requires a meaningful
custom User-Agent. Its published limits are 15 product-read requests/minute/IP
and 10 search requests/minute/IP; global limits can also return HTTP 503. The
docs ask integrators to submit their API-use form. No OFF account, credential,
product lookup, or image request was used in this research
([official API documentation](https://openfoodfacts.github.io/openfoodfacts-server/api/)).

## Uncertainties and access status

The Commons file pages and API fields establish what Commons currently
declares, not an independent rights investigation or legal opinion. The generic
aliases follow the source descriptions, not an asserted product identity.
Do not present these as exact products or use them to imply a brand, SKU, or
offer-specific match.

The Commons metadata calls completed successfully. No access denial or HTTP
401/403/429 was observed. One initial malformed API URL (query separators
encoded as part of the `action` value) returned MediaWiki `badvalue`; the
documented endpoint was then queried with normal parameter separators. The
API returned original-image URL metadata, but no direct image URL was opened or
fetched during research.

## Local catalogue implementation

`src/images/catalog.json` preserves the verified original titles, URLs and provenance.
The importer accepts only CC0, not the other licenses discussed for comparison.
Its license links use the HTTPS CC0 deed corresponding to the HTTP deed URL
returned by Commons. Full-name aliases are explicitly curated; there is no
substring/category-wide or brand inference. All displayed images are labelled
“Illustrationsbild”, link their author/source/license, and disclose resizing
and compression. Fresh-tomato aliases exclude canned tomatoes, and the apple
image does not match pomegranates.

`npm run images:sync` sequentially fetched the five original JPEGs successfully,
without retries, denials, metadata API calls, or contacting supermarket sources.
`sharp` oriented each image, contained it without cropping on a white 192×192
canvas, stripped metadata and encoded JPEG at quality 55 with mozjpeg. No AI
image generation is involved.

| Local derivative | Bytes |
|---|---:|
| `potato-chips.jpg` | 4,343 |
| `deli-ham.jpg` | 2,546 |
| `bread.jpg` | 3,534 |
| `tomatoes.jpg` | 5,152 |
| `apples.jpg` | 3,208 |
| **Total** | **18,783** |

`npm run images:check` validates local format, dimensions, metadata removal and
the 20 KiB per-file limit offline. Existing files are reused by the importer.

### Publication blocked by content exclusion

After the initial generation and local validation, the commit attempt was
denied because `.jpg` is a globally ignored file type. These files must not be
accessed further by Copilot and have not been committed or published. The
unrestricted source metadata and prepared code are retained, but the renderer
is not connected to the app. Publication uses only checked-in assets and does
not run the image importer or validator. The local build was not rerun after
the exclusion, so it cannot copy the blocked, untracked files.
