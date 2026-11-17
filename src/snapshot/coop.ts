import { Buffer } from "node:buffer";
import { z } from "zod";
import { mapCoopCategory } from "../domain/categories";
import {
  SCHEMA_VERSION,
  SnapshotSchema,
  type Offer,
  type Snapshot,
  type Store,
} from "../domain/snapshot";
import type { StoreDiscoveryConfig } from "./config";

export const TJEK_REQUEST_DELAY_MS = 1_000;
export const COOP_TJEK_SOURCE = "coop-tjek";

const TJEK_ENDPOINT = "https://ereklamblad.se/";
const TJEK_PAGE_SIZE = 100;
const TJEK_MAX_PAGES = 40;
const STOCKHOLM_TIME_ZONE = "Europe/Stockholm";

export interface CoopLocation {
  id: string;
  name: string;
  city?: string;
  storeDiscovery?: StoreDiscoveryConfig;
}

export interface CoopJobDependencies {
  fetcher?: typeof fetch;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
  previousSnapshot?: unknown;
}

const optionalText = z.string().nullable().optional();
const optionalNumber = z
  .union([
    z.number().finite().nonnegative(),
    z.string().refine((value) => parseAmount(value) !== undefined),
    z.null(),
  ])
  .optional();
const sourceIdentifier = z.union([
  z.string().min(1).refine((value) => value.trim().length > 0),
  z.number().int().nonnegative().finite(),
]);
const sourceAddressSchema = z.union([
  z.string().nullable(),
  z
    .object({
      city: optionalText,
      town: optionalText,
      street: optionalText,
      streetAddress: optionalText,
      streetName: optionalText,
      line1: optionalText,
      postalCode: optionalText,
    })
    .passthrough(),
]);
const sourceChainSchema = z.union([
  z.string(),
  z.object({ name: optionalText }).passthrough(),
  z.null(),
]);

const TjekBusinessSchema = z
  .object({
    publicId: sourceIdentifier,
    name: z.string().min(1).refine((value) => value.trim().length > 0),
    chain: sourceChainSchema.optional(),
    chainName: optionalText,
    city: optionalText,
    locality: optionalText,
    postalCity: optionalText,
    address: sourceAddressSchema.optional(),
    location: z.unknown().optional(),
  })
  .passthrough();

const sourceBusinessSchema = z
  .object({
    publicId: sourceIdentifier.optional(),
    id: sourceIdentifier.optional(),
    name: optionalText,
  })
  .passthrough();

const sourcePublicationSchema = z
  .object({
    publicId: sourceIdentifier.optional(),
    url: optionalText,
  })
  .passthrough();

const TjekOfferSchema = z
  .object({
    publicId: sourceIdentifier,
    name: z.string().min(1).refine((value) => value.trim().length > 0),
    business: sourceBusinessSchema.optional(),
    businessId: sourceIdentifier.optional(),
    businessPublicId: sourceIdentifier.optional(),
    publication: sourcePublicationSchema.optional(),
    description: optionalText,
    priceText: optionalText,
    mechanicText: optionalText,
    offerText: optionalText,
    price: optionalNumber,
    membershipPrice: optionalNumber,
    appPrice: optionalNumber,
    fromPrice: optionalNumber,
    unitPrice: optionalNumber,
    regularPrice: optionalNumber,
    ordinaryPrice: optionalNumber,
    originalPrice: optionalNumber,
    baseUnit: optionalText,
    unitSymbol: optionalText,
    priceUnit: optionalText,
    unitSizeFrom: optionalNumber,
    unitSizeTo: optionalNumber,
    quantity: z.number().int().positive().nullable().optional(),
    currencyCode: optionalText,
    currency: optionalText,
    validFrom: z.union([z.string(), z.number().finite(), z.null()]).optional(),
    visibleFrom: z.union([z.string(), z.number().finite(), z.null()]).optional(),
    validUntil: z.union([z.string(), z.number().finite(), z.null()]).optional(),
    validTo: z.union([z.string(), z.number().finite(), z.null()]).optional(),
    departmentSlug: optionalText,
    department: optionalText,
    category: optionalText,
    categoryName: optionalText,
    brand: optionalText,
    manufacturer: optionalText,
    packageSize: optionalText,
    productSize: optionalText,
    size: optionalText,
    image: z
      .union([
        z.string(),
        z.object({ url: optionalText }).passthrough(),
        z.null(),
      ])
      .optional(),
    imageUrl: optionalText,
    comparisonPriceText: optionalText,
    unitPriceText: optionalText,
    limitText: optionalText,
    sourceUrl: optionalText,
    url: optionalText,
  })
  .passthrough();

