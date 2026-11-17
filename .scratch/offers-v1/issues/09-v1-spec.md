# Spec: Weekly grocery Offers in one view (v1)

Type: spec
Status: open
Labels: ready-for-agent
Blocked by:
Parent: ../map.md

## Problem Statement

Every week our household wants to know what is cheap in the supermarkets around us. To find out today, we have to open three different Chain websites or apps (ICA, Coop and Hemköp), pick each Store one at a time, and scroll through flyers that all look different. Linköping has 25 Stores across these Chains, so nobody does it properly. We miss good Offers, cannot easily see which Store has the cheapest coffee this week, and cannot search across Chains at all.

## Solution

Build a mobile-first, Swedish-language web app with no login. It shows this Offer Week's Offers from every ICA, Coop and Hemköp Store in the Location (Linköping for now) in one list. The list can be filtered by Chain, Store, category and free text, and sorted by lowest price or largest discount.

The app never calls the Chains live. A scheduled job fetches each Chain's Offers once a day, normalises them into one shared Offer shape, and publishes a static **Snapshot** file per Location. The app only reads that Snapshot, so it loads fast and keeps working when a Chain's site has trouble. If one Chain's data could not be refreshed, the app says so plainly instead of silently showing an incomplete list.

## User Stories

1. As a household member, I want to see this Offer Week's Offers from all ICA, Coop and Hemköp Stores in Linköping in one list, so that I don't have to visit three Chain websites.
2. As a household member, I want the app to open straight to the Offer list without logging in, so that I can check prices in seconds.
3. As a household member, I want the app to be in Swedish, so that product names, mechanics and labels read naturally.
4. As a household member on my phone, I want the list to be comfortable to read and tap on a small screen, so that I can use it in the shop or on the bus.
5. As a household member, I want each Offer to show the product name, brand and package size, so that I know exactly what is on offer.
6. As a household member, I want each Offer to show the Offer price as the Chain writes it (for example "2 för 22 kr" or "20 kr/st"), so that I recognise the Offer when I see it in the Store.
7. As a household member, I want each Offer to show the comparison price (jämförpris) when the Chain provides one, so that I can compare value across package sizes.
8. As a household member, I want each Offer to show the regular price when it is known, so that I can see how much I save.
9. As a household member, I want each Offer to show which Store and Chain it belongs to, so that I know where to go.
10. As a household member, I want each Offer to show when it ends, so that I don't plan around an Offer that expires before I shop.
11. As a household member, I want to see a product image when one is available, so that I can scan the list quickly.
12. As a household member, I want member prices (Stammis, Medlemspris, Klubbpris) to appear as ordinary Offers, so that I see the price we actually pay as members of every Chain.
13. As a household member, I want to see a purchase limit (for example "max 2 per hushåll") when the Chain states one, so that I'm not surprised at the till.
14. As a household member, I want to filter by one or more Chains, so that I only see Offers from Chains I plan to visit.
15. As a household member, I want to filter by one or more specific Stores, so that I only see Offers from the Stores near me.
16. As a household member, I want the Store filter to list only Stores from the Chains I have selected, so that the Store list stays short.
17. As a household member, I want to filter by category (for example "Frukt & grönt" or "Mejeri"), so that I can browse one kind of product across all Chains.
18. As a household member, I want category names to be the same for every Chain, so that a category filter gives me matching products from ICA, Coop and Hemköp alike.
19. As a household member, I want Offers whose category can't be mapped to show up under "Övrigt", so that no Offer disappears from the list because of a missing category.
20. As a household member, I want to search by free text across product name and brand, so that I can find "kaffe" or "Zoégas" quickly.
21. As a household member, I want search to ignore upper/lower case, so that "arla" finds "Arla".
22. As a household member, I want the Chain, Store, category and search filters to combine, so that I can ask "ICA and Hemköp, Mejeri, containing 'yoghurt'".
23. As a household member, I want to sort by lowest price, so that I find the cheapest Offers first.
24. As a household member, I want to sort by largest discount, so that I find the biggest savings first.
25. As a household member, I want Offers without a known regular price to sort after those with one when I sort by discount, so that the top of the list shows real savings.
26. As a household member, I want Offers without a usable price to sort last when I sort by lowest price, so that they don't crowd the top of the list.
27. As a household member, I want to see how many Offers match my current filters, so that I know whether to narrow or widen my search.
28. As a household member, I want a clear way to reset all filters, so that I can quickly get back to the full list.
29. As a household member, I want a friendly empty state when no Offers match, so that I understand it is my filters and not a broken app.
30. As a household member, I want my filters and sort order kept in the page address, so that a reload or a shared link shows the same view.
31. As a household member, I want to see when the Offers were last updated, so that I can trust the list is current.
32. As a household member, I want to be told when one Chain's Offers couldn't be refreshed, so that I know that part of the list may be outdated or missing.
33. As a household member, I want the Offers from that Chain's last successful update to stay visible (marked as possibly outdated) while they are still valid, so that one failing source doesn't empty that Chain's part of the list.
34. As a household member, I want expired Offers never to be shown, so that I don't go shopping for prices that no longer apply.
35. As a household member, I want Offers that run shorter or longer than a calendar week to be shown exactly while they are valid, so that odd-length Offers are neither lost nor stale.
36. As a household member, I want next week's Offers to appear soon after the Chains publish them, so that I can plan the weekly shop on Monday morning.
37. As a household member, I want the app to load fast on mobile data, so that it's usable inside a Store with poor reception.
38. As the maintainer, I want a scheduled job to build the Snapshot automatically every day, so that the app stays current without manual work.
39. As the maintainer, I want to be able to run the job on demand, so that I can refresh the Snapshot after fixing a broken source.
40. As the maintainer, I want the job to find each Location's Stores automatically from each Chain's Store listing, so that new or closed Stores are picked up without code changes.
41. As the maintainer, I want to be able to pin or exclude particular Stores in a Location's configuration, so that I can fix discovery mistakes without code changes.
42. As the maintainer, I want adding a second Location to mean adding configuration only, so that the app can grow beyond Linköping cheaply.
43. As the maintainer, I want each Chain's source to sit behind its own adapter with one shared output shape, so that a Chain can switch to its fallback source without touching the app.
44. As the maintainer, I want Tjek/eReklamblad configured as a fallback source for every Chain, so that a broken first-party source can be swapped out quickly.
45. As the maintainer, I want the job to keep requests to each source low-rate and sequential, so that we put minimal load on the Chains and aggregators.
46. As the maintainer, I want the job to honour Hemköp's stated crawl delay and visiting window, so that we stay as considerate as possible with a source whose robots.txt disallows this route.
47. As the maintainer, I want the job to fail one Chain without failing the whole Snapshot, so that one broken source never takes the whole app down.
48. As the maintainer, I want the job to reject source data with an unexpected shape rather than publish garbage, so that a silent change at a Chain shows up as a reported failure.
49. As the maintainer, I want a failed GitHub Actions run when a Chain fails, so that I'm notified to investigate.
50. As the maintainer, I want the Snapshot to record each Chain's source, fetch time and status, so that I can diagnose problems from the published file.
51. As the maintainer, I want no secrets stored in the repository or the CI settings, so that nothing sensitive can leak; any tokens the sources need are fetched anonymously at runtime.
52. As the maintainer, I want the Snapshot to carry a schema version, so that the app and the job can evolve without silently misreading each other.
53. As the maintainer, I want the ToS and robots risks of each source documented next to its adapter, so that the trade-off we accepted stays visible.
54. As the maintainer, I want free, static hosting for the app and Snapshot, so that running the household tool costs nothing.

