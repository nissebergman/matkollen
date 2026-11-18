# 09: Publish and refresh the app automatically

**What to build:** Make the household app and its Snapshots available through static hosting and refresh them automatically each day or on demand.

**Blocked by:** 02: Add ICA Offers; 03: Add Coop Offers; 07: Keep Offers visible when a source fails.

**Status:** resolved

- [x] A GitHub Actions workflow runs the Snapshot job daily around 05:00 UTC and supports manual runs; the app and Snapshots are deployed together to GitHub Pages.
- [x] A partially failed refresh still publishes successful and retained stale data, then reports a failed workflow run for maintainer notification.
- [x] The published app loads its Snapshot correctly from the deployed site and does not request Chain endpoints from the browser.
- [x] No source credentials are committed or stored as CI secrets; the workflow and publication behaviour are verified without requiring live endpoints in the automated tests.
- [x] Document that GitHub Pages may be publicly accessible and verify that the chosen repository and Pages visibility are acceptable before publishing household data.

## Answer

The public Pages site is live at
<https://nissebergman.github.io/matkollen/>. Run
[44256936947](https://github.com/nissebergman/matkollen/actions/runs/44256936947)
deployed Snapshot commit
[60ce187](https://github.com/nissebergman/matkollen/commit/60ce187) with every
Chain fresh: ICA 787 Offers across 12 Stores (Tjek), Coop 293 across six (Tjek)
and Hemköp 452 across seven (Axfood). The app and Snapshot URLs return HTTP
200, and the deployed bundle requests the Location Snapshot under
`/matkollen/snapshots/`. An earlier partial run, recorded under Comments,
confirmed that a failing Chain still publishes and then fails the workflow as
designed. No source credentials or CI source secrets were used.

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

**Status note (2026-11-18, pre-publication):** The user authorized public Pages
deployment after source validation, using generated live Snapshots only. GitHub
reports Pages is disabled (`has_pages: false`) and no workflow is listed on the
remote default branch; the integration branch has not been pushed. No Pages
setting, push, or deployment has been changed. Hemköp validation remains
pending its permitted UTC window.

**Status note (2026-11-18, pre-publication):** Hemköp's bounded check is
complete; see ticket 10 and the Tjek source notes. The user authorized public
Pages deployment using generated live Snapshots only. GitHub reports this
public repository is empty (size 0, no branch refs), despite `main` being
configured as its default branch, and Pages is disabled (`has_pages: false`).
The integration branch must be pushed first; it may need to become the default
branch before the workflow can be dispatched. No remote branch, Pages setting
or deployment has changed yet.

**Status note (2026-11-18, branch published):** Commit `af71763` pushed
`integration/offers-v1` as the sole remote branch, and GitHub set it as the
default branch. The workflow file is present and passes local `actionlint`,
but GitHub's workflow API still reports no registered workflows. Pages remains
disabled and no deployment has run; retry workflow registration after the
default-branch push is indexed.

**Status note (2026-11-18, first deployment, partial refresh):** Manual run
[44246089770](https://github.com/nissebergman/matkollen/actions/runs/44246089770)
generated and deployed Snapshot commit
[3b56b4c](https://github.com/nissebergman/matkollen/commit/3b56b4c) at
2026-11-18T05:49:13Z. It contains 293 fresh Coop Tjek Offers and no fixture
Chains or Offers. ICA's anonymous token request returned HTTP 403, and
Hemköp's first-party campaign response had an unsupported `comparePrice`
shape; both failed closed with no Offers. The Pages deployment succeeded, and
the workflow then reported the partial refresh as failed as designed. The app
and Snapshot URLs return HTTP 200, and the deployed bundle requests the
Location Snapshot under `/matkollen/snapshots/`. No source credentials or CI
source secrets were used.

**Status note (2026-11-18, after publication):** The Hemköp `comparePrice`
failure was traced to an observed price range and fixed locally with offline
regression coverage; see ticket 01 and the Hemköp source notes. The deployed
Snapshot still contains the original failures. ICA's HTTP 403 has not been
retried or bypassed, and a complete refresh after the Hemköp fix has not been
verified.

**Status note (2026-11-18, successful refresh):** ICA was explicitly
configured to use Tjek. Run
[44256936947](https://github.com/nissebergman/matkollen/actions/runs/44256936947)
successfully deployed Snapshot commit
[60ce187](https://github.com/nissebergman/matkollen/commit/60ce187). The live
Snapshot reports all Chains fresh: ICA 787 Offers across 12 Stores, Coop 293
across six, and Hemköp 452 across seven; each discovered Store has Offers.
ICA member-price compatibility and Tjek's terms risks remain documented.
