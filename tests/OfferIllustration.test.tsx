import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfferIllustration } from "../src/components/OfferIllustration";
import { parseSnapshot } from "../src/domain/snapshot";
import snapshotFixture from "./fixtures/snapshots/linkoping.json";

const offer = parseSnapshot(snapshotFixture).offers[0];

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("Offer illustrations", () => {
  it("loads a local image below the Pages base path and identifies its source and license", () => {
    vi.stubEnv("BASE_URL", "/matkollen/");
    render(<OfferIllustration offer={{
      ...offer, name: "Chips, Ringar och Bågar", imageUrl: "https://example.com/remote.jpg",
    }} />);

    expect(screen.getByRole("img", { name: /Potatischips.*illustrationsbild, inte exakt produkt/ }))
      .toHaveAttribute("src", "/matkollen/images/products/potato-chips.jpg");
    expect(screen.getByRole("link", { name: "Daderot" }))
      .toHaveAttribute("href", "https://commons.wikimedia.org/wiki/File:Potato_chips_-_Massachusetts.jpg");
    expect(screen.getByRole("link", { name: "CC0-1.0" }))
      .toHaveAttribute("href", "https://creativecommons.org/publicdomain/zero/1.0/");
    expect(screen.getByText("Storleksändrad och komprimerad.")).toBeVisible();
  });

  it("retains the placeholder rather than fetching an uncurated remote product image", () => {
    render(<OfferIllustration offer={{
      ...offer, name: "Okänd produkt", imageUrl: "https://example.com/remote.jpg",
    }} />);

    expect(screen.getByRole("img", { name: "Ingen produktbild" })).toBeVisible();
    expect(document.querySelector("img")).not.toBeInTheDocument();
  });
});