const TjekBusinessesResponseSchema = z
  .object({ value: z.array(TjekBusinessSchema) })
  .passthrough();
const TjekOffersResponseSchema = z
  .object({
    value: z
      .object({ data: z.array(TjekOfferSchema) })
      .passthrough(),
  })
  .passthrough();

type TjekBusiness = z.infer<typeof TjekBusinessSchema>;
type TjekOffer = z.infer<typeof TjekOfferSchema>;

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function describeValidationError(error: z.ZodError): string {
  const issue = error.issues[0];
  const path = issue.path.length ? issue.path.join(".") : "response";
  return `fältet ${path} har ett oväntat format`;
}

function parseResponse<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`Ogiltigt svar från Tjek (${label}): ${describeValidationError(result.error)}.`);
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

function sourceText(value: string | null | undefined): string | undefined {
  const text = value?.trim();
  return text || undefined;
}

function normalizedKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function sourceId(value: string | number): string {
  return String(value);
}

function discoveryFor(location: CoopLocation): StoreDiscoveryConfig {
  if (location.storeDiscovery) {
    return location.storeDiscovery;
  }
  if (location.city) {
    return {
      exactCity: { field: "city", value: location.city },
      pinStoreIds: [],
      excludeStoreIds: [],
    };
  }
  throw new Error("Coop saknar konfigurerade kriterier för butiksupptäckt.");
}

function sourceField(value: unknown, path: string): unknown {
  const parts = path.split(".");
  if (
    !parts.every(
      (part) =>
        /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(part) &&
        !["__proto__", "prototype", "constructor"].includes(part),
    )
  ) {
    return undefined;
  }

  let current = value;
  for (const part of parts) {
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

function coopSourceStoreId(configuredId: string): string {
  return configuredId.startsWith("Coop:")
    ? configuredId.slice("Coop:".length)
    : configuredId;
}

function businessCity(business: TjekBusiness): string | undefined {
  const address =
    business.address && typeof business.address === "object"
      ? business.address
      : undefined;
  const location =
    business.location && typeof business.location === "object"
      ? (business.location as Record<string, unknown>)
      : undefined;
  return (
    sourceText(business.city) ??
    sourceText(business.locality) ??
    sourceText(business.postalCity) ??
    sourceText(address?.city) ??
    sourceText(address?.town) ??
    sourceText(typeof location?.city === "string" ? location.city : undefined) ??
    sourceText(typeof location?.town === "string" ? location.town : undefined)
  );
}

function isCoopBusiness(business: TjekBusiness): boolean {
  const declaredChain =
    typeof business.chain === "string"
      ? sourceText(business.chain)
      : sourceText(business.chain?.name);
  const chainName = declaredChain ?? sourceText(business.chainName);
  return chainName
    ? normalizedKey(chainName).includes("coop")
    : /(^|[^a-z])coop([^a-z]|$)/iu.test(business.name);
}

function storeAddress(business: TjekBusiness, city: string): string {
  if (typeof business.address === "string" && business.address.trim()) {
    const address = business.address.trim();
    return normalizedKey(address).includes(normalizedKey(city))
      ? address
      : `${address}, ${city}`;
  }

  const address = business.address;
  if (address && typeof address === "object") {
    const value = [
      sourceText(address.streetAddress) ??
        sourceText(address.street) ??
        sourceText(address.streetName) ??
        sourceText(address.line1),
      sourceText(address.postalCode),
      city,
    ]
      .filter(Boolean)
      .join(", ");
    if (value) {
      return value;
    }
  }
  return city;
}

function storeFromBusiness(business: TjekBusiness, city: string): Store {
  const id = sourceId(business.publicId);
  return {
    id: `Coop:${id}`,
    chain: "Coop",
    name: business.name.trim(),
    address: storeAddress(business, city),
  };
}

function businessIdFromOffer(offer: TjekOffer): string | undefined {
  const value =
    offer.business?.publicId ??
    offer.businessPublicId ??
    offer.businessId ??
    offer.business?.id;
  return value === undefined ? undefined : sourceId(value);
}

function amountText(value: number): string {
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 2 }).format(value);
}

