import { z } from "zod";
import { mapHemkopCategory } from "../domain/categories";
import {
  CHAINS,
  SCHEMA_VERSION,
  SnapshotSchema,
  type Chain,
  type Offer,
  type Snapshot,
  type Store,
} from "../domain/snapshot";
import type {
  ChainLocationConfig,
  LocationConfig,
  StoreDiscoveryConfig,
} from "./config";

export const HEMKOP_REQUEST_DELAY_MS = 10_000;
const HEMKOP_SOURCE = "hemkop-first-party";
const HEMKOP_ORIGIN = "https://www.hemkop.se";
const STOCKHOLM_TIME_ZONE = "Europe/Stockholm";

export interface HemkopLocation {
  id: string;
  name: string;
  city?: string;
  storeDiscovery?: StoreDiscoveryConfig;
}

export interface HemkopJobDependencies {
  fetcher?: typeof fetch;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
  previousSnapshot?: unknown;
}

export interface SnapshotJobDependencies extends Omit<HemkopJobDependencies, "previousSnapshot"> {
  previousSnapshot?: unknown;
  previousSnapshots?: Readonly<Record<string, unknown>>;
}

const optionalText = z.string().nullable().optional();
const optionalNumber = z
  .union([
    z.number().finite().nonnegative(),
    z.string().refine((value) => parseAmount(value) !== undefined),
    z.null(),
  ])
  .optional();
const optionalLimit = z
  .union([
    z.number().int().nonnegative().finite(),
    z.string().refine((value) => {
      const limit = parseAmount(value);
      return limit !== undefined && Number.isInteger(limit);
    }),
    z.null(),
  ])
  .optional();
const optionalDate = z
  .union([z.string().min(1), z.number().finite(), z.null()])
  .optional();
const optionalIdentifier = z.union([z.string(), z.number().finite()]).optional();
const nonBlankText = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0);
const sourceStoreId = z.union([
  nonBlankText,
  z.number().int().nonnegative(),
]);

const HemkopStoreSchema = z
  .object({
    storeId: sourceStoreId,
    name: nonBlankText,
    address: z
      .object({
        town: nonBlankText,
        line1: optionalText,
        postalCode: optionalText,
      })
      .passthrough(),
  })
  .passthrough();

const HemkopPromotionSchema = z
  .object({
    id: optionalIdentifier,
    campaignId: optionalIdentifier,
    campaignType: optionalText,
    promotionType: optionalText,
    price: optionalNumber,
    priceUnit: optionalText,
    cartLabel: optionalText,
    conditionLabel: optionalText,
    rewardLabel: optionalText,
    textLabel: optionalText,
    description: optionalText,
    qualifyingCount: z.number().int().positive().nullable().optional(),
    threshold: z.number().finite().nonnegative().nullable().optional(),
    redeemLimit: optionalLimit,
    limitText: optionalText,
    startDate: optionalDate,
    endDate: optionalDate,
    validUntil: optionalDate,
    comparePrice: optionalNumber,
    comparePriceUnit: optionalText,
    ordinaryPrice: optionalNumber,
    regularPrice: optionalNumber,
  })
  .passthrough();

const HemkopProductSchema = z
  .object({
    id: optionalIdentifier,
    code: optionalIdentifier,
    ean: optionalIdentifier,
    name: nonBlankText,
    manufacturer: optionalText,
    brands: z.union([z.string(), z.array(z.string()), z.null()]).optional(),
    price: optionalNumber,
    priceNoUnit: optionalNumber,
    priceUnit: optionalText,
    regularPrice: optionalNumber,
    ordinaryPrice: optionalNumber,
    displayVolume: optionalText,
    googleAnalyticsCategory: optionalText,
    promotionProductOrdinaryComparePrice: optionalNumber,
    promotionProductOrdinaryComparePriceUnit: optionalText,
    potentialPromotions: z.array(HemkopPromotionSchema),
    image: z
      .union([
        z.string(),
        z.object({ url: optionalText }).passthrough(),
        z.null(),
      ])
      .optional(),
    originalImage: z
      .union([
        z.string(),
        z.object({ url: optionalText }).passthrough(),
        z.null(),
      ])
      .optional(),
    thumbnail: z
      .union([
        z.string(),
        z.object({ url: optionalText }).passthrough(),
        z.null(),
      ])
      .optional(),
  })
  .passthrough();

