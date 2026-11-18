import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildLocationSnapshot } from "../src/snapshot/build";
import { LOCATION_REGISTRY } from "../src/snapshot/config";

const TJEK_SOURCE = "tjek-ereklamblad";
const fixtureRoot = resolve(import.meta.dirname, "fixtures");
const tjekRoot = resolve(fixtureRoot, "tjek");
const icaRoot = resolve(fixtureRoot, "ica");
const hemkopRoot = resolve(fixtureRoot, "hemkop");
const configuredLinkoping = LOCATION_REGISTRY.locations.find(
  (location) => location.id === "linkoping",
)!;
const linkopingLocation = {
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

const tjekBusinesses = JSON.parse(
  readFileSync(resolve(tjekRoot, "businesses.json"), "utf8"),
);
const tjekCoopBrandExcerpt = JSON.parse(
  readFileSync(resolve(tjekRoot, "businesses-coop-brand.json"), "utf8"),
);
const tjekCoopStoreExcerpt = JSON.parse(
  readFileSync(resolve(tjekRoot, "stores-coop-63eeoD.json"), "utf8"),
);
const tjekCoopFronts = JSON.parse(
  readFileSync(resolve(tjekRoot, "fronts-coop-drottninggatan.json"), "utf8"),
);
const tjekCoopPublicationPages = JSON.parse(
  readFileSync(
    resolve(tjekRoot, "publication-pages-coop-NV_F04Kb.json"),
    "utf8",
  ),
);
const tjekCoopOfferLookups = new Map(
  [
    "U-I8EtMIBykwiBusR4IQ1",
    "if-FEwMj9_SuqzsDZ7fOj",
    "1pXJA6RFdEjXUMq444vlS",
  ].map((publicId) => [
    publicId,
    JSON.parse(
      readFileSync(resolve(tjekRoot, `offer-${publicId}.json`), "utf8"),
    ),
  ]),
);
type TjekFallbackFixtures = {
  businesses: unknown;
  stores: Record<string, unknown>;
  fronts: unknown;
  publicationPages: unknown;
  offerLookups: Record<string, unknown>;
};
const tjekFallbackFixtures = JSON.parse(
  readFileSync(
    resolve(tjekRoot, "ica-hemkop-publication-flow-synthetic.json"),
    "utf8",
  ),
) as Record<"ICA" | "Hemköp", TjekFallbackFixtures>;
const tjekHemkopIncitoOfferSample = JSON.parse(
  readFileSync(
    resolve(tjekRoot, "hemkop-incito-offer-2026-11-18.json"),
    "utf8",
  ),
);
const tjekStoreResponses = new Map<string, unknown>([
  ["63eeoD", tjekCoopStoreExcerpt],
  [
    "ica-berga",
    {
      key: "synthetic",
      status: "synthetic",
      value: {
        data: [
          {
            id: "ica-berga",
            name: "ICA Supermarket Berga Centrum",
            city: "Linköping",
            streetAddress: "Berga centrum",
          },
        ],
      },
    },
  ],
  [
    "hemkop-lucullus",
    {
      key: "synthetic",
      status: "synthetic",
      value: {
        data: [
          {
            id: "hemkop-lucullus",
            name: "Hemköp Linköping Lucullus",
            city: "Linköping",
            streetAddress: "Stora Torget 5",
          },
        ],
      },
    },
  ],
  [
    "ica-norrkoping",
    {
      key: "synthetic",
      status: "synthetic",
      value: {
        data: [
          {
            id: "ica-norrkoping",
            name: "ICA Supermarket Norrköping",
            city: "Norrköping",
            streetAddress: "Testgatan 1",
          },
        ],
      },
    },
  ],
]);
const tjekOffers = new Map<string, unknown[]>([
  [
    "ica-berga",
    JSON.parse(
      readFileSync(resolve(tjekRoot, "offers-ica-berga.json"), "utf8"),
    ).value.data,
  ],
  [
    "hemkop-lucullus",
    JSON.parse(
      readFileSync(resolve(tjekRoot, "offers-hemkop-lucullus.json"), "utf8"),
    ).value.data,
  ],
]);
const icaToken = JSON.parse(
  readFileSync(resolve(icaRoot, "token.json"), "utf8"),
);
const icaStores = JSON.parse(
  readFileSync(resolve(icaRoot, "stores.json"), "utf8"),
);
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

interface TjekCommand {
  action: string;
  parameters: Record<string, unknown>;
  at: number;
  headers: Headers;
  credentials?: RequestCredentials;
}

function locationWithTjek(chains: Array<"ICA" | "Hemköp">) {
  const location = structuredClone(linkopingLocation);
  delete location.chains.Coop;
  for (const chain of chains) {
    location.chains[chain]!.source = TJEK_SOURCE;
  }
  return location;
}

function tjekFallbackFixtureOptions(chain: "ICA" | "Hemköp") {
  const fixtures = structuredClone(tjekFallbackFixtures[chain]);
  return {
    businesses: fixtures.businesses,
    stores: new Map(Object.entries(fixtures.stores)),
    fronts: fixtures.fronts,
    publicationPages: fixtures.publicationPages,
    offerLookups: new Map(Object.entries(fixtures.offerLookups)),
  };
}

function fixtureFetcher(
  now: () => number,
  options: {
    businesses?: unknown;
    offers?: Map<string, unknown[]>;
    stores?: Map<string, unknown>;
    fronts?: unknown;
    frontsStatus?: number;
    publicationPages?: unknown;
    publicationPagesStatus?: number;
    incitoOfferIds?: unknown;
    offerLookups?: Map<string, unknown>;
    tjekStatus?: number;
  } = {},
) {
  const tjekCommands: TjekCommand[] = [];
  const requests: Array<{
    hostname: string;
    pathname: string;
    search: string;
    at: number;
    headers: Headers;
    credentials?: RequestCredentials;
  }> = [];
  let activeRequests = 0;
  let maxConcurrentRequests = 0;
  const sourceBusinesses = options.businesses ?? tjekBusinesses;
  const sourceOffers = options.offers ?? tjekOffers;
  const sourceStores = options.stores ?? tjekStoreResponses;

  const fetcher: typeof fetch = async (input, init) => {
    activeRequests += 1;
    maxConcurrentRequests = Math.max(maxConcurrentRequests, activeRequests);
    try {
      await Promise.resolve();
      const url = new URL(String(input));
      requests.push({
        hostname: url.hostname,
        pathname: url.pathname,
        search: url.search,
        at: now(),
        headers: new Headers(init?.headers),
        credentials: init?.credentials,
      });

      if (url.hostname === "publication-viewer.tjek.com") {
        if (url.pathname.startsWith("/api/paged-publications/")) {
          if (options.publicationPagesStatus !== undefined) {
            return new Response("Tjek publication pages fixture", {
              status: options.publicationPagesStatus,
            });
          }
          return options.publicationPages === undefined
            ? new Response("No recorded publication fixture", { status: 404 })
            : Response.json(options.publicationPages);
        }
        if (url.pathname.startsWith("/api/incito-publications/")) {
          return options.incitoOfferIds === undefined
            ? new Response("No recorded Incito Offer IDs fixture", {
                status: 404,
              })
            : Response.json(options.incitoOfferIds);
        }
        return new Response("Unexpected publication viewer route", {
          status: 404,
        });
      }

      if (url.hostname === "ereklamblad.se") {
        const body = JSON.parse(String(init?.body)) as { data: string[] };
        const [action, parameters] = JSON.parse(
          Buffer.from(body.data[0]!, "base64").toString("utf8"),
        ) as [string, Record<string, unknown>];
        tjekCommands.push({
          action,
          parameters,
          at: now(),
          headers: new Headers(init?.headers),
          credentials: init?.credentials,
        });
        if (options.tjekStatus !== undefined) {
          return new Response("Tjek fixture response", {
            status: options.tjekStatus,
          });
        }
        if (action === "businesses") {
          return Response.json(sourceBusinesses);
        }
        if (action === "stores") {
          const businessId = String(parameters.businessId ?? "");
          return Response.json(
            sourceStores.get(businessId) ?? {
              key: "synthetic",
              status: "synthetic",
              value: { data: [] },
            },
          );
        }
        if (action === "fronts") {
          if (options.frontsStatus !== undefined) {
            return new Response("Tjek fronts fixture denial", {
              status: options.frontsStatus,
            });
          }
          return options.fronts === undefined
            ? new Response("No recorded Tjek fronts fixture", { status: 404 })
            : Response.json(options.fronts);
        }
        if (action === "offer") {
          const publicId = String(parameters.publicId ?? "");
          const offer = options.offerLookups?.get(publicId);
          return offer === undefined
            ? new Response("No recorded Tjek Offer fixture", { status: 404 })
            : Response.json(offer);
        }
        if (action === "offers") {
          const businessId = String(
            (parameters.businessIds as string[] | undefined)?.[0] ?? "",
          );
          const pagination = parameters.pagination as
            | { limit?: number; offset?: number }
            | undefined;
          const limit = pagination?.limit ?? 100;
          const offset = pagination?.offset ?? 0;
          const page = sourceOffers.get(businessId)?.slice(offset, offset + limit) ?? [];
          return Response.json({ value: { data: page } });
        }
        return new Response("Unexpected Tjek command", { status: 404 });
      }

      if (url.hostname === "www.ica.se" && url.pathname === "/e11/public-access-token") {
        return Response.json(icaToken);
      }
      if (
        url.hostname === "apim-pub.gw.ica.se" &&
        url.pathname === "/sverige/digx/storesearch/v1/searchbyquery"
      ) {
        return Response.json(icaStores);
      }
      if (url.hostname === "www.ica.se" && url.pathname.startsWith("/erbjudanden/")) {
        const accountNumber = url.pathname.match(/-(\d+)\/?$/)?.[1];
        const page = accountNumber ? icaOffers.get(accountNumber) : undefined;
        return page
          ? new Response(page, { headers: { "Content-Type": "text/html" } })
          : new Response("No recorded ICA fixture for this Store", { status: 404 });
      }
      if (url.hostname === "www.hemkop.se" && url.pathname === "/axfood/rest/store") {
        return Response.json(hemkopStores);
      }
      if (
        url.hostname === "www.hemkop.se" &&
        url.pathname === "/search/campaigns/offline"
      ) {
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

  return {
    fetcher,
    requests,
    tjekCommands,
    get maxConcurrentRequests() {
      return maxConcurrentRequests;
    },
  };
}

describe("Tjek Snapshot adapter", () => {
  it("uses the configured Tjek source for ICA", async () => {
    const location = structuredClone(configuredLinkoping);
    delete location.chains.Coop;
    delete location.chains.Hemköp;
    const replay = fixtureFetcher(() => 0, tjekFallbackFixtureOptions("ICA"));
    const snapshot = await buildLocationSnapshot(location, {
      fetcher: replay.fetcher,
      now: () => new Date("2026-11-17T05:00:00.000Z"),
      sleep: async () => {},
    });

    expect(snapshot.chains).toMatchObject([
      { chain: "ICA", source: TJEK_SOURCE, status: "ok" },
    ]);
    expect(snapshot.offers).toContainEqual(
      expect.objectContaining({ chain: "ICA", storeId: "ICA:synthetic-ica-berga" }),
    );
  });

  it("discovers a Coop publication and normalizes its structured Offers", async () => {
    let elapsed = 0;
    const replay = fixtureFetcher(() => elapsed, {
      businesses: tjekCoopBrandExcerpt,
      stores: new Map([["63eeoD", tjekCoopStoreExcerpt]]),
      fronts: tjekCoopFronts,
      publicationPages: tjekCoopPublicationPages,
      offerLookups: tjekCoopOfferLookups,
    });

    const snapshot = await buildLocationSnapshot(linkopingLocation, {
      fetcher: replay.fetcher,
      now: () => new Date("2026-11-17T05:00:00.000Z"),
      sleep: async (milliseconds) => {
        elapsed += milliseconds;
      },
    });

    expect(snapshot.chains).toContainEqual(
      expect.objectContaining({
        chain: "Coop",
        source: "coop-tjek",
        status: "ok",
      }),
    );
    expect(snapshot.stores.filter((store) => store.chain === "Coop")).toMatchObject([
      {
        id: "Coop:lSegmZB4MZVpS_3lKyiRv",
        chain: "Coop",
        name: "Coop Drottninggatan Linköping",
        address: "Drottninggatan 23, Linköping",
      },
    ]);
    const offersByName = new Map(
      snapshot.offers
        .filter((offer) => offer.chain === "Coop")
        .map((offer) => [offer.name, offer]),
    );
    expect([...offersByName.keys()]).toEqual([
      "Färdigkokt julskinka",
      "Snacktomater",
      "Kexchoklad",
    ]);
    expect(offersByName.get("Färdigkokt julskinka")).toMatchObject({
      storeId: "Coop:lSegmZB4MZVpS_3lKyiRv",
      mechanicText: "44,9 kr/kg",
      category: "Kött & chark",
      validFrom: "2026-11-16",
      validTo: "2026-11-22",
      price: 44.9,
      unitPrice: 44.9,
      priceUnit: "kg",
      limitText: "Max 2 per hushåll",
    });
    expect(offersByName.get("Färdigkokt julskinka")).not.toHaveProperty("packageSize");
    expect(offersByName.get("Snacktomater")).toMatchObject({
      mechanicText: "29 kr",
      category: "Frukt & grönt",
      packageSize: "400 g",
      price: 29,
      unitPrice: 72.5,
      priceUnit: "kg",
      comparisonPriceText: "72,5 kr/kg",
    });
    expect(offersByName.get("Kexchoklad")).toMatchObject({
      mechanicText: "15 kr",
      category: "Godis & snacks",
      packageSize: "60 g",
      price: 15,
      unitPrice: 125,
      priceUnit: "kg",
      comparisonPriceText: "125 kr/kg",
    });
    expect(replay.tjekCommands.map(({ action }) => action)).toEqual([
      "businesses",
      "stores",
      "fronts",
      "offer",
      "offer",
      "offer",
    ]);
    expect(replay.tjekCommands[1]?.parameters).toEqual({
      businessId: "63eeoD",
      pagination: { offset: 0, limit: 3000 },
    });
    expect(replay.tjekCommands[2]?.parameters).toEqual({
      businessIds: ["63eeoD"],
      localBusinessIds: ["lSegmZB4MZVpS_3lKyiRv"],
      coordinates: { latitude: 58.4043977, longitude: 15.6242393 },
    });
    expect(
      replay.tjekCommands
        .filter(({ action }) => action === "offer")
        .map(({ parameters }) => parameters.publicId),
    ).toEqual([
      "U-I8EtMIBykwiBusR4IQ1",
      "if-FEwMj9_SuqzsDZ7fOj",
      "1pXJA6RFdEjXUMq444vlS",
    ]);
    expect(replay.requests).toContainEqual(
      expect.objectContaining({
        hostname: "publication-viewer.tjek.com",
        pathname: "/api/paged-publications/NV_F04Kb/pages",
        search: "?from=1&to=20",
      }),
    );
    expect(replay.maxConcurrentRequests).toBe(1);
    const tjekRequests = replay.requests.filter(
      ({ hostname }) =>
        hostname === "ereklamblad.se" ||
        hostname === "publication-viewer.tjek.com",
    );
    expect(
      tjekRequests.every(
        ({ credentials, headers }) =>
          credentials === "omit" && headers.get("Authorization") === null,
      ),
    ).toBe(true);
    expect(
      tjekRequests.slice(1).every(
        (request, index) => request.at - tjekRequests[index]!.at >= 1_000,
      ),
    ).toBe(true);
  });

  it("ignores a blank Store name outside the configured Location", async () => {
    const stores = structuredClone(tjekCoopStoreExcerpt) as {
      value: { data: Array<Record<string, unknown>> };
    };
    stores.value.data.push({
      id: "synthetic-off-location-store",
      name: "",
      city: "Norrköping",
      streetAddress: "Synthetic street",
    });
    const replay = fixtureFetcher(() => 0, {
      businesses: tjekCoopBrandExcerpt,
      stores: new Map([["63eeoD", stores]]),
      fronts: tjekCoopFronts,
      publicationPages: tjekCoopPublicationPages,
      offerLookups: tjekCoopOfferLookups,
    });

    const snapshot = await buildLocationSnapshot(linkopingLocation, {
      fetcher: replay.fetcher,
      now: () => new Date("2026-11-17T05:00:00.000Z"),
      sleep: async () => {},
    });

    expect(
      snapshot.chains.find(({ chain }) => chain === "Coop"),
    ).toMatchObject({ status: "ok" });
    expect(snapshot.stores.filter(({ chain }) => chain === "Coop")).toHaveLength(1);
  });

  it("fails closed before publication lookup when a selected Store has a blank name", async () => {
    const stores = structuredClone(tjekCoopStoreExcerpt) as {
      value: { data: Array<Record<string, unknown>> };
    };
    stores.value.data[0]!.name = "";
    const replay = fixtureFetcher(() => 0, {
      businesses: tjekCoopBrandExcerpt,
      stores: new Map([["63eeoD", stores]]),
      fronts: tjekCoopFronts,
      publicationPages: tjekCoopPublicationPages,
      offerLookups: tjekCoopOfferLookups,
    });

    const snapshot = await buildLocationSnapshot(linkopingLocation, {
      fetcher: replay.fetcher,
      now: () => new Date("2026-11-17T05:00:00.000Z"),
      sleep: async () => {},
    });

    expect(
      snapshot.chains.find(({ chain }) => chain === "Coop"),
    ).toMatchObject({
      status: "failed",
      error: expect.stringContaining("visningsnamn"),
    });
    expect(snapshot.stores.filter(({ chain }) => chain === "Coop")).toEqual([]);
    expect(replay.tjekCommands.map(({ action }) => action)).toEqual([
      "businesses",
      "stores",
    ]);
  });

  it.each([
    ["Offer", "publicId", "not-the-requested-id"],
    ["brand", "businessPublicId", "other-brand"],
    ["publication", "publicationPublicId", "other-publication"],
  ] as const)(
    "fails closed when a structured Offer has a mismatched %s association",
    async (_association, field, value) => {
      const publicId = "U-I8EtMIBykwiBusR4IQ1";
      const tampered = structuredClone(
        tjekCoopOfferLookups.get(publicId),
      ) as { value: Record<string, unknown> };
      tampered.value[field] = value;
      const replay = fixtureFetcher(() => 0, {
        businesses: tjekCoopBrandExcerpt,
        stores: new Map([["63eeoD", tjekCoopStoreExcerpt]]),
        fronts: tjekCoopFronts,
        publicationPages: tjekCoopPublicationPages,
        offerLookups: new Map([[publicId, tampered]]),
      });

      const snapshot = await buildLocationSnapshot(linkopingLocation, {
        fetcher: replay.fetcher,
        now: () => new Date("2026-11-17T05:00:00.000Z"),
        sleep: async () => {},
      });

      expect(
        snapshot.chains.find(({ chain }) => chain === "Coop"),
      ).toMatchObject({ status: "failed" });
      expect(snapshot.offers.filter(({ chain }) => chain === "Coop")).toEqual([]);
      expect(
        replay.tjekCommands.map(({ action }) => action),
      ).toEqual(["businesses", "stores", "fronts", "offer"]);
    },
  );

  it("fails closed when the Store fronts response has an unsupported shape", async () => {
    const replay = fixtureFetcher(() => 0, {
      businesses: tjekCoopBrandExcerpt,
      stores: new Map([["63eeoD", tjekCoopStoreExcerpt]]),
      fronts: { value: { unexpected: [] } },
      publicationPages: tjekCoopPublicationPages,
      offerLookups: tjekCoopOfferLookups,
    });

    const snapshot = await buildLocationSnapshot(linkopingLocation, {
      fetcher: replay.fetcher,
      now: () => new Date("2026-11-17T05:00:00.000Z"),
      sleep: async () => {},
    });

    expect(
      snapshot.chains.find(({ chain }) => chain === "Coop"),
    ).toMatchObject({ status: "failed" });
    expect(snapshot.offers.filter(({ chain }) => chain === "Coop")).toEqual([]);
    expect(replay.tjekCommands.map(({ action }) => action)).toEqual([
      "businesses",
      "stores",
      "fronts",
    ]);
  });

  it("fails closed when a front belongs to a different business than the Store", async () => {
    const fronts = structuredClone(tjekCoopFronts) as {
      value: Array<{ business: { publicId: string } }>;
    };
    fronts.value[0]!.business.publicId = "other-brand";
    const replay = fixtureFetcher(() => 0, {
      businesses: tjekCoopBrandExcerpt,
      stores: new Map([["63eeoD", tjekCoopStoreExcerpt]]),
      fronts,
      publicationPages: tjekCoopPublicationPages,
      offerLookups: tjekCoopOfferLookups,
    });

    const snapshot = await buildLocationSnapshot(linkopingLocation, {
      fetcher: replay.fetcher,
      now: () => new Date("2026-11-17T05:00:00.000Z"),
      sleep: async () => {},
    });

    expect(
      snapshot.chains.find(({ chain }) => chain === "Coop"),
    ).toMatchObject({ status: "failed" });
    expect(snapshot.offers.filter(({ chain }) => chain === "Coop")).toEqual([]);
    expect(replay.tjekCommands.map(({ action }) => action)).toEqual([
      "businesses",
      "stores",
      "fronts",
    ]);
    expect(
      replay.requests.some(
        ({ hostname }) => hostname === "publication-viewer.tjek.com",
      ),
    ).toBe(false);
  });

  it("fails closed when a discovered Coop Store has no current publication", async () => {
    const replay = fixtureFetcher(() => 0, {
      businesses: tjekCoopBrandExcerpt,
      stores: new Map([["63eeoD", tjekCoopStoreExcerpt]]),
      fronts: {
        key: "[redacted]",
        status: "success",
        value: [],
      },
    });

    const snapshot = await buildLocationSnapshot(linkopingLocation, {
      fetcher: replay.fetcher,
      now: () => new Date("2026-11-17T05:00:00.000Z"),
      sleep: async () => {},
    });

    expect(
      snapshot.chains.find(({ chain }) => chain === "Coop"),
    ).toMatchObject({ status: "failed" });
    expect(snapshot.offers.filter(({ chain }) => chain === "Coop")).toEqual([]);
    expect(replay.tjekCommands.map(({ action }) => action)).toEqual([
      "businesses",
      "stores",
      "fronts",
    ]);
  });

  it("treats a local-midnight publication end as an exclusive boundary", async () => {
    const fronts = structuredClone(tjekCoopFronts) as {
      value: Array<{ publications: Array<{ validUntil: string }> }>;
    };
    fronts.value[0]!.publications[0]!.validUntil =
      "2026-11-16T23:00:00.000Z";
    const replay = fixtureFetcher(() => 0, {
      businesses: tjekCoopBrandExcerpt,
      stores: new Map([["63eeoD", tjekCoopStoreExcerpt]]),
      fronts,
      publicationPages: tjekCoopPublicationPages,
      offerLookups: tjekCoopOfferLookups,
    });

    const snapshot = await buildLocationSnapshot(linkopingLocation, {
      fetcher: replay.fetcher,
      now: () => new Date("2026-11-17T05:00:00.000Z"),
      sleep: async () => {},
    });

    expect(
      snapshot.chains.find(({ chain }) => chain === "Coop"),
    ).toMatchObject({ status: "failed" });
    expect(replay.tjekCommands.map(({ action }) => action)).toEqual([
      "businesses",
      "stores",
      "fronts",
    ]);
  });

  it("stops a Store-specific publication denial without retrying", async () => {
    const replay = fixtureFetcher(() => 0, {
      businesses: tjekCoopBrandExcerpt,
      stores: new Map([["63eeoD", tjekCoopStoreExcerpt]]),
      frontsStatus: 403,
    });

    const snapshot = await buildLocationSnapshot(linkopingLocation, {
      fetcher: replay.fetcher,
      now: () => new Date("2026-11-17T05:00:00.000Z"),
      sleep: async () => {},
    });

    expect(
      snapshot.chains.find(({ chain }) => chain === "Coop"),
    ).toMatchObject({
      status: "failed",
      error: expect.stringContaining("HTTP 403"),
    });
    expect(snapshot.offers.filter(({ chain }) => chain === "Coop")).toEqual([]);
    expect(replay.tjekCommands.map(({ action }) => action)).toEqual([
      "businesses",
      "stores",
      "fronts",
    ]);
  });

  it("filters expired individual Offers after the publication pages are fetched", async () => {
    const expiredPublicId = "U-I8EtMIBykwiBusR4IQ1";
    const expiredOffer = structuredClone(
      tjekCoopOfferLookups.get(expiredPublicId),
    ) as { value: Record<string, unknown> };
    expiredOffer.value.validUntil = "2026-11-16T22:59:59+0000";
    const offerLookups = new Map(tjekCoopOfferLookups);
    offerLookups.set(expiredPublicId, expiredOffer);
    const replay = fixtureFetcher(() => 0, {
      businesses: tjekCoopBrandExcerpt,
      stores: new Map([["63eeoD", tjekCoopStoreExcerpt]]),
      fronts: tjekCoopFronts,
      publicationPages: tjekCoopPublicationPages,
      offerLookups,
    });

    const snapshot = await buildLocationSnapshot(linkopingLocation, {
      fetcher: replay.fetcher,
      now: () => new Date("2026-11-17T05:00:00.000Z"),
      sleep: async () => {},
    });

    expect(
      snapshot.chains.find(({ chain }) => chain === "Coop"),
    ).toMatchObject({ status: "ok" });
    expect(
      snapshot.offers.filter(({ chain }) => chain === "Coop").map(({ name }) => name),
    ).toEqual(["Snacktomater", "Kexchoklad"]);
  });

  it.each([
    [
      "ICA",
      {
        businessId: "synthetic-ica-brand",
        storeId: "ICA:synthetic-ica-berga",
        sourceStoreId: "synthetic-ica-berga",
        coordinates: { latitude: 58.389, longitude: 15.605 },
        storeName: "ICA Supermarket Berga Centrum",
        address: "Berga centrum, 583 03, Linköping",
        publicationId: "synthetic-ica-week",
        offerId: "synthetic-ica-offer",
        offer: {
          id: "ica:synthetic-ica-berga:synthetic-ica-offer",
          chain: "ICA",
          storeId: "ICA:synthetic-ica-berga",
          name: "Mjölk 1,5 %",
          mechanicText: "2 för 40 kr",
          category: "Mejeri & ost",
          validFrom: "2026-11-16",
          validTo: "2026-11-22",
          quantity: 2,
          price: 40,
          unitPrice: 20,
          priceUnit: "st",
          regularPrice: 25,
          brand: "Arla",
          packageSize: "1 l",
          sourceUrl: "https://ereklamblad.se/erbjudanden/synthetic-ica-offer",
        },
      },
    ],
    [
      "Hemköp",
      {
        businessId: "synthetic-hemkop-brand",
        storeId: "Hemköp:synthetic-hemkop-lucullus",
        sourceStoreId: "synthetic-hemkop-lucullus",
        coordinates: { latitude: 58.41, longitude: 15.621 },
        storeName: "Hemköp Linköping Lucullus",
        address: "Stora Torget 5, 582 19, Linköping",
        publicationId: "synthetic-hemkop-week",
        offerId: "synthetic-hemkop-offer",
        offer: {
          id: "hemkop:synthetic-hemkop-lucullus:synthetic-hemkop-offer",
          chain: "Hemköp",
          storeId: "Hemköp:synthetic-hemkop-lucullus",
          name: "Naturell yoghurt",
          mechanicText: "Klubbpris 19,90 kr/st",
          category: "Mejeri & ost",
          validFrom: "2026-11-16",
          validTo: "2026-11-22",
          price: 19.9,
          unitPrice: 19.9,
          priceUnit: "st",
          regularPrice: 29.9,
          brand: "Arla",
          packageSize: "1 kg",
          limitText: "Max 2 per hushåll",
          sourceUrl:
            "https://ereklamblad.se/erbjudanden/synthetic-hemkop-offer",
        },
      },
    ],
  ] as const)(
    "builds a Snapshot for the explicitly selected %s Tjek fallback from synthetic offline fixtures",
    async (chain, expected) => {
      let elapsed = 0;
      const replay = fixtureFetcher(
        () => elapsed,
        tjekFallbackFixtureOptions(chain),
      );
      const snapshot = await buildLocationSnapshot(locationWithTjek([chain]), {
        fetcher: replay.fetcher,
        now: () => new Date("2026-11-17T05:00:00.000Z"),
        sleep: async (milliseconds) => {
          elapsed += milliseconds;
        },
      });

      expect(linkopingLocation.chains.ICA?.source).toBe("ica-first-party");
      expect(linkopingLocation.chains.Hemköp?.source).toBe(
        "hemkop-first-party",
      );
      expect(
        snapshot.chains.find((status) => status.chain === chain),
      ).toMatchObject({ source: TJEK_SOURCE, status: "ok" });
      expect(snapshot.stores.filter((store) => store.chain === chain)).toEqual([
        {
          id: expected.storeId,
          chain,
          name: expected.storeName,
          address: expected.address,
        },
      ]);
      expect(snapshot.offers.filter((offer) => offer.chain === chain)).toEqual([
        expect.objectContaining(expected.offer),
      ]);
      expect(
        replay.tjekCommands.map(({ action }) => action),
      ).toEqual(["businesses", "stores", "fronts", "offer"]);
      expect(
        replay.tjekCommands.find(({ action }) => action === "fronts")?.parameters,
      ).toMatchObject({
        businessIds: [expected.businessId],
        localBusinessIds: [expected.sourceStoreId],
        coordinates: expected.coordinates,
      });
      expect(
        replay.requests.some(
          ({ hostname, pathname }) =>
            hostname === "publication-viewer.tjek.com" &&
            pathname ===
              `/api/paged-publications/${expected.publicationId}/pages`,
        ),
      ).toBe(true);

      const tjekRequests = replay.requests.filter(
        ({ hostname }) =>
          hostname === "ereklamblad.se" ||
          hostname === "publication-viewer.tjek.com",
      );
      expect(replay.maxConcurrentRequests).toBe(1);
      expect(
        tjekRequests.every(
          ({ credentials, headers }) =>
            credentials === "omit" && headers.get("Authorization") === null,
        ),
      ).toBe(true);
      expect(
        tjekRequests.slice(1).every(
          (request, index) => request.at - tjekRequests[index]!.at >= 1_000,
        ),
      ).toBe(true);
    },
  );

  it.each([
    ["ICA", "front", "synthetic-ica-offer"],
    ["Hemköp", "publication", "synthetic-hemkop-offer"],
  ] as const)(
    "fails the explicitly selected %s Tjek fallback on a mismatched %s association",
    async (chain, association, offerId) => {
      const options = tjekFallbackFixtureOptions(chain);
      if (association === "front") {
        const fronts = structuredClone(options.fronts) as {
          value: Array<{ business: { publicId: string } }>;
        };
        fronts.value[0]!.business.publicId = "another-business";
        options.fronts = fronts;
      } else {
        const offer = structuredClone(
          options.offerLookups.get(offerId),
        ) as { value: Record<string, unknown> };
        offer.value.publicationPublicId = "another-publication";
        options.offerLookups.set(offerId, offer);
      }

      const replay = fixtureFetcher(() => 0, options);
      const snapshot = await buildLocationSnapshot(locationWithTjek([chain]), {
        fetcher: replay.fetcher,
        now: () => new Date("2026-11-17T05:00:00.000Z"),
        sleep: async () => {},
      });

      expect(
        snapshot.chains.find((status) => status.chain === chain),
      ).toMatchObject({ source: TJEK_SOURCE, status: "failed" });
      expect(snapshot.offers.filter((offer) => offer.chain === chain)).toEqual(
        [],
      );
      expect(
        replay.tjekCommands.map(({ action }) => action),
      ).toEqual(
        association === "front"
          ? ["businesses", "stores", "fronts"]
          : ["businesses", "stores", "fronts", "offer"],
      );
    },
  );

  it("uses Incito Offer IDs for Hemköp when paged-publications returns 404", async () => {
    let elapsed = 0;
    const options = tjekFallbackFixtureOptions("Hemköp");
    const businesses = structuredClone(options.businesses) as {
      value: Array<{ publicId: string }>;
    };
    businesses.value[0]!.publicId = "d9b6XA";
    const sourceStores = options.stores.get("synthetic-hemkop-brand");
    if (!sourceStores) {
      throw new Error("Missing synthetic Hemköp Store fixture.");
    }
    const fronts = structuredClone(options.fronts) as {
      value: Array<{
        business: { publicId: string };
        publications: Array<{
          id: string;
          validFrom: string;
          validUntil: string;
        }>;
      }>;
    };
    fronts.value[0]!.business.publicId = "d9b6XA";
    fronts.value[0]!.publications[0]!.id = "0Z78Bmhd";
    fronts.value[0]!.publications[0]!.validFrom =
      "2026-11-15T23:00:00+0000";
    fronts.value[0]!.publications[0]!.validUntil =
      "2026-11-22T22:59:59+0000";
    const offerId = "dRkret65t9A0RPhpkhqug";
    const replay = fixtureFetcher(() => elapsed, {
      businesses,
      stores: new Map([["d9b6XA", sourceStores]]),
      fronts,
      publicationPagesStatus: 404,
      incitoOfferIds: [[offerId, "synthetic-reference"]],
      offerLookups: new Map([[offerId, tjekHemkopIncitoOfferSample]]),
    });

    const snapshot = await buildLocationSnapshot(
      locationWithTjek(["Hemköp"]),
      {
        fetcher: replay.fetcher,
        now: () => new Date("2026-11-17T05:00:00.000Z"),
        sleep: async (milliseconds) => {
          elapsed += milliseconds;
        },
      },
    );

    expect(
      snapshot.chains.find((status) => status.chain === "Hemköp"),
    ).toMatchObject({ source: TJEK_SOURCE, status: "ok" });
    expect(
      snapshot.offers.find(
        (offer) => offer.chain === "Hemköp" && offer.name === "Ryggfilé 3-pack",
      ),
    ).toMatchObject({
      chain: "Hemköp",
      storeId: "Hemköp:synthetic-hemkop-lucullus",
      mechanicText: "39,95 kr",
      price: 39.95,
      validFrom: "2026-11-16",
      validTo: "2026-11-22",
    });
    expect(
      replay.requests
        .filter(({ hostname }) => hostname === "publication-viewer.tjek.com")
        .map(({ pathname }) => pathname),
    ).toEqual([
      "/api/paged-publications/0Z78Bmhd/pages",
      "/api/incito-publications/0Z78Bmhd/offer-ids",
    ]);
    expect(replay.tjekCommands.map(({ action }) => action)).toEqual([
      "businesses",
      "stores",
      "fronts",
      "offer",
    ]);
    const tjekRequests = replay.requests.filter(
      ({ hostname }) =>
        hostname === "ereklamblad.se" ||
        hostname === "publication-viewer.tjek.com",
    );
    expect(
      tjekRequests.slice(1).every(
        (request, index) => request.at - tjekRequests[index]!.at >= 1_000,
      ),
    ).toBe(true);
  });

  it("does not try Hemköp Incito after a paged-publications access denial", async () => {
    const replay = fixtureFetcher(
      () => 0,
      {
        ...tjekFallbackFixtureOptions("Hemköp"),
        publicationPagesStatus: 403,
        incitoOfferIds: [["synthetic-hemkop-offer", "synthetic-reference"]],
      },
    );

    const snapshot = await buildLocationSnapshot(
      locationWithTjek(["Hemköp"]),
      {
        fetcher: replay.fetcher,
        now: () => new Date("2026-11-17T05:00:00.000Z"),
        sleep: async () => {},
      },
    );

    expect(
      snapshot.chains.find((status) => status.chain === "Hemköp"),
    ).toMatchObject({ source: TJEK_SOURCE, status: "failed" });
    expect(snapshot.offers.filter((offer) => offer.chain === "Hemköp")).toEqual(
      [],
    );
    expect(
      replay.requests
        .filter(({ hostname }) => hostname === "publication-viewer.tjek.com")
        .map(({ pathname }) => pathname),
    ).toEqual(["/api/paged-publications/synthetic-hemkop-week/pages"]);
  });

  it.skip("replays legacy ICA and Hemköp bulk fixtures (the current fallback uses Store-specific publications)", async () => {
    let elapsed = 0;
    const replay = fixtureFetcher(() => elapsed);
    const snapshot = await buildLocationSnapshot(
      locationWithTjek(["ICA", "Hemköp"]),
      {
        fetcher: replay.fetcher,
        now: () => new Date("2026-11-17T05:00:00.000Z"),
        sleep: async (milliseconds) => {
          elapsed += milliseconds;
        },
      },
    );
    const offersByName = new Map(
      snapshot.offers.map((offer) => [offer.name, offer]),
    );

    expect(snapshot.chains).toMatchObject([
      { chain: "ICA", source: TJEK_SOURCE, status: "ok" },
      { chain: "Hemköp", source: TJEK_SOURCE, status: "ok" },
    ]);
    expect(snapshot.stores).toMatchObject([
      {
        id: "ICA:ica-berga",
        chain: "ICA",
        name: "ICA Supermarket Berga Centrum",
      },
      {
        id: "Hemköp:hemkop-lucullus",
        chain: "Hemköp",
        name: "Hemköp Linköping Lucullus",
      },
    ]);
    expect(snapshot.stores.some((store) => store.id.includes("coop"))).toBe(false);
    expect(offersByName.get("Mjölk 1,5 %")).toMatchObject({
      chain: "ICA",
      storeId: "ICA:ica-berga",
      mechanicText: "2 för 40 kr",
      category: "Mejeri & ost",
      validFrom: "2026-11-16",
      validTo: "2026-11-22",
      quantity: 2,
      price: 40,
      unitPrice: 20,
      priceUnit: "st",
      regularPrice: 25,
      brand: "Arla",
      packageSize: "1 l",
    });
    expect(offersByName.get("Naturell yoghurt")).toMatchObject({
      chain: "Hemköp",
      storeId: "Hemköp:hemkop-lucullus",
      mechanicText: "Klubbpris 19,90 kr/st",
      category: "Mejeri & ost",
      price: 19.9,
      unitPrice: 19.9,
      priceUnit: "st",
      limitText: "Max 2 per hushåll",
    });
    expect(offersByName.get("Kampanjprodukt ICA")).toMatchObject({
      mechanicText: "3 för 2",
      quantity: 3,
      category: "Övrigt",
      validFrom: "2026-11-20",
    });
    expect(offersByName.get("Kampanjprodukt ICA")).not.toHaveProperty("price");
    expect(offersByName.get("Kampanjprodukt ICA")).not.toHaveProperty("unitPrice");
    expect(offersByName.get("Lösviktskaffe")).toMatchObject({
      mechanicText: "29,90 kr/kg",
      price: 29.9,
      unitPrice: 29.9,
      priceUnit: "kg",
      category: "Skafferi",
    });
    expect(offersByName.get("Lösviktskaffe")).not.toHaveProperty("regularPrice");
    expect(offersByName.has("Nästa veckas vara")).toBe(false);
    expect(offersByName.has("Utgånget exempel ICA")).toBe(false);
    expect(replay.maxConcurrentRequests).toBe(1);
    expect(replay.tjekCommands.map(({ action }) => action)).toEqual([
      "businesses",
      "offers",
      "businesses",
      "offers",
    ]);
    expect(
      replay.tjekCommands.every(
        ({ credentials, headers }) =>
          credentials === "omit" && headers.get("Authorization") === null,
      ),
    ).toBe(true);
    expect(
      replay.tjekCommands.slice(1).every(
        (command, index) =>
          command.at - replay.tjekCommands[index]!.at >= 1_000,
      ),
    ).toBe(true);
    expect(replay.requests.every(({ hostname }) => hostname !== "fixtures.matapp.test"))
      .toBe(true);
  });

  it.skip("uses member-specific Offer text before ordinary prices in the legacy bulk flow (synthetic bulk fixtures are unverified)", async () => {
    const ordinaryAndMemberOffer = {
      ...(tjekOffers.get("ica-berga")![0] as Record<string, unknown>),
      publicId: "ica-member-price-precedence",
      name: "Medlemspris före ordinarie pris",
      description: null,
      priceText: "29,90 kr/st",
      membershipPriceText: "Medlemspris 19,90 kr/st",
      price: 29.9,
      membershipPrice: 19.9,
      unitPrice: 29.9,
    };
    const replay = fixtureFetcher(() => 0, {
      offers: new Map([["ica-berga", [ordinaryAndMemberOffer]]]),
    });

    const snapshot = await buildLocationSnapshot(locationWithTjek(["ICA"]), {
      fetcher: replay.fetcher,
      now: () => new Date("2026-11-17T05:00:00.000Z"),
      sleep: async () => {},
    });

    expect(
      snapshot.offers.find(
        (offer) => offer.name === "Medlemspris före ordinarie pris",
      ),
    ).toMatchObject({
      mechanicText: "Medlemspris 19,90 kr/st",
      price: 19.9,
      unitPrice: 19.9,
      priceUnit: "st",
    });
  });

  it.skip("follows Tjek bulk Offer pages through the final short page (the documented bulk lookup returned no sampled records)", async () => {
    const template = tjekOffers.get("ica-berga")![0] as Record<string, unknown>;
    const manyOffers = Array.from({ length: 101 }, (_, index) => ({
      ...template,
      publicId: `paged-offer-${index}`,
      name: `Paginerat erbjudande ${index}`,
    }));
    const replay = fixtureFetcher(
      () => 0,
      { offers: new Map([["ica-berga", manyOffers]]) },
    );
    const location = locationWithTjek(["ICA"]);

    const snapshot = await buildLocationSnapshot(location, {
      fetcher: replay.fetcher,
      now: () => new Date("2026-11-17T05:00:00.000Z"),
      sleep: async () => {},
    });

    expect(
      snapshot.chains.find(({ chain }) => chain === "ICA"),
    ).toMatchObject({ source: TJEK_SOURCE, status: "ok" });
    expect(snapshot.offers.filter((offer) => offer.chain === "ICA")).toHaveLength(101);
    expect(
      replay.tjekCommands
        .filter(({ action }) => action === "offers")
        .map(({ parameters }) => {
          const pagination = parameters.pagination as { offset: number };
          return pagination.offset;
        }),
    ).toEqual([0, 100]);
  });

  it("switches either fallback Chain back to its first-party source through Location configuration", async () => {
    let elapsed = 0;
    const replay = fixtureFetcher(() => elapsed);
    const location = locationWithTjek(["ICA", "Hemköp"]);
    const dependencies = {
      fetcher: replay.fetcher,
      now: () => new Date("2026-11-17T05:00:00.000Z"),
      sleep: async (milliseconds: number) => {
        elapsed += milliseconds;
      },
    };

    const bothTjek = await buildLocationSnapshot(location, dependencies);
    expect(bothTjek.chains.map(({ source }) => source)).toEqual([
      TJEK_SOURCE,
      TJEK_SOURCE,
    ]);
    expect(bothTjek.chains.every(({ status }) => status === "failed")).toBe(true);
    expect(
      bothTjek.offers.filter((offer) => ["ICA", "Hemköp"].includes(offer.chain)),
    ).toEqual([]);

    location.chains.ICA!.source = "ica-first-party";
    const icaPrimary = await buildLocationSnapshot(location, dependencies);
    expect(icaPrimary.chains.map(({ source }) => source)).toEqual([
      "ica-first-party",
      TJEK_SOURCE,
    ]);
    expect(icaPrimary.chains.map(({ status }) => status)).toEqual([
      "ok",
      "failed",
    ]);

    location.chains.Hemköp!.source = "hemkop-first-party";
    const bothPrimary = await buildLocationSnapshot(location, dependencies);
    expect(bothPrimary.chains.map(({ source }) => source)).toEqual([
      "ica-first-party",
      "hemkop-first-party",
    ]);
    expect(bothPrimary.chains.every(({ status }) => status === "ok")).toBe(true);
  });

  it.each([401, 403])(
    "reports a Tjek HTTP %i denial without retrying or bypassing it, while another Chain succeeds",
    async (status) => {
      const replay = fixtureFetcher(
        () => 0,
        { tjekStatus: status },
      );
      const location = locationWithTjek(["ICA"]);

      const snapshot = await buildLocationSnapshot(location, {
        fetcher: replay.fetcher,
        now: () => new Date("2026-11-17T05:00:00.000Z"),
        sleep: async () => {},
      });

      expect(snapshot.chains).toMatchObject([
        {
          chain: "ICA",
          source: TJEK_SOURCE,
          status: "failed",
          error: expect.stringContaining(`HTTP ${status}`),
        },
        {
          chain: "Hemköp",
          source: "hemkop-first-party",
          status: "ok",
        },
      ]);
      expect(snapshot.offers.some((offer) => offer.chain === "ICA")).toBe(false);
      expect(snapshot.offers.some((offer) => offer.chain === "Hemköp")).toBe(true);
      expect(replay.tjekCommands).toHaveLength(1);
      expect(
        replay.requests.some(
          ({ hostname }) => hostname === "www.ica.se" || hostname === "apim-pub.gw.ica.se",
        ),
      ).toBe(false);
    },
  );

  it("treats a malformed Tjek business response as a source failure", async () => {
    const replay = fixtureFetcher(
      () => 0,
      { businesses: { value: [{ name: "Store without a source id" }] } },
    );
    const snapshot = await buildLocationSnapshot(locationWithTjek(["Hemköp"]), {
      fetcher: replay.fetcher,
      now: () => new Date("2026-11-17T05:00:00.000Z"),
      sleep: async () => {},
    });

    expect(snapshot.chains).toMatchObject([
      {
        chain: "ICA",
        source: "ica-first-party",
        status: "ok",
      },
      {
        chain: "Hemköp",
        source: TJEK_SOURCE,
        status: "failed",
        error: expect.stringContaining("Tjek"),
      },
    ]);
  });
});