**Decision (2026-11-17):** Offer image display is deferred. Keep the current
placeholder and do not load remote `imageUrl`s in the browser. Image fetching
or proxying is out of scope.

## Implementation Decisions

### Architecture

- Two halves joined by one contract, the **Snapshot**:
  - **Snapshot job**: a scheduled TypeScript program that fetches, normalises and validates Offers for every configured Location. It writes one Snapshot JSON file per Location.
  - **SPA**: a static, mobile-first TypeScript app that loads the Snapshot for the current Location and does all filtering and sorting in the browser.
- The SPA never calls Chain or aggregator endpoints. This avoids the CORS restrictions found for ICA and Coop and keeps all source risk inside the job.

### Stack and hosting (resolves ticket 07)

- TypeScript throughout. The SPA uses Vite + React. Vitest is the test runner for both halves.
- The Snapshot job runs as a GitHub Actions workflow. It runs on a daily cron and can also be started by hand (`workflow_dispatch`).
- The cron runs once a day at around 05:00 UTC, inside Hemköp's stated 04:00–08:45 UTC visiting window. Monday's run picks up the new Offer Week.
- The job commits the updated Snapshot files to the repository, and the SPA and Snapshots are deployed together as static files to GitHub Pages.
- No secrets are stored. ICA's anonymous public access token is fetched at runtime on every run. Coop remains configured to use Tjek's consumer endpoint anonymously. One authorized Store-specific `fronts` retry returned a Coop publication; its viewer pages and sample individual Offer lookups also succeeded. The observed nested `fronts` envelope is captured in a sanitized fixture, but complete coverage across Linköping Stores remains unverified. Coop's page-embedded subscription key is not copied into the project.

