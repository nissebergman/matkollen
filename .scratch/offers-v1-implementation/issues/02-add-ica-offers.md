# 02: Add ICA Offers

**What to build:** Show current ICA Offers from every discovered Linköping Store alongside Hemköp Offers, using ICA's first-party source and the shared Snapshot contract.

**Blocked by:** 01: Show Hemköp Offers end to end.

**Status:** ready-for-agent

- [ ] Discover ICA Stores by exact city, fetch each Store's public Offers and obtain any anonymous token at runtime without storing credentials.
- [ ] Preserve the Store association and normalise representative member prices, multi-buy and other mechanics, validity, category and available product details; unmapped categories become Övrigt.
- [ ] ICA Offers appear as ordinary Offers in the app, and future and expired Offers remain hidden according to the agreed validity rule.
- [ ] Requests are sequential and low-rate, blocked or malformed responses are reported rather than bypassed, and source risks are documented.
- [ ] Fixture-based job and whole-app tests demonstrate ICA and Hemköp Offers together without live requests.