function amountFromMechanic(text: string): number | undefined {
  const match = text.match(/(\d[\d\s.,]*)\s*kr\b/i);
  return match ? parseAmount(match[1]) : undefined;
}

function priceUnitFrom(...values: Array<string | null | undefined>): Offer["priceUnit"] {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  if (/(?:\/|\b)kg\b|kilogram/.test(text)) {
    return "kg";
  }
  if (/(?:\/|\b)l\b|liter/.test(text)) {
    return "l";
  }
  if (/(?:\/|\b)st\b|piece/.test(text)) {
    return "st";
  }
  return undefined;
}

function mechanicText(offer: TjekOffer): string {
  const direct =
    sourceText(offer.priceText) ??
    sourceText(offer.mechanicText) ??
    sourceText(offer.offerText) ??
    sourceText(offer.description);
  if (direct) {
    return direct;
  }

  const priceUnit = priceUnitFrom(offer.baseUnit, offer.unitSymbol, offer.priceUnit);
  const price =
    parseAmount(offer.membershipPrice) ??
    parseAmount(offer.appPrice) ??
    parseAmount(offer.fromPrice) ??
    parseAmount(offer.price) ??
    parseAmount(offer.unitPrice);
  if (price !== undefined) {
    return `${amountText(price)} kr${priceUnit ? `/${priceUnit}` : ""}`;
  }
  throw new Error(`Tjek-erbjudandet "${offer.name}" saknar en visbar erbjudandetext.`);
}

function quantityFor(offer: TjekOffer, text: string): number {
  if (offer.quantity && offer.quantity > 1) {
    return offer.quantity;
  }
  const multiBuy = text.match(/(\d+)\s*(?:för|for)\s*\d+/iu);
  return multiBuy ? Number(multiBuy[1]) : 1;
}

function comparisonPriceText(
  offer: TjekOffer,
  unitPrice: number | undefined,
  priceUnit: Offer["priceUnit"],
): string | undefined {
  const direct =
    sourceText(offer.comparisonPriceText) ?? sourceText(offer.unitPriceText);
  if (direct) {
    return direct;
  }
  return unitPrice !== undefined && priceUnit
    ? `${amountText(unitPrice)} kr/${priceUnit}`
    : undefined;
}

function imageUrl(offer: TjekOffer): string | undefined {
  const image =
    typeof offer.image === "string"
      ? offer.image
      : offer.image?.url;
  for (const candidate of [offer.imageUrl, image]) {
    if (candidate?.startsWith("https://")) {
      return candidate;
    }
  }
  return undefined;
}

function sourceUrl(offer: TjekOffer): string {
  for (const candidate of [
    offer.sourceUrl,
    offer.url,
    offer.publication?.url,
  ]) {
    if (candidate?.startsWith("https://")) {
      return candidate;
    }
  }
  return TJEK_ENDPOINT;
}

