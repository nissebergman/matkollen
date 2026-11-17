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

The files under `public/` and `flyers/` are synthetic Coop API/page and
text-only PDF fixtures. The public configuration contains an obvious
fixture-only placeholder, not a Coop key. The PDFs are generated examples,
not copies of real flyers. `observed-coop-layout-synthetic.pdf` is a generated
two-page example built from short text fragments observed in one public
Stora Coop Garnisonen flyer: a `Jfr-pris`-only product description and a
price-first `2 för 169:-` Libero offer with a preceding purchase limit. It
models those text structures without preserving the source PDF.
