# 03: Add Coop Offers

**What to build:** Show current Coop Offers from every discovered Linköping Store alongside the other Chains, using Tjek as Coop's primary source.

**Blocked by:** 01: Show Hemköp Offers end to end.

**Status:** ready-for-agent

- [ ] Discover Coop Stores for the configured city and associate Tjek publications and Offers with the correct Store, following any pagination.
- [ ] Normalise representative member prices, mechanics, validity, category and available product details into the shared Snapshot; unmapped categories become Övrigt.
- [ ] Coop Offers appear as ordinary Offers in the app, and future and expired Offers remain hidden according to the agreed validity rule.
- [ ] Requests are sequential and low-rate, blocked or malformed responses are reported rather than bypassed, and Tjek's access and terms risks are documented.
- [ ] Fixture-based job and whole-app tests demonstrate Coop alongside the existing Chain without live requests or stored credentials.
