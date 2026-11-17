import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildHemkopSnapshot, buildSnapshots } from "../src/snapshot/job";

const fixtureRoot = resolve(import.meta.dirname, "fixtures/hemkop");
const stores = JSON.parse(readFileSync(resolve(fixtureRoot, "stores.json"), "utf8"));
const campaignPages = new Map(
  ["4552-0", "4552-1", "4552-2", "4701-0", "4800-0"].map((key) => [
    key,
    JSON.parse(
      readFileSync(resolve(fixtureRoot, `campaigns/${key}.json`), "utf8"),
    ),
  ]),
);

function fixtureFetcher(now: () => number) {
  const requestTimes: number[] = [];
  const fetcher: typeof fetch = async (input) => {
    requestTimes.push(now());
    const url = new URL(String(input));
    if (url.pathname === "/axfood/rest/store") {
      return Response.json(stores);
    }
    if (url.pathname === "/search/campaigns/offline") {
      const key = `${url.searchParams.get("q")}-${url.searchParams.get("page")}`;
      const page = campaignPages.get(key);
      if (!page) {
        return new Response("No recorded fixture for this request", { status: 404 });
      }
      return Response.json(page);
    }
    return new Response("No recorded fixture for this request", { status: 404 });
  };
  return { fetcher, requestTimes };
}

