# What stack and hosting do the SPA and the snapshot job use?

Type: grilling
Status: resolved
Blocked by: 05
Parent: ../map.md

## Question

What framework, language and build tool does the SPA use? Where and how does the scheduled snapshot job run (for example GitHub Actions cron or a serverless function), where is the snapshot stored, and where is the SPA hosted? Constraints that follow from the chosen sources (needed secrets, IP blocking, runtime) must be satisfied.

## Answer

_Resolved 2026-11-18._

Resolved: TypeScript, React and Vite for the SPA; a TypeScript Snapshot job
scheduled and manually dispatched by GitHub Actions; static Snapshot and app
deployment to GitHub Pages. Source credentials are not stored. The deployment
is the repository's GitHub default branch, `integration/offers-v1`, and the
latest publication run completed successfully. Details and constraints are
recorded in [the v1 spec](09-v1-spec.md#stack-and-hosting-resolves-ticket-07)
and [`README.md`](../../../README.md).