### Source per Chain (resolves ticket 05)

| Chain | Primary source | Fallback |
|---|---|---|
| ICA | First-party: the anonymous-token Store search, then each Store's public offers page and its embedded weekly-Offer state | Tjek/eReklamblad (Store/publication/Offer flow unverified for ICA) |
| Coop | Target: Tjek/eReklamblad structured Offers for Coop's Linköping Stores. One Store/publication/sample Offer path is verified; complete response shape and Store coverage remain blocked | Coop flyer PDF parsing, only if Tjek fails for a long time |
| Hemköp | First-party: the Axfood Store listing, then the per-Store paginated campaign JSON | Tjek/eReklamblad (Store/publication/Offer flow unverified for Hemköp) |

- Each source is implemented as a **Chain adapter** with one shared interface. Given a Location config, it discovers that Chain's Stores and returns their Offers in the normalised Offer shape. A Location config picks which adapter each Chain uses, so moving to a fallback is a configuration change.
- **Current Tjek compatibility (2026-11-17):** Tjek remains selected in the existing configuration. The shared adapter uses the observed `stores` action and one Coop Store-list response (621 records, including five Linköping Stores). An authorized exact Store-specific `fronts` retry, a publication-pages GET and sample individual Offer lookups succeeded. The observed `{key, status, value: [{business, publications}]}` shape is represented in a sanitized fixture, and the adapter checks front business IDs against the Store's brand ID. Only one of five Linköping Stores plus a small Offer sample was checked; complete live coverage remains blocked. See [ticket 04](04-third-party-offer-sources.md) and the [Tjek source note](../../../docs/sources/tjek-ereklamblad.md); do not change the configured source as part of this work.
- ToS and robots risk is accepted for this personal household tool and must be recorded with each adapter. ICA's offers page is an undocumented extraction surface. Hemköp's robots.txt disallows the campaign query route. Tjek's API is customer-only and its consumer endpoint is undocumented. The job must not disguise itself or work around blocks. When a source blocks the job, that Chain fails and is reported.
- Politeness rules: requests to a source are sequential, never parallel. There is at least a 10-second delay between Hemköp requests, and a small fixed delay between requests to other sources. Back off and fail the Chain on 403/429 responses or repeated errors. Pagination is always followed until the source reports the last page.

### Location configuration

- A Location is configured with:
  - an id and a display name
  - which adapter each Chain uses
  - per-Chain Store discovery criteria: an exact city match on the source's Store records, for example `visitingCity`, `address.town` or `city` equal to "Linköping"
  - optional lists of Store ids to pin or exclude
- Linköping is the only configured Location. Adding a Location means adding a config entry, after which the job produces a second Snapshot.
- The SPA shows no Location picker while only one Location exists. It loads the Snapshot for the Location in the page address, defaulting to the only configured one.
- Expected Linköping coverage, used as a sanity check rather than a hard rule: about 12 ICA, 6 Coop and 7 Hemköp Stores.

### Snapshot contract (resolves ticket 06)

- One JSON file per Location, named after the Location id and published next to the SPA.
- Top-level shape:
  - `schemaVersion`: an integer. The SPA refuses Snapshots with an unknown major version and shows an error.
  - `location`: the Location's id and display name.
  - `generatedAt`: an ISO timestamp.
  - `chains`: one entry per Chain with:
    - `chain`: `ICA`, `Coop` or `Hemköp`
    - `source`: the adapter id
    - `status`: `ok`, `stale` or `failed`
    - `lastAttemptAt`
    - `lastSuccessAt`
    - an optional short `error` message
  - `stores`: one entry per Store with:
    - a stable `id` that is unique across Chains, made from the Chain and the source's Store id
    - `chain`, `name`, and an address or locality label
  - `offers`: an array of normalised Offers.
