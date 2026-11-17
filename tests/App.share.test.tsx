import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import snapshotFixture from "./fixtures/snapshots/linkoping-multi-chain.json";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function snapshotWithDiscounts() {
  const snapshot = JSON.parse(JSON.stringify(snapshotFixture));
  const yoghurt = snapshot.offers.find(
    (offer: { id: string }) => offer.id === "fixture-ica-yoghurt",
  );
  const blueberryYoghurt = snapshot.offers.find(
    (offer: { id: string }) => offer.id === "fixture-hemkop-yoghurt",
  );

  Object.assign(yoghurt, {
    unitPrice: 19.9,
    regularPrice: 21.9,
    priceUnit: "st",
  });
  Object.assign(blueberryYoghurt, {
    unitPrice: 22,
    regularPrice: 42,
    priceUnit: "st",
  });
  return snapshot;
}

async function mountApp() {
  const app = render(<App />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  return app;
}

function expectSharedView() {
  expect(screen.getByText("2 erbjudanden")).toBeVisible();
  expect(screen.getByRole("combobox", { name: "Sortera efter" })).toHaveValue(
    "discount",
  );
  expect(screen.getByRole("checkbox", { name: "ICA" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Hemköp" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Coop" })).not.toBeChecked();
  expect(
    screen.getByRole("checkbox", {
      name: "ICA Supermarket Linköping City (ICA)",
    }),
  ).toBeChecked();
  expect(
    screen.getByRole("checkbox", {
      name: "Hemköp Linköping Lucullus (Hemköp)",
    }),
  ).toBeChecked();
  expect(
    screen.getByRole("checkbox", { name: "Mejeri & ost" }),
  ).toBeChecked();
  expect(
    screen.getByRole("searchbox", {
      name: "Sök på produkt eller varumärke",
    }),
  ).toHaveValue("yoghurt");
  expect(
    screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
  ).toEqual(["Blåbärsyoghurt", "Yoghurt naturell"]);
}

describe("sharing an Offer view", () => {
  it("restores filters and sort from a shared address after reload", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T09:00:00.000Z"));
    vi.stubGlobal("fetch", async () => Response.json(snapshotWithDiscounts()));
    window.history.replaceState(
      {},
      "",
      "/?chain=ICA&chain=Hemk%C3%B6p&store=ICA%3A100&store=Hemk%C3%B6p%3A4552&category=Mejeri+%26+ost&q=yoghurt&sort=discount",
    );

    const firstLoad = await mountApp();
    expectSharedView();

    firstLoad.unmount();
    await mountApp();
    expectSharedView();
  });

  it("writes each filter and sort change to the page address", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T09:00:00.000Z"));
    vi.stubGlobal("fetch", async () => Response.json(snapshotWithDiscounts()));
    await mountApp();

    fireEvent.click(screen.getByRole("checkbox", { name: "ICA" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Hemköp" }));
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "ICA Supermarket Linköping City (ICA)",
      }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Mejeri & ost" }));
    fireEvent.change(
      screen.getByRole("searchbox", {
        name: "Sök på produkt eller varumärke",
      }),
      { target: { value: "YOGHURT arla" } },
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Sortera efter" }), {
      target: { value: "discount" },
    });

    const searchParams = new URLSearchParams(window.location.search);
    expect(searchParams.getAll("chain")).toEqual(["ICA", "Hemköp"]);
    expect(searchParams.getAll("store")).toEqual(["ICA:100"]);
    expect(searchParams.getAll("category")).toEqual(["Mejeri & ost"]);
    expect(searchParams.get("q")).toBe("YOGHURT arla");
    expect(searchParams.get("sort")).toBe("discount");
  });

  it("resets filters in the address without changing the sort order", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T09:00:00.000Z"));
    vi.stubGlobal("fetch", async () => Response.json(snapshotWithDiscounts()));
    await mountApp();

    fireEvent.click(screen.getByRole("checkbox", { name: "ICA" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Hemköp" }));
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "ICA Supermarket Linköping City (ICA)",
      }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Mejeri & ost" }));
    fireEvent.change(
      screen.getByRole("searchbox", {
        name: "Sök på produkt eller varumärke",
      }),
      { target: { value: "yoghurt" } },
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Sortera efter" }), {
      target: { value: "discount" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Rensa filter" }));

    const searchParams = new URLSearchParams(window.location.search);
    expect(searchParams.getAll("chain")).toEqual([]);
    expect(searchParams.getAll("store")).toEqual([]);
    expect(searchParams.getAll("category")).toEqual([]);
    expect(searchParams.get("q")).toBeNull();
    expect(searchParams.get("sort")).toBe("discount");
    expect(screen.getByText("6 erbjudanden")).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Sortera efter" })).toHaveValue(
      "discount",
    );
    expect(screen.getByRole("checkbox", { name: "ICA" })).not.toBeChecked();
    expect(
      screen.getByRole("searchbox", {
        name: "Sök på produkt eller varumärke",
      }),
    ).toHaveValue("");
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual([
      "Blåbärsyoghurt",
      "Yoghurt naturell",
      "Apelsinläsk",
      "Bryggkaffe",
      "Bryggkaffe",
      "Krossade tomater",
    ]);
    expect(
      screen.queryByRole("heading", { name: "Läsk nästa vecka" }),
    ).not.toBeInTheDocument();
  });
});
