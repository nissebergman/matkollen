# What does a normalised Offer look like in the snapshot?

Type: grilling
Status: resolved
Blocked by: 05
Parent: ../map.md

## Question

What is the shape of one normalised Offer in the snapshot the SPA reads? Cover the required and optional fields, how offer mechanics are represented ("2 för 30 kr", "3 för 2", per-kg prices, max-purchase limits), the comparison price, validity, Store/Chain references, images, and what "discount" means for sorting when the original price is missing. Also decide the shape of the snapshot file as a whole, such as one file per Location versus per Store.

## Decision (2026-11-18)

Resolved by the implemented, versioned Snapshot contract documented in
[the v1 spec](09-v1-spec.md#snapshot-contract-resolves-ticket-06) and
`src/domain/snapshot.ts`. It publishes one JSON Snapshot per Location, with
Chain status, Stores, and normalized Offers. Numeric prices remain optional;
mechanics and comparison-price text are preserved when numeric values cannot
be derived. Discounts are computed only when regular and effective prices use
the same known unit. Local product illustrations are maintained separately
from Offer `imageUrl`s and matched conservatively by name.
