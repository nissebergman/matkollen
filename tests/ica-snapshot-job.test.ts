import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildLocationSnapshot } from "../src/snapshot/build";
import { LOCATION_REGISTRY, type LocationConfig } from "../src/snapshot/config";
import snapshotFixture from "./fixtures/snapshots/linkoping.json";

const fixtureRoot = resolve(import.meta.dirname, "fixtures");
const icaRoot = resolve(fixtureRoot, "ica");
const hemkopRoot = resolve(fixtureRoot, "hemkop");
const configuredLinkoping = LOCATION_REGISTRY.locations.find(
  (location) => location.id === "linkoping",
)!;
const linkopingLocation: LocationConfig = {
  ...configuredLinkoping,
  chains: {
    ...configuredLinkoping.chains,
    ICA: {
      source: "ica-first-party",
      storeDiscovery: {
        exactCity: { field: "visitingCity", value: "Linköping" },
      },
    },
  },
};
const linkopingIcaHemkopLocation = {
  ...linkopingLocation,
  chains: {
    ICA: linkopingLocation.chains.ICA,
    Hemköp: linkopingLocation.chains.Hemköp,
  },
};
const token = JSON.parse(readFileSync(resolve(icaRoot, "token.json"), "utf8"));
const icaStores = JSON.parse(readFileSync(resolve(icaRoot, "stores.json"), "utf8"));
const icaOffers = new Map([
  [
    "1003586",
    readFileSync(resolve(icaRoot, "offers-1003586.html"), "utf8"),
  ],
  [
    "1003520",
    readFileSync(resolve(icaRoot, "offers-1003520.html"), "utf8"),
  ],
]);
const hemkopStores = JSON.parse(
  readFileSync(resolve(hemkopRoot, "stores.json"), "utf8"),
);
const hemkopCampaigns = new Map(
  ["4552-0", "4552-1", "4552-2", "4701-0"].map((key) => [
    key,
    JSON.parse(
      readFileSync(resolve(hemkopRoot, `campaigns/${key}.json`), "utf8"),
    ),
  ]),
);