- Normalised Offer fields:
  - Required:
    - `id`, stable within the Snapshot
    - `chain`
    - `storeId`
    - `name`
    - `mechanicText`: the Offer price exactly as the Chain presents it, for example "2 för 22 kr", "20 kr/st" or "29,90 kr/kg"
    - `category`: one of the shared categories
    - `validTo`
    - `sourceUrl`
  - Optional:
    - `brand`
    - `packageSize`
    - `quantity`: how many items the mechanic needs, default 1
    - `price`: the total price for `quantity` items, in SEK
    - `unitPrice`: the effective price per item or per unit, in SEK. It is derived as `price / quantity` when the source does not give it
    - `priceUnit`: `st`, `kg` or `l`
    - `regularPrice`: the ordinary price per item or unit, in SEK
    - `comparisonPriceText`: for example "15,38 kr/kg"
    - `limitText`: for example "Max 2 per hushåll"
    - `validFrom`
    - `imageUrl`
    - `sourceCategory`: the Chain's own category label, kept for debugging and future remapping
- Mechanics are represented as the displayed `mechanicText` plus the numeric fields that can be derived from it. Mechanics such as "3 för 2" (with no price) or weight-based Offers with no numeric price keep `mechanicText`, and their numeric price fields are left empty. Parsing must never invent a price.
- There is **no member flag**. Member-only prices are ordinary Offers. When a source gives both a member price and an ordinary Offer price, the member price is used.
- **Discount** is `regularPrice − unitPrice` in SEK, computed only when both are present and in the same unit. It is computed in the SPA, not stored.

### Category taxonomy

- One shared list of about 12–15 Swedish categories, for example:
  - Frukt & grönt
  - Kött & chark
  - Fisk & skaldjur
  - Mejeri & ost
  - Bröd & bageri
  - Skafferi
  - Fryst
  - Dryck
  - Godis & snacks
  - Hushåll & hygien
  - Barn
  - Djur
  - Övrigt
- Each adapter maps its source category to a shared category with a per-Chain lookup table. Sources:
  - ICA: `articleGroupName`
  - Hemköp: the first segment of `googleAnalyticsCategory`
  - Tjek: whatever category or label the record carries
- When there is no mapping, the Offer goes in "Övrigt". The table can be extended later without changing the schema.

### Validity and freshness

- The job includes an Offer when its `validTo` is on or after the run date and its `validFrom` (when known) is no later than the end of the current Offer Week. This way Offers that are shorter, longer or straddle week boundaries are handled naturally.
- The SPA also hides Offers whose `validTo` has passed, measured against the device's local date in Europe/Stockholm. This keeps the list correct if a job run is missed.
- **Source breakage** depends on what happens to the Chain:
  - Source fails or returns data that fails validation, and the previous Snapshot holds still-valid Offers for that Chain: the job keeps those Offers and sets the Chain to `stale`.
  - Otherwise: the job drops that Chain's Offers and sets it to `failed`.
  - The job always publishes the Snapshot for the Chains that succeeded.
  - If any Chain is `stale` or `failed`, the workflow run ends with a failing status so that the maintainer is notified.
- Each adapter validates source responses against a schema. Missing required fields or an unexpected structure count as a failure, never as a silent empty result. A Store that returns zero Offers while other Stores of that Chain return many is reported in the Chain's `error` as a warning, but it does not fail the Chain.

### SPA behaviour (ticket 08's prototype refines visuals, not these behaviours)

- A single scrolling list of Offer rows or cards. Each shows:
  - an image (or a placeholder)
  - name, brand and package size
  - `mechanicText`, shown prominently
  - the comparison price
  - the regular price, when known
  - a Chain badge and the Store name
  - "t.o.m." plus the end date
  - the limit text, when present
- Filters:
  - Chain: multi-select chips.
  - Store: multi-select, listing only Stores from the selected Chains (or all Chains when none is selected).
  - Category: multi-select chips.
  - Search: free text matching `name` and `brand`, ignoring case, with each word of the search matched separately (AND).
- Filters combine with OR inside one filter type and AND between filter types. An empty filter type means "all".
- Sort options:
  - "Lägsta pris": sorts by `unitPrice` ascending. Offers without `unitPrice` go last.
  - "Största rabatt": sorts by discount, largest first. Offers with no computable discount go last.
  - Ties are broken by name.
- Filter and sort state is kept in the URL query string.
- Always visible:
  - the number of matching Offers
  - a "Rensa filter" action
  - a "Senast uppdaterad" timestamp taken from `generatedAt`
- When any Chain is `stale` or `failed`, show a short banner naming the Chain and its last successful update. Stale Offers get a subtle "kan vara inaktuellt" marker.
- Empty state: a Swedish message plus a reset-filters action. When the Snapshot fails to load or has an unsupported version, show an error state.
- All UI text is in Swedish. The layout targets narrow phone screens first. There is no login, no cookies and no tracking.

