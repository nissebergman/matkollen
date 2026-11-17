# 09: Publish and refresh the app automatically

**What to build:** Make the household app and its Snapshots available through static hosting and refresh them automatically each day or on demand.

**Blocked by:** 02: Add ICA Offers; 03: Add Coop Offers; 07: Keep Offers visible when a source fails.

**Status:** blocked

- [ ] A GitHub Actions workflow runs the Snapshot job daily around 05:00 UTC and supports manual runs; the app and Snapshots are deployed together to GitHub Pages.
- [ ] A partially failed refresh still publishes successful and retained stale data, then reports a failed workflow run for maintainer notification.
- [ ] The published app loads its Snapshot correctly from the deployed site and does not request Chain endpoints from the browser.
- [ ] No source credentials are committed or stored as CI secrets; the workflow and publication behaviour are verified without requiring live endpoints in the automated tests.
- [ ] Document that GitHub Pages may be publicly accessible and verify that the chosen repository and Pages visibility are acceptable before publishing household data.

## Comments

Blocked because the repository has no GitHub remote; configuring remote/Pages and verifying an actual deployment and its visibility require user approval.
