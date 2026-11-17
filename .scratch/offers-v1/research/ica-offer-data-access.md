# ICA store and weekly-offer data access

**Observed:** 2026-11-17 (Europe/Stockholm). Findings below are from public ICA pages and low-rate, read-only requests. No ICA customer credentials were used. The store search used ICA's short-lived anonymous public token; the community-described mobile offers route was not called. One cross-origin probe of the offers HTML returned HTTP 403; I did not retry or attempt to work around it.

## Bottom line

- **Store search:** the current ICA site client builds a first-party request to `https://apim-pub.gw.ica.se/sverige/digx/storesearch/v1/searchbyquery?...`. The gateway requires a bearer token, but the ICA site exposes an anonymous public-token endpoint (`https://www.ica.se/e11/public-access-token`); its response had `isAnonymous: true`. A request without the bearer returned 401; one with the public token returned 200. The route and token handling appear in ICA's own web client bundle (`src-CsDy5qkt.js:12`). [ICA client bundle, line 12](https://assets.icanet.se/raw/upload/v1/customer-solutions-apps/mdsa-store-vue3/assets/src-CsDy5qkt.js#L12) · [public token endpoint](https://www.ica.se/e11/public-access-token) · [tested store-search request](https://apim-pub.gw.ica.se/sverige/digx/storesearch/v1/searchbyquery?query=Link%C3%B6ping&take=100&offset=0&onlyOnline=false&onlyOnlineB2B=false)
- **Current weekly offers:** the lowest-friction public source found is each store's ICA offers page, for example [ICA Supermarket Berga Centrum, Linköping](https://www.ica.se/erbjudanden/ica-supermarket-berga-centrum-linkoping-1003586/). Its page response includes `offers.weeklyOffers` in the HTML hydration state and the page visibly listed 76 weekly offers without a login. Personal offers are separately labeled as requiring sign-in. [Berga offers page](https://www.ica.se/erbjudanden/ica-supermarket-berga-centrum-linkoping-1003586/)
- **Coverage:** a `query=Linköping` store-search request returned 41 search hits; filtering the returned records for exact `visitingCity == "Linköping"` yielded 12 stores. Use each result's `accountNumber` or its `urls[]` entry with `type: "Erbjudande"` to reach the store's offers page. The API `id` is distinct from the account number used in the page URL; for Berga, `id`/offer `BMSStoreId` is `2151`, while `accountNumber` is `1003586`. [tested store-search request](https://apim-pub.gw.ica.se/sverige/digx/storesearch/v1/searchbyquery?query=Link%C3%B6ping&take=100&offset=0&onlyOnline=false&onlyOnlineB2B=false) · [Berga offers page](https://www.ica.se/erbjudanden/ica-supermarket-berga-centrum-linkoping-1003586/)
- **Support/stability:** these are first-party website services discovered from ICA's own page/client, not a published public API contract. I found no official, documented bulk-offers API, numeric request limit, or API-use terms in the bounded review. Treat the offers-page state as an undocumented extraction surface and seek ICA approval before relying on recurring production collection. [ICA store directory](https://www.ica.se/butiker/) · [ICA offers landing page](https://www.ica.se/erbjudanden/) · [ICA robots.txt](https://www.ica.se/robots.txt)

## 1. ICA Store search

### Tested endpoint and authentication

The tested request was:

```text
GET https://apim-pub.gw.ica.se/sverige/digx/storesearch/v1/searchbyquery
    ?query=Link%C3%B6ping&take=100&offset=0
    &onlyOnline=false&onlyOnlineB2B=false
Authorization: Bearer <short-lived ICA public token>
```

ICA's client bundle defines `STORE_SEARCH` as `/storesearch/v1`, builds `searchbyquery` with `query`, `take`, `offset`, `onlyOnline`, and `onlyOnlineB2B`, and adds a bearer token obtained from `/e11/public-access-token` (`src-CsDy5qkt.js:12`). The token endpoint was callable without a customer session and returned `isAnonymous: true`; the token itself was not retained or included here. A direct search call without `Authorization` returned 401 with “Missing Credentials”; the same search with the anonymous token returned 200. Thus the API gateway expects an authorization header, but the tested public store search did not require an ICA customer login. [ICA client bundle, line 12](https://assets.icanet.se/raw/upload/v1/customer-solutions-apps/mdsa-store-vue3/assets/src-CsDy5qkt.js#L12) · [public token endpoint](https://www.ica.se/e11/public-access-token) · [tested request](https://apim-pub.gw.ica.se/sverige/digx/storesearch/v1/searchbyquery?query=Link%C3%B6ping&take=100&offset=0&onlyOnline=false&onlyOnlineB2B=false)

The public `/butiker/` application also exposes a separate API base, `https://apim-pub.gw.ica.se/sverige/digx/mdsastoresearch/v1`. Its client builds `/page-and-filters` requests with `url`, `q`, `take`, `skip`, `sort`, and `storeId`, and adds a bearer access token (`src-CsDy5qkt.js:2`). This is a first-party directory backend identified in the current page/bundle, but I did not independently call this route; the store list below came from the tested `storesearch/v1` endpoint. [ICA store directory](https://www.ica.se/butiker/) · [ICA client bundle, line 2](https://assets.icanet.se/raw/upload/v1/customer-solutions-apps/mdsa-store-vue3/assets/src-CsDy5qkt.js#L2)

The tested `storesearch` response used lower-camel-case JSON keys such as `documents`, `stats`, `id`, `name`, `marketingName`, `visitingCity`, `accountNumber`, and `url`. A real result began: [tested response query](https://apim-pub.gw.ica.se/sverige/digx/storesearch/v1/searchbyquery?query=Link%C3%B6ping&take=100&offset=0&onlyOnline=false&onlyOnlineB2B=false)

```json
{
  "id": 2137,
  "name": "ICA Signalen, Linköping",
  "marketingName": "ICA Signalen, Linköping",
  "visitingCity": "Linköping",
  "accountNumber": "1003520",
  "url": "https://www.ica.se/butiker/kvantum/linkoping/ica-signalen-linkoping-1003520/"
}
```

The tested response had `stats.totalHits: 41`; filtering its 41 returned records to exact `visitingCity == "Linköping"` produced the following 12 entries. The table's `storesearch id` is the response's `id`; the Berga offers page independently shows `BMSStoreId: 2151`. Account numbers are separate and appear in official page URLs. [tested response query](https://apim-pub.gw.ica.se/sverige/digx/storesearch/v1/searchbyquery?query=Link%C3%B6ping&take=100&offset=0&onlyOnline=false&onlyOnlineB2B=false) · [Berga offers page](https://www.ica.se/erbjudanden/ica-supermarket-berga-centrum-linkoping-1003586/)

| ICA Store (official page) | `storesearch id` | `accountNumber` |
|---|---:|---:|
| [ICA Signalen, Linköping](https://www.ica.se/butiker/kvantum/linkoping/ica-signalen-linkoping-1003520/) | 2137 | 1003520 |
| [Maxi ICA Stormarknad Linköping](https://www.ica.se/butiker/maxi/linkoping/maxi-ica-stormarknad-linkoping-1003823/) | 8900 | 1003823 |
| [ICA Nära Vasavägen, Linköping](https://www.ica.se/butiker/nara/linkoping/ica-nara-vasavagen-linkoping-1004476/) | 2127 | 1004476 |
| [ICA Nära Skillingen, Linköping](https://www.ica.se/butiker/nara/linkoping/ica-nara-skillingen-linkoping-1003438/) | 2153 | 1003438 |
| [ICA Nära Flamman, Linköping](https://www.ica.se/butiker/nara/linkoping/ica-nara-flamman-linkoping-1003799/) | 2136 | 1003799 |
| [ICA Nära Skolgatan, Linköping](https://www.ica.se/butiker/nara/linkoping/ica-nara-skolgatan-linkoping-1003440/) | 2126 | 1003440 |
| [ICA Supermarket Berga Centrum, Linköping](https://www.ica.se/butiker/supermarket/linkoping/ica-supermarket-berga-centrum-linkoping-1003586/) | 2151 | 1003586 |
| [ICA Nära Djurgårdsgatan](https://www.ica.se/butiker/nara/linkoping/ica-nara-djurgardsgatan-1004217/) | 2129 | 1004217 |
| [ICA Supermarket Malmslätt](https://www.ica.se/butiker/supermarket/linkoping/ica-supermarket-malmslatt-1003755/) | 2138 | 1003755 |
| [ICA Supermarket Tannefors](https://www.ica.se/butiker/supermarket/linkoping/ica-supermarket-tannefors-1003503/) | 9701 | 1003503 |
| [ICA Supermarket Johannelund](https://www.ica.se/butiker/supermarket/linkoping/ica-supermarket-johannelund-1003967/) | 2154 | 1003967 |
| [ICA Supermarket Storgatan](https://www.ica.se/butiker/supermarket/linkoping/ica-supermarket-storgatan-1004552/) | 16325 | 1004552 |

An unversioned alternative, `https://www.ica.se/api/store/search?q=Link%C3%B6ping&take=40`, also returned HTTP 200 and a PascalCase `Documents` collection in a low-rate probe. Its first records included stores outside Linköping, so that request did not yield an exact city list. I found no current ICA client code or public contract for this path; prefer the versioned gateway search above rather than assuming this older-looking route's `q` behavior. [tested alternate route](https://www.ica.se/api/store/search?q=Link%C3%B6ping&take=40) · [current ICA client bundle, line 12](https://assets.icanet.se/raw/upload/v1/customer-solutions-apps/mdsa-store-vue3/assets/src-CsDy5qkt.js#L12)

## 2. Current offers and available fields

### Public per-store offers page

The direct public page pattern is `https://www.ica.se/erbjudanden/{store-slug}-{accountNumber}/`; the tested example is [ICA Supermarket Berga Centrum, Linköping](https://www.ica.se/erbjudanden/ica-supermarket-berga-centrum-linkoping-1003586/). The page response embeds `offers.weeklyOffers` in `window.__INITIAL_DATA__`; the visible page said “Veckans erbjudanden” and “Visar 76 stycken.” It also says to log in to see personal offers. ICA's generic [offers landing page](https://www.ica.se/erbjudanden/) says to choose a store for current store offers, including Stammis prices and other unique offers, and displays a separate “Veckans TV-erbjudanden” section with two offers. This landing view is not evidence of a complete nationwide offers feed. [Berga offers page](https://www.ica.se/erbjudanden/ica-supermarket-berga-centrum-linkoping-1003586/) · [ICA offers landing page](https://www.ica.se/erbjudanden/)

The public Berga response contained the following real offer excerpt (captured 2026-11-17). It demonstrates that a Stammis-tagged offer price is visible without logging in; the page also shows the ordinary price. A second visible example was “Gräddfil” with mechanic text “2 för 22 kr.” [Berga offers page](https://www.ica.se/erbjudanden/ica-supermarket-berga-centrum-linkoping-1003586/)

```json
{
  "id": "5004211273",
  "details": {
    "brand": "ICA. Spanien",
    "packageInformation": "1 kg",
    "name": "Småcitrus i nät",
    "mechanicInfo": "20 kr/st"
  },
  "category": {
    "articleGroupName": "Frukt & Grönt",
    "articleGroupId": 4
  },
  "validTo": "2026-11-22T00:00:00",
  "comparisonPrice": "20:00/kg",
  "parsedMechanics": {
    "type": "Standard",
    "benefitType": "FIXED",
    "quantity": 1,
    "value2": "20",
    "value4": "/st"
  },
  "stores": [{
    "storeMarketingName": "ICA Supermarket Berga Centrum, Linköping",
    "BMSStoreId": 2151,
    "regularPrice": "30,95",
    "onlineInd": true,
    "storeInd": true,
    "referencePriceText": "Ord.pris 30:95 kr."
  }],
  "picture": {
    "baseUrl": "https://assets.icanet.se",
    "fileName": "nn6k1tqo2j1bxknjlce6"
  },
  "eans": [{
    "id": "7318690132301",
    "articleDescription": "Småcitrus i nät",
    "image": "https://assets.icanet.se/q_auto,f_auto/c_lpad,h_200,w_200,e_sharpen:70/7318690132301.jpg"
  }],
  "traits": ["Stammis", "Butiksunikt"]
}
```

Observed fields and caveats from that response/page: [Berga offers page](https://www.ica.se/erbjudanden/ica-supermarket-berga-centrum-linkoping-1003586/)

| Need | Observed field(s) | Notes |
|---|---|---|
| Name, brand, size | `details.name`, `details.brand`, `details.packageInformation` | Example: “Småcitrus i nät”, “ICA. Spanien”, “1 kg.” |
| Offer price/mechanic | `details.mechanicInfo`; structured fragments in `parsedMechanics` (`benefitType`, `quantity`, `value1`–`value4`, `unitSign`) | Example price text is `20 kr/st`; another offer renders `2 för 22 kr`. The sample has no standalone numeric `price` property. |
| Ordinary/reference price | `stores[].regularPrice`, `stores[].referencePriceText` | Example `30,95` and `Ord.pris 30:95 kr.` |
| Comparison/unit price | `comparisonPrice` | Example `20:00/kg`, shown on the page as Jmfpris. |
| Validity | `validTo` | Example `2026-11-22T00:00:00`; no `validFrom` appeared in this sample. |
| Category | `category.articleGroupName`, `category.articleGroupId` | Example `Frukt & Grönt`, `4`. |
| Image | `picture.baseUrl` + `picture.fileName`; also `eans[].image` | The EAN image field is a direct image URL; `picture` is a base/file reference in the sample. |
| Member/store flags | `traits`; `stores[].BMSStoreId`, `storeInd`, `onlineInd` | The sample's traits are `Stammis` and `Butiksunikt`; the store record has BMS ID `2151`. |

These are observed fields from one live weekly-offer object, not a complete or guaranteed schema. The offers page's HTML hydration object is not a documented standalone JSON API; the extract includes JavaScript `undefined` values elsewhere in the state. The visible page and its embedded state are therefore useful but structurally brittle. [Berga offers page](https://www.ica.se/erbjudanden/ica-supermarket-berga-centrum-linkoping-1003586/)

### Per-store versus national; community mobile endpoint

The selected-store page and its `stores[].BMSStoreId` identify the observed list with Berga (`2151`); the generic landing page instead asks the user to select a store and shows only two TV offers. In this bounded check I found no separate official national offer catalog/API, and cannot determine whether every promotion appearing on store pages is store-specific or shared across multiple stores. [Berga offers page](https://www.ica.se/erbjudanden/ica-supermarket-berga-centrum-linkoping-1003586/) · [ICA offers landing page](https://www.ica.se/erbjudanden/)

For comparison only, the community `kanylbullen/ica-mcp` project labels its client as using an “inofficiella API” (`client.py:1-8`) and constructs a mobile offers route of the form `https://apimgw-pub.ica.se/sverige/digx/mobile/offersservice/v1/offersdiscounts/{store_id}` (`client.py:49-50, 63-68, 700-701`). Its client attaches a bearer token to API requests (`client.py:433-441`) and its formatter reads fields such as `name`, `brand`, `packageInformation`, `parsedMechanics`, `category.articleGroupName`, `isPersonal`, `requiresLoyaltyCard`, and `validTo` (`client.py:703-720`). This is GitHub corroboration only: I did not call this route, verify its current response, or establish that it is an ICA-supported public API. [community client, lines 1-8](https://github.com/kanylbullen/ica-mcp/blob/eaf003e1212cc4e0f21e6cd1300096a83d2f6b98/ica_mcp/client.py#L1-L8) · [API base, lines 49-50](https://github.com/kanylbullen/ica-mcp/blob/eaf003e1212cc4e0f21e6cd1300096a83d2f6b98/ica_mcp/client.py#L49-L50) · [mobile path constants, lines 63-68](https://github.com/kanylbullen/ica-mcp/blob/eaf003e1212cc4e0f21e6cd1300096a83d2f6b98/ica_mcp/client.py#L63-L68) · [Bearer header, lines 433-441](https://github.com/kanylbullen/ica-mcp/blob/eaf003e1212cc4e0f21e6cd1300096a83d2f6b98/ica_mcp/client.py#L433-L441) · [offer route, lines 699-701](https://github.com/kanylbullen/ica-mcp/blob/eaf003e1212cc4e0f21e6cd1300096a83d2f6b98/ica_mcp/client.py#L699-L701) · [formatter, lines 703-720](https://github.com/kanylbullen/ica-mcp/blob/eaf003e1212cc4e0f21e6cd1300096a83d2f6b98/ica_mcp/client.py#L703-L720)

## 3. CORS, limits, robots, terms, and stability

- **CORS:** On the tested `storesearch/v1` endpoint, an `OPTIONS` preflight with `Origin: https://example.org`, method `GET`, and requested header `Authorization` returned 200 with `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET`, and an allow-headers list including `authorization`; a GET with the same origin and the public bearer returned 200 with `Access-Control-Allow-Origin: *`. This means browser CORS did not block the tested store-search request. The offers HTML is different: one direct GET with an `Origin` header returned 403 and no CORS headers; cause is unknown, and I did not retry or evade it, so offers-page CORS remains unverified. [tested store-search endpoint](https://apim-pub.gw.ica.se/sverige/digx/storesearch/v1/searchbyquery?query=Link%C3%B6ping&take=1&offset=0&onlyOnline=false&onlyOnlineB2B=false) · [Berga offers page](https://www.ica.se/erbjudanden/ica-supermarket-berga-centrum-linkoping-1003586/)
- **Rate limits:** the observed store-search responses had `Cache-Control: max-age=0, no-cache, no-store`; among the rate-related headers inspected, I saw no `X-RateLimit-Limit`, `X-RateLimit-Remaining`, or `Retry-After`. I found no public numeric limit in the official pages/client material checked; this does not establish that no gateway limit exists. [tested store-search endpoint](https://apim-pub.gw.ica.se/sverige/digx/storesearch/v1/searchbyquery?query=Link%C3%B6ping&take=1&offset=0&onlyOnline=false&onlyOnlineB2B=false) · [ICA store directory](https://www.ica.se/butiker/) · [ICA offers landing page](https://www.ica.se/erbjudanden/)
- **Robots/terms:** ICA's `robots.txt` has `User-agent: *` rules disallowing `/templates/ajaxresponse.aspx` and `/Templates/ajaxresponse.aspx`; it does not list a general disallow for `/butiker/` or `/erbjudanden/`, and contains separate deeper-path rules for `GPTBot` and `meta-externalagent`. No `Crawl-delay` directive appeared. RFC 9309 explicitly says robots rules “are not a form of access authorization,” so a robots entry or omission should not be treated as ToS permission. I did not locate endpoint-specific ToS or a public API-use license in this bounded review; confirm ICA's terms/permission before production use. [ICA robots.txt](https://www.ica.se/robots.txt) · [RFC 9309 §1](https://www.rfc-editor.org/rfc/rfc9309.html#section-1)
- **Stability (assessment/inference):** the two store-search routes are versioned `v1` and are referenced by ICA's current site code, which is a stronger signal than a guessed URL, but no public schema/SLA was found. Offer extraction depends on an unversioned HTML page and an internal hydration shape, so it is more likely to break if ICA changes rendering or field names. The mobile route is visible only in an unofficial community client here and should be considered least stable. [ICA client bundle, line 2](https://assets.icanet.se/raw/upload/v1/customer-solutions-apps/mdsa-store-vue3/assets/src-CsDy5qkt.js#L2) · [ICA client bundle, line 12](https://assets.icanet.se/raw/upload/v1/customer-solutions-apps/mdsa-store-vue3/assets/src-CsDy5qkt.js#L12) · [Berga offers page](https://www.ica.se/erbjudanden/ica-supermarket-berga-centrum-linkoping-1003586/) · [community client, lines 1-8](https://github.com/kanylbullen/ica-mcp/blob/eaf003e1212cc4e0f21e6cd1300096a83d2f6b98/ica_mcp/client.py#L1-L8)

## Practical conclusion

For a scheduled public-data job, the tested approach is: obtain ICA's anonymous public token, call the versioned store-search endpoint, filter `documents` by exact `visitingCity`, then use each store's `accountNumber`/`urls[].type == "Erbjudande"` to fetch that store's public offers page and extract `offers.weeklyOffers`. This exposes public weekly offers, including a visibly `Stammis`-tagged price; personal offers are a separate sign-in feature. Keep the request cadence low and cache the store list, do not call the community mobile endpoint without ICA authorization, and ask ICA for a supported API/terms if the job is intended for long-term production. [ICA client bundle, line 12](https://assets.icanet.se/raw/upload/v1/customer-solutions-apps/mdsa-store-vue3/assets/src-CsDy5qkt.js#L12) · [public token endpoint](https://www.ica.se/e11/public-access-token) · [tested store-search request](https://apim-pub.gw.ica.se/sverige/digx/storesearch/v1/searchbyquery?query=Link%C3%B6ping&take=100&offset=0&onlyOnline=false&onlyOnlineB2B=false) · [Berga offers page](https://www.ica.se/erbjudanden/ica-supermarket-berga-centrum-linkoping-1003586/) · [ICA offers landing page](https://www.ica.se/erbjudanden/) · [ICA robots.txt](https://www.ica.se/robots.txt)
