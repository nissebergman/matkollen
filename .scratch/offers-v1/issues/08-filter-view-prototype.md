# How should the filterable Offer list look and behave on mobile?

Type: prototype
Status: resolved
Blocked by: 06
Parent: ../map.md

## Question

How should the single Offer list look and behave on a phone? Cover the card or row layout of an Offer, how the Chain, Store, category and search filters are presented and combined, sorting by price or discount, and empty or partial states. Build a rough clickable prototype on a sample of real snapshot-shaped data and react to it.

## Outcome (2026-11-18)

Resolved by the production mobile-first flyer UI in `src/App.tsx`,
`src/components/StorePicker.tsx` and `src/styles.css`, rather than retaining a
separate throwaway prototype. It combines Chain, Store, category and text
filters; sorts by displayed purchase price or computable discount; preserves
view state in the URL; and handles empty, loading and source-failure states.
The real published page was exercised by Playwright at desktop, tablet and
two mobile widths. See [`README.md`](../../../README.md#locations) and
`tests/App.filters.test.tsx`.
