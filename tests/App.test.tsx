import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import snapshotFixture from "./fixtures/snapshots/linkoping.json";
import multiChainFixture from "./fixtures/snapshots/multi-chain-previous.json";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Offers app", () => {
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
    expect(screen.getByRole("img", { name: "Ingen produktbild" })).toBeInTheDocument();
    expect(screen.getByText("Max 2")).toBeVisible();
    expect(screen.getByText(/t\.o\.m\./i)).toBeVisible();
    expect(screen.getByText(/senast uppdaterad/i)).toBeVisible();
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

    vi.setSystemTime(new Date("2026-11-17T23:00:00.000Z"));
    view.rerender(<App />);
    expect(screen.getByRole("heading", { name: "Läsk 4-pack" })).toBeVisible();
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

      expect(screen.getByText(/t\.o\.m\.\s*22 november 2026/i)).toBeVisible();
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
