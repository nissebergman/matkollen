# Matapp

A Swedish, mobile-first view of supermarket Offers for Linköping. The app reads
the versioned Snapshot at `public/snapshots/linkoping.json`; it never calls
Hemköp directly.

Offers are ordered by lowest effective price by default. Choose “Största rabatt”
to sort by the difference between regular and effective price when both use a
known, shared unit; Offers without a usable price or computable discount appear
last.

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

## Hemköp refresh

`npm run snapshot:hemkop -- [output-path]` runs the Snapshot job. Before
refreshing, read [the source terms and robots notes](docs/sources/hemkop.md):
the campaign route is disallowed by Hemköp's robots.txt. The job makes direct,
anonymous requests only during the stated UTC visit window, waits at least ten
seconds between requests, does not retry access denials, and reports a failed
or stale Chain with a nonzero process exit.