function packageSize(offer: TjekOffer): string | undefined {
  const direct =
    sourceText(offer.packageSize) ??
    sourceText(offer.productSize) ??
    sourceText(offer.size);
  if (direct) {
    return direct;
  }
  const sizeFrom = parseAmount(offer.unitSizeFrom);
  const sizeTo = parseAmount(offer.unitSizeTo);
  if (sizeFrom !== undefined && sizeFrom === sizeTo) {
    const unit = sourceText(offer.unitSymbol);
    return `${amountText(sizeFrom)}${unit ? ` ${unit}` : ""}`;
  }
  return undefined;
}

function normalizedOffer(
  store: Store,
  sourceStoreId: string,
  offer: TjekOffer,
  runDate: string,
  weekEnd: string,
): Offer | undefined {
  const linkedBusinessId = businessIdFromOffer(offer);
  if (!linkedBusinessId) {
    throw new Error(`Tjek-erbjudandet "${offer.name}" saknar Store-koppling.`);
  }
  if (linkedBusinessId !== sourceStoreId) {
    throw new Error(`Tjek kopplade ett erbjudande till fel Coop-butik (${offer.name}).`);
  }

  const currency = sourceText(offer.currencyCode) ?? sourceText(offer.currency);
  if (currency && currency.toUpperCase() !== "SEK") {
    throw new Error(`Tjek-erbjudandet "${offer.name}" har en valuta som inte stöds.`);
  }

  const text = mechanicText(offer);
  const suppliedValidFrom = dateFromSource(offer.validFrom);
  const visibleFrom = dateFromSource(offer.visibleFrom);
  const validFrom = [suppliedValidFrom, visibleFrom]
    .filter((date): date is string => date !== undefined)
    .sort()
    .at(-1);
  const validTo = dateFromSource(offer.validUntil ?? offer.validTo);
  if ((offer.validFrom != null && !suppliedValidFrom) ||
      (offer.visibleFrom != null && !visibleFrom)) {
    throw new Error(`Tjek-erbjudandet "${offer.name}" har ett ogiltigt startdatum.`);
  }
  if (
    (offer.validUntil != null && !dateFromSource(offer.validUntil)) ||
    (offer.validUntil == null && offer.validTo != null && !dateFromSource(offer.validTo))
  ) {
    throw new Error(`Tjek-erbjudandet "${offer.name}" har ett ogiltigt slutdatum.`);
  }
  if (!validTo) {
    throw new Error(`Tjek-erbjudandet "${offer.name}" saknar ett giltigt slutdatum.`);
  }
  if (validFrom && validFrom > validTo) {
    throw new Error(`Tjek-erbjudandet "${offer.name}" har ett ogiltigt giltighetsintervall.`);
  }
  if (validTo < runDate || (validFrom && validFrom > weekEnd)) {
    return undefined;
  }

  const quantity = quantityFor(offer, text);
  const priceUnit = priceUnitFrom(
    offer.baseUnit,
    offer.unitSymbol,
    offer.priceUnit,
    text,
  );
  const mechanicAmount = amountFromMechanic(text);
  const price =
    parseAmount(offer.membershipPrice) ??
    parseAmount(offer.appPrice) ??
    parseAmount(offer.fromPrice) ??
    parseAmount(offer.price) ??
    (priceUnit === "kg" || priceUnit === "l" ? undefined : mechanicAmount);
  const sourceUnitPrice = parseAmount(offer.unitPrice);
  const unitPrice =
    sourceUnitPrice && sourceUnitPrice > 0
      ? sourceUnitPrice
      : priceUnit === "kg" || priceUnit === "l"
        ? mechanicAmount
        : price !== undefined
          ? price / quantity
          : undefined;
  const regularPrice =
    parseAmount(offer.regularPrice) ??
    parseAmount(offer.ordinaryPrice) ??
    parseAmount(offer.originalPrice);
  const brand = sourceText(offer.brand) ?? sourceText(offer.manufacturer);
  const category =
    sourceText(offer.departmentSlug) ??
    sourceText(offer.department) ??
    sourceText(offer.category) ??
    sourceText(offer.categoryName);
  const comparison = comparisonPriceText(offer, unitPrice, priceUnit);
  const size = packageSize(offer);
  const image = imageUrl(offer);
  const limit = sourceText(offer.limitText);

  return {
    id: `coop:${encodeURIComponent(sourceStoreId)}:${encodeURIComponent(sourceId(offer.publicId))}`,
    chain: "Coop",
    storeId: store.id,
    name: offer.name.trim(),
    mechanicText: text,
    category: mapCoopCategory(category),
    validTo,
    sourceUrl: sourceUrl(offer),
    ...(quantity > 1 ? { quantity } : {}),
    ...(brand ? { brand } : {}),
    ...(size ? { packageSize: size } : {}),
    ...(price !== undefined ? { price } : {}),
    ...(unitPrice !== undefined ? { unitPrice } : {}),
    ...(priceUnit ? { priceUnit } : {}),
    ...(regularPrice !== undefined ? { regularPrice } : {}),
    ...(comparison ? { comparisonPriceText: comparison } : {}),
    ...(limit ? { limitText: limit } : {}),
    ...(validFrom ? { validFrom } : {}),
    ...(image ? { imageUrl: image } : {}),
    ...(category ? { sourceCategory: category } : {}),
  };
}

