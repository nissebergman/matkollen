# Matapp

A Swedish, mobile-first view of supermarket Offers for Linköping. The app reads
the versioned Snapshot at `public/snapshots/linkoping.json`; it never calls a
Chain or third-party Offer source directly.

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

## Coop refresh

Before refreshing, read [the Tjek source access and terms notes](docs/sources/coop-tjek.md).
`npm run snapshot:coop -- [output-path]` uses Tjek's undocumented consumer
endpoint without credentials. Requests are sequential with a one-second delay;
HTTP 403/429 and malformed responses fail the Chain without retries or access
workarounds. The job merges Coop's result into an existing Snapshot so a
successful Hemköp refresh is retained. The flyer-PDF fallback is not part of
this command.
