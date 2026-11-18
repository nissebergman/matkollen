# Matapp

A Swedish, mobile-first view of supermarket Offers. The app reads a versioned
Snapshot for the Location in the page address (`?location=<id>`), defaulting to
the configured default Location. It never calls a Chain or third-party Offer
source directly. Offer image display is deferred: the current placeholder
remains, and the browser does not load remote `imageUrl`s.

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
and 293 Offers. An ICA check found 12 Linköping Stores with current Store-specific
publications; a separate sample verified three Offers with Store association
and date normalization but no member-price field. A bounded Hemköp Tjek check
later verified three Offers and one member price, but not live Store discovery. The 2026-11-18
publish run initially failed for ICA and Hemköp. A later refresh succeeded for
all three Chains: 787 ICA Offers across 12 Stores, 293 Coop Offers across six,
and 452 Hemköp Offers across seven. The ICA source change is an explicit
configuration, not an automatic response to a denial. The sanitized fixtures,
remaining live compatibility limits and Tjek's terms risks are documented in
the source notes.
The flyer-PDF adapter is available as an experimental, manually selected
fallback; a read-only check of a real flyer showed a layout that the parser
correctly rejects rather than publishing misidentified Offers. The configured
source remains unchanged; do not switch sources automatically.

Offers are ordered by lowest effective price by default. Choose “Störst rabatt
(%)” to sort by the percentage reduction from regular to effective price when
both use a known, shared unit and the regular price is positive. Offers without
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

## GitHub Pages publication

`.github/workflows/publish.yml` refreshes and publishes the app and Snapshots
daily at 05:00 UTC, or on a manual `workflow_dispatch`. It commits the generated
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
