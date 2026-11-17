# Matapp

A Swedish, mobile-first view of supermarket Offers. The app reads a versioned
Snapshot for the Location in the page address (`?location=<id>`), defaulting to
the configured default Location. It never calls a Chain directly.

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
adapter is reported as a failed Chain; currently only the Hemköp adapter is
implemented.

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

`npm run snapshot:hemkop -- [output-directory]` runs the job for every
configured Location, one at a time, and writes one Snapshot per Location.
When only one Location is configured, a `.json` argument can still be used as
the exact output path. Before refreshing, read
[the source terms and robots notes](docs/sources/hemkop.md): the campaign
route is disallowed by Hemköp's robots.txt. The adapter makes direct,
anonymous requests only during the stated UTC visiting window, waits at least
ten seconds between requests, does not retry access denials, and reports a
failed or stale Chain with a nonzero process exit.
