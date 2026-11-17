import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCATION_REGISTRY } from "../src/snapshot/config";
import { buildSnapshots } from "../src/snapshot/job";

const fixtureRoot = resolve(import.meta.dirname, "fixtures/coop");
const linkoping = LOCATION_REGISTRY.locations.find(
  (location) => location.id === "linkoping",
);
const linkopingCoop = linkoping?.chains.Coop;

if (!linkoping || !linkopingCoop) {
  throw new Error("Missing Linköping Coop configuration");
}

const coopOnlyLinkoping = {
  ...linkoping,
  chains: { Coop: linkopingCoop },
};

const PAGE_URL = "https://www.coop.se/butiker-erbjudanden/";
const STORES_SCRIPT_URL =
  "https://www.coop.se/Assets/apps/coopse/dist/coopse.script.storesApp.fixture.js";
const STORE_MAP_PATH = "/external/store/stores/map";
const STORE_DETAILS_PATH = "/external/store/stores/";
const PUBLIC_TEST_KEY = "fixture-only-public-client-value";

type FixtureOptions = {
  blockedStoreMap?: boolean;
  credentialUrlFor?: string;
  malformedFlyerFor?: string;
  missingFlyerFor?: string;
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(fixtureRoot, path), "utf8")) as T;
}

function recordedFetcher(options: FixtureOptions = {}) {
  let elapsed = 0;
  const requests: Array<{ url: string; init?: RequestInit; at: number }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    const parsedUrl = new URL(url);
    requests.push({ url, init, at: elapsed });

    if (url === PAGE_URL) {
      return new Response(
        readFileSync(resolve(fixtureRoot, "public/stores-page.html"), "utf8"),
        { headers: { "Content-Type": "text/html" } },
      );
    }
    if (url === STORES_SCRIPT_URL) {
      return new Response(
        readFileSync(resolve(fixtureRoot, "public/stores-app.js"), "utf8"),
        { headers: { "Content-Type": "application/javascript" } },
      );
    }
    if (parsedUrl.hostname === "proxy.api.coop.se" &&
        parsedUrl.pathname === STORE_MAP_PATH) {
      if (options.blockedStoreMap) {
        return new Response("Forbidden", { status: 403 });
      }
      return Response.json(readJson("public/store-map.json"));
    }
    if (parsedUrl.hostname === "proxy.api.coop.se" &&
        parsedUrl.pathname.startsWith(STORE_DETAILS_PATH)) {
      const ledgerAccountNumber = parsedUrl.pathname.slice(
        STORE_DETAILS_PATH.length,
      );
      const detail = readJson<Record<string, unknown>>(
        `public/store-details/${ledgerAccountNumber}.json`,
      );
      if (options.missingFlyerFor === ledgerAccountNumber) {
        return Response.json({ ...detail, flyers: [] });
      }
      if (options.credentialUrlFor === ledgerAccountNumber) {
        const flyers = detail.flyers as Array<Record<string, unknown>>;
        return Response.json({
          ...detail,
          flyers: flyers.map((flyer, index) =>
            index === 0
              ? {
                  ...flyer,
                  pdfUrl: `https://dr.coop.se/butik/${ledgerAccountNumber}?subscriptionKey=${PUBLIC_TEST_KEY}`,
                }
              : flyer,
          ),
        });
      }
      return Response.json(detail);
    }
    if (parsedUrl.hostname === "dr.coop.se") {
      const ledgerAccountNumber = parsedUrl.pathname.split("/").filter(Boolean).at(-1);
      if (options.malformedFlyerFor === ledgerAccountNumber) {
        return new Response("not a PDF", {
          headers: { "Content-Type": "application/pdf" },
        });
      }
      return new Response(
        readFileSync(
          resolve(fixtureRoot, `flyers/${ledgerAccountNumber}.pdf`),
        ),
        { headers: { "Content-Type": "application/pdf" } },
      );
    }
    return new Response(`No recorded fixture for ${url}`, { status: 404 });
  };

  return {
    fetcher,
    requests,
    sleep: async (milliseconds: number) => {
      elapsed += milliseconds;
    },
  };
}

async function buildConfiguredCoopSnapshot(
  options: FixtureOptions = {},
  location = coopOnlyLinkoping,
) {
  const replay = recordedFetcher(options);
  const [snapshot] = await buildSnapshots([location], {
    fetcher: replay.fetcher,
    now: () => new Date("2026-11-17T05:00:00.000Z"),
    sleep: replay.sleep,
  });
  return { snapshot, requests: replay.requests };
}