## Testing Decisions

- **What makes a good test:** it exercises behaviour from the outside, through one of the two agreed seams, and checks what a user or the Snapshot contract would observe. It does not call internal parsers, mappers or React components directly, and it does not assert implementation details such as component structure, state shape or call counts. A refactor that keeps behaviour must keep the tests green.
- **Seam 1 — Snapshot job:**
  - **Setup:** run the job's entry point with:
    - a Location config
    - a fixed "now"
    - an injected HTTP fetcher that replays recorded source responses (fixtures)
    - an optional previous Snapshot
  - **Check:** the Snapshot it produces.
  - **Fixtures:** trimmed real responses from each source (ICA Store search and offers page HTML, Hemköp Store and campaign JSON, Tjek responses for Coop), with any tokens or keys removed.
  - **Cases to cover:**
    - Normalising each Chain's representative Offers: member prices, multi-buy mechanics, weight-based Offers with no numeric price, missing regular price, limits, and category mapping including the "Övrigt" fallback.
    - Store discovery by exact city, including pin and exclude lists.
    - Following pagination to the last page.
    - Filtering out expired and future Offers around week boundaries.
    - Breakage:
      - an HTTP error from one Chain gives a `stale` Chain when there is a previous Snapshot, and a `failed` Chain otherwise
      - a schema-violating response counts as a failure
      - the other Chains are unaffected
    - The required delay between Hemköp requests, checked through an injected clock or sleeper (not real time).
    - Configuring a second Location produces a second Snapshot.
- **Seam 2 — SPA:**
  - **Setup:** mount the whole app with a fixture Snapshot served at the URL where the real Snapshot would be.
  - **Interaction:** drive it as a user would with Testing Library in a DOM environment: tap chips, pick Stores, type a search, change the sort, reload with query-string state.
  - **Check:** the visible Offers, their order, the match count, and the banners and empty or error states.
  - **Cases to cover:**
    - filter combinations
    - the Store list narrowing to the selected Chains
    - case-insensitive multi-word search
    - both sort orders, including where Offers with missing values end up
    - hiding Offers expired by the device date
    - the stale and failed Chain banners
    - an unsupported `schemaVersion`
    - filter and sort state restored from the URL
- No other seams: no separate unit tests for adapters, mechanic parsing or category mapping. They are covered through Seam 1.
- Live endpoints are never called in tests. Optionally, a manual smoke run of the real job in CI (`workflow_dispatch`) checks the sources still work. It is not part of the automated test suite.
- **Prior art:** none in this repository; it has no code yet. The open-source scrapers cited in the research tickets show how the source responses are shaped, which helps when recording fixtures. They are not testing prior art.

## Out of Scope

- Cross-Chain product matching (comparing the same product between Chains).
- Shopping lists, favourites, notifications, price history and accounts or login.
- Store discovery by geolocation, and a Location picker UI while only one Location exists.
- Personal or app-only Offers that need sign-in (for example ICA personal offers) and coupon-based Offers that can't be read anonymously.
- Coop flyer PDF parsing, unless Tjek fails for a long time.
- Chains other than ICA, Coop and Hemköp (for example Willys, Lidl, City Gross), even where the same platform makes them easy.
- Licensing agreements or written permission from the Chains or Tjek. The risk is accepted for personal use, and the data is not redistributed beyond the household's own static site.
- Offline/PWA installation and push updates.
- Exact shelf-price guarantees. Hemköp warns that its web prices can differ from in-Store prices. The app shows what the source publishes.

## Further Notes

- This spec settles open tickets 05 (source per Chain), 06 (Offer data model), 07 (stack and hosting) and the map's "Not yet specified" items: category taxonomy, refresh cadence, adding a Location and source breakage. Ticket 08's filter-view prototype can still refine the visual layout of rows and filter controls within the behaviour fixed here.
- "Snapshot" is used here as a new domain term: one Location's published, normalised set of Stores and current Offers plus per-Chain freshness status. It should be added to the glossary.
- The research found that a public open-source project started getting 403 from scripted ICA requests on 2026-10-28, while our low-rate probes on 2026-11-17 succeeded. ICA is therefore the Chain most likely to need its Tjek fallback early. The configuration seam exists; the Coop sample does not verify ICA's Store-specific publication and Offer-ID flow.
- Research details (endpoints, sample fields, Store ids, citations) are in `../research/`. Implementers should read them before building each adapter but should not hard-code the Store lists found there, because Stores are discovered at runtime.
