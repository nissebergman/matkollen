# ICA and Hemköp Tjek fixtures

These are synthetic, secret-free examples for the shared Tjek Snapshot adapter.
The command and response envelope follow the shape described by the
third-party-source research, but the Store identities, Offer values, and
associations are fabricated because no raw Tjek business or Offer payload was
preserved. They do not prove the undocumented endpoint currently returns this
schema.

Tests replay these files through an injected fetcher and make no network
requests. Fixture start dates include a future Offer so the Snapshot can
preserve its validity interval for the app's date-based visibility behavior.
