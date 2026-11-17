import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCATION_REGISTRY } from "../src/snapshot/config";
import {
  buildCoopSnapshot,
  COOP_TJEK_SOURCE,
  type CoopLocation,
} from "../src/snapshot/coop";
import { buildSnapshots } from "../src/snapshot/job";

const fixtureRoot = resolve(import.meta.dirname, "fixtures/coop");
const hemkopFixtureRoot = resolve(import.meta.dirname, "fixtures/hemkop");
const tjekFixtureRoot = resolve(import.meta.dirname, "fixtures/tjek");
const coopLocation: CoopLocation = {
  id: "linkoping",
  name: "Linköping",
  storeDiscovery: {
    exactCity: { field: "city", value: "Linköping" },
  },
};

function readFixture<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(fixtureRoot, path), "utf8")) as T;
}

function readHemkopFixture<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(hemkopFixtureRoot, path), "utf8")) as T;
}

function readTjekFixture<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(tjekFixtureRoot, path), "utf8")) as T;
}

function decodeCommand(init?: RequestInit): [string, Record<string, unknown>] {
  if (typeof init?.body !== "string") {
    throw new Error("Tjek request did not contain a JSON body");
  }
  const body = JSON.parse(init.body) as { data?: string[] };
  const encoded = body.data?.[0];
  if (!encoded) {
    throw new Error("Tjek request did not contain an encoded command");
  }
  return JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as [
    string,
    Record<string, unknown>,
  ];
}

