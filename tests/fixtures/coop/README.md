# Coop/Tjek fixtures

These are secret-free, representative Tjek command responses recorded as
offline fixtures. The base64 `businesses`/`offers` commands and response
envelopes follow the observations and cited open-source client in
`.scratch/offers-v1/research/third-party-offer-sources.md`. Business city/chain
metadata and public IDs, publication IDs, prices, products, and addresses are
fixture values because no raw Tjek payload was preserved; they are not
credentials or a claim that the undocumented endpoint currently returns this
exact payload.

The job tests replay the fixtures through an injected fetcher. They make no
network requests. A generated 100-record first page exercises the observed
offset pagination boundary without storing a large repetitive fixture.
