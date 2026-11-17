# Tjek fixtures

`businesses-coop-brand.json` is a sanitized excerpt from the anonymous live
Tjek `businesses` response observed on 2026-11-17. It retains only the Coop
brand's public ID and name; it is a global brand record, not a Store record.

`stores-coop-63eeoD.json` retains one Linköping Store row from the authorized
anonymous `stores` response for Coop brand `63eeoD`. It preserves the verified
`{key, status, value: {data: [...]}}` envelope, with the unused `key` and
`status` values redacted, and contains only the verified Store ID, name, city,
street address, and coordinates. The original response contained 621 Store
records; this fixture is a one-row excerpt and does not represent the full
list.
The adapter allows blank `name` strings while validating these broad Store
lists, then fails closed before publication lookup if a selected Location Store
has no display name. The regression tests use synthetic blank-name rows; no live
Store payload containing one was retained.

`fronts-coop-drottninggatan.json` preserves the observed Store-specific
`fronts` envelope: `{key, status, value: [{category, business,
publications}]}`. The key, status and category values are redacted/placeholders;
the front's business public ID and nested publication ID, label and exact
validity timestamps are retained. The adapter verifies the front business ID
against the business ID associated with the discovered Store, then flattens
its publications. Tjek's `validUntil` is an exclusive local-midnight boundary
in this response; the adapter treats the publication as valid through
2026-11-22.

`publication-pages-coop-NV_F04Kb.json` is a parser fixture based on live page
hotspots for publication `NV_F04Kb`, limited to three Offer IDs with
individual lookups. The raw page-to-ID grouping was not retained, so those
IDs are grouped on one page for the test; this is not the complete 20-page
response.
`offer-*.json` contains sanitized, normalized subsets of the corresponding
individual Offer records, with Tjek request keys redacted. The reported names,
prices, units, sizes, limits and category slugs are preserved. The exact
per-Offer date timestamps were not retained, so the date-only fixture values
use the reported publication window; they are not claims about each Offer's
exact live validity. These fixtures verify only this publication sample, not
all Offers or all Linköping Stores. A separate live individual lookup also
returned “Färsk fläskfilé” with membership and unit price 79.9 per kilogram;
its full response is not included because the retained summary did not
contain all fields needed for a fixture.

The ICA and Hemköp Store/Offer examples are synthetic, secret-free fixtures
for the legacy adapter schema. Their Store identities, Offer values, and
associations are fabricated and do not verify the current Tjek response
shapes. `ica-hemkop-publication-flow-synthetic.json` is a hypothetical
end-to-end fixture for the shared Store/publication/Offer flow. It tests the
Snapshot contract and fail-closed association checks only; it is not based on
live ICA or Hemköp responses and does not establish source compatibility.
Tests replay fixtures through an injected fetcher and make no network
requests.
