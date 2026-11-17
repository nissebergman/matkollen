# Matapp

A Swedish, mobile-first view of supermarket Offers. The app reads a versioned
Snapshot for the Location in the page address (`?location=<id>`), defaulting to
the configured default Location. It never calls a Chain or third-party Offer
source directly.

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
Coop sources are implemented. Linköping currently selects
`coop-flyer-pdf`; change the Coop `source` to `coop-tjek` to switch back.

Offers are ordered by lowest effective price by default. Choose “Största rabatt”
to sort by the difference between regular and effective price when both use a
known, shared unit; Offers without a usable price or computable discount appear
last.

Use the multi-select Chain, Store and category filters together, or search
product names and brands by one or more words. Select **Rensa filter** to
return to all currently valid Offers.

## Development

```sh
npm install
npm run dev
npm test
npm run build
```

The checked-in Snapshot is visibly labelled as fixture data, not a live
refresh. Automated tests replay secret-free fixtures and do not access the
network.

## Snapshot refresh

`npm run snapshot -- [output-directory]` runs the job for every configured
Location, one at a time, and writes one Snapshot per Location. When only one
Location is configured, a `.json` argument can still be used as the exact
output path. Before refreshing, read the [ICA](docs/sources/ica.md),
[Hemköp](docs/sources/hemkop.md), [Coop flyer-PDF](docs/sources/coop-pdf.md)
and [Coop Tjek](docs/sources/coop-tjek.md) source-access notes. ICA fetches an
anonymous token at runtime for Store discovery, then requests public per-Store
Offers pages sequentially. Hemköp requests only run during its stated UTC
visiting window and wait at least ten seconds between requests. Both Coop
sources make sequential requests with a one-second delay. The PDF source reads
Coop's public page configuration at runtime; it stores no key or credentials.
All adapters stop on access denials without retries or workarounds, and report
a failed or stale Chain with a nonzero process exit.