describe("Coop flyer-PDF Snapshot job", () => {
  it("uses each configured Store's flyer and preserves its validity and Offers", async () => {
    expect(linkopingCoop.source).toBe("coop-flyer-pdf");

    const { snapshot, requests } = await buildConfiguredCoopSnapshot();

    expect(snapshot.chains).toMatchObject([
      { chain: "Coop", source: "coop-flyer-pdf", status: "ok" },
    ]);
    expect(snapshot.stores.map((store) => store.id)).toEqual([
      "Coop:2303",
      "Coop:239",
    ]);
    expect(snapshot.offers).toContainEqual(
      expect.objectContaining({
        chain: "Coop",
        storeId: "Coop:2303",
        name: "Arla Mellanmjölk 1 l",
        packageSize: "1 l",
        mechanicText: "Medlemspris 15 kr/l",
        category: "Mejeri & ost",
        validFrom: "2026-11-16",
        validTo: "2026-11-22",
        sourceUrl: "https://dr.coop.se/butik/056010",
        unitPrice: 15,
        priceUnit: "l",
        regularPrice: 17.9,
      }),
    );
    const noPriceOffer = snapshot.offers.find(
      (offer) => offer.name === "Köp tre, betala för två",
    );
    expect(noPriceOffer).toMatchObject({
      mechanicText: "3 för 2",
      quantity: 3,
      validFrom: "2026-11-16",
      validTo: "2026-11-22",
    });
    expect(noPriceOffer).not.toHaveProperty("price");
    expect(noPriceOffer).not.toHaveProperty("unitPrice");
    expect(snapshot.offers).toContainEqual(
      expect.objectContaining({
        storeId: "Coop:239",
        name: "Zoégas kaffe 450 g",
        packageSize: "450 g",
        mechanicText: "2 för 99 kr",
        quantity: 2,
        price: 99,
        unitPrice: 49.5,
        category: "Skafferi",
        validFrom: "2026-11-18",
        validTo: "2026-11-24",
        sourceUrl: "https://dr.coop.se/butik/056019",
      }),
    );
    expect(snapshot.offers).not.toContainEqual(
      expect.objectContaining({ storeId: "Coop:8888" }),
    );
    expect(
      requests.some((request) => request.url.includes("ereklamblad.se")),
    ).toBe(false);
    const mapRequest = requests.find((request) =>
      request.url.includes(STORE_MAP_PATH),
    );
    expect(
      new Headers(mapRequest?.init?.headers).get(
        "Ocp-Apim-Subscription-Key",
      ),
    ).toBe(PUBLIC_TEST_KEY);
    expect(mapRequest?.init?.credentials).toBe("omit");
    expect(mapRequest?.init?.redirect).toBe("error");
    expect(
      new Headers(mapRequest?.init?.headers).get("Authorization"),
    ).toBeNull();
    expect(new Headers(mapRequest?.init?.headers).get("Cookie")).toBeNull();
    expect(
      requests.every((request) => request.init?.credentials === "omit"),
    ).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain(PUBLIC_TEST_KEY);
    expect(
      requests
        .slice(1)
        .every((request, index) => request.at - requests[index].at >= 1_000),
    ).toBe(true);
  });

  it("honours configured Coop Store exclusions", async () => {
    const location = {
      ...coopOnlyLinkoping,
      chains: {
        Coop: {
          ...linkopingCoop,
          storeDiscovery: {
            ...linkopingCoop.storeDiscovery,
            excludeStoreIds: ["Coop:239"],
          },
        },
      },
    };
    const { snapshot } = await buildConfiguredCoopSnapshot({}, location);

    expect(snapshot.stores.map((store) => store.id)).toEqual(["Coop:2303"]);
    expect(snapshot.offers.every((offer) => offer.storeId === "Coop:2303")).toBe(
      true,
    );
  });

  it("keeps a pinned Coop Store's source city and Store-specific flyer", async () => {
    const location = {
      ...coopOnlyLinkoping,
      chains: {
        Coop: {
          ...linkopingCoop,
          storeDiscovery: {
            ...linkopingCoop.storeDiscovery,
            pinStoreIds: ["Coop:8888"],
          },
        },
      },
    };
    const { snapshot } = await buildConfiguredCoopSnapshot({}, location);

    expect(snapshot.stores.map((store) => store.id)).toContain("Coop:8888");
    expect(
      snapshot.stores.find((store) => store.id === "Coop:8888")?.address,
    ).toContain("Norrköping");
    expect(snapshot.offers).toContainEqual(
      expect.objectContaining({
        storeId: "Coop:8888",
        validFrom: "2026-11-16",
        validTo: "2026-11-22",
      }),
    );
  });

  it("fails the Coop Chain when a current flyer is missing", async () => {
    const { snapshot } = await buildConfiguredCoopSnapshot({
      missingFlyerFor: "056010",
    });

    expect(snapshot.chains[0]).toMatchObject({
      status: "failed",
      source: "coop-flyer-pdf",
    });
    expect(snapshot.chains[0].error).toMatch(/aktuell.*flyer|flyer.*saknas/i);
    expect(snapshot.offers).toHaveLength(0);
  });

  it("fails the Coop Chain instead of publishing Offers from an unparseable PDF", async () => {
    const { snapshot } = await buildConfiguredCoopSnapshot({
      malformedFlyerFor: "056010",
    });

    expect(snapshot.chains[0]).toMatchObject({
      status: "failed",
      source: "coop-flyer-pdf",
    });
    expect(snapshot.chains[0].error).toMatch(/pdf|erbjudande/i);
    expect(snapshot.offers).toHaveLength(0);
  });

  it("rejects flyer URLs that contain credentials instead of storing them", async () => {
    const { snapshot, requests } = await buildConfiguredCoopSnapshot({
      credentialUrlFor: "056010",
    });

    expect(snapshot.chains[0].status).toBe("failed");
    expect(snapshot.chains[0].error).toContain("åtkomstuppgifter");
    expect(
      requests.some((request) => request.url.includes("subscriptionKey")),
    ).toBe(false);
    expect(JSON.stringify(snapshot)).not.toContain(PUBLIC_TEST_KEY);
  });

  it("reports blocked Coop access without retries or a Tjek fallback", async () => {
    const { snapshot, requests } = await buildConfiguredCoopSnapshot({
      blockedStoreMap: true,
    });

    expect(snapshot.chains[0].status).toBe("failed");
    expect(snapshot.chains[0].error).toContain("HTTP 403");
    expect(
      requests.filter((request) => request.url.includes(STORE_MAP_PATH)),
    ).toHaveLength(1);
    expect(
      requests.some((request) => request.url.includes("ereklamblad.se")),
    ).toBe(false);
  });
});