const HemkopPageSchema = z
  .object({
    results: z.array(HemkopProductSchema),
    pagination: z
      .object({
        currentPage: z.number().int().nonnegative().optional(),
        numberOfPages: z.number().int().nonnegative(),
        totalNumberOfResults: z.number().int().nonnegative().optional(),
      })
      .passthrough(),
  })
  .passthrough()
  .superRefine((page, context) => {
    if (page.results.length > 0 && page.pagination.numberOfPages === 0) {
      context.addIssue({
        code: "custom",
        message: "A nonempty page must report at least one page",
        path: ["pagination", "numberOfPages"],
      });
    }
    if (
      page.pagination.currentPage !== undefined &&
      page.pagination.numberOfPages > 0 &&
      page.pagination.currentPage >= page.pagination.numberOfPages
    ) {
      context.addIssue({
        code: "custom",
        message: "currentPage must be inside numberOfPages",
        path: ["pagination", "currentPage"],
      });
    }
  });

type HemkopStore = z.infer<typeof HemkopStoreSchema>;
type HemkopProduct = z.infer<typeof HemkopProductSchema>;
type HemkopPromotion = z.infer<typeof HemkopPromotionSchema>;

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function assertWithinHemkopVisitTime(date: Date): void {
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  if (utcMinutes < 4 * 60 || utcMinutes >= 8 * 60 + 45) {
    throw new Error("Hemköps besöksfönster är 04:00–08:45 UTC; ingen begäran skickades.");
  }
}

function describeValidationError(error: z.ZodError): string {
  const issue = error.issues[0];
  const path = issue.path.length ? issue.path.join(".") : "response";
  return `fältet ${path} har ett oväntat format`;
}

function parseResponse<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`Ogiltigt svar från Hemköp (${label}): ${describeValidationError(result.error)}.`);
  }
  return result.data;
}

function stockholmDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: STOCKHOLM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function dateFromSource(value: string | number | null | undefined): string | undefined {
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? stockholmDate(date) : undefined;
  }
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const normalized = value.trim();
  const swedishDate = normalized.match(/^(\d{1,2})\/(\d{1,2})-(\d{4})$/);
  if (swedishDate) {
    const [, day, month, year] = swedishDate;
    const isoDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    return isIsoDate(isoDate) ? isoDate : undefined;
  }
  if (isIsoDate(normalized)) {
    return normalized;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return undefined;
  }
  if (/^\d{10,13}$/.test(normalized)) {
    const rawTimestamp = Number(normalized);
    const timestamp = normalized.length === 10 ? rawTimestamp * 1_000 : rawTimestamp;
    const date = new Date(timestamp);
    return Number.isFinite(date.getTime()) ? stockholmDate(date) : undefined;
  }

  const time = Date.parse(normalized);
  return Number.isFinite(time) ? stockholmDate(new Date(time)) : undefined;
}

