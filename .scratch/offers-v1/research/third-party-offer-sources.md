# Third-party Offer sources for Linköping

**Checked:** 2026-11-17 (Europe/Stockholm). Findings combine read-only probes of public website endpoints, current app pages, official terms, and GitHub source. “Current” below means that the sampled Offer or publication was valid for the observed Offer Week; it is not a freshness guarantee.

## Finding

Yes. Matpriskollen and Tjek’s eReklamblad app exposed current, Store-linked Offers for ICA, Coop and Hemköp in Linköping. Their websites use fetchable JSON interfaces, but I found no public-use API license for either source. Matpriskollen’s coordinate lookup is a straightforward but radius-limited JSON source; Tjek/eReklamblad has both digital-flyer pages and structured Offers, including member prices. Shopgun did not provide a separate source in this check: `shopgun.com` redirected to eTilbudsavis, another Tjek app. Current validity dates were visible, but neither source provided a freshness SLA.

## Matpriskollen

### Linköping coverage

An unauthenticated `GET` to the [nearby-stores endpoint](https://matpriskollen.se/api/v1/stores?lat=58.4109&lon=15.6216&radius=5) returned 30 stores within 5 km of central Linköping: **9 ICA, 5 Coop and 7 Hemköp**, plus stores from other chains. This is a radius-based selection, not a census of every Store in Linköping. Representative store/detail/Offer responses:

| Chain | Store | Address | Offers reported |
|---|---|---|---:|
| ICA | ICA Supermarket Storgatan | Storgatan 24 | 52 |
| Coop | Coop Drottninggatan Linköping | Drottninggatan 23 | 21 |
| Hemköp | Hemköp Linköping, Lucullus | Stora Torget 5 | 69 |

The linked examples are [ICA store](https://matpriskollen.se/api/v1/stores/9c715a97-bfbe-4bb5-bb4c-e29243e36269) and [Offers](https://matpriskollen.se/api/v1/stores/9c715a97-bfbe-4bb5-bb4c-e29243e36269/offers); [Coop store](https://matpriskollen.se/api/v1/stores/fc551ab3-fa55-422b-8ef4-e6c0f149dbe7) and [Offers](https://matpriskollen.se/api/v1/stores/fc551ab3-fa55-422b-8ef4-e6c0f149dbe7/offers); [Hemköp store](https://matpriskollen.se/api/v1/stores/d5f735d2-b2e3-49e0-8cda-8601eb1a3596) and [Offers](https://matpriskollen.se/api/v1/stores/d5f735d2-b2e3-49e0-8cda-8601eb1a3596/offers).

### Fields, access and freshness

The tested endpoints returned JSON without authentication: `GET /api/v1/stores?lat=…&lon=…&radius=…`, `GET /api/v1/stores/{store-key}`, and `GET /api/v1/stores/{store-key}/offers`. Store records include chain, name, address, postal code, city, coordinates, store ID/key and Offer count. Offer records include Offer ID/key, price, comparison and regular-price strings, volume, validity timestamps (`validFrom`, `validTo`), store ID/key, and product name, brand, origin, categories, tags and image URLs. They also expose `requiresMembershipCard`, `requiredSelfScan` and `requiresCoupon`; member-only Offers therefore appear in the data. A standard EAN/GTIN was not present in the sampled responses; sampled `product.id` values were `0`. In Coop and Hemköp Offer responses, `storeName` was the generic `"Butik"`; use the store key/ID and store lookup to preserve the Store association.

Sample Offers from the three Stores had `validFrom`/`validTo` timestamps corresponding to **2026-11-16 through 2026-11-22**. No source-update timestamp or freshness SLA was present in the sampled data. A current validity window proves that the Offer is represented as current, not when Matpriskollen last refreshed its data. Its [name-search endpoint](https://matpriskollen.se/api/v1/stores/search?q=ICA) returned no results for `q=ICA`; the [Home Assistant integration](https://github.com/wizz666/homeassistant-grocery-tracker/blob/cbbbea45f39f4a227f27507fc7831c9915205e21/pyscript/grocery_offers.py#L451-L513) also documents a coordinate-search fallback when name search is empty.

### Terms risk

The [published Matpriskollen terms](https://matpriskollen.se/allmanna-villkor-matpriskollen) grant a personal, non-transferable licence to the service (§2.1); §4.3 restricts copying the service’s data/features and using its IP to create a competing service, while §11.1 restricts copying, distributing, publishing or otherwise using its IP without written consent. The tested JSON routes are website endpoints, not a public developer API I found. Reuse in a private scheduled snapshot is therefore a ToS/content-rights risk; this is not a legal determination.

## Tjek: eReklamblad / eTilbudsavis / Shopgun

### Linköping coverage

The eReklamblad [location lookup](https://ereklamblad.se/butiker) returned **25 Linköping locations** with a current publication listed when checked: **12 ICA, 6 Coop and 7 Hemköp**. These are Tjek-listed locations, not an independent census of every physical Store in the municipality.

| Chain | Listed locations |
|---|---|
| Coop (6) | Drottninggatan, Lambohov, Lägerhyddan, Ullstämma, Vallaplan, Stora Coop Garnisonen |
| Hemköp (7) | Tallboda, Storgatan, Ullstämma Östenssons, Folkungavallen Östenssons, Priso, Lucullus, Ryd |
| ICA (12) | Maxi Linköping; Kvantum Signalen; Nära Flamman, Vasavägen, Skillingen, Djurgårdsgatan and Skolgatan; Supermarket Johannelund, Tannefors, Storgatan, Berga Centrum and Malmslätt |

The listed publications were valid **2026-11-16 through 2026-11-22**. Representative live publication responses are [Coop Drottninggatan pages](https://publication-viewer.tjek.com/api/paged-publications/NV_F04Kb/pages?from=1&to=20), [ICA Maxi Linköping pages](https://publication-viewer.tjek.com/api/paged-publications/tsqeGyOT/pages?from=1&to=20), and [Hemköp Lucullus Offer IDs](https://publication-viewer.tjek.com/api/incito-publications/0Z78Bmhd/offer-ids).

### Fields, access and freshness

The eReklamblad site says its content depends on location and that it is part of Tjek ([site](https://ereklamblad.se/)). The [current browser bundle](https://dqei8yomz48ve.cloudfront.net/assets/entry-client-BU1LoiwP.js) implements JSON `POST` calls to `/api/{action}` and contains data actions such as `businesses`, `fronts`, `publication` and `offer`; `fronts` associates local Stores with publications, and the publication viewer returns flyer pages with Offer hotspots/IDs. Incito publications expose Offer IDs, with structured records available from individual Offer lookups. Separately, a read-only probe to `POST https://ereklamblad.se/` with a JSON `data` array containing a base64-encoded `["businesses",{}]` command returned HTTP 200 and 188 business entries. The [open-source Tjek fetcher](https://github.com/potato1778/supermarket-tracker/blob/83d660f0903fb87ef73b065dc27324c8de83ee52/sources/tjek.py#L28-L93) uses this root endpoint. Neither interface is documented as a public developer contract.

The sampled ICA, Coop and Hemköp records had `price`, `membershipPrice` and `appPrice` fields; one current Offer from each had a null ordinary `price` and a populated member price. Other observed fields included name, description, currency, unit/base-unit price, savings, images, `validFrom`, `validUntil` and `visibleFrom`. Offer records identify their business and publication; join the publication back to its Store using the location lookup. No standard EAN/GTIN was apparent in the sampled records, and one `productId` was null. The flyer and Offer validity dates were current for the observed week, but no refresh timestamp or freshness SLA was found; individual Offer dates can vary within a publication week.

`shopgun.com` redirected to [eTilbudsavis](https://etilbudsavis.dk/), and Tjek identifies eTilbudsavis and eReklamblad as its shopping apps ([Tjek terms §1.2](https://tjek.com/terms)). No separate Shopgun feed was found in this check.

### Terms risk

Tjek’s [API/SDK page](https://tjek.com/apis-and-sdks) says API access is only available to customers. Its [terms](https://tjek.com/terms), §§8.2–8.4, limit customer API use to agreed services on the customer’s own platforms and require written approval for certain third-party use or systematic fetching/reuse; §11.1 reserves rights in service content and data. The consumer-site POST interface is not documented as a public API, and unauthenticated access does not establish permission to scrape or reuse it. This is a material ToS/content-rights risk even for personal use.

## Open-source fetch examples

These repositories show implementation techniques, not permission to collect or reuse the underlying data.

### One project covering all three Chains

[`arvidhedin/veckans_deals`](https://github.com/arvidhedin/veckans_deals) had a latest observed commit on **2026-11-17** ([commit](https://github.com/arvidhedin/veckans_deals/commit/8226a0e1aacf25ab16314add4c0f4daa5e4b2908)); its [workflow](https://github.com/arvidhedin/veckans_deals/blob/8226a0e1aacf25ab16314add4c0f4daa5e4b2908/.github/workflows/scrape_and_deploy.yml#L3-L10) schedules a daily build. Its configured stores are in Uppsala, not Linköping.

| Chain | Fetch method shown by the repo | Maintenance / Linköping caveat |
|---|---|---|
| ICA | The current scraper says scripted `ica.se` requests began returning 403 on 2026-10-28. It now consumes an upload from a browser bookmarklet, which reads the offers page’s `window.__INITIAL_DATA__` and posts it to the project’s API ([scraper](https://github.com/arvidhedin/veckans_deals/blob/8226a0e1aacf25ab16314add4c0f4daa5e4b2908/scrapers/ica.py#L1-L6), [bookmarklet](https://github.com/arvidhedin/veckans_deals/blob/8226a0e1aacf25ab16314add4c0f4daa5e4b2908/public/ica-export.js#L59-L85)). | Current source is not an unattended fetch of Linköping ICA Offers; configured stores are Uppsala. The ICA scraper was last changed in commit [`74f2384`](https://github.com/arvidhedin/veckans_deals/commit/74f23849284b4586cb49b95ac4ab0fbdfa24c53f) (Nov. 12). |
| Coop | Calls `external.api.coop.se/dke/offers/sorting-groups/{store_id}` and reads a subscription key from Coop’s public-page `coopSettings` ([source](https://github.com/arvidhedin/veckans_deals/blob/8226a0e1aacf25ab16314add4c0f4daa5e4b2908/scrapers/coop.py#L210-L254)). | Configured stores are Centralhuset, Liljegatan and Ekeby, not Linköping. The source last changed in [`072c2eb`](https://github.com/arvidhedin/veckans_deals/commit/072c2eb9b18b02cb11c5f39346729a160b9390ec) (Sept. 29). |
| Hemköp | Calls Axfood’s `/axfood/rest/v1/search/campaigns/offline` with a Store ID and paginates; maps `LOYALTY` to “Klubbpris” ([source](https://github.com/arvidhedin/veckans_deals/blob/8226a0e1aacf25ab16314add4c0f4daa5e4b2908/scrapers/hemkop.py#L6-L15), [pagination](https://github.com/arvidhedin/veckans_deals/blob/8226a0e1aacf25ab16314add4c0f4daa5e4b2908/scrapers/hemkop.py#L105-L148)). | Configured stores are Uppsala’s Svava and Rosendal, not Linköping. The source last changed in [`243ad1e`](https://github.com/arvidhedin/veckans_deals/commit/243ad1ecb72e5452123e847afa6e02f155c64d4a) (Sept. 27). |

### Aggregator-specific projects

- [`potato1778/supermarket-tracker`](https://github.com/potato1778/supermarket-tracker) implements Tjek/eReklamblad’s base64-command POST protocol, Store/business lookup, Offer paging and deduplication. Its code describes the endpoint as undocumented and rate-limited ([source](https://github.com/potato1778/supermarket-tracker/blob/83d660f0903fb87ef73b065dc27324c8de83ee52/sources/tjek.py#L1-L18), [request/paging code](https://github.com/potato1778/supermarket-tracker/blob/83d660f0903fb87ef73b065dc27324c8de83ee52/sources/tjek.py#L28-L93)). Latest observed repo commit: **2026-10-11** ([commit](https://github.com/potato1778/supermarket-tracker/commit/83d660f0903fb87ef73b065dc27324c8de83ee52)).
- [`wizz666/homeassistant-grocery-tracker`](https://github.com/wizz666/homeassistant-grocery-tracker) calls Matpriskollen’s store and Offer JSON endpoints and falls back from name search to coordinate search ([source](https://github.com/wizz666/homeassistant-grocery-tracker/blob/cbbbea45f39f4a227f27507fc7831c9915205e21/pyscript/grocery_offers.py#L27-L96), [fallback](https://github.com/wizz666/homeassistant-grocery-tracker/blob/cbbbea45f39f4a227f27507fc7831c9915205e21/pyscript/grocery_offers.py#L491-L513)). Latest observed repo commit: **2026-09-07** ([commit](https://github.com/wizz666/homeassistant-grocery-tracker/commit/cbbbea45f39f4a227f27507fc7831c9915205e21)).

## Implication for the scheduled snapshot

Both aggregators technically expose enough Store-linked Offer data to try a server-side snapshot for Linköping. Matpriskollen’s coordinate search is simple but its 5 km result is not proof of complete city coverage. Tjek/eReklamblad’s directory listed more Linköping locations and its Incito data included member prices, but its API is customer-only and the consumer app endpoint is undocumented. For either source, store the retrieval time and source URL, filter by the Offer’s validity window, and regard schema/availability as changeable. Personal use does not remove the terms and content-reuse risk noted above.