function requestError(status: number): string {
  if (status === 403 || status === 429) {
    return `Tjek nekade begäran (HTTP ${status}); uppdateringen avbryts utan återförsök.`;
  }
  return `Tjek svarade med HTTP ${status}.`;
}

export async function buildCoopSnapshot(
  location: CoopLocation,
  dependencies: CoopJobDependencies = {},
): Promise<Snapshot> {
  const fetcher = dependencies.fetcher ?? globalThis.fetch;
  const now = dependencies.now ?? (() => new Date());
  const sleep = dependencies.sleep ?? defaultSleep;
  const attemptAt = now().toISOString();
  const runDate = stockholmDate(new Date(attemptAt));
  const weekEnd = currentOfferWeekEnd(runDate);
  let requestStarted = false;
  let discoveredStores: Store[] = [];

  const requestJson = async (command: [string, Record<string, unknown>], label: string): Promise<unknown> => {
    if (requestStarted) {
      await sleep(TJEK_REQUEST_DELAY_MS);
    }
    requestStarted = true;
    const encodedCommand = Buffer.from(JSON.stringify(command), "utf8").toString("base64");
    const response = await fetcher(TJEK_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: [encodedCommand] }),
      credentials: "omit",
    });
    if (!response.ok) {
      throw new Error(requestError(response.status));
    }
    try {
      return await response.json();
    } catch {
      throw new Error(`Tjek svarade inte med giltig JSON (${label}).`);
    }
  };

  try {
    const discovery = discoveryFor(location);
    const businessesResponse = await requestJson(["businesses", {}], "butiker");
    const businesses = parseResponse(
      TjekBusinessesResponseSchema,
      businessesResponse,
      "butiker",
    ).value;
    const coopBusinesses = businesses.filter(isCoopBusiness);
    const pinnedIds = new Set(
      (discovery.pinStoreIds ?? []).map(coopSourceStoreId),
    );
    const excludedIds = new Set(
      (discovery.excludeStoreIds ?? []).map(coopSourceStoreId),
    );
    const availableIds = new Set(
      coopBusinesses.map((business) => sourceId(business.publicId)),
    );
    const missingPins = [...pinnedIds].filter((id) => !availableIds.has(id));
    if (missingPins.length) {
      throw new Error(
        `Konfigurerade Coop-butiker hittades inte: ${missingPins.join(", ")}.`,
      );
    }
    const matchingBusinesses = coopBusinesses.filter((business) => {
      const id = sourceId(business.publicId);
      return (
        !excludedIds.has(id) &&
        (pinnedIds.has(id) ||
          sourceField(business, discovery.exactCity.field) ===
            discovery.exactCity.value)
      );
    });
    if (matchingBusinesses.length === 0) {
      throw new Error(
        `Inga Coop-butiker hittades för ${discovery.exactCity.value}.`,
      );
    }

    discoveredStores = matchingBusinesses.map((business) => {
      const fieldCity = sourceField(business, discovery.exactCity.field);
      const city =
        (typeof fieldCity === "string" && fieldCity.trim()) ||
        businessCity(business) ||
        discovery.exactCity.value;
      return storeFromBusiness(business, city);
    });
    const uniqueStores = new Map(
      discoveredStores.map((store) => [store.id, store]),
    );
    if (uniqueStores.size !== discoveredStores.length) {
      throw new Error("Tjeks butikslista innehåller dubbla Store ids.");
    }

    const offers: Offer[] = [];
    const offersByStore = new Map<string, number>();
    for (const business of matchingBusinesses) {
      const sourceStoreId = sourceId(business.publicId);
      const store = uniqueStores.get(`Coop:${sourceStoreId}`);
      if (!store) {
        throw new Error("Tjek-butiken kunde inte kopplas till en Coop Store.");
      }

      const seenOfferIds = new Set<string>();
      let expectedLastPage = false;
      let activeOfferCount = 0;
      for (let page = 0; page < TJEK_MAX_PAGES; page += 1) {
        const offset = page * TJEK_PAGE_SIZE;
        const offersResponse = await requestJson(
          [
            "offers",
            {
              hideUpcoming: false,
              pagination: { limit: TJEK_PAGE_SIZE, offset },
              sort: ["score_desc"],
              businessIds: [sourceStoreId],
            },
          ],
          "erbjudanden",
        );
        const sourceOffers = parseResponse(
          TjekOffersResponseSchema,
          offersResponse,
          "erbjudanden",
        ).value.data;

        for (const sourceOffer of sourceOffers) {
          const offerId = sourceId(sourceOffer.publicId);
          if (seenOfferIds.has(offerId)) {
            continue;
          }
          seenOfferIds.add(offerId);
          const offer = normalizedOffer(
            store,
            sourceStoreId,
            sourceOffer,
            runDate,
            weekEnd,
          );
          if (offer) {
            offers.push(offer);
            activeOfferCount += 1;
          }
        }

        if (sourceOffers.length < TJEK_PAGE_SIZE) {
          expectedLastPage = true;
          break;
        }
      }
      if (!expectedLastPage) {
        throw new Error(`Tjek-pagineringen för ${store.name} saknar sista sidan.`);
      }
      offersByStore.set(store.id, activeOfferCount);
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
          chain: "Coop",
          source: COOP_TJEK_SOURCE,
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
    const previousCoop = previous?.chains.find((chain) => chain.chain === "Coop");
    const canReusePrevious =
      previousCoop?.source === COOP_TJEK_SOURCE &&
      previousCoop.status !== "failed";
    const previousOffers =
      (canReusePrevious ? previous?.offers : undefined)?.filter(
        (offer) =>
          offer.chain === "Coop" &&
          offer.validTo >= runDate &&
          (!offer.validFrom || offer.validFrom <= weekEnd),
      ) ?? [];
    const stale = previousOffers.length > 0;
    const message = error instanceof Error ? error.message : "Okänt fel.";
    const failedAt = now().toISOString();

    return SnapshotSchema.parse({
      schemaVersion: SCHEMA_VERSION,
      location: { id: location.id, name: location.name },
      generatedAt: failedAt,
      chains: [
        {
          chain: "Coop",
          source: COOP_TJEK_SOURCE,
          status: stale ? "stale" : "failed",
          lastAttemptAt: attemptAt,
          lastSuccessAt: canReusePrevious ? previousCoop?.lastSuccessAt ?? null : null,
          error: message.slice(0, 240),
        },
      ],
      stores: stale
        ? previous?.stores.filter((store) => store.chain === "Coop") ?? []
        : discoveredStores,
      offers: stale ? previousOffers : [],
    });
  }
}
