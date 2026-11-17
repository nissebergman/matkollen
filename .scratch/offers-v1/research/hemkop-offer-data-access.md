# Hemköp store and weekly-offer data access

**Observed:** 2026-11-17 (Europe/Stockholm). Findings are from Hemköp/Axfood public pages and limited, read-only HTTP probes. No Hemköp account, cookies, or authorization credentials were used. This is an undocumented website interface, not a published public API.

## Bottom line

- **Store list:** Hemköp's store finder is backed by `GET https://www.hemkop.se/axfood/rest/store?online=false&clickAndCollect=false&b2bClickAndCollect=false`. It returned 206 store records; filtering `address.town == "Linköping"` produced the seven Stores below. Use `storeId`, not `id`. [Hemköp store finder](https://www.hemkop.se/butik-sok) · [Hemköp client bundle](https://www.hemkop.se/_next/static/chunks/pages/_app-d25ae0c6536137e2.js) · [tested store response](https://www.hemkop.se/axfood/rest/store?online=false&clickAndCollect=false&b2bClickAndCollect=false)
- **Offers:** an unauthenticated GET to `https://www.hemkop.se/search/campaigns/offline?q={storeId}&type=PERSONAL_GENERAL&page={page}&size=30&disableMimerSort=true` returned offer JSON. For Lucullus (`4552`), page 0 contained 30 products, with `pagination.numberOfPages: 3` and `totalNumberOfResults: 66`. Follow the response pagination per Store rather than assuming one page is complete. [tested Lucullus response](https://www.hemkop.se/search/campaigns/offline?q=4552&type=PERSONAL_GENERAL&page=0&size=30&disableMimerSort=true)
- **Klubbpris:** the anonymous response included a promotion with `campaignType: "LOYALTY"`, `textLabel: "Klubbpris"`, a numeric price, unit comparison price, and validity dates. No customer authentication was needed to read it; Hemköp's terms say Klubberbjudanden can only be used by logged-in members. [tested Lucullus response](https://www.hemkop.se/search/campaigns/offline?q=4552&type=PERSONAL_GENERAL&page=0&size=30&disableMimerSort=true) · [Hemköp terms, §6](https://www.hemkop.se/artikel/anvandarvillkor) · [Hemköp pricing guide](https://www.hemkop.se/artikel/prissattning)
- **Important restriction:** Hemköp's `robots.txt` has `Disallow: /*?q=`, which matches this campaign request, plus `Crawl-delay: 10` and `Visit-time: 0400-0845` UTC. The endpoint is technically readable, but the exact campaign URL is explicitly disallowed to crawlers. Do not schedule recurring requests without accepting that risk and, ideally, obtaining Hemköp's permission. [Hemköp robots.txt](https://www.hemkop.se/robots.txt)
- **Stability/scope:** these are first-party, undocumented site endpoints, not a supported API contract; no public SLA or numeric rate limit was found. The offer query is keyed by Store, but no field establishes whether an individual Offer is local or shared nationally. Hemköp also cautions that its e-commerce prices can differ from physical-store prices. [Hemköp terms, §1 and §6](https://www.hemkop.se/artikel/anvandarvillkor) · [Hemköp pricing guide](https://www.hemkop.se/artikel/prissattning)

## 1. Linköping Stores

The store response had 206 entries. Filtering on the exact town value `"Linköping"` returned these seven records (addresses and IDs as observed on 2026-11-17). Each record also has a `flyerURL`, with the observed pattern `https://hemkop.eo.se/hkp/{storeId}.pdf`; the PDFs were not inspected.

| Hemköp Store | `storeId` | Address |
|---|---:|---|
| Hemköp Linköping Lucullus | 4552 | Stora Torget 5, 582 19 |
| Hemköp Linköping Priso | 4701 | Timmermansgatan 1, 582 77 |
| Hemköp Linköping Ryd | 4193 | Mårdtorpsgatan 27, 582 48 |
| Hemköp Linköping Storgatan | 4277 | Storgatan 11, 582 23 |
| Hemköp Linköping Tallboda | 4225 | Gränsliden 6, 582 74 |
| Hemköp Linköping Ullstämma Östenssons | 4738 | Värmevägen 2, 589 37 |
| Hemköp Lkpg Folkungavallen Östenssons | 4757 | Badmästargatan 1, 582 43 |

The store endpoint returned HTTP 200 JSON without an Authorization header or session cookie. Its response fields include `storeId`, `name`, `address` (including `town`, `line1`, and `postalCode`), `geoPoint`, `openingHours`, `onlineStore`, `franchiseStore`, and `flyerURL`. The current Hemköp client bundle defines a GET operation for `/axfood/rest/store`. [Store finder page](https://www.hemkop.se/butik-sok) · [client bundle](https://www.hemkop.se/_next/static/chunks/pages/_app-d25ae0c6536137e2.js) · [tested store response](https://www.hemkop.se/axfood/rest/store?online=false&clickAndCollect=false&b2bClickAndCollect=false)

## 2. Offer endpoint and observed fields

The tested request was:

```text
GET https://www.hemkop.se/search/campaigns/offline
    ?q=4552&type=PERSONAL_GENERAL&page=0&size=30&disableMimerSort=true
```

It returned HTTP 200 with `Content-Type: application/json;charset=UTF-8`, without login, cookies, or an Authorization header. The top-level JSON contains `results`, `pagination`, `sorts`, `relatedResults`, `currentQuery`, `breadcrumbs`, and `facets`. The tested pagination reported 30 results on page 0, 3 pages, and 66 total results. [Live response](https://www.hemkop.se/search/campaigns/offline?q=4552&type=PERSONAL_GENERAL&page=0&size=30&disableMimerSort=true)

Representative fields from the response:

| Need | Observed field(s) | Example / caveat |
|---|---|---|
| Name and brand | `results[].name`, `results[].manufacturer`; promotion `name` and `brands` | `Krossade tomater`, manufacturer `Garant`. |
| Product price and unit | `price`, `priceNoUnit`, `priceUnit`, `displayVolume` | `12,25 kr`, `12,25`, `kr/st`, `390g`. Product `price` is a formatted string. |
| Offer price and mechanic | `potentialPromotions[]`: `campaignType`, `promotionType`, `price`, `cartLabel`, `conditionLabel`, `rewardLabel`, `textLabel`, `description`, `realMixAndMatch`, `qualifyingCount`, `threshold`, `redeemLimit` | General sample: `campaignType: "GENERAL"`, `promotionType: "MixMatchPricePromotion"`, `price: 6.0`, `cartLabel: "6 kr/st"`. |
| Member-only offer | `campaignType`, `textLabel`, `textLabelGenerated`, `cartLabel`, `price` | “Läsk 4-pack”: `LOYALTY`, “Klubbpris”, `49.95`, “49,95 kr/st”. |
| Comparison/unit price | Promotion `comparePrice`; product `priceUnit`, `promotionProductOrdinaryComparePrice`, `promotionProductOrdinaryComparePriceUnit` | Samples include `15,38/kg` and `8,33/l +pant`. |
| Validity | Promotion `startDate`, `endDate`, `validUntil` | Sample dates `16/11-2026`–`22/11-2026`; `validUntil` is also present as epoch milliseconds. |
| Category | `googleAnalyticsCategory` | Example: `skafferi|konserver-och-burkar|tomatkonserver`; no dedicated `category` object appeared in this result. |
| Image | `image`, `originalImage`, `thumbnail` | Each may contain an asset URL; sample `image.url` points to `assets.axfood.se`. |

Fields vary with promotion type. For example, an observed weight-based loyalty promotion had `price: null` but still had a `cartLabel` and `comparePrice`; do not assume every promotion has a numeric `price`. This is a sample of one Store's response, not a complete schema or contract. [Live response](https://www.hemkop.se/search/campaigns/offline?q=4552&type=PERSONAL_GENERAL&page=0&size=30&disableMimerSort=true)

The store ID is supplied as query parameter `q`; the returned promotions do not carry a reliable per-Store/national-scope field. Thus, the API is queried per Store, but this probe cannot establish whether a given Offer is exclusive to that Store or shared across the chain. Hemköp's pricing guide says prices shown on hemkop.se are e-commerce prices and prices in physical stores may vary by Store or location, so validate the intended in-store interpretation before labeling the snapshot as exact shelf pricing. [Hemköp pricing guide](https://www.hemkop.se/artikel/prissattning)

## 3. CORS, rate limits, and terms

- **CORS:** GET responses from the tested Hemköp store and campaign endpoints included `Access-Control-Allow-Origin: *` and `Cache-Control: no-cache, no-store, max-age=0, must-revalidate`. A separate OPTIONS probe to both endpoints with `Origin: https://example.com`, requested method `GET`, and requested header `content-type` returned HTTP 403; it exposed `Access-Control-Allow-Origin: *` but no `Access-Control-Allow-Methods` or `Access-Control-Allow-Headers`. A scheduled server-side job is not subject to browser CORS; do not assume browser requests with custom headers will work. [Store response](https://www.hemkop.se/axfood/rest/store?online=false&clickAndCollect=false&b2bClickAndCollect=false) · [campaign response](https://www.hemkop.se/search/campaigns/offline?q=4552&type=PERSONAL_GENERAL&page=0&size=30&disableMimerSort=true)
- **Limits:** no `Retry-After` or `X-RateLimit-*` header appeared in the inspected GET responses, and I found no public numeric rate-limit contract. This is not evidence that the site has no server-side limits. `robots.txt` specifies a 10-second crawl delay and the UTC visit window above; the matching `?q=` disallow is the more important constraint for this offer route. [Hemköp robots.txt](https://www.hemkop.se/robots.txt)
- **Terms:** Hemköp's e-commerce terms say site content and functions may be changed or removed without advance notice, and that Klubberbjudanden can only be used by logged-in Klubb Hemköp customers. The terms reviewed do not describe this endpoint as a supported API. Public visibility of a Klub price is not the same as permission to redeem it without membership. [Hemköp terms, §§1, 2, 6](https://www.hemkop.se/artikel/anvandarvillkor)
- **Stability:** `/axfood/rest/store` and `/search/campaigns/offline` are first-party routes, but the offer path is unversioned and undocumented. Treat the response fields and pagination as changeable; add validation and alert on unexpected schema/status changes. No SLA was found. [Hemköp client bundle](https://www.hemkop.se/_next/static/chunks/pages/_app-d25ae0c6536137e2.js) · [Hemköp terms](https://www.hemkop.se/artikel/anvandarvillkor)

## 4. Axfood/Willys relationship and GitHub examples

Axfood identifies both Hemköp and Willys as concepts in its group. A no-auth GET to Willys' corresponding `/axfood/rest/store?...` route also returned HTTP 200 JSON, with the same store-object field set (`storeId`, `name`, `address`, `geoPoint`, `flyerURL`, etc.). This is strong evidence of a shared Axfood commerce implementation, not a public cross-brand API guarantee. [Axfood on Hemköp](https://www.axfood.com/about-axfood/the-axfood-family/hemkop/) · [Axfood on Willys](https://www.axfood.com/about-axfood/the-axfood-family/willys/) · [Willys store response](https://www.willys.se/axfood/rest/store?online=false&clickAndCollect=false&b2bClickAndCollect=false)

- [`maxvalter/FyndFind`](https://github.com/maxvalter/FyndFind/blob/cb98ad878dcb3779f298027e56677a0cad36f95e/src/lib/scrapers/hemkop.ts) implements Hemköp store lookup and calls `/search/campaigns/offline?q={storeId}&type=PERSONAL_GENERAL...`; its Hemköp scraper reuses the project's Axfood campaign-item parser. The repo's GitHub metadata has no declared license, so treat it as a public code example, not a licensed dependency. [Repository metadata](https://api.github.com/repos/maxvalter/FyndFind)
- [`elfgren89/Willys-Rabattkoll`](https://github.com/elfgren89/Willys-Rabattkoll/blob/8d5b0437a3d6d3007604c330f922f0f8585a968/api/index.py) calls Willys' matching `/search/campaigns/offline` route. Its repo likewise has no declared license. [Repository metadata](https://api.github.com/repos/elfgren89/Willys-Rabattkoll)
- [`Colin-Andrew-Rasiga/matval`](https://github.com/Colin-Andrew-Rasiga/matval) is MIT-licensed and has a Hemköp scraper, but it scrapes product catalog/detail routes (`/c/...`, `/axfood/rest/p/...`), not this offers endpoint. Its README says both Hemköp and Willys specify `Crawl-delay: 10` and `Visit-time: 0400-0845 UTC`. [Hemköp spider](https://github.com/Colin-Andrew-Rasiga/matval/blob/main/scrape_supermarket_websites/hemkop/scraper/hemkop_scraper/spiders/hemkop_spider.py) · [README](https://github.com/Colin-Andrew-Rasiga/matval/blob/main/README.md) · [MIT license](https://github.com/Colin-Andrew-Rasiga/matval/blob/main/LICENSE)
- [`ostwilkens/primat-api`](https://github.com/ostwilkens/primat-api) is an MIT-licensed third-party client/API project that says its `offers=1` endpoint includes current member campaigns. It requires a Primat API key, and its README says the data is not open data; it is an alternative provider, not a Hemköp-published endpoint. [README and terms summary](https://github.com/ostwilkens/primat-api/blob/main/README.md)

## Practical conclusion

A scheduled backend can technically obtain the store catalog and current campaign JSON without Hemköp customer authentication, and Klubbpris fields are present. For the seven Linköping Stores, use the returned `storeId` values and follow each response's `pagination`. However, the exact campaign URL is covered by Hemköp's `robots.txt` `Disallow: /*?q=` rule, and the interface has no public API support contract. For personal use, this is a material robots/terms and breakage risk; do not disguise or work around the disallowed request. The store API's `flyerURL` values are a possible first-party human-readable reference, but their contents and machine-readability were not tested.
