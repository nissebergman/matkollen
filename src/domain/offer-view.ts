import type { Offer } from "./snapshot";

export type SortOrder = "price" | "discount";

export interface OfferGroup {
  key: string;
  offer: Offer;
  storeIds: string[];
  regularPriceRange?: { min: number; max: number; complete: boolean };
  discountPercent?: number;
  discountVaries: boolean;
}

export function purchasePrice(offer: Pick<Offer, "price" | "unitPrice">): number | undefined {
  return offer.price ?? offer.unitPrice;
}

function discountPercent(offer: Offer): number | undefined {
  if (
    offer.unitPrice === undefined ||
    offer.regularPrice === undefined ||
    offer.priceUnit === undefined ||
    offer.regularPrice <= 0 ||
    offer.unitPrice >= offer.regularPrice
  ) {
    return undefined;
  }
  return ((offer.regularPrice - offer.unitPrice) / offer.regularPrice) * 100;
}

function normalizedText(value: string | undefined): string | undefined {
  return value?.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("sv-SE");
}

function equivalenceKey(offer: Offer): string {
  return JSON.stringify([
    offer.chain,
    normalizedText(offer.name),
    normalizedText(offer.brand),
    normalizedText(offer.packageSize),
    offer.category,
    normalizedText(offer.mechanicText),
    offer.price,
    offer.unitPrice,
    offer.priceUnit,
    offer.quantity ?? 1,
    offer.validFrom,
    offer.validTo,
    normalizedText(offer.comparisonPriceText),
    normalizedText(offer.limitText),
  ]);
}

export function aggregateOffers(offers: readonly Offer[]): OfferGroup[] {
  const groups = new Map<string, Offer[]>();
  for (const offer of offers) {
    const key = equivalenceKey(offer);
    const existing = groups.get(key);
    if (existing) {
      existing.push(offer);
    } else {
      groups.set(key, [offer]);
    }
  }
  return [...groups].map(([key, members]) => {
    const regularPrices = members
      .map((offer) => offer.regularPrice)
      .filter((price): price is number => price !== undefined && price > 0);
    const discounts = members.map(discountPercent);
    const knownDiscounts = discounts.filter((value): value is number => value !== undefined);
    return {
      key,
      offer: members[0],
      storeIds: [...new Set(members.map((offer) => offer.storeId))],
      ...(regularPrices.length > 0 ? {
        regularPriceRange: {
          min: Math.min(...regularPrices),
          max: Math.max(...regularPrices),
          complete: regularPrices.length === members.length,
        },
      } : {}),
      ...(knownDiscounts.length === members.length
        ? { discountPercent: Math.min(...knownDiscounts) }
        : {}),
      discountVaries: new Set(knownDiscounts).size > 1,
    };
  });
}

export function sortOfferGroups(groups: readonly OfferGroup[], order: SortOrder): OfferGroup[] {
  return [...groups].sort((left, right) => {
    const leftValue = order === "price" ? purchasePrice(left.offer) : left.discountPercent;
    const rightValue = order === "price" ? purchasePrice(right.offer) : right.discountPercent;
    const byName = left.offer.name.localeCompare(right.offer.name, "sv") ||
      left.key.localeCompare(right.key, "sv");
    if (leftValue === undefined) {
      return rightValue === undefined ? byName : 1;
    }
    if (rightValue === undefined) {
      return -1;
    }
    return (order === "price" ? leftValue - rightValue : rightValue - leftValue) || byName;
  });
}
