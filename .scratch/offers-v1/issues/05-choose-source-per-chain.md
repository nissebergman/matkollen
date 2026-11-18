# Which source do we use for each Chain?

Type: grilling
Status: resolved
Blocked by: 01, 02, 03, 04
Parent: ../map.md

## Question

Given the research findings, which source does the snapshot job use for ICA, Coop and Hemköp? Choose between each Chain's own source, one aggregator for all Chains, or a mix. Weigh coverage, field richness, stability and ToS risk, and record a fallback for each Chain.

## Decision (2026-11-18)

The configured source is selected independently per Chain in
`src/snapshot/locations.json`:

| Chain | Configured source | Fallback / limitation |
|---|---|---|
| ICA | Tjek/eReklamblad | First-party access returned HTTP 403; no automatic retry or source switch. ICA member-price mapping remains unverified. |
| Coop | Tjek/eReklamblad | Experimental Store-specific flyer-PDF adapter exists but fails closed on the observed ambiguous row; keep Tjek configured. |
| Hemköp | Axfood first-party campaign API | Tjek's observed Incito Offer lookup works for a small sample, but live Store discovery and broad coverage are unverified. |

This mix prioritizes the source that currently works in production for each
Chain. Tjek is undocumented and its reuse terms remain a known risk; source
limitations and evidence are tracked in [ticket 10](../../offers-v1-implementation/issues/10-switch-ica-and-hemkop-to-tjek.md)
and [ticket 11](../../offers-v1-implementation/issues/11-switch-coop-to-flyer-pdfs.md).
The app is source-agnostic because all adapters produce the same Snapshot
contract. See [the v1 spec](09-v1-spec.md) and
[`README.md`](../../../README.md#locations).
