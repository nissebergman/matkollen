# 08: Configure additional Locations and Store overrides

**What to build:** Let the maintainer add a Location and correct its discovered Stores through configuration, without changing application code.

**Blocked by:** 01: Show Hemköp Offers end to end.

**Status:** ready-for-agent

- [ ] A Location config supplies its id, display name, Chain sources, exact-city discovery criteria and optional per-Chain Store pin and exclude lists.
- [ ] The job discovers Stores rather than relying on a hard-coded Linköping list, applies overrides and produces a separate Snapshot for each configured Location.
- [ ] The app loads the Location specified in the page address, defaulting to the only configured Location; it shows no Location picker while there is only one.
- [ ] Fixture-based tests demonstrate city matching, pinning and excluding Stores, and producing and loading a second Location without code changes.
