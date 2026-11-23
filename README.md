# Matapp

A Swedish, mobile-first view of supermarket Offers. The app reads a versioned
Snapshot for the Location in the page address (`?location=<id>`), defaulting to
the configured default Location. It never calls a Chain or third-party Offer
source directly. The browser never loads remote Offer `imageUrl`s; cards use
the [local product image database](#local-product-image-database) instead.

## Locations

`src/snapshot/locations.json` is the shared Location configuration for the
Snapshot job and the app. Each entry has an id, display name and per-Chain
source and discovery settings. `storeDiscovery.exactCity` names the exact
source-record field and value to match; `pinStoreIds` includes Stores even
when their city does not match, and `excludeStoreIds` removes Stores even if
they match or are pinned. Store override ids may be source Store ids or their
normalized Snapshot ids (for example `Hemköp:4552`); exclusions take
precedence over pins.

Add a Location by adding a configuration entry and publishing a Snapshot named
`public/snapshots/<id>.json`. The app shows a Location picker only when more
than one Location is configured. A configured source without a registered
adapter is reported as a failed Chain. The ICA and Hemköp adapters and both
Coop source adapters are implemented. Linköping uses `tjek-ereklamblad` for ICA
and `coop-tjek` for Coop. The shared Tjek adapter discovers Stores and implements the observed Store-specific
`fronts` → publication pages → individual Offer lookup flow. A 2026-11-17
Coop refresh validated all six configured Linköping Stores, six publications
and 293 Offers. An ICA check found current Store-specific publications for all
12 Linköping Stores; a later bounded sample verified 21 Offer associations and
validity, with a member-price field present in two. The sample does not
establish broad Offer coverage or mechanic prevalence. A bounded Hemköp Tjek
check verified three Offers and one member price, but not live Store discovery.
The 2026-11-18 publish run initially failed for ICA and Hemköp. A later refresh
succeeded for all three Chains: 787 ICA Offers across 12 Stores, 293 Coop
Offers across six, and 452 Hemköp Offers across seven. The ICA source change is an explicit
configuration, not an automatic response to a denial. The sanitized fixtures,
remaining live compatibility limits and Tjek's terms risks are documented in
the source notes.
The flyer-PDF adapter is available as an experimental, manually selected
fallback; a read-only check of a real flyer showed a layout that the parser
correctly rejects rather than publishing misidentified Offers. The configured
source remains unchanged; do not switch sources automatically.

Equivalent Offers within a Chain appear once, with every matching Store listed
in the **Butik** row. Brand, package size, purchase price, quantity, mechanics,
comparison price, restrictions and validity must agree. Store filtering happens
before aggregation; raw per-Store Snapshots and provenance remain unchanged.
Different regular prices do not split an otherwise identical Offer: the card
shows their range, and **Spara minst** uses the smallest reduction available at
every listed Store. If any Store lacks a usable regular price, no group-wide
discount is claimed.

Offers are ordered by the purchase price shown on their price ticket, not the
kg/l comparison price. A multi-buy total is its purchase price; a numeric unit
price is used only when no purchase price exists. Choose “Största rabatt (kr)”
to sort by the saving in SEK (regular price minus effective unit price) when
both use a known, shared unit; the **Spara** badge shows the same amount per
unit (kr, kr/kg or kr/l). Aggregated
Offers use the conservative Store-wide reduction described above. Offers without
a usable price or computable reduction appear last. Offers with an explicit
zero price or zero effective price are hidden; unknown prices remain visible.

Use the multi-select Chain and category filters with the Store dropdown, or
search product names and brands by one or more words. All Stores are selected
by default; the dropdown supports selecting all, none or individual Stores.
Filters and sorting are preserved in shared URLs, including an explicit empty
Store selection (`store=none`). Select **Rensa filter** to return to all
currently valid, nonzero-price Offers.

## Development

```sh
npm install
npm run dev
npm test
npm run build
```

`public/snapshots/linkoping.json` contains the latest output from the refresh
workflow, not fixture data. Failed Chains are represented in the Snapshot and
shown in the app rather than being replaced with fixture Offers. Automated
tests replay secret-free fixtures and do not access the network.

## Local product image database

Offer cards show local illustrations from 33 Wikimedia Commons CC0 photos
(fruit, vegetables, dairy, meat, bread, snacks, household goods). They are
**illustrations, not exact products or brands**: each card labels the image
“Illustrationsbild” and links its author, source and license. Offers without a
match, or whose image is missing from the build, show a placeholder. Remote
Offer `imageUrl`s are never loaded.

[`src/images/catalog.json`](src/images/catalog.json) is the database: per image,
its keywords, optional excluded words, original title, source and download
URLs, author, license and verification date. The importer only accepts CC0.
Matching tokenizes the Offer name and compares each word with the keywords.
Swedish compounds put the head noun last, so a suffix match (“snack**tomater**”,
“grill**korv**”) outranks a prefix match (“**kyckling**innerfilé”), and
“potatischips” is chips, not potatoes. Keywords shorter than four letters
(“ost”, “lax”, “ägg”) only match whole words. Excluded words stop false
positives such as “färsk” for “färs” or “köttbullar” for “bullar”.

`npm run images:sync` downloads each missing image as a 330px Commons
thumbnail (Wikimedia rate-limits bulk original downloads), pausing one second
between requests and stopping the batch on HTTP 429. It uses `sharp` (no AI) to
orient it, contain it on a white 192×192 canvas, strip metadata and encode a
JPEG at quality 55 with mozjpeg into `public/images/products/` (typically
2–6 KB each). `npm run images:check` validates existing files offline. Both
continue past individual failures and exit non-zero if any image failed.
Existing files are never re-downloaded, so give an image a new `id` when
replacing its source.

The image files are generated, not committed. The publish workflow restores
the latest set from an incremental Actions cache, runs `images:sync` to fill in
missing images, builds, and saves the set again. A Wikimedia outage or rate
limit cannot block Offer publication; affected cards fall back to placeholders.

To add an image, find a CC0 file on Commons, check its license through the
Commons API ([source research](docs/sources/product-images.md)), add a catalogue
entry with keywords, run `npm run images:sync`, and check the matches against
the current Snapshot. Do not assume public availability permits reuse.

## GitHub Pages publication

`.github/workflows/publish.yml` refreshes and publishes the app and Snapshots
daily at 05:17 UTC, or on a manual `workflow_dispatch`. It commits the generated
Snapshots, builds them alongside the app, and deploys the resulting static site.
The public site is available at
<https://nissebergman.github.io/matkollen/>.
It stages Snapshots in a clean directory and validates one schema-valid
Snapshot per configured Location before copying or building. If a Chain refresh
fails but still produces valid successful/stale results, those results are
committed and deployed before the workflow reports failure. An unhandled job
failure or incomplete output stops before deployment; the checked-in fixture is
not used as refresh output.

The workflow stores no source credentials and requires no CI source secrets.
GitHub Actions' automatically provided token is used only to commit Snapshot
updates and deploy the Pages artifact. GitHub Pages sites may be publicly
accessible: before configuring Pages or running the workflow, verify that the
repository and the visibility of its Pages site are acceptable for the
household data. The workflow does not enable Pages.

For app-only changes, manually dispatch with `refresh_snapshots=false` to reuse
the persisted live Snapshots without contacting sources. These still pass
publication validation, which rejects fixture sources. Scheduled and ordinary
manual runs continue to refresh sources.

## Snapshot refresh

`npm run snapshot -- [output-directory]` runs the job for every configured
Location, one at a time, and writes one Snapshot per Location. When only one
Location is configured, a `.json` argument can still be used as the exact
output path. Set `SNAPSHOT_PREVIOUS_DIRECTORY` to read stale-data fallbacks from
a different directory; `npm run snapshot:validate -- [output-directory]`
checks every configured Location Snapshot before publication. Before
refreshing, read the
[ICA](docs/sources/ica.md), [Hemköp](docs/sources/hemkop.md),
[Tjek/eReklamblad](docs/sources/tjek-ereklamblad.md),
[Coop flyer-PDF](docs/sources/coop-pdf.md), and
[Coop Tjek](docs/sources/coop-tjek.md) source-access notes. The Coop-specific
Tjek note records its retained Snapshot source id. The first-party ICA adapter
fetches an anonymous token at runtime for Store
discovery, then requests public per-Store Offers pages sequentially. Hemköp
requests only run during its stated UTC visiting window and wait at least ten
seconds between requests. Tjek and both Coop sources make sequential requests
with a one-second delay. The PDF source reads Coop's public page configuration
at runtime; it stores no key or credentials. All adapters stop on access denials
without retries or workarounds, and report a failed or stale Chain with a
nonzero process exit.