describe("Coop Snapshot job", () => {
  it.skip("normalizes Coop's paginated Tjek Offers (awaiting verified publication and Offer-ID flow)", async () => {
    const businesses = readFixture<{ value: Array<Record<string, unknown>> }>(
      "businesses.json",
    );
    const drottninggatanPage = readFixture<{ value: { data: Array<Record<string, unknown>> } }>(
      "offers/coop-drottninggatan-0.json",
    ).value.data;
    const garnisonenPage = readFixture<{ value: { data: Array<Record<string, unknown>> } }>(
      "offers/coop-garnisonen-0.json",
    );
    const lastPageOffer = {
      ...drottninggatanPage[1],
      publicId: "coop-offer-last-page",
      name: "Sista sidan",
    };
    let elapsed = 0;
    const requestTimes: number[] = [];
    const requestedOffsets: number[] = [];
    const fetcher: typeof fetch = async (_input, init) => {
      requestTimes.push(elapsed);
      const [action, params] = decodeCommand(init);
      if (action === "businesses") {
        return Response.json(businesses);
      }
      if (action === "offers") {
        const businessIds = params.businessIds as string[] | undefined;
        const businessId = businessIds?.[0];
        const pagination = params.pagination as
          | { limit?: number; offset?: number }
          | undefined;
        const offset = pagination?.offset ?? 0;
        requestedOffsets.push(offset);
        if (businessId === "coop-drottninggatan" && offset === 0) {
          const filler = Array.from(
            { length: 100 - drottninggatanPage.length },
            (_, index) => ({
              ...drottninggatanPage[0],
              publicId: `pagination-fixture-${index}`,
              name: `Pagineringsexempel ${index}`,
            }),
          );
          return Response.json({
            value: { data: [...drottninggatanPage, ...filler] },
          });
        }
        if (businessId === "coop-drottninggatan" && offset === 100) {
          return Response.json({ value: { data: [lastPageOffer] } });
        }
        if (businessId === "coop-garnisonen" && offset === 0) {
          return Response.json(garnisonenPage);
        }
        return Response.json({ value: { data: [] } });
      }
      return new Response("No recorded fixture for this command", { status: 404 });
    };

    const snapshot = await buildCoopSnapshot(coopLocation, {
      fetcher,
      now: () => new Date("2026-11-17T05:00:00.000Z"),
      sleep: async (milliseconds) => {
        elapsed += milliseconds;
      },
    });

    expect(snapshot.chains).toMatchObject([
      { chain: "Coop", source: COOP_TJEK_SOURCE, status: "ok" },
    ]);
    expect(snapshot.stores.map((store) => store.id)).toEqual([
      "Coop:coop-drottninggatan",
      "Coop:coop-garnisonen",
    ]);
    expect(snapshot.offers).toContainEqual(
      expect.objectContaining({
        chain: "Coop",
        storeId: "Coop:coop-drottninggatan",
        name: "Arla Mellanmjölk",
        brand: "Arla",
        packageSize: "1 l",
        mechanicText: "Medlemspris 15 kr/l",
        category: "Mejeri & ost",
        validFrom: "2026-11-16",
        validTo: "2026-11-22",
        price: 15,
        unitPrice: 15,
        priceUnit: "l",
        regularPrice: 17.9,
        comparisonPriceText: "15 kr/l",
        limitText: "Max 2 per hushåll",
      }),
    );
    expect(snapshot.offers).toContainEqual(
      expect.objectContaining({
        name: "Kaffe för helgen",
        mechanicText: "2 för 30 kr",
        quantity: 2,
        price: 30,
        unitPrice: 15,
        validFrom: "2026-11-20",
      }),
    );
    expect(snapshot.offers).toContainEqual(
      expect.objectContaining({
        name: "Okänd kategori",
        category: "Övrigt",
        storeId: "Coop:coop-garnisonen",
      }),
    );
    const weightOffer = snapshot.offers.find((offer) => offer.name === "Laxfilé");
    expect(weightOffer).toMatchObject({
      mechanicText: "69,90 kr/kg",
      priceUnit: "kg",
      unitPrice: 69.9,
    });
    expect(weightOffer).not.toHaveProperty("price");
    const memberOffer = snapshot.offers.find(
      (offer) => offer.name === "Medlemspris före ordinarie pris",
    );
    expect(memberOffer).toMatchObject({
      price: 10,
      regularPrice: 19,
      mechanicText: "Medlemspris 10 kr/st",
    });
    const textOnlyOffer = snapshot.offers.find(
      (offer) => offer.name === "Köp tre, betala för två",
    );
    expect(textOnlyOffer).toMatchObject({
      mechanicText: "3 för 2",
      quantity: 3,
    });
    expect(textOnlyOffer).not.toHaveProperty("price");
    expect(textOnlyOffer).not.toHaveProperty("unitPrice");
    expect(snapshot.offers.some((offer) => offer.name === "Utgånget exempel")).toBe(
      false,
    );
    expect(snapshot.offers.some((offer) => offer.name === "Sista sidan")).toBe(true);
    expect(requestedOffsets).toContain(100);
    expect(
      requestTimes
        .slice(1)
        .every((time, index) => time - requestTimes[index] >= 1_000),
    ).toBe(true);
  });

  it("keeps still-valid Offers as stale when Tjek Store discovery is denied", async () => {
    const businesses = readTjekFixture<unknown>("businesses-coop-brand.json");
    const actions: string[] = [];
    const previousSnapshot = {
      schemaVersion: 1,
      location: { id: "linkoping", name: "Linköping" },
      generatedAt: "2026-11-16T09:00:00.000Z",
      chains: [
        {
          chain: "Coop",
          source: "coop-tjek",
          status: "ok",
          lastAttemptAt: "2026-11-16T09:00:00.000Z",
          lastSuccessAt: "2026-11-16T09:00:00.000Z",
        },
      ],
      stores: [
        {
          id: "Coop:coop-drottninggatan",
          chain: "Coop",
          name: "Coop Drottninggatan Linköping",
          address: "Drottninggatan 23, Linköping",
        },
      ],
      offers: [
        {
          id: "previous-coop-offer",
          chain: "Coop",
          storeId: "Coop:coop-drottninggatan",
          name: "Tidigare giltigt erbjudande",
          mechanicText: "15 kr/l",
          category: "Mejeri & ost",
          validFrom: "2026-11-16",
          validTo: "2026-11-22",
          sourceUrl: "https://ereklamblad.se/",
          price: 15,
          unitPrice: 15,
          priceUnit: "l",
        },
      ],
    };
    const fetcher: typeof fetch = async (_input, init) => {
      const [action] = decodeCommand(init);
      actions.push(action);
      if (action === "businesses") {
        return Response.json(businesses);
      }
      if (action === "stores") {
        return new Response("Forbidden", { status: 403 });
      }
      return new Response("No recorded fixture for this command", { status: 404 });
    };

    const snapshot = await buildCoopSnapshot(coopLocation, {
      fetcher,
      now: () => new Date("2026-11-17T05:00:00.000Z"),
      sleep: async () => {},
      previousSnapshot,
    });

    expect(snapshot.chains[0]).toMatchObject({
      status: "stale",
      lastSuccessAt: "2026-11-16T09:00:00.000Z",
    });
    expect(snapshot.chains[0].error).toContain("HTTP 403");
    expect(snapshot.offers.map((offer) => offer.id)).toEqual([
      "previous-coop-offer",
    ]);
    expect(actions).toEqual(["businesses", "stores"]);
  });

  it("reports a malformed Tjek Store listing as a failed Chain", async () => {
    const businesses = readTjekFixture<unknown>("businesses-coop-brand.json");
    const fetcher: typeof fetch = async (_input, init) => {
      const [action] = decodeCommand(init);
      if (action === "businesses") {
        return Response.json(businesses);
      }
      if (action === "stores") {
        return Response.json({
          key: "synthetic",
          status: "synthetic",
          value: { data: {} },
        });
      }
      return new Response("Unexpected Tjek command", { status: 404 });
    };

    const snapshot = await buildCoopSnapshot(coopLocation, {
      fetcher,
      now: () => new Date("2026-11-17T05:00:00.000Z"),
      sleep: async () => {},
    });

    expect(snapshot.chains[0].status).toBe("failed");
    expect(snapshot.chains[0].error).toContain("Ogiltigt svar från Tjek");
    expect(snapshot.offers).toHaveLength(0);
  });

  it("applies Coop Store pins and exclusions from Location configuration", async () => {
    const businesses = readTjekFixture<unknown>("businesses-coop-brand.json");
    const stores = {
      key: "synthetic",
      status: "synthetic",
      value: {
        data: [
          {
            id: "coop-drottninggatan",
            name: "Coop Drottninggatan Linköping",
            city: "Linköping",
            streetAddress: "Drottninggatan 23",
          },
          {
            id: "coop-garnisonen",
            name: "Stora Coop Garnisonen",
            city: "Linköping",
            streetAddress: "Garnisonsvägen 50",
          },
          {
            id: "coop-norrkoping",
            name: "Coop Norrköping",
            city: "Norrköping",
            streetAddress: "Testgatan 1",
          },
        ],
      },
    };
    const fetcher: typeof fetch = async (_input, init) => {
      const [action] = decodeCommand(init);
      if (action === "businesses") {
        return Response.json(businesses);
      }
      if (action === "stores") {
        return Response.json(stores);
      }
      return new Response("Unexpected Tjek command", { status: 404 });
    };

    const snapshot = await buildCoopSnapshot(
      {
        ...coopLocation,
        storeDiscovery: {
          exactCity: { field: "city", value: "Linköping" },
          pinStoreIds: ["Coop:coop-garnisonen", "coop-norrkoping"],
          excludeStoreIds: ["coop-garnisonen"],
        },
      },
      {
        fetcher,
        now: () => new Date("2026-11-17T05:00:00.000Z"),
        sleep: async () => {},
      },
    );

    expect(snapshot.chains[0].status).toBe("failed");
    expect(snapshot.stores.map((store) => store.id)).toEqual([
      "Coop:coop-drottninggatan",
      "Coop:coop-norrkoping",
    ]);
  });

  it("keeps Coop configured for Tjek beside Hemköp without publishing unverified Coop Offers", async () => {
    const businesses = readTjekFixture<unknown>("businesses-coop-brand.json");
    const stores = readTjekFixture<unknown>("stores-coop-63eeoD.json");
    const hemkopStores = readHemkopFixture<unknown>("stores.json");
    const campaignPages = new Map(
      ["4552-0", "4552-1", "4552-2", "4701-0", "4800-0"].map((key) => [
        key,
        readHemkopFixture<unknown>(`campaigns/${key}.json`),
      ]),
    );
    const fetcher: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      if (url.hostname === "ereklamblad.se") {
        const [action] = decodeCommand(init);
        if (action === "businesses") {
          return Response.json(businesses);
        }
        if (action === "stores") {
          return Response.json(stores);
        }
        return new Response("No recorded Coop fixture", { status: 404 });
      }

      if (url.pathname === "/axfood/rest/store") {
        return Response.json(hemkopStores);
      }
      if (url.pathname === "/search/campaigns/offline") {
        const key = `${url.searchParams.get("q")}-${url.searchParams.get("page")}`;
        const page = campaignPages.get(key);
        return page
          ? Response.json(page)
          : new Response("No recorded Hemköp fixture", { status: 404 });
      }
      return new Response("No recorded fixture for this request", { status: 404 });
    };
    const configuredLocation = LOCATION_REGISTRY.locations.find(
      (candidate) => candidate.id === "linkoping",
    );
    if (!configuredLocation) {
      throw new Error("Missing Linköping Location configuration");
    }
    const location = {
      ...configuredLocation,
      chains: {
        Coop: {
          ...configuredLocation.chains.Coop!,
          source: COOP_TJEK_SOURCE,
        },
        Hemköp: configuredLocation.chains.Hemköp,
      },
    };

    const [snapshot] = await buildSnapshots([location], {
      fetcher,
      now: () => new Date("2026-11-17T05:00:00.000Z"),
      sleep: async () => {},
    });

    expect(snapshot.chains).toMatchObject([
      { chain: "Coop", source: COOP_TJEK_SOURCE, status: "failed" },
      { chain: "Hemköp", source: "hemkop-first-party", status: "ok" },
    ]);
    expect(snapshot.stores.map((store) => store.id)).toEqual(
      expect.arrayContaining([
        "Coop:lSegmZB4MZVpS_3lKyiRv",
        "Hemköp:4552",
      ]),
    );
    expect(snapshot.offers.map((offer) => offer.chain)).toContain("Hemköp");
    expect(snapshot.offers.some((offer) => offer.chain === "Coop")).toBe(false);
  });
});
