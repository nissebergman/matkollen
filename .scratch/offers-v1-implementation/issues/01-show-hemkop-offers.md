# 01: Show Hemköp Offers end to end

**What to build:** Establish the first working path for the Weekly grocery Offers v1 spec: fetch Hemköp Offers for Linköping, publish a versioned Snapshot and show those Offers in a Swedish, mobile-first app without login. The app reads the Snapshot, not the Chain's endpoints.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Discover Linköping Stores from the first-party source, follow Offer pagination and include member prices as ordinary Offers.
- [ ] Produce a validated Snapshot containing Location, Store and Chain metadata, source and freshness information, and normalised Offers with their source, validity, category and available price details.
- [ ] Show each Offer's name, mechanic, Store, Chain and end date, plus brand, package size, image, comparison price, regular price and purchase limit when available; use a placeholder when there is no image.
- [ ] Show Offers only from their start date through their end date, inclusive, using the Europe/Stockholm date; never invent numeric prices for mechanics that do not provide one.
- [ ] Map source categories to shared Swedish categories, using Övrigt for unmapped Offers; validate source responses instead of silently publishing malformed data.
- [ ] Fetch sequentially, with at least ten seconds between Hemköp requests, and document the source's terms and robots risks. Do not circumvent blocks.
- [ ] Exercise the Snapshot job with recorded, secret-free source fixtures and the whole app with a fixture Snapshot; tests make no live requests.

The v1 spec specifies TypeScript, Vite, React and Vitest, the Snapshot fields and the expected source behaviour.
