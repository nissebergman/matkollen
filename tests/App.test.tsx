import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import snapshotFixture from "./fixtures/snapshots/linkoping.json";
import norrkopingSnapshotFixture from "./fixtures/snapshots/norrkoping.json";
import multiChainFixture from "./fixtures/snapshots/multi-chain-previous.json";
import coopFlyerSnapshotFixture from "./fixtures/snapshots/coop-flyer-pdf.json";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.history.replaceState({}, "", "/");
});

describe("Offers app", () => {
  it("loads a configured second Location from the page address", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T09:00:00.000Z"));
    window.history.replaceState({}, "", "/?location=norrkoping");
    const requestedUrls: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      return Response.json(
        url === "/snapshots/norrkoping.json"
          ? norrkopingSnapshotFixture
          : snapshotFixture,
      );
    });

    render(
      <App
        locations={[
          { id: "linkoping", name: "Linköping" },
          { id: "norrkoping", name: "Norrköping" },
        ]}
      />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(requestedUrls).toEqual(["/snapshots/norrkoping.json"]);
    expect(screen.getByRole("combobox", { name: "Plats" })).toHaveValue(
      "norrkoping",
    );
    expect(
      screen.getByRole("heading", {
        name: "Veckans erbjudanden i Norrköping",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Norrköpings Testprodukt" }),
    ).toBeVisible();
    expect(screen.getByText("Hemköp Testbutik Norrköping")).toBeVisible();
  });

  it("defaults to the only configured Location without showing a picker", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T09:00:00.000Z"));
    const requestedUrls: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      requestedUrls.push(String(input));
      return Response.json(snapshotFixture);
    });

    render(<App />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(requestedUrls).toEqual(["/snapshots/linkoping.json"]);
    expect(screen.getByRole("heading", { name: /i Linköping/ })).toBeVisible();
    expect(
      screen.queryByRole("combobox", { name: "Plats" }),
    ).not.toBeInTheDocument();
  });

  it("loads the Snapshot below the configured static-site base path", async () => {
    vi.stubEnv("BASE_URL", "/matapp/");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T09:00:00.000Z"));
    const requestedUrls: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      requestedUrls.push(String(input));
      return Response.json(snapshotFixture);
    });

    render(<App />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(requestedUrls).toEqual(["/matapp/snapshots/linkoping.json"]);
    expect(screen.getByRole("heading", { name: /i Linköping/ })).toBeVisible();
  });

  it("shows Coop flyer Offers and hides each Store's future Offer until valid", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T21:59:00.000Z"));
    vi.stubGlobal(
      "fetch",
      async () => Response.json(coopFlyerSnapshotFixture),
    );

    const view = render(<App />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      screen.getByRole("heading", { name: "Arla Mellanmjölk 1 l" }),
    ).toBeVisible();
    expect(screen.getByText("Stora Coop Garnisonen Linköping")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Zoégas kaffe 450 g" })).not.toBeInTheDocument();

    vi.setSystemTime(new Date("2026-11-17T23:00:00.000Z"));
    view.rerender(<App />);

    expect(
      screen.getByRole("heading", { name: "Zoégas kaffe 450 g" }),
    ).toBeVisible();
    expect(screen.getByText("Coop Vallaplan")).toBeVisible();
    expect(screen.getByText("2 för 99 kr")).toBeVisible();
  });

  it("shows current Snapshot Offers and hides expired and future Offers", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T21:59:00.000Z"));
    vi.stubGlobal("fetch", async () => Response.json(snapshotFixture));

    render(<App />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      screen.getByRole("heading", { name: "Veckans erbjudanden i Linköping" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/ingen liveuppdatering har körts/i)).toBeVisible();
    expect(screen.getByRole("heading", { name: "Krossade tomater" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Läsk 4-pack" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Utgånget exempel" })).not.toBeInTheDocument();
    expect(screen.getByText("Garant · 390g")).toBeVisible();
    expect(screen.getByText("6 kr/st")).toBeVisible();
    expect(screen.getByText("15,38/kg")).toBeVisible();
    expect(screen.getByText("12,25 kr")).toBeVisible();
    expect(screen.getByText("Hemköp Linköping Lucullus")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Arla Mellanmjölk" })).toBeVisible();
    expect(screen.getByText("Coop Drottninggatan Linköping")).toBeVisible();
    expect(screen.getByText("Medlemspris 15 kr/l")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Coop Fruktjuice" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Småcitrus i nät" })).toBeVisible();
    expect(
      screen.getByText("ICA Supermarket Berga Centrum, Linköping"),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Utgånget ICA-exempel" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Ingen produktbild" })).toBeInTheDocument();
    expect(screen.getByText("Max 2")).toBeVisible();
    expect(screen.getAllByText(/t\.o\.m\./i)).toHaveLength(3);
    expect(screen.getByText(/senast uppdaterad/i)).toBeVisible();
  });

  it("orders visible Offers by effective price, breaks ties by name, and puts missing prices last", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T09:00:00.000Z"));
    const sortableSnapshot = JSON.parse(JSON.stringify(snapshotFixture));
    const baseOffer = sortableSnapshot.offers[0];
    sortableSnapshot.offers = [
      {
        ...baseOffer,
        id: "price-zero",
        name: "Kostnadsfri",
        price: 0,
        unitPrice: 0,
      },
      {
        ...baseOffer,
        id: "price-six",
        name: "Köp en",
        price: 6,
        unitPrice: 6,
        quantity: 1,
      },
      {
        ...baseOffer,
        id: "price-five-multibuy",
        name: "Köp två",
        mechanicText: "2 för 10 kr",
        price: 10,
        quantity: 2,
        unitPrice: 5,
      },
      {
        ...baseOffer,
        id: "price-five-name-first",
        name: "Apelsin",
        price: 25,
        unitPrice: 5,
        quantity: 5,
      },
      {
        ...baseOffer,
        id: "price-three",
        name: "Zoégas",
        price: 3,
        unitPrice: 3,
      },
      {
        ...baseOffer,
        id: "price-missing",
        name: "Oprissatt",
        price: undefined,
        unitPrice: undefined,
      },
      {
        ...baseOffer,
        id: "price-future",
        name: "Framtida lågpris",
        validFrom: "2026-11-18",
        price: 0.1,
        unitPrice: 0.1,
      },
    ];
    vi.stubGlobal("fetch", async () => Response.json(sortableSnapshot));

    render(<App />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("combobox", { name: "Sortera efter" })).toHaveValue(
      "price",
    );
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual([
      "Kostnadsfri",
      "Zoégas",
      "Apelsin",
      "Köp två",
      "Köp en",
      "Oprissatt",
    ]);
    expect(
      screen.queryByRole("heading", { name: "Framtida lågpris" }),
    ).not.toBeInTheDocument();
  });

  it("orders Offers by largest computable discount and puts missing or unknown-unit discounts last", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T09:00:00.000Z"));
    const sortableSnapshot = JSON.parse(JSON.stringify(snapshotFixture));
    const baseOffer = sortableSnapshot.offers[0];
    sortableSnapshot.offers = [
      {
        ...baseOffer,
        id: "discount-nine",
        name: "Stor rabatt",
        price: 1,
        unitPrice: 1,
        regularPrice: 10,
        priceUnit: "st",
      },
      {
        ...baseOffer,
        id: "discount-five-a",
        name: "Rabatt Apelsin",
        price: 2,
        unitPrice: 2,
        regularPrice: 7,
        priceUnit: "kg",
      },
      {
        ...baseOffer,
        id: "discount-five-b",
        name: "Rabatt Äpple",
        price: 5,
        unitPrice: 5,
        regularPrice: 10,
        priceUnit: "l",
      },
      {
        ...baseOffer,
        id: "discount-missing-regular",
        name: "Ingen ordinarie",
        price: 1,
        unitPrice: 1,
        regularPrice: undefined,
        priceUnit: "st",
      },
      {
        ...baseOffer,
        id: "discount-unknown-unit",
        name: "Oidentifierad enhet",
        price: 1,
        unitPrice: 1,
        regularPrice: 9,
        priceUnit: undefined,
      },
      {
        ...baseOffer,
        id: "discount-missing-effective",
        name: "Oprissatt",
        price: undefined,
        unitPrice: undefined,
        regularPrice: 10,
        priceUnit: "st",
      },
      {
        ...baseOffer,
        id: "discount-future",
        name: "Framtida rabatt",
        validFrom: "2026-11-18",
        price: 0.1,
        unitPrice: 0.1,
        regularPrice: 100,
        priceUnit: "st",
      },
    ];
    vi.stubGlobal("fetch", async () => Response.json(sortableSnapshot));

    render(<App />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.change(screen.getByRole("combobox", { name: "Sortera efter" }), {
      target: { value: "discount" },
    });

    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual([
      "Stor rabatt",
      "Rabatt Apelsin",
      "Rabatt Äpple",
      "Ingen ordinarie",
      "Oidentifierad enhet",
      "Oprissatt",
    ]);
    expect(
      screen.queryByRole("heading", { name: "Framtida rabatt" }),
    ).not.toBeInTheDocument();
  });

  it("makes a future Offer visible at the start of its Stockholm validity date", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T21:59:00.000Z"));
    vi.stubGlobal("fetch", async () => Response.json(snapshotFixture));

    const view = render(<App />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.queryByRole("heading", { name: "Läsk 4-pack" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Coop Fruktjuice" })).not.toBeInTheDocument();

    vi.setSystemTime(new Date("2026-11-17T23:00:00.000Z"));
    view.rerender(<App />);
    expect(screen.getByRole("heading", { name: "Läsk 4-pack" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Coop Fruktjuice" })).toBeVisible();
  });

  it("keeps an ICA Offer hidden until its future start date in Stockholm", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-19T22:59:00.000Z"));
    vi.stubGlobal("fetch", async () => Response.json(snapshotFixture));

    const view = render(<App />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      screen.queryByRole("heading", { name: "Fredagserbjudande" }),
    ).not.toBeInTheDocument();

    vi.setSystemTime(new Date("2026-11-19T23:00:00.000Z"));
    view.rerender(<App />);
    expect(
      screen.getByRole("heading", { name: "Fredagserbjudande" }),
    ).toBeVisible();
  });

  it("keeps an Offer through its Stockholm end date and hides it the next day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-22T22:59:00.000Z"));
    vi.stubGlobal("fetch", async () => Response.json(snapshotFixture));

    const view = render(<App />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole("heading", { name: "Krossade tomater" })).toBeVisible();

    vi.setSystemTime(new Date("2026-11-22T23:00:00.000Z"));
    view.rerender(<App />);
    expect(screen.queryByRole("heading", { name: "Krossade tomater" })).not.toBeInTheDocument();
    expect(screen.getByText("Inga erbjudanden just nu")).toBeVisible();
  });

  it("formats Offer end dates in Europe/Stockholm", async () => {
    const originalTimezone = process.env.TZ;
    try {
      process.env.TZ = "Pacific/Kiritimati";
      expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(
        "Pacific/Kiritimati",
      );
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-11-17T09:00:00.000Z"));
      vi.stubGlobal("fetch", async () => Response.json(snapshotFixture));

      render(<App />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(
        screen.getAllByText(/t\.o\.m\.\s*22 november 2026/i),
      ).toHaveLength(3);
    } finally {
      if (originalTimezone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalTimezone;
      }
    }
  });

  it("shows a product image when the Snapshot provides one", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T09:00:00.000Z"));
    const snapshotWithImage = JSON.parse(JSON.stringify(snapshotFixture));
    snapshotWithImage.offers[0].imageUrl =
      "https://assets.axfood.se/image/fixture-product.jpg";
    vi.stubGlobal("fetch", async () => Response.json(snapshotWithImage));

    render(<App />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      screen.getByRole("img", { name: "Krossade tomater" }),
    ).toBeInTheDocument();
  });

  it("shows a clear error for an unsupported Snapshot version", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T09:00:00.000Z"));
    vi.stubGlobal("fetch", async () =>
      Response.json({ ...snapshotFixture, schemaVersion: 2 }),
    );

    render(<App />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Snapshot-versionen stöds inte",
    );
  });

  it("marks retained Offers as possibly outdated after a failed Chain refresh", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T09:00:00.000Z"));
    const staleSnapshot = JSON.parse(JSON.stringify(snapshotFixture));
    staleSnapshot.chains[0].status = "stale";
    staleSnapshot.chains[0].lastSuccessAt = "2026-11-16T08:00:00.000Z";
    staleSnapshot.chains[0].error = "Hemköp svarade med HTTP 503.";
    vi.stubGlobal("fetch", async () => Response.json(staleSnapshot));

    render(<App />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Hemköp kunde inte uppdateras",
    );
    expect(screen.getByText("Krossade tomater")).toBeVisible();
    expect(screen.getByText("Kan vara inaktuellt")).toBeVisible();
  });

  it("shows separate stale and failed Chain banners in a multi-Chain Snapshot", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T09:00:00.000Z"));
    const snapshot = JSON.parse(JSON.stringify(multiChainFixture));
    snapshot.generatedAt = "2026-11-17T09:00:00.000Z";
    snapshot.chains[0].status = "stale";
    snapshot.chains[0].error = "ICA svarade med HTTP 503.";
    snapshot.chains[1].status = "failed";
    snapshot.chains[1].lastSuccessAt = null;
    snapshot.chains[1].error = "Coop svarade med HTTP 503.";
    snapshot.offers = snapshot.offers.filter(
      (offer: { chain: string }) => offer.chain === "ICA",
    );
    vi.stubGlobal("fetch", async () => Response.json(snapshot));

    render(<App />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const banners = screen.getAllByRole("alert");
    expect(banners).toHaveLength(2);
    expect(banners[0]).toHaveTextContent("ICA kunde inte uppdateras");
    expect(banners[0]).toHaveTextContent("16 nov. 2026");
    expect(banners[0]).toHaveTextContent("ICA svarade med HTTP 503.");
    expect(banners[1]).toHaveTextContent("Coop kunde inte uppdateras");
    expect(banners[1]).toHaveTextContent("Ingen tidigare lyckad uppdatering finns");
    expect(banners[1]).toHaveTextContent("Coop svarade med HTTP 503.");
    expect(screen.getByRole("heading", { name: "Havregryn" })).toBeVisible();
    expect(screen.getByText("Kan vara inaktuellt")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Gammalt ägg" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Nästa veckas havregryn" })).not.toBeInTheDocument();
    expect(screen.getByText(/senast uppdaterad/i)).toBeVisible();
  });

  it("reports a failed Snapshot request instead of showing an empty Offer list", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T09:00:00.000Z"));
    vi.stubGlobal(
      "fetch",
      async () => new Response("Unavailable", { status: 503 }),
    );

    render(<App />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("alert")).toHaveTextContent("HTTP 503");
    expect(
      screen.queryByText("Inga erbjudanden just nu"),
    ).not.toBeInTheDocument();
  });
});
