# 07: Keep Offers visible when a source fails

**What to build:** Preserve useful Offers and tell the household when a Chain's data is stale or missing, without letting one source failure take down the other Chains.

**Blocked by:** 01: Show Hemköp Offers end to end.

**Status:** ready-for-agent

- [ ] A failed or invalid Chain refresh retains that Chain's still-valid previous Offers and marks it stale; without usable previous Offers it is failed, while successful Chains are published normally.
- [ ] Each Chain records its source, status, last attempt, last success and a short error when relevant; the job reports an unsuccessful overall run when any Chain is stale or failed.
- [ ] The app shows the Snapshot update time, identifies stale or failed Chains and their last successful update when known, and marks stale Offers as potentially outdated.
- [ ] Expired Offers disappear even if the Snapshot is not refreshed, and future Offers remain hidden until their start date.
- [ ] An unavailable Snapshot or unsupported schema version produces a clear Swedish error state rather than a misleading empty list.
- [ ] Fixture-based job and whole-app tests cover a failed source with and without a previous Snapshot, malformed data, unaffected Chains, validity and error banners.
