# Coop offer data access

**Checked:** 2026-11-17. Live requests below were read-only. No API key value is reproduced here.

## Finding

The most direct source for a scheduled snapshot is Coop's first-party store API: get the store map, request each store's detail by `ledgerAccountNumber`, then follow its current flyer link. The map/detail API requires the `Ocp-Apim-Subscription-Key` configured in Coop's public website; requests with that key but no Coop member session succeeded, while a request without the key returned 401. The page's public configuration is not a published third-party API agreement or a guarantee of continued access.

The verified Linköping physical-store source is a per-store flyer PDF, not a structured JSON list of individual Offers. Coop has a separate online-promotions API with structured product and promotion fields, but a request using a Linköping physical `storeId` returned zero products. It should not be mistaken for the physical-store flyer feed.

## First-party endpoints and observed responses

### Store map

The official [stores and weekly offers page](https://www.coop.se/butiker-erbjudanden/) says it shows the weekly offer for the selected store. Its first-party [stores JavaScript bundle](https://www.coop.se/Assets/apps/coopse/dist/coopse.script.storesApp.0174522e.js) configures the store API and sends `Ocp-Apim-Subscription-Key`.

```text
GET https://proxy.api.coop.se/external/store/stores/map?conceptIds=12,6,95&invertFilter=true&api-version=v2
```

The live request returned HTTP 200 and 718 map records when the subscription-key header was supplied. The observed map fields were `storeId`, `ledgerAccountNumber`, `name`, `address`, `phone`, `openingHoursToday`, `latitude`, `longitude`, `url`, `city`, and `postalCode`. Filtering those records for `city == "Linköping"` returned the six stores listed below.

Without the key, the same endpoint returned HTTP 401 and an Azure API Management challenge naming `Ocp-Apim-Subscription-Key`. The public Coop page configuration contains the key; no member Bearer token was needed for the successful map or detail requests. Do not copy the key into this project or treat it as an issued third-party credential.

### Store details and physical-store flyer

Use the six-digit `ledgerAccountNumber` in the detail path—not the numeric `storeId`:

```text
GET https://proxy.api.coop.se/external/store/stores/056010?api-version=v7&onlyVisibleOpeningHours=true&includeFlyers=true
```

For Stora Coop Garnisonen Linköping this returned HTTP 200, with `id: 2303`, `ledgerAccountNumber: "056010"`, `name: "Stora Coop Garnisonen Linköping"`, `concept: {"id": 1, "name": "Stora Coop"}`, and `weeklyOffersLink: "https://dr.coop.se/butik/056010"`. The actual top-level fields in that response were:

`address`, `alwaysOpen`, `city`, `concept`, `flyers`, `futureIrregularOpeningHours`, `id`, `isAvailableForDr`, `isTemporaryClosed`, `latitude`, `ledgerAccountNumber`, `longitude`, `name`, `openingHours`, `openingHoursToday`, `ownerLedger`, `ownerLogoUrl`, `ownerName`, `ownerOrganizationNumber`, `ownerUrl`, `partOpeningHours`, `phone`, `postalCode`, `services`, `siteId`, `staffing`, `temporaryClosedDetails`, `temporaryClosedHeadline`, `url`, `weeklyOffersLink`.

Its `flyers` entry had `id: 205762`, `startDate: "2026-11-16T00:00:00"`, `stopDate: "2026-11-22T23:59:59"`, `current: true`, `pdfExists: true`, `pdfUrl`, `isHemmaBilaga: false`, and `imageUrl`. These are flyer-level fields; this JSON did not contain individual product Offers.

An unauthenticated `GET https://dr.coop.se/butik/056010` returned HTTP 200 with `Content-Type: application/pdf` and a 3,550,896-byte response. A `HEAD` request returned 405, so use GET when verifying the flyer. The store response's `weeklyOffersLink` and `pdfUrl` are the available paths to the flyer and its preview.

### Separate online product promotions

The official [online offers page](https://www.coop.se/handla/aktuella-erbjudanden/) and its [e-commerce JavaScript bundle](https://www.coop.se/Assets/apps/coopse/dist/coopse.script.ecommerceApp.c7cb3dc9.js) use this API:

```text
POST https://external.api.coop.se/personalization/search/products/promotions?api-version=v2&store=251300&direct=false&only-primary=false
```

The page's client sends a subscription-key header and a JSON request with `resultsOptions` (including `skip` and `take`). A request with the page-configured key and no member login returned HTTP 200 and `results.count: 1098` for its configured online store `251300`. The same request using Linköping physical `storeId` `2303` returned HTTP 200 with `results.count: 0`. That result does **not** mean the physical store has no Offers; its separate flyer response confirms a current flyer.

Relevant fields observed on one online product item included `id`, `ean`, `name`, `manufacturerName`, `packageSize`, `salesPriceData`, `onlinePromotions`, `availablePromotions`, `availableOnline`, `comparativePriceData`, `comparativePriceText`, `comparativePriceUnit`, `navCategories`, and `imageUrl`. The promotion object included `id`, `priceData`, `startDate`, `endDate`, `message`, `type`, `numberOfProductRequired`, `medMeraRequired`, `priority`, `comparativePrice`, and `higherThanHistoricalPrice`. Thus the online response has price, mechanic, comparison/unit-price, date, category, image, and a member-requirement flag (`medMeraRequired`; the sampled promotion had `false`). `manufacturerName` is the observed brand-like field; no `brand` field was present in that item. These are online-store results, not verified Linköping flyer items.

For this project, keep promotions with `medMeraRequired: true` as ordinary Offers; the one sampled promotion only verifies that the field exists, not that it was member-required.

## Linköping Coop stores returned by the live map

| Store | `storeId` | `ledgerAccountNumber` | Address | Postal code |
|---|---:|---|---|---|
| Stora Coop Garnisonen Linköping | 2303 | `056010` | Garnisonsvägen 50 | 58750 |
| Coop Vallaplan | 239 | `056019` | Malmslättsvägen | 58246 |
| Coop Lägerhyddan | 240 | `056020` | Rekrytgatan 5 | 58214 |
| Coop Lambohov | 238 | `056016` | Tröskaregatan 33 | 58333 |
| Coop Ullstämma | 3868 | `056212` | Bronsåldersgatan 2 | 58951 |
| Coop Drottninggatan Linköping | 3867 | `056211` | Drottninggatan 23 | 58225 |

The observed names comprise one Stora Coop and five Coop stores; none was named Coop Konsum in this live result. The numeric `storeId` and six-digit `ledgerAccountNumber` are different identifiers.

## Offer fields and store scope

| Requested data | Physical Linköping flyer API | Separate online promotions API |
|---|---|---|
| Product name / brand | Not structured in the store-detail response; extract from flyer/PDF or page content. | `name`; `manufacturerName` (brand-like). |
| Price / mechanic / member requirement | Not structured in the flyer metadata; extract from flyer/PDF or page content. | `salesPriceData`, promotion `priceData`, `message`, `type`, `numberOfProductRequired`, `medMeraRequired`. |
| Comparison / unit price | Not structured in the flyer metadata. | `comparativePriceData`, `comparativePriceText`, `comparativePriceUnit`; promotion `comparativePrice`. |
| Validity | Flyer `startDate` and `stopDate`. | Promotion `startDate` and `endDate`. |
| Category / image | Flyer `imageUrl` is a flyer preview, not a confirmed product image; no product category in the flyer metadata. | `navCategories` and product `imageUrl`. |

Two Linköping stores had distinct flyer IDs and PDF URLs for the same Offer Week (2026-11-16 through 2026-11-22): Stora Coop Garnisonen (`205762`) and Coop Vallaplan (`206360`). This is evidence that physical-store flyers are store-specific. No national physical-store product-feed endpoint was found. The online promotions API is also store-contextual, but its tested Linköping physical-store ID returned no items.

## CORS, rate limits, terms, and stability

- Live CORS preflights for the store API (`GET`) returned `Access-Control-Allow-Origin: https://www.coop.se`, `Access-Control-Allow-Methods: GET`, and `Access-Control-Allow-Headers: ocp-apim-subscription-key`. The promotions API (`POST`) returned the same allowed origin, `Access-Control-Allow-Methods: POST`, and `Access-Control-Allow-Headers: content-type,ocp-apim-subscription-key`. With `Origin: http://localhost:5173`, both returned no `Access-Control-Allow-Origin` header; a browser-hosted SPA on another origin should expect CORS to block direct calls. The scheduled server-side job avoids that dependency.
- No public Coop developer portal/API contract or numeric rate-limit guidance was found in the sources checked. The successful store-detail response had no rate-limit or retry-after headers. Treat throttling as possible: use sequential, low-frequency requests, cache responses, and back off on errors.
- Coop's [website robots.txt](https://www.coop.se/robots.txt) allows `/` generally but disallows specific account, search, and checkout paths. The [flyer host robots.txt](https://dr.coop.se/robots.txt) allows `/` except `*/period/`; the two API hosts' `/robots.txt` paths returned 404. Robots rules are not permission or authorization ([RFC 9309 §1](https://www.rfc-editor.org/rfc/rfc9309.html#section-1)).
- Coop's [user terms](https://www.coop.se/coop-kundservice/anvandarvillkor/) §4.3 restrict copying content from Coop's channels when using a Customer Account except through designated features, and §7.1 reserves intellectual-property rights to Coop or its licensors. These terms are not a third-party API license; the public client key and robots rules do not establish reuse rights. Personal use still carries ToS and content-reuse uncertainty; avoid redistribution and seek permission before broader use.
- The APIs are visible in Coop's own browser bundles but have no public contract located in this research; the store and promotions APIs use explicit version parameters (`v7`/`v2`), and the bundles have hashed filenames. Assume endpoint schemas, keys, and flyer URLs can change without notice.

## Open-source implementation evidence (not authoritative permission)

- [FirebrawlX/VeckansMat Coop scraper](https://github.com/FirebrawlX/VeckansMat/blob/b706937de11357cd3f0a95b6ffd1903c5573b145/scripts/scrape-coop-offers.mjs#L106-L156) reads visible offer-card text and follows a `dr.coop.se` PDF link; it also validates/extracts PDF text ([PDF parsing](https://github.com/FirebrawlX/VeckansMat/blob/b706937de11357cd3f0a95b6ffd1903c5573b145/scripts/scrape-coop-offers.mjs#L174-L180)). This is an example of a non-official fallback, not an API contract.
- [klintskar/matPriser Coop adapter](https://github.com/klintskar/matPriser/blob/b8755931f27f2eeb8852b37858cfa2ea7b59e097/src/retailers/coop.ts#L17-L60) follows a store flyer URL, downloads the PDF, extracts text, and parses offers. This corroborates the PDF-extraction approach, not permission or stability.

## Snapshot-job implication

For the personal snapshot, fetch the store map at low frequency, filter the six Linköping records, request detail by each `ledgerAccountNumber`, and fetch/parse the current store flyer PDF using its validity dates. Preserve source URL and retrieval time and tolerate missing/changed flyers. Treat structured online promotions as a separate optional feed, not as the physical-store offer source. The UI can read the produced snapshot instead of calling Coop from the browser.
