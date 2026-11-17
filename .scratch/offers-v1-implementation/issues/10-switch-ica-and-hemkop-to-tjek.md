# 10: Switch ICA and Hemköp to Tjek when needed

**What to build:** Let the maintainer switch either ICA or Hemköp from its first-party source to Tjek through configuration, without changing the app.

**Blocked by:** 02: Add ICA Offers.

**Status:** ready-for-agent

- [ ] Each Chain can independently select its primary source or Tjek and produce Stores and Offers in the existing Snapshot contract.
- [ ] Tjek Store association, member prices, validity and representative mechanics are preserved for both Chains; source identity and terms risks are recorded.
- [ ] Switching a source leaves the app's display and filters working without application changes; failed or blocked sources are reported rather than bypassed.
- [ ] Fixture-based tests cover both fallback Chains and switching back to a primary source without live requests.