describe("combined Snapshot job", () => {
  it("publishes ICA and Hemköp Offers for exact-city Stores from recorded responses", async () => {
    let elapsed = 0;
    let activeRequests = 0;
    let maxConcurrentRequests = 0;
    const requestTimes: Array<{ chain: string; at: number }> = [];
    const requestHeaders: Array<{ path: string; headers: Headers; credentials?: RequestCredentials }> = [];
    const fetcher: typeof fetch = async (input, init) => {
      activeRequests += 1;
      maxConcurrentRequests = Math.max(maxConcurrentRequests, activeRequests);
      try {
        await Promise.resolve();
        const url = new URL(String(input));
        const chain = url.hostname.endsWith("ica.se") ? "ICA" : "Hemköp";
        requestTimes.push({ chain, at: elapsed });
        if (chain === "ICA") {
          requestHeaders.push({
            path: url.pathname,
            headers: new Headers(init?.headers),
            credentials: init?.credentials,
          });
        }

        if (chain === "ICA" && url.pathname === "/e11/public-access-token") {
          return Response.json(token);
        }
        if (
          chain === "ICA" &&
          url.pathname === "/sverige/digx/storesearch/v1/searchbyquery"
        ) {
          return Response.json(icaStores);
        }
        if (chain === "ICA" && url.pathname.startsWith("/erbjudanden/")) {
          const accountNumber = url.pathname.match(/-(\d+)\/?$/)?.[1];
          const page = accountNumber ? icaOffers.get(accountNumber) : undefined;
          return page
            ? new Response(page, { headers: { "Content-Type": "text/html" } })
            : new Response("No recorded ICA fixture for this Store", { status: 404 });
        }
        if (chain === "Hemköp" && url.pathname === "/axfood/rest/store") {
          return Response.json(hemkopStores);
        }
        if (chain === "Hemköp" && url.pathname === "/search/campaigns/offline") {
          const key = `${url.searchParams.get("q")}-${url.searchParams.get("page")}`;
          const page = hemkopCampaigns.get(key);
          return page
            ? Response.json(page)
            : new Response("No recorded Hemköp fixture for this request", {
                status: 404,
              });
        }
        return new Response("No recorded fixture for this request", { status: 404 });
      } finally {
        activeRequests -= 1;
      }
    };

    const snapshot = await buildLocationSnapshot(
      linkopingIcaHemkopLocation,
      {
        fetcher,
        now: () => new Date("2026-11-17T05:00:00.000Z"),
        sleep: async (milliseconds) => {
          elapsed += milliseconds;
        },
      },
    );
    const byName = new Map(snapshot.offers.map((offer) => [offer.name, offer]));

    expect(snapshot.chains.map((chain) => chain.chain)).toEqual(
      expect.arrayContaining(["ICA", "Hemköp"]),
    );
    expect(snapshot.chains.find((chain) => chain.chain === "ICA")?.status).toBe(
      "ok",
    );
    expect(snapshot.chains.find((chain) => chain.chain === "Hemköp")?.status).toBe(
      "ok",
    );
    expect(snapshot.stores.map((store) => store.id)).toEqual(
      expect.arrayContaining([
        "ICA:2151",
        "ICA:2137",
        "Hemköp:4552",
        "Hemköp:4701",
      ]),
    );
    expect(snapshot.stores.some((store) => store.id === "ICA:9999")).toBe(false);
    expect(byName.get("Småcitrus i nät")).toMatchObject({
      chain: "ICA",
      storeId: "ICA:2151",
      brand: "ICA. Spanien",
      packageSize: "1 kg",
      mechanicText: "20 kr/st",
      category: "Frukt & grönt",
      price: 20,
      unitPrice: 20,
      regularPrice: 30.95,
      comparisonPriceText: "20:00/kg",
      imageUrl: "https://assets.icanet.se/fixture-citrus.jpg",
    });
    expect(byName.get("Gräddfil")).toMatchObject({
      chain: "ICA",
      storeId: "ICA:2151",
      quantity: 2,
      price: 22,
      unitPrice: 11,
      regularPrice: 18.95,
    });
    expect(byName.get("Prova tre")).toMatchObject({
      quantity: 3,
      category: "Övrigt",
      mechanicText: "3 för 2",
    });
    expect(byName.get("Prova tre")).not.toHaveProperty("price");
    expect(byName.get("Lösviktskaffe")).toMatchObject({
      price: 29.9,
      unitPrice: 29.9,
      priceUnit: "kg",
      category: "Skafferi",
    });
    expect(byName.get("Lösviktskaffe")).not.toHaveProperty("regularPrice");
    expect(byName.get("Naturell yoghurt")).toMatchObject({
      chain: "ICA",
      storeId: "ICA:2137",
      brand: "Arla",
      regularPrice: 24.9,
    });
    expect(byName.get("Fredagserbjudande")).toMatchObject({
      validFrom: "2026-11-20",
      validTo: "2026-11-22",
    });
    expect(byName.get("Krossade tomater")).toMatchObject({
      chain: "Hemköp",
      storeId: "Hemköp:4552",
    });
    expect(byName.has("Utgånget ICA-exempel")).toBe(false);
    expect(byName.has("Nästa veckas ICA-exempel")).toBe(false);
    expect(snapshot.offers.some((offer) => offer.id.includes(token.token))).toBe(false);
    expect(maxConcurrentRequests).toBe(1);
    const storeSearchRequest = requestHeaders.find(
      ({ path }) => path === "/sverige/digx/storesearch/v1/searchbyquery",
    );
    expect(storeSearchRequest?.headers.get("Authorization")).toBe(
      `Bearer ${token.token}`,
    );
    expect(storeSearchRequest?.credentials).toBe("omit");
    expect(
      requestHeaders
        .filter(({ path }) => path === "/e11/public-access-token")
        .every(
          ({ headers, credentials }) =>
            headers.get("Authorization") === null && credentials === "omit",
        ),
    ).toBe(true);
    expect(
      requestHeaders
        .filter(({ path }) => path.startsWith("/erbjudanden/"))
        .every(({ headers, credentials }) => {
          return (
            headers.get("Authorization") === null &&
            headers.get("Accept") === "text/html" &&
            credentials === "omit"
          );
        }),
    ).toBe(true);
    expect(
      requestHeaders.some(
        ({ path }) => path === "/erbjudanden/ica-signalen-linkoping-1003520/",
      ),
    ).toBe(true);

    const icaRequests = requestTimes.filter(({ chain }) => chain === "ICA");
    expect(
      icaRequests.slice(1).every(
        (request, index) => request.at - icaRequests[index].at >= 1_000,
      ),
    ).toBe(true);
  });

  it("applies configured ICA Store pins and exclusions", async () => {
    const location = structuredClone(linkopingLocation);
    delete location.chains.Hemköp;
    delete location.chains.Coop;
    location.chains.ICA!.storeDiscovery.exactCity.value = "Mjölby";
    location.chains.ICA!.storeDiscovery.pinStoreIds = ["ICA:2151"];
    location.chains.ICA!.storeDiscovery.excludeStoreIds = ["ICA:9999"];

    const fetcher: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/e11/public-access-token") {
        return Response.json(token);
      }
      if (url.pathname === "/sverige/digx/storesearch/v1/searchbyquery") {
        return Response.json(icaStores);
      }
      if (url.pathname.startsWith("/erbjudanden/")) {
        const accountNumber = url.pathname.match(/-(\d+)\/?$/)?.[1];
        const page = accountNumber ? icaOffers.get(accountNumber) : undefined;
        return page
          ? new Response(page, { headers: { "Content-Type": "text/html" } })
          : new Response("No recorded ICA fixture for this Store", { status: 404 });
      }
      return new Response("No recorded fixture for this request", { status: 404 });
    };

    const snapshot = await buildLocationSnapshot(location, {
      fetcher,
      now: () => new Date("2026-11-17T05:00:00.000Z"),
      sleep: async () => {},
    });

    expect(snapshot.chains).toMatchObject([
      { chain: "ICA", source: "ica-first-party", status: "ok" },
    ]);
    expect(snapshot.stores.map((store) => store.id)).toEqual(["ICA:2151"]);
    expect(snapshot.offers.length).toBeGreaterThan(0);
    expect(snapshot.offers.every((offer) => offer.storeId === "ICA:2151")).toBe(true);
  });

  it("reports an ICA access denial without retrying or dropping Hemköp Offers", async () => {
    let storeSearchRequests = 0;
    const fetcher: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/e11/public-access-token") {
        return Response.json(token);
      }
      if (url.pathname === "/sverige/digx/storesearch/v1/searchbyquery") {
        storeSearchRequests += 1;
        return new Response("Forbidden", { status: 403 });
      }
      if (url.pathname === "/axfood/rest/store") {
        return Response.json(hemkopStores);
      }
      if (url.pathname === "/search/campaigns/offline") {
        const key = `${url.searchParams.get("q")}-${url.searchParams.get("page")}`;
        const page = hemkopCampaigns.get(key);
        return page
          ? Response.json(page)
          : new Response("No recorded Hemköp fixture for this request", {
              status: 404,
            });
      }
      return new Response("No recorded fixture for this request", { status: 404 });
    };

    const snapshot = await buildLocationSnapshot(
      linkopingIcaHemkopLocation,
      {
        fetcher,
        now: () => new Date("2026-11-17T05:00:00.000Z"),
        sleep: async () => {},
      },
    );

    expect(snapshot.chains.find((chain) => chain.chain === "ICA")).toMatchObject({
      status: "failed",
      error: expect.stringContaining("HTTP 403"),
    });
    expect(snapshot.chains.find((chain) => chain.chain === "Hemköp")?.status).toBe(
      "ok",
    );
    expect(snapshot.offers.some((offer) => offer.chain === "Hemköp")).toBe(true);
    expect(snapshot.offers.some((offer) => offer.chain === "ICA")).toBe(false);
    expect(storeSearchRequests).toBe(1);
  });

  it("reports an unexpected ICA offers page instead of publishing an empty success", async () => {
    let offerPageRequests = 0;
    const fetcher: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/e11/public-access-token") {
        return Response.json(token);
      }
      if (url.pathname === "/sverige/digx/storesearch/v1/searchbyquery") {
        return Response.json(icaStores);
      }
      if (url.pathname.startsWith("/erbjudanden/")) {
        offerPageRequests += 1;
        return new Response("<html><body>Changed ICA page</body></html>", {
          headers: { "Content-Type": "text/html" },
        });
      }
      if (url.pathname === "/axfood/rest/store") {
        return Response.json(hemkopStores);
      }
      if (url.pathname === "/search/campaigns/offline") {
        const key = `${url.searchParams.get("q")}-${url.searchParams.get("page")}`;
        const page = hemkopCampaigns.get(key);
        return page
          ? Response.json(page)
          : new Response("No recorded Hemköp fixture for this request", {
              status: 404,
            });
      }
      return new Response("No recorded fixture for this request", { status: 404 });
    };

    const snapshot = await buildLocationSnapshot(
      linkopingIcaHemkopLocation,
      {
        fetcher,
        now: () => new Date("2026-11-17T05:00:00.000Z"),
        sleep: async () => {},
      },
    );

    expect(snapshot.chains.find((chain) => chain.chain === "ICA")).toMatchObject({
      status: "failed",
      error: expect.stringContaining("saknar det förväntade"),
    });
    expect(snapshot.chains.find((chain) => chain.chain === "Hemköp")?.status).toBe(
      "ok",
    );
    expect(snapshot.offers.some((offer) => offer.chain === "ICA")).toBe(false);
    expect(snapshot.offers.some((offer) => offer.chain === "Hemköp")).toBe(true);
    expect(offerPageRequests).toBe(1);
  });

  it("keeps still-valid ICA Offers as stale data when the source stops responding", async () => {
    const previous = structuredClone(snapshotFixture);
    previous.chains.find((chain) => chain.chain === "ICA")!.source =
      "ica-first-party";
    const fetcher: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/e11/public-access-token") {
        return Response.json(token);
      }
      if (url.pathname === "/sverige/digx/storesearch/v1/searchbyquery") {
        return new Response("Unavailable", { status: 503 });
      }
      if (url.pathname === "/axfood/rest/store") {
        return Response.json(hemkopStores);
      }
      if (url.pathname === "/search/campaigns/offline") {
        const key = `${url.searchParams.get("q")}-${url.searchParams.get("page")}`;
        const page = hemkopCampaigns.get(key);
        return page
          ? Response.json(page)
          : new Response("No recorded Hemköp fixture for this request", {
              status: 404,
            });
      }
      return new Response("No recorded fixture for this request", { status: 404 });
    };

    const snapshot = await buildLocationSnapshot(
      linkopingIcaHemkopLocation,
      {
        fetcher,
        now: () => new Date("2026-11-17T05:00:00.000Z"),
        sleep: async () => {},
        previousSnapshot: previous,
      },
    );

    expect(snapshot.chains.find((chain) => chain.chain === "ICA")).toMatchObject({
      status: "stale",
      lastSuccessAt: "2026-11-17T09:00:00.000Z",
    });
    expect(snapshot.offers.filter((offer) => offer.chain === "ICA").map((offer) => offer.name)).toEqual([
      "Småcitrus i nät",
      "Fredagserbjudande",
    ]);
    expect(snapshot.offers.some((offer) => offer.name === "Utgånget ICA-exempel")).toBe(
      false,
    );
    expect(snapshot.chains.find((chain) => chain.chain === "Hemköp")?.status).toBe(
      "ok",
    );
  });
});