describe("Hemköp Snapshot job", () => {
  it("builds separate Location Snapshots from exact-city discovery and Store overrides", async () => {
    let elapsed = 0;
    const { fetcher } = fixtureFetcher(() => elapsed);
    const locations = [
      {
        id: "linkoping",
        name: "Linköping",
        chains: {
          Hemköp: {
            source: "hemkop-first-party",
            storeDiscovery: {
              exactCity: { field: "address.town", value: "Linköping" },
              pinStoreIds: ["Hemköp:4800", "4701"],
              excludeStoreIds: ["Hemköp:4701"],
            },
          },
        },
      },
      {
        id: "norrkoping",
        name: "Norrköping",
        chains: {
          Hemköp: {
            source: "hemkop-first-party",
            storeDiscovery: {
              exactCity: { field: "address.town", value: "Norrköping" },
            },
          },
        },
      },
    ];

    const snapshots = await buildSnapshots(locations, {
      fetcher,
      now: () => new Date("2026-11-17T05:00:00.000Z"),
      sleep: async (milliseconds) => {
        elapsed += milliseconds;
      },
    });

    expect(snapshots.map((snapshot) => snapshot.location)).toEqual([
      { id: "linkoping", name: "Linköping" },
      { id: "norrkoping", name: "Norrköping" },
    ]);
    expect(snapshots[0].stores.map((store) => store.id)).toEqual([
      "Hemköp:4552",
      "Hemköp:4800",
    ]);
    expect(snapshots[0].offers.every((offer) => offer.storeId !== "Hemköp:4701")).toBe(
      true,
    );
    expect(snapshots[0].offers.some((offer) => offer.storeId === "Hemköp:4800")).toBe(
      true,
    );
    expect(snapshots[1].stores.map((store) => store.id)).toEqual(["Hemköp:4800"]);
    expect(
      snapshots[1].offers.every((offer) => offer.storeId === "Hemköp:4800"),
    ).toBe(true);
  });

  it("publishes the paginated Linköping Offers as a normalized Snapshot", async () => {
    let elapsed = 0;
    const { fetcher, requestTimes } = fixtureFetcher(() => elapsed);
    const snapshot = await buildHemkopSnapshot(
      { id: "linkoping", name: "Linköping", city: "Linköping" },
      {
        fetcher,
        now: () => new Date("2026-11-17T05:00:00.000Z"),
        sleep: async (milliseconds) => {
          elapsed += milliseconds;
        },
      },
    );

    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      location: { id: "linkoping", name: "Linköping" },
      chains: [{ chain: "Hemköp", source: "hemkop-first-party", status: "ok" }],
      stores: [
        {
          id: "Hemköp:4552",
          chain: "Hemköp",
          name: "Hemköp Linköping Lucullus",
          address: "Stora Torget 5, 582 19, Linköping",
        },
        {
          id: "Hemköp:4701",
          chain: "Hemköp",
          name: "Hemköp Linköping Priso",
        },
      ],
      offers: expect.arrayContaining([
        expect.objectContaining({
          chain: "Hemköp",
          name: "Krossade tomater",
          brand: "Garant",
          packageSize: "390g",
          mechanicText: "6 kr/st",
          category: "Skafferi",
          validFrom: "2026-11-16",
          validTo: "2026-11-22",
          price: 6,
          unitPrice: 6,
          regularPrice: 12.25,
          comparisonPriceText: "15,38/kg",
          sourceUrl: expect.stringContaining("hemkop.se"),
        }),
        expect.objectContaining({
          name: "Kampanjprodukt",
          mechanicText: "3 för 2",
          category: "Övrigt",
          quantity: 3,
          validFrom: "2026-11-20",
        }),
      ]),
    });
    const noPricedOffer = snapshot.offers.find(
      (offer) => offer.name === "Kampanjprodukt",
    );
    expect(noPricedOffer).toBeDefined();
    expect(noPricedOffer).not.toHaveProperty("price");
    expect(noPricedOffer).not.toHaveProperty("unitPrice");
    const memberOffer = snapshot.offers.find(
      (offer) => offer.name === "Läsk 4-pack",
    );
    expect(memberOffer).toMatchObject({
      mechanicText: "49,95 kr/st",
      price: 49.95,
      category: "Dryck",
    });
    expect(snapshot.offers.filter((offer) => offer.name === "Läsk 4-pack")).toHaveLength(
      1,
    );
    expect(
      snapshot.offers.find((offer) => offer.name === "Två för 22"),
    ).toMatchObject({
      quantity: 2,
      price: 22,
      unitPrice: 11,
    });
    expect(snapshot.chains[0].error).toContain("Hemköp Linköping Priso");
    expect(snapshot.offers.some((offer) => offer.name === "Utgånget exempel")).toBe(
      false,
    );
    expect(snapshot.offers.some((offer) => offer.name === "Nästa vecka")).toBe(false);
    expect(
      requestTimes.slice(1).every((time, index) => time - requestTimes[index] >= 10_000),
    ).toBe(true);
  });

  it("uses an exact city match when discovering Stores", async () => {
    const { fetcher } = fixtureFetcher(() => 0);
    const snapshot = await buildHemkopSnapshot(
      { id: "linkoping", name: "Linköping", city: "linköping" },
      {
        fetcher,
        now: () => new Date("2026-11-17T05:00:00.000Z"),
        sleep: async () => {},
      },
    );

    expect(snapshot.chains[0]).toMatchObject({
      status: "failed",
      lastSuccessAt: null,
    });
    expect(snapshot.chains[0].error).toContain("Inga Hemköp-butiker hittades");
    expect(snapshot.stores).toHaveLength(0);
    expect(snapshot.offers).toHaveLength(0);
  });

  it("surfaces duplicate Store ids as a valid failed Snapshot", async () => {
    let requestCount = 0;
    const fetcher: typeof fetch = async (input) => {
      requestCount += 1;
      if (new URL(String(input)).pathname === "/axfood/rest/store") {
        return Response.json([...stores, stores[0]]);
      }
      return new Response("Unexpected campaign request", { status: 500 });
    };
    const snapshot = await buildHemkopSnapshot(
      { id: "linkoping", name: "Linköping", city: "Linköping" },
      {
        fetcher,
        now: () => new Date("2026-11-17T05:00:00.000Z"),
        sleep: async () => {},
      },
    );

    expect(snapshot.chains[0].status).toBe("failed");
    expect(snapshot.chains[0].error).toContain("dubbla Store ids");
    expect(snapshot.stores.map((store) => store.id)).toEqual([
      "Hemköp:4552",
      "Hemköp:4701",
    ]);
    expect(snapshot.offers).toHaveLength(0);
    expect(requestCount).toBe(1);
  });

  it("rejects a whitespace-only Store name without returning malformed data", async () => {
    const invalidStores = structuredClone(stores);
    invalidStores[0].name = "   ";
    let requestCount = 0;
    const fetcher: typeof fetch = async () => {
      requestCount += 1;
      return Response.json(invalidStores);
    };
    const snapshot = await buildHemkopSnapshot(
      { id: "linkoping", name: "Linköping", city: "Linköping" },
      {
        fetcher,
        now: () => new Date("2026-11-17T05:00:00.000Z"),
        sleep: async () => {},
      },
    );

    expect(snapshot.chains[0].status).toBe("failed");
    expect(snapshot.chains[0].error).toContain("Ogiltigt svar från Hemköp");
    expect(snapshot.stores).toHaveLength(0);
    expect(snapshot.offers).toHaveLength(0);
    expect(requestCount).toBe(1);
  });

  it("sends no source requests outside Hemköp's stated UTC visiting window", async () => {
    let madeRequest = false;
    const fetcher: typeof fetch = async () => {
      madeRequest = true;
      return Response.json(stores);
    };
    const snapshot = await buildHemkopSnapshot(
      { id: "linkoping", name: "Linköping", city: "Linköping" },
      {
        fetcher,
        now: () => new Date("2026-11-17T09:00:00.000Z"),
        sleep: async () => {},
      },
    );

    expect(madeRequest).toBe(false);
    expect(snapshot.chains[0].status).toBe("failed");
    expect(snapshot.chains[0].error).toContain("04:00–08:45 UTC");
  });

  it("stops before a delayed request would cross the UTC visiting-window end", async () => {
    let currentTime = new Date("2026-11-17T08:44:50.000Z");
    let requestCount = 0;
    const fetcher: typeof fetch = async () => {
      requestCount += 1;
      return Response.json(stores);
    };
    const snapshot = await buildHemkopSnapshot(
      { id: "linkoping", name: "Linköping", city: "Linköping" },
      {
        fetcher,
        now: () => new Date(currentTime),
        sleep: async (milliseconds) => {
          currentTime = new Date(currentTime.getTime() + milliseconds);
        },
      },
    );

    expect(requestCount).toBe(1);
    expect(snapshot.chains[0].status).toBe("failed");
    expect(snapshot.chains[0].error).toContain("04:00–08:45 UTC");
  });

  it("surfaces an HTTP block as a failed Chain instead of publishing empty success", async () => {
    const { fetcher: replay } = fixtureFetcher(() => 0);
    const fetcher: typeof fetch = async (input) => {
      if (new URL(String(input)).pathname === "/search/campaigns/offline") {
        return new Response("Forbidden", { status: 403 });
      }
      return replay(input);
    };
    const snapshot = await buildHemkopSnapshot(
      { id: "linkoping", name: "Linköping", city: "Linköping" },
      {
        fetcher,
        now: () => new Date("2026-11-17T05:00:00.000Z"),
        sleep: async () => {},
      },
    );

    expect(snapshot.chains[0].status).toBe("failed");
    expect(snapshot.chains[0].error).toContain("HTTP 403");
    expect(snapshot.offers).toHaveLength(0);
  });

  it("treats a malformed campaign response as a source failure", async () => {
    const { fetcher: replay } = fixtureFetcher(() => 0);
    const fetcher: typeof fetch = async (input) => {
      if (new URL(String(input)).pathname === "/search/campaigns/offline") {
        return Response.json({ results: {}, pagination: { numberOfPages: 1 } });
      }
      return replay(input);
    };
    const snapshot = await buildHemkopSnapshot(
      { id: "linkoping", name: "Linköping", city: "Linköping" },
      {
        fetcher,
        now: () => new Date("2026-11-17T05:00:00.000Z"),
        sleep: async () => {},
      },
    );

    expect(snapshot.chains[0].status).toBe("failed");
    expect(snapshot.chains[0].error).toContain("Ogiltigt svar från Hemköp");
    expect(snapshot.offers).toHaveLength(0);
  });

  it("fails the Chain when a supplied Offer start date cannot be parsed", async () => {
    const { fetcher: replay } = fixtureFetcher(() => 0);
    const malformedPage = structuredClone(campaignPages.get("4552-0"));
    malformedPage.results[0].potentialPromotions[0].startDate = "next week";
    const fetcher: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (
        url.pathname === "/search/campaigns/offline" &&
        url.searchParams.get("q") === "4552" &&
        url.searchParams.get("page") === "0"
      ) {
        return Response.json(malformedPage);
      }
      return replay(input);
    };
    const snapshot = await buildHemkopSnapshot(
      { id: "linkoping", name: "Linköping", city: "Linköping" },
      {
        fetcher,
        now: () => new Date("2026-11-17T05:00:00.000Z"),
        sleep: async () => {},
      },
    );

    expect(snapshot.chains[0].status).toBe("failed");
    expect(snapshot.chains[0].error).toContain("startdatum");
    expect(snapshot.offers).toHaveLength(0);
  });

  it("fails the Chain instead of silently ignoring a malformed numeric price", async () => {
    const { fetcher: replay } = fixtureFetcher(() => 0);
    const malformedPage = structuredClone(campaignPages.get("4552-0"));
    malformedPage.results[0].potentialPromotions[0].price = "2 för 22";
    const fetcher: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (
        url.pathname === "/search/campaigns/offline" &&
        url.searchParams.get("q") === "4552" &&
        url.searchParams.get("page") === "0"
      ) {
        return Response.json(malformedPage);
      }
      return replay(input);
    };
    const snapshot = await buildHemkopSnapshot(
      { id: "linkoping", name: "Linköping", city: "Linköping" },
      {
        fetcher,
        now: () => new Date("2026-11-17T05:00:00.000Z"),
        sleep: async () => {},
      },
    );

    expect(snapshot.chains[0].status).toBe("failed");
    expect(snapshot.chains[0].error).toContain("price");
    expect(snapshot.offers).toHaveLength(0);
  });

  it("keeps still-valid Offers and reports stale data when refresh fails", async () => {
    const now = () => new Date("2026-11-17T05:00:00.000Z");
    const { fetcher: replay } = fixtureFetcher(() => 0);
    const previous = await buildHemkopSnapshot(
      { id: "linkoping", name: "Linköping", city: "Linköping" },
      { fetcher: replay, now, sleep: async () => {} },
    );
    const failingFetcher: typeof fetch = async (input) => {
      if (new URL(String(input)).pathname === "/search/campaigns/offline") {
        return new Response("Unavailable", { status: 503 });
      }
      return replay(input);
    };
    const stale = await buildHemkopSnapshot(
      { id: "linkoping", name: "Linköping", city: "Linköping" },
      {
        fetcher: failingFetcher,
        now,
        sleep: async () => {},
        previousSnapshot: previous,
      },
    );

    expect(stale.chains[0]).toMatchObject({
      status: "stale",
      lastSuccessAt: previous.chains[0].lastSuccessAt,
    });
    expect(stale.chains[0].error).toContain("HTTP 503");
    expect(stale.offers.map((offer) => offer.id)).toEqual(
      previous.offers.map((offer) => offer.id),
    );
  });

  it("keeps the previous success time when no previous Offer remains valid", async () => {
    const now = () => new Date("2026-11-17T05:00:00.000Z");
    const { fetcher: replay } = fixtureFetcher(() => 0);
    const previous = await buildHemkopSnapshot(
      { id: "linkoping", name: "Linköping", city: "Linköping" },
      { fetcher: replay, now, sleep: async () => {} },
    );
    previous.offers = [];
    const fetcher: typeof fetch = async (input) => {
      if (new URL(String(input)).pathname === "/search/campaigns/offline") {
        return new Response("Unavailable", { status: 503 });
      }
      return replay(input);
    };
    const failed = await buildHemkopSnapshot(
      { id: "linkoping", name: "Linköping", city: "Linköping" },
      {
        fetcher,
        now,
        sleep: async () => {},
        previousSnapshot: previous,
      },
    );

    expect(failed.chains[0].status).toBe("failed");
    expect(failed.chains[0].lastSuccessAt).toBe(previous.chains[0].lastSuccessAt);
    expect(failed.offers).toHaveLength(0);
  });

  it("does not mistake the checked-in fixture Snapshot for a successful live refresh", async () => {
    const now = () => new Date("2026-11-17T05:00:00.000Z");
    const { fetcher: replay } = fixtureFetcher(() => 0);
    const previous = await buildHemkopSnapshot(
      { id: "linkoping", name: "Linköping", city: "Linköping" },
      { fetcher: replay, now, sleep: async () => {} },
    );
    previous.chains[0].source = "hemkop-fixture";
    const fetcher: typeof fetch = async (input) => {
      if (new URL(String(input)).pathname === "/search/campaigns/offline") {
        return new Response("Forbidden", { status: 403 });
      }
      return replay(input);
    };

    const failed = await buildHemkopSnapshot(
      { id: "linkoping", name: "Linköping", city: "Linköping" },
      {
        fetcher,
        now,
        sleep: async () => {},
        previousSnapshot: previous,
      },
    );

    expect(failed.chains[0].status).toBe("failed");
    expect(failed.chains[0].lastSuccessAt).toBeNull();
    expect(failed.offers).toHaveLength(0);
  });
});