function currentOfferWeekEnd(today: string): string {
  const day = new Date(`${today}T00:00:00.000Z`).getUTCDay();
  const daysUntilSunday = (7 - day) % 7;
  const end = new Date(`${today}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + daysUntilSunday);
  return end.toISOString().slice(0, 10);
}

function parseAmount(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  }
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  if (normalized.startsWith("-")) {
    return undefined;
  }
  const numericTokens = normalized.match(/\d[\d\s.,]*\d|\d/g);
  if (!numericTokens || numericTokens.length !== 1) {
    return undefined;
  }
  let amount = numericTokens[0].replace(/\s|\u00a0/g, "");
  if (!/^\d+(?:[.,]\d+)*$/.test(amount)) {
    return undefined;
  }

  const comma = amount.lastIndexOf(",");
  const dot = amount.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    if (comma > dot) {
      amount = amount.replace(/\./g, "").replace(",", ".");
    } else {
      amount = amount.replace(/,/g, "");
    }
  } else if (comma >= 0) {
    amount = amount.replace(",", ".");
  } else if ((amount.match(/\./g) ?? []).length > 1) {
    const lastDot = amount.lastIndexOf(".");
    amount = `${amount.slice(0, lastDot).replace(/\./g, "")}${amount.slice(lastDot)}`;
  }

  const parsed = Number(amount);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function amountFromMechanic(text: string): number | undefined {
  const price = text.match(/(\d[\d\s.,]*)\s*kr\b/i);
  return price ? parseAmount(price[1]) : undefined;
}

function sourceText(value: string | null | undefined): string | undefined {
  const text = value?.trim();
  return text || undefined;
}

function mechanicText(promotion: HemkopPromotion): string {
  const composedLabels = [
    sourceText(promotion.conditionLabel),
    sourceText(promotion.rewardLabel),
  ]
    .filter(Boolean)
    .join(" ");
  const direct =
    sourceText(promotion.cartLabel) ??
    sourceText(composedLabels) ??
    sourceText(promotion.description) ??
    sourceText(promotion.textLabel);
  if (!direct) {
    throw new Error("Hemköps kampanj saknar en visbar erbjudandetext.");
  }
  return direct;
}

function positiveInteger(value: number | undefined): number | undefined {
  return value && Number.isInteger(value) && value > 0 ? value : undefined;
}

function quantityFor(promotion: HemkopPromotion, text: string): number {
  const multiBuy = text.match(/(\d+)\s*för\s*\d+/iu);
  return (
    positiveInteger(multiBuy ? Number(multiBuy[1]) : undefined) ??
    positiveInteger(promotion.qualifyingCount ?? undefined) ??
    1
  );
}

function priceUnitFrom(...values: Array<string | null | undefined>): Offer["priceUnit"] {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  if (/(?:\/|\b)kg\b/.test(text)) {
    return "kg";
  }
  if (/(?:\/|\b)l\b|liter/.test(text)) {
    return "l";
  }
  if (/(?:\/|\b)st\b|styck/.test(text)) {
    return "st";
  }
  return undefined;
}

function comparisonPriceText(
  promotion: HemkopPromotion,
  product: HemkopProduct,
): string | undefined {
  const raw = promotion.comparePrice;
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim();
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const unit = sourceText(promotion.comparePriceUnit);
    return unit ? `${raw} ${unit}` : String(raw);
  }

  const ordinaryComparePrice = product["promotionProductOrdinaryComparePrice"];
  if (typeof ordinaryComparePrice === "string" && ordinaryComparePrice.trim()) {
    const unit = sourceText(product["promotionProductOrdinaryComparePriceUnit"] as string | null);
    return unit ? `${ordinaryComparePrice.trim()} ${unit}` : ordinaryComparePrice.trim();
  }
  if (typeof ordinaryComparePrice === "number" && Number.isFinite(ordinaryComparePrice)) {
    const unit = sourceText(product["promotionProductOrdinaryComparePriceUnit"] as string | null);
    return unit ? `${ordinaryComparePrice} ${unit}` : String(ordinaryComparePrice);
  }
  return undefined;
}

function imageUrl(product: HemkopProduct): string | undefined {
  for (const image of [product.image, product.originalImage, product.thumbnail]) {
    const url = typeof image === "string" ? image : image?.url;
    if (typeof url === "string" && url.startsWith("https://")) {
      return url;
    }
  }
  return undefined;
}

function storeFromSource(store: HemkopStore): Store {
  const sourceId = String(store.storeId);
  const address = [
    sourceText(store.address.line1),
    sourceText(store.address.postalCode),
    store.address.town.trim(),
  ]
    .filter(Boolean)
    .join(", ");
  return {
    id: `Hemköp:${sourceId}`,
    chain: "Hemköp",
    name: store.name.trim(),
    address,
  };
}

function unwrapStoreIdOverride(configuredId: string): string {
  const prefix = "Hemköp:";
  return configuredId.startsWith(prefix) ? configuredId.slice(prefix.length) : configuredId;
}

function sourceField(value: unknown, path: string): unknown {
  let current = value;
  for (const part of path.split(".")) {
    if (
      typeof current !== "object" ||
      current === null ||
      !Object.hasOwn(current, part)
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function discoverHemkopStores(
  stores: HemkopStore[],
  discovery: StoreDiscoveryConfig,
): HemkopStore[] {
  const pinIds = new Set((discovery.pinStoreIds ?? []).map(unwrapStoreIdOverride));
  const excludeIds = new Set(
    (discovery.excludeStoreIds ?? []).map(unwrapStoreIdOverride),
  );
  const availableIds = new Set(stores.map((store) => String(store.storeId)));
  const missingPins = [...pinIds].filter((id) => !availableIds.has(id));
  if (missingPins.length) {
    throw new Error(
      `Konfigurerade Hemköp-butiker hittades inte: ${missingPins.join(", ")}.`,
    );
  }

  const matchingCityStores = stores.filter(
    (store) =>
      sourceField(store, discovery.exactCity.field) === discovery.exactCity.value,
  );
  if (matchingCityStores.length === 0 && pinIds.size === 0) {
    throw new Error(
      `Inga Hemköp-butiker hittades för ${discovery.exactCity.value}.`,
    );
  }

  const selected = stores.filter((store) => {
    const id = String(store.storeId);
    return (
      !excludeIds.has(id) &&
      (pinIds.has(id) ||
        sourceField(store, discovery.exactCity.field) === discovery.exactCity.value)
    );
  });
  return selected;
}

function stableOfferId(
  storeId: string,
  product: HemkopProduct,
  promotion: HemkopPromotion,
  text: string,
): string {
  const productKey =
    product.id ?? product.code ?? product.ean ?? `${product.name}:${product.manufacturer ?? ""}`;
  const promotionKey =
    promotion.id ??
    promotion.campaignId ??
    [
      promotion.campaignType,
      promotion.promotionType,
      promotion.startDate,
      promotion.endDate,
      text,
    ].join(":");
  return `hemkop:${storeId}:${encodeURIComponent(String(productKey))}:${encodeURIComponent(String(promotionKey))}`;
}

function normalizeOffer(
  storeId: string,
  product: HemkopProduct,
  promotion: HemkopPromotion,
  sourceUrl: string,
  runDate: string,
  weekEnd: string,
): Offer | undefined {
  const text = mechanicText(promotion);
  const validFrom = dateFromSource(promotion.startDate);
  const endDate = dateFromSource(promotion.endDate);
  const validUntil = dateFromSource(promotion.validUntil);
  if (promotion.startDate != null && !validFrom) {
    throw new Error(`Erbjudandet "${product.name}" har ett ogiltigt startdatum.`);
  }
  if (promotion.endDate != null && !endDate) {
    throw new Error(`Erbjudandet "${product.name}" har ett ogiltigt slutdatum.`);
  }
  if (promotion.validUntil != null && !validUntil) {
    throw new Error(`Erbjudandet "${product.name}" har ett ogiltigt slutdatum.`);
  }
  const validTo = endDate ?? validUntil;
  if (!validTo) {
    throw new Error(`Erbjudandet "${product.name}" saknar ett giltigt slutdatum.`);
  }
  if (validFrom && validFrom > validTo) {
    throw new Error(`Erbjudandet "${product.name}" har ett ogiltigt giltighetsintervall.`);
  }
  if (validTo < runDate || (validFrom && validFrom > weekEnd)) {
    return undefined;
  }

  const quantity = quantityFor(promotion, text);
  const price = parseAmount(promotion.price) ?? amountFromMechanic(text);
  const priceUnit = priceUnitFrom(
    promotion.priceUnit,
    product.priceUnit,
    text,
  );
  const regularPrice =
    parseAmount(promotion.regularPrice) ??
    parseAmount(product.regularPrice) ??
    parseAmount(promotion.ordinaryPrice) ??
    parseAmount(product.ordinaryPrice) ??
    parseAmount(product.priceNoUnit) ??
    parseAmount(product.price);
  const brand =
    sourceText(product.manufacturer) ??
    (typeof product.brands === "string"
      ? sourceText(product.brands)
      : product.brands?.map((value) => value.trim()).find(Boolean));
  const limit = sourceText(promotion.limitText);
  const redeemLimit = parseAmount(promotion.redeemLimit);
  const limitText =
    limit ??
    (redeemLimit !== undefined
      ? `Max ${new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(redeemLimit)}`
      : undefined);

  return {
    id: stableOfferId(storeId, product, promotion, text),
    chain: "Hemköp",
    storeId,
    name: product.name.trim(),
    mechanicText: text,
    category: mapHemkopCategory(product.googleAnalyticsCategory),
    validTo,
    sourceUrl,
    quantity,
    ...(brand ? { brand } : {}),
    ...(sourceText(product.displayVolume) ? { packageSize: sourceText(product.displayVolume) } : {}),
    ...(price !== undefined ? { price, unitPrice: price / quantity } : {}),
    ...(priceUnit ? { priceUnit } : {}),
    ...(regularPrice !== undefined ? { regularPrice } : {}),
    ...(comparisonPriceText(promotion, product)
      ? { comparisonPriceText: comparisonPriceText(promotion, product) }
      : {}),
    ...(limitText ? { limitText } : {}),
    ...(validFrom ? { validFrom } : {}),
    ...(imageUrl(product) ? { imageUrl: imageUrl(product) } : {}),
    ...(product.googleAnalyticsCategory
      ? { sourceCategory: product.googleAnalyticsCategory }
      : {}),
  };
}

function requestedPageUrl(storeId: string, page: number): string {
  const url = new URL("/search/campaigns/offline", HEMKOP_ORIGIN);
  url.searchParams.set("q", storeId);
  url.searchParams.set("type", "PERSONAL_GENERAL");
  url.searchParams.set("page", String(page));
  url.searchParams.set("size", "30");
  url.searchParams.set("disableMimerSort", "true");
  return url.toString();
}

function formatRequestError(status: number): string {
  if (status === 403 || status === 429) {
    return `Hemköp nekade begäran (HTTP ${status}); uppdateringen avbryts utan återförsök.`;
  }
  return `Hemköp svarade med HTTP ${status}.`;
}

export async function buildHemkopSnapshot(
  location: HemkopLocation,
  dependencies: HemkopJobDependencies = {},
): Promise<Snapshot> {
  const fetcher = dependencies.fetcher ?? globalThis.fetch;
  const now = dependencies.now ?? (() => new Date());
  const sleep = dependencies.sleep ?? defaultSleep;
  const attemptAt = now().toISOString();
  const runDate = stockholmDate(new Date(attemptAt));
  const weekEnd = currentOfferWeekEnd(runDate);
  let requestStarted = false;
  let discoveredStores: Store[] = [];

  const requestJson = async (url: string, label: string): Promise<unknown> => {
    if (requestStarted) {
      await sleep(HEMKOP_REQUEST_DELAY_MS);
    }
    assertWithinHemkopVisitTime(now());
    requestStarted = true;
    const response = await fetcher(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "omit",
    });
    if (!response.ok) {
      throw new Error(formatRequestError(response.status));
    }
    try {
      return await response.json();
    } catch {
      throw new Error(`Hemköp svarade inte med giltig JSON (${label}).`);
    }
  };

  try {
    const storesResponse = await requestJson(
      `${HEMKOP_ORIGIN}/axfood/rest/store?online=false&clickAndCollect=false&b2bClickAndCollect=false`,
      "butiker",
    );
    const sourceStores = parseResponse(
      z.array(HemkopStoreSchema),
      storesResponse,
      "butiker",
    );
    const discovery =
      location.storeDiscovery ??
      (location.city
        ? {
            exactCity: { field: "address.town", value: location.city },
            pinStoreIds: [],
            excludeStoreIds: [],
          }
        : undefined);
    if (!discovery) {
      throw new Error("Hemköp saknar konfigurerade kriterier för butiksupptäckt.");
    }
    const matchingStores = discoverHemkopStores(sourceStores, discovery);
    const mappedStores = matchingStores.map(storeFromSource);
    discoveredStores = [
      ...new Map(mappedStores.map((store) => [store.id, store])).values(),
    ];
    if (discoveredStores.length !== mappedStores.length) {
      throw new Error("Hemköps butikslista innehåller dubbla Store ids.");
    }

    const offers: Offer[] = [];
    const offersByStore = new Map<string, number>();

    for (const sourceStore of matchingStores) {
      const sourceStoreId = String(sourceStore.storeId);
      const storeId = `Hemköp:${sourceStoreId}`;
      let expectedPages: number | undefined;
      let page = 0;
      let storeOfferCount = 0;

      while (expectedPages === undefined || page < expectedPages) {
        const sourceUrl = requestedPageUrl(sourceStoreId, page);
        const pageResponse = await requestJson(sourceUrl, "kampanjer");
        const campaignPage = parseResponse(
          HemkopPageSchema,
          pageResponse,
          "kampanjer",
        );
        if (campaignPage.pagination.currentPage !== undefined &&
            campaignPage.pagination.currentPage !== page) {
          throw new Error("Hemköps kampanjpaginering ändrades under hämtningen.");
        }
        if (expectedPages === undefined) {
          expectedPages = campaignPage.pagination.numberOfPages;
        } else if (campaignPage.pagination.numberOfPages !== expectedPages) {
          throw new Error("Hemköps kampanjpaginering ändrades under hämtningen.");
        }

        for (const product of campaignPage.results) {
          const loyaltyPromotions = product.potentialPromotions.filter(
            (promotion) => promotion.campaignType?.toUpperCase() === "LOYALTY",
          );
          const promotions = loyaltyPromotions.length
            ? loyaltyPromotions
            : product.potentialPromotions;
          for (const promotion of promotions) {
            const offer = normalizeOffer(
              storeId,
              product,
              promotion,
              sourceUrl,
              runDate,
              weekEnd,
            );
            if (offer) {
              offers.push(offer);
              storeOfferCount += 1;
            }
          }
        }
        page += 1;
      }
      offersByStore.set(storeId, storeOfferCount);
    }

    const emptyStores = discoveredStores
      .filter((store) => offersByStore.get(store.id) === 0)
      .map((store) => store.name);
    const warning =
      offers.length > 0 && emptyStores.length > 0
        ? `Inga aktuella erbjudanden hämtades från: ${emptyStores.join(", ")}.`
        : undefined;
    const completedAt = now().toISOString();

    return SnapshotSchema.parse({
      schemaVersion: SCHEMA_VERSION,
      location: { id: location.id, name: location.name },
      generatedAt: completedAt,
      chains: [
        {
          chain: "Hemköp",
          source: HEMKOP_SOURCE,
          status: "ok",
          lastAttemptAt: attemptAt,
          lastSuccessAt: completedAt,
          ...(warning ? { error: warning } : {}),
        },
      ],
      stores: discoveredStores,
      offers,
    });
  } catch (error) {
    const previousResult = dependencies.previousSnapshot
      ? SnapshotSchema.safeParse(dependencies.previousSnapshot)
      : undefined;
    const previous =
      previousResult?.success && previousResult.data.location.id === location.id
        ? previousResult.data
        : undefined;
    const previousHemkop = previous?.chains.find((chain) => chain.chain === "Hemköp");
    const canReusePrevious =
      previousHemkop?.source === HEMKOP_SOURCE &&
      previousHemkop.status !== "failed";
    const previousOffers =
      (canReusePrevious ? previous?.offers : undefined)?.filter(
        (offer) =>
          offer.chain === "Hemköp" &&
          offer.validTo >= runDate &&
          (!offer.validFrom || offer.validFrom <= weekEnd),
      ) ?? [];
    const stale = previousOffers.length > 0;
    const message = error instanceof Error ? error.message : "Okänt fel.";
    const surfacedMessage = message.slice(0, 240);
    const failedAt = now().toISOString();

    return SnapshotSchema.parse({
      schemaVersion: SCHEMA_VERSION,
      location: { id: location.id, name: location.name },
      generatedAt: failedAt,
      chains: [
        {
          chain: "Hemköp",
          source: HEMKOP_SOURCE,
          status: stale ? "stale" : "failed",
          lastAttemptAt: attemptAt,
          lastSuccessAt: canReusePrevious ? previousHemkop?.lastSuccessAt ?? null : null,
          error: surfacedMessage,
        },
      ],
      stores: stale
        ? previous?.stores.filter((store) => store.chain === "Hemköp") ?? []
        : discoveredStores,
      offers: stale ? previousOffers : [],
    });
  }
}

function buildUnavailableChainSnapshot(
  location: LocationConfig,
  chain: Chain,
  configuration: ChainLocationConfig,
  dependencies: SnapshotJobDependencies,
): Snapshot {
  const now = dependencies.now ?? (() => new Date());
  const attemptAt = now().toISOString();
  const runDate = stockholmDate(new Date(attemptAt));
  const weekEnd = currentOfferWeekEnd(runDate);
  const previousValue =
    dependencies.previousSnapshots?.[location.id] ?? dependencies.previousSnapshot;
  const previousResult =
    previousValue !== undefined
      ? SnapshotSchema.safeParse(previousValue)
      : undefined;
  const previous =
    previousResult?.success && previousResult.data.location.id === location.id
      ? previousResult.data
      : undefined;
  const previousChain = previous?.chains.find(
    (status) => status.chain === chain,
  );
  const canReusePrevious =
    previousChain?.source === configuration.source &&
    previousChain.status !== "failed";
  const previousOffers =
    (canReusePrevious ? previous?.offers : undefined)?.filter(
      (offer) =>
        offer.chain === chain &&
        offer.validTo >= runDate &&
        (!offer.validFrom || offer.validFrom <= weekEnd),
    ) ?? [];
  const stale = previousOffers.length > 0;
  const failedAt = now().toISOString();

  return SnapshotSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    location: { id: location.id, name: location.name },
    generatedAt: failedAt,
    chains: [
      {
        chain,
        source: configuration.source,
        status: stale ? "stale" : "failed",
        lastAttemptAt: attemptAt,
        lastSuccessAt: canReusePrevious ? previousChain?.lastSuccessAt ?? null : null,
        error: `Källan "${configuration.source}" för ${chain} är inte implementerad i Snapshot-jobbet.`,
      },
    ],
    stores: stale
      ? previous?.stores.filter((store) => store.chain === chain) ?? []
      : [],
    offers: stale ? previousOffers : [],
  });
}

export async function buildSnapshots(
  locations: readonly LocationConfig[],
  dependencies: SnapshotJobDependencies = {},
): Promise<Snapshot[]> {
  const now = dependencies.now ?? (() => new Date());
  const snapshots: Snapshot[] = [];

  for (const location of locations) {
    const previousSnapshot =
      dependencies.previousSnapshots?.[location.id] ?? dependencies.previousSnapshot;
    const chainSnapshots: Snapshot[] = [];

    for (const chain of CHAINS) {
      const configuration = location.chains[chain];
      if (!configuration) {
        continue;
      }

      if (chain === "Hemköp" && configuration.source === HEMKOP_SOURCE) {
        chainSnapshots.push(
          await buildHemkopSnapshot(
            {
              id: location.id,
              name: location.name,
              storeDiscovery: configuration.storeDiscovery,
            },
            {
              fetcher: dependencies.fetcher,
              now,
              sleep: dependencies.sleep,
              previousSnapshot,
            },
          ),
        );
      } else {
        chainSnapshots.push(
          buildUnavailableChainSnapshot(location, chain, configuration, {
            ...dependencies,
            now,
            previousSnapshot,
          }),
        );
      }
    }

    snapshots.push(
      SnapshotSchema.parse({
        schemaVersion: SCHEMA_VERSION,
        location: { id: location.id, name: location.name },
        generatedAt: now().toISOString(),
        chains: chainSnapshots.flatMap((snapshot) => snapshot.chains),
        stores: chainSnapshots.flatMap((snapshot) => snapshot.stores),
        offers: chainSnapshots.flatMap((snapshot) => snapshot.offers),
      }),
    );
  }

  return snapshots;
}
