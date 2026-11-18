import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import snapshotFixture from "./fixtures/snapshots/linkoping.json";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function renderSharedOffer() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-18T09:00:00.000Z"));
  const offer = {
    ...snapshotFixture.offers[0],
    chain: "ICA",
    name: "Chips, Ringar och Bågar",
    mechanicText: "45 kr",
    price: 45,
    unitPrice: 112.5,
    priceUnit: "kg",
    regularPrice: 150,
    validFrom: "2026-11-16",
    validTo: "2026-11-22",
  };
  vi.stubGlobal("fetch", async () => Response.json({
    ...snapshotFixture,
    chains: snapshotFixture.chains.filter(({ chain }) => chain === "ICA"),
    stores: [
      { id: "ICA:a", chain: "ICA", name: "ICA A", address: "A, Linköping" },
      { id: "ICA:b", chain: "ICA", name: "ICA B", address: "B, Linköping" },
    ],
    offers: [
      { ...offer, id: "a-1", storeId: "ICA:a" },
      { ...offer, id: "a-duplicate", storeId: "ICA:a" },
      { ...offer, id: "b-1", storeId: "ICA:b", regularPrice: 160 },
    ],
  }));
  render(<App />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("aggregated Offers", () => {
  it("aggregates equivalent Offers across Stores and duplicate source rows", async () => {
    await renderSharedOffer();

    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("1 erbjudande")).toBeVisible();
    const card = within(screen.getByRole("article"));
    expect(card.getByText("ICA A")).toBeVisible();
    expect(card.getByText("ICA B")).toBeVisible();
    expect(card.getByText(/150,00.*160,00/)).toBeVisible();
    expect(card.getByText("Spara minst 37,50 kr/kg")).toBeVisible();
  });

  it("only lists the selected Stores on an aggregated Offer", async () => {
    await renderSharedOffer();
    fireEvent.click(screen.getByText("Butiker"));
    fireEvent.click(screen.getByRole("checkbox", { name: "ICA B (ICA)" }));

    expect(screen.getAllByRole("article")).toHaveLength(1);
    const card = within(screen.getByRole("article"));
    expect(card.getByText("ICA A")).toBeVisible();
    expect(card.queryByText("ICA B")).not.toBeInTheDocument();
    expect(card.getByText("150,00 kr")).toBeVisible();
  });
});
