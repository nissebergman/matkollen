import { describe, expect, it } from "vitest";
import { aggregateOffers, sortOfferGroups } from "../src/domain/offer-view";
import type { Offer } from "../src/domain/snapshot";

const offer: Offer = {
  id: "store-a",
  chain: "Hemköp",
  storeId: "Hemköp:a",
  name: "Smörgåspålägg",
  brand: "Pärsons",
  packageSize: "200g",
  category: "Kött & chark",
  mechanicText: "28,95 kr/st",
  price: 28.95,
  unitPrice: 28.95,
  priceUnit: "st",
  regularPrice: 38.41,
  validFrom: "2026-11-16",
  validTo: "2026-11-22",
  sourceUrl: "https://example.com/store-a",
};

describe("Offer presentation", () => {
  it("keeps different brands, sizes, prices, validity and purchase restrictions separate", () => {
    const variants: Offer[] = [
      offer,
      { ...offer, id: "other-brand", brand: "Jakobsdals" },
      { ...offer, id: "other-size", packageSize: "100g" },
      { ...offer, id: "other-price", price: 30, unitPrice: 30 },
      { ...offer, id: "other-date", validTo: "2026-11-20" },
      { ...offer, id: "other-limit", limitText: "Max 2 per hushåll" },
    ];
    expect(aggregateOffers(variants)).toHaveLength(variants.length);
  });

  it("does not claim a group-wide reduction when one Store lacks a usable regular price", () => {
    const [group] = aggregateOffers([
      offer,
      { ...offer, id: "store-b", storeId: "Hemköp:b", regularPrice: undefined },
    ]);

    expect(group.storeIds).toEqual(["Hemköp:a", "Hemköp:b"]);
    expect(group.regularPriceRange).toEqual({ min: 38.41, max: 38.41, complete: false });
    expect(group.discountAmount).toBeUndefined();
  });

  it("sorts group discounts by the reduction available at every listed Store", () => {
    const uncertainGroup = [
      { ...offer, id: "a-1", name: "Olika ordinarie priser", price: 20, unitPrice: 20, regularPrice: 100 },
      { ...offer, id: "a-2", storeId: "Hemköp:b", name: "Olika ordinarie priser", price: 20, unitPrice: 20, regularPrice: 25 },
    ];
    const consistent = {
      ...offer, id: "b-1", name: "Samma ordinarie pris", price: 20, unitPrice: 20, regularPrice: 40,
    };

    const sorted = sortOfferGroups(aggregateOffers([...uncertainGroup, consistent]), "discount");
    expect(sorted.map(({ offer }) => offer.name)).toEqual([
      "Samma ordinarie pris", "Olika ordinarie priser",
    ]);
    expect(sorted.map(({ discountAmount }) => discountAmount)).toEqual([20, 5]);
  });
});
