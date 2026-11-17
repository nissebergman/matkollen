# Matapp

A Swedish, mobile-first view of supermarket Offers for Linköping. The app reads
the versioned Snapshot at `public/snapshots/linkoping.json`; it never calls
supermarket data sources directly.

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

`npm run snapshot -- [output-path]` runs the Snapshot job for ICA and Hemköp.
Before refreshing, read the [ICA](docs/sources/ica.md) and
[Hemköp](docs/sources/hemkop.md) access notes. ICA uses an anonymous token
fetched at runtime for Store discovery and public per-Store Offers pages;
Hemköp requests only run during its stated UTC visiting window and wait at
least ten seconds between requests. Both adapters make sequential, anonymous
requests, stop on access denials without retries or workarounds, and report a
failed or stale Chain with a nonzero process exit.
