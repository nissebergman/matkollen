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

async function renderOffersApp() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T09:00:00.000Z"));
  vi.stubGlobal("fetch", async () => Response.json(snapshotFixture));

  render(<App />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("Offer filters", () => {
  it("shows Offers from any selected Chain and updates the matching count", async () => {
    await renderOffersApp();

    expect(screen.getByText("6 erbjudanden")).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Läsk nästa vecka" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "ICA" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Hemköp" }));

    expect(screen.getByText("5 erbjudanden")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Yoghurt naturell" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Blåbärsyoghurt" }),
    ).toBeVisible();
    expect(screen.queryByText("Coop Extra Tannefors")).not.toBeInTheDocument();
  });

  it("narrows Store choices by Chain and combines multiple selected Stores", async () => {
    await renderOffersApp();

    expect(
      screen.getByRole("checkbox", {
        name: "Coop Extra Tannefors (Coop)",
      }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("checkbox", { name: "ICA" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Hemköp" }));

    expect(
      screen.getByRole("checkbox", {
        name: "ICA Supermarket Linköping City (ICA)",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("checkbox", {
        name: "Hemköp Linköping Lucullus (Hemköp)",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("checkbox", {
        name: "Coop Extra Tannefors (Coop)",
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "ICA Supermarket Linköping City (ICA)",
      }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Hemköp Linköping Lucullus (Hemköp)",
      }),
    );

    expect(screen.getByText("3 erbjudanden")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Yoghurt naturell" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Blåbärsyoghurt" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Krossade tomater" }),
    ).toBeVisible();
  });

  it("combines multiple selected categories with the Chain filter", async () => {
    await renderOffersApp();

    fireEvent.click(screen.getByRole("checkbox", { name: "ICA" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Hemköp" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Mejeri & ost" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Skafferi" }));

    expect(screen.getByText("4 erbjudanden")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Yoghurt naturell" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Bryggkaffe" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Blåbärsyoghurt" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Krossade tomater" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Apelsinläsk" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Coop Extra Tannefors")).not.toBeInTheDocument();
  });

  it("matches every case-insensitive search word across the name and brand", async () => {
    await renderOffersApp();

    fireEvent.click(screen.getByRole("checkbox", { name: "ICA" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Hemköp" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Mejeri & ost" }));
    fireEvent.change(
      screen.getByRole("searchbox", {
        name: "Sök på produkt eller varumärke",
      }),
      { target: { value: "YOGHURT arla" } },
    );

    expect(screen.getByText("1 erbjudande")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Yoghurt naturell" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Blåbärsyoghurt" }),
    ).not.toBeInTheDocument();
  });

  it("shows a Swedish no-match message and resets every filter", async () => {
    await renderOffersApp();

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
      { target: { value: "finns inte" } },
    );

    expect(screen.getByText("0 erbjudanden")).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "Inga erbjudanden matchar dina filter",
      }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Rensa filter" }));

    expect(screen.getByText("6 erbjudanden")).toBeVisible();
    expect(
      screen.getByRole("searchbox", {
        name: "Sök på produkt eller varumärke",
      }),
    ).toHaveValue("");
    expect(screen.getByRole("checkbox", { name: "ICA" })).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "ICA Supermarket Linköping City (ICA)" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Mejeri & ost" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", {
        name: "Coop Extra Tannefors (Coop)",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Läsk nästa vecka" }),
    ).not.toBeInTheDocument();
  });
});
