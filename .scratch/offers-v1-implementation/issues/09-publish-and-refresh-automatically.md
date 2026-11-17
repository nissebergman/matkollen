# 09: Publish and refresh the app automatically

**What to build:** Make the household app and its Snapshots available through static hosting and refresh them automatically each day or on demand.

**Blocked by:** 02: Add ICA Offers; 03: Add Coop Offers; 07: Keep Offers visible when a source fails.

**Status:** in_progress

- [ ] A GitHub Actions workflow runs the Snapshot job daily around 05:00 UTC and supports manual runs; the app and Snapshots are deployed together to GitHub Pages.
- [ ] A partially failed refresh still publishes successful and retained stale data, then reports a failed workflow run for maintainer notification.
- [ ] The published app loads its Snapshot correctly from the deployed site and does not request Chain endpoints from the browser.
- [ ] No source credentials are committed or stored as CI secrets; the workflow and publication behaviour are verified without requiring live endpoints in the automated tests.
- [ ] Document that GitHub Pages may be publicly accessible and verify that the chosen repository and Pages visibility are acceptable before publishing household data.

## Comments

The workflow is integrated and the user approved publishing to the public
`nissebergman/matkollen` repository. The active GitHub account has admin access,
the remote is configured, and the approved public commit email is set locally.
Actual publication and GitHub Pages verification are pending final review and
history cleanup. Pages must remain public only as already approved.

Live validation on 2026-11-17 completed the Coop refresh across all six
configured Linköping Stores, six publications and 293 Offers. The validated
Snapshot remains under session state; the checked-in public Snapshot still
contains demo fixture data and must not be published. A bounded ICA Tjek check
verified one Store-specific publication and three Offers with Store
association and date normalization, but none contained a member-price field;
Hemköp was not probed. This does not verify broader ICA/Hemköp compatibility or
complete multi-Chain deployment data. Actual publication and Pages verification
remain pending; do not enable Pages, deploy, or publish the fixture as part of
this repair.
