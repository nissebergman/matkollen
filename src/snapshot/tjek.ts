import { Buffer } from "node:buffer";
import { z } from "zod";
import { mapTjekCategory } from "../domain/categories";
import { STOCKHOLM_TIME_ZONE, stockholmDate } from "../domain/date";
import {
  type Chain,
  type Offer,
  type Store,
} from "../domain/snapshot";
import type { StoreDiscoveryConfig } from "./config";
import { discoverStores } from "./store-discovery";
import {
  ChainRefreshError,
  type ChainRefreshContext,
  type ChainRefreshResult,
  type ChainSourceAdapter,
  type SnapshotLocation,
} from "./runner";

export const TJEK_REQUEST_DELAY_MS = 1_000;
export const TJEK_SOURCE = "tjek-ereklamblad";

const TJEK_ENDPOINT = "https://ereklamblad.se/";
const TJEK_PUBLICATION_PAGES_ENDPOINT =
  "https://publication-viewer.tjek.com/api/paged-publications";
const TJEK_STORE_LIMIT = 3_000;

export interface TjekRequestThrottle {
  requestStarted: boolean;
}

export function createTjekRequestThrottle(): TjekRequestThrottle {
  return { requestStarted: false };
}

export interface TjekLocation extends SnapshotLocation {
  city?: string;
  storeDiscovery?: StoreDiscoveryConfig;
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
    retailer: sourceChainSchema.optional(),
    retailerName: optionalText,
    brand: sourceChainSchema.optional(),
    brandName: optionalText,
  })
  .passthrough();

const TjekStoreSchema = z
  .object({
    id: sourceIdentifier,
    name: z.string(),
    city: z.string().min(1).refine((value) => value.trim().length > 0),
    streetAddress: optionalText,
    postalCode: optionalText,
    coordinates: z
      .object({
        latitude: z.number().finite(),
        longitude: z.number().finite(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

const sourceDateValue = z.union([
  z.string(),
  z.number().finite(),
  z.null(),
]);

const TjekPublicationSchema = z
  .object({
    id: sourceIdentifier,
    label: z.string().min(1).refine((value) => value.trim().length > 0),
    validFrom: sourceDateValue,
    validUntil: sourceDateValue,
  })
  .passthrough();

const TjekFrontSchema = z
  .object({
    category: z.unknown().refine((value) => value !== undefined),
    business: z
      .object({ publicId: sourceIdentifier })
      .passthrough(),
    publications: z.array(TjekPublicationSchema),
  })
  .passthrough();
const TjekFrontsResponseSchema = z
  .object({
    key: z.unknown().refine((value) => value !== undefined),
    status: z.unknown().refine((value) => value !== undefined),
    value: z.array(TjekFrontSchema),
  })
  .passthrough();

const TjekPublicationPagesResponseSchema = z
  .object({
    pages: z.record(
      z.string(),
      z
        .object({
          hotspots: z
            .array(
              z
                .object({
                  offer: z
                    .object({ id: sourceIdentifier })
                    .passthrough(),
                })
                .passthrough(),
            )
            .optional(),
        })
        .passthrough(),
    ),
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
    publicationPublicId: sourceIdentifier.optional(),
    publication: sourcePublicationSchema.optional(),
    description: optionalText,
    priceText: optionalText,
    mechanicText: optionalText,
    offerText: optionalText,
    membershipPriceText: optionalText,
    memberPriceText: optionalText,
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
const TjekStoresResponseSchema = z
  .object({
    key: z.unknown().refine((value) => value !== undefined),
    status: z.unknown().refine((value) => value !== undefined),
    value: z
      .object({ data: z.array(TjekStoreSchema) })
      .passthrough(),
  })
  .passthrough();
const TjekOfferResponseSchema = z
  .object({
    key: z.string().min(1),
    status: z.literal("success"),
    value: TjekOfferSchema,
  })
  .passthrough();

type TjekBusiness = z.infer<typeof TjekBusinessSchema>;
export type TjekOffer = z.infer<typeof TjekOfferSchema>;
type TjekStore = z.infer<typeof TjekStoreSchema>;

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

function publicationEndDateFromSource(
  value: string | number | null | undefined,
): string | undefined {
  const date = dateFromSource(value);
  if (!date || (typeof value === "string" && isIsoDate(value.trim()))) {
    return date;
  }

  let timestamp: number;
  if (typeof value === "number") {
    timestamp = value;
  } else if (typeof value === "string" && /^\d{10,13}$/.test(value.trim())) {
    const rawTimestamp = Number(value.trim());
    timestamp = value.trim().length === 10 ? rawTimestamp * 1_000 : rawTimestamp;
  } else if (typeof value === "string") {
    timestamp = Date.parse(value.trim());
  } else {
    return date;
  }
  const instant = new Date(timestamp);
  if (!Number.isFinite(instant.getTime()) || instant.getUTCMilliseconds() !== 0) {
    return date;
  }

  const localTime = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: STOCKHOLM_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(instant)
      .map(({ type, value: part }) => [type, part]),
  );
  if (
    localTime.hour !== "00" ||
    localTime.minute !== "00" ||
    localTime.second !== "00"
  ) {
    return date;
  }

  const previousDay = new Date(`${date}T00:00:00.000Z`);
  previousDay.setUTCDate(previousDay.getUTCDate() - 1);
  return previousDay.toISOString().slice(0, 10);
}

function publicationsFromResponse(
  value: unknown,
  label: string,
  expectedBusinessId: string,
): z.infer<typeof TjekPublicationSchema>[] {
  const fronts = parseResponse(TjekFrontsResponseSchema, value, label).value;
  const publications: z.infer<typeof TjekPublicationSchema>[] = [];
  for (const front of fronts) {
    if (sourceId(front.business.publicId) !== expectedBusinessId) {
      throw new Error(
        `Tjek returnerade en front för ett annat varumärke än ${expectedBusinessId}.`,
      );
    }
    publications.push(...front.publications);
  }
  return publications;
}

function publicationDetails(
  publication: z.infer<typeof TjekPublicationSchema>,
): { id: string; validFrom: string; validTo: string } {
  const { id, label } = publication;
  const validFrom = dateFromSource(publication.validFrom);
  const validTo = publicationEndDateFromSource(publication.validUntil);
  if (id === undefined || !label || !validFrom || !validTo) {
    throw new Error(
      "Tjek returnerade en publikation utan verifierat ID, etikett eller giltighetsintervall.",
    );
  }
  if (
    (publication.validFrom != null && !validFrom) ||
    (publication.validUntil != null &&
      !publicationEndDateFromSource(publication.validUntil)) ||
    validFrom > validTo
  ) {
    throw new Error("Tjek returnerade en publikation med ogiltigt giltighetsintervall.");
  }
  return { id: sourceId(id), validFrom, validTo };
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

function chainLabels(value: unknown): string[] {
  if (typeof value === "string") {
    return sourceText(value) ? [value] : [];
  }
  if (typeof value !== "object" || value === null) {
    return [];
  }

  const record = value as Record<string, unknown>;
  return ["name", "title", "slug", "displayName", "label"]
    .map((key) => record[key])
    .filter((label): label is string => typeof label === "string" && !!label.trim());
}

function isBusinessForChain(business: TjekBusiness, chain: Chain): boolean {
  const record = business as Record<string, unknown>;
  const declaredLabels = [
    "chain",
    "chainName",
    "retailer",
    "retailerName",
    "brand",
    "brandName",
  ].flatMap((key) => chainLabels(record[key]));
  const labels = declaredLabels.length ? declaredLabels : [business.name];
  const expected = normalizedKey(chain).replace(/[^a-z0-9]/g, "");

  return labels.some((label) =>
    normalizedKey(label)
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .includes(expected),
  );
}

function storeFromTjekStore(store: TjekStore, chain: Chain): Store {
  const city = store.city.trim();
  const address = [
    sourceText(store.streetAddress),
    sourceText(store.postalCode),
    city,
  ]
    .filter(Boolean)
    .join(", ");
  return {
    id: `${chain}:${sourceId(store.id)}`,
    chain,
    name: store.name.trim(),
    address,
  };
}

function businessIdsFromOffer(offer: TjekOffer): string[] {
  return [
    offer.business?.publicId,
    offer.businessPublicId,
    offer.businessId,
  ]
    .filter((value): value is string | number => value !== undefined)
    .map(sourceId);
}

function publicationIdsFromOffer(offer: TjekOffer): string[] {
  return [offer.publicationPublicId, offer.publication?.publicId]
    .filter((value): value is string | number => value !== undefined)
    .map(sourceId);
}

function amountText(value: number): string {
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 2 }).format(value);
}

function amountFromMechanic(text: string): number | undefined {
  const match = text.match(/(\d[\d\s.,]*)\s*kr\b/i);
  return match ? parseAmount(match[1]) : undefined;
}

function memberPriceText(offer: TjekOffer): string | undefined {
  return (
    sourceText(offer.membershipPriceText) ?? sourceText(offer.memberPriceText)
  );
}

function memberPriceAmount(offer: TjekOffer): number | undefined {
  const text = memberPriceText(offer);
  return (
    parseAmount(offer.membershipPrice) ??
    (text ? amountFromMechanic(text) : undefined)
  );
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
    memberPriceText(offer) ??
    sourceText(offer.priceText) ??
    sourceText(offer.mechanicText) ??
    sourceText(offer.offerText);
  if (direct) {
    return direct;
  }

  const priceUnit = priceUnitFrom(offer.baseUnit, offer.unitSymbol, offer.priceUnit);
  const memberPrice = memberPriceAmount(offer);
  if (memberPrice !== undefined) {
    const sourceUnitPrice = parseAmount(offer.unitPrice);
    const priceIsPerUnit =
      (priceUnit === "kg" || priceUnit === "l") &&
      sourceUnitPrice === memberPrice;
    return `${amountText(memberPrice)} kr${priceIsPerUnit ? `/${priceUnit}` : ""}`;
  }

  const productPrice =
    parseAmount(offer.fromPrice) ?? parseAmount(offer.price);
  if (productPrice !== undefined) {
    return `${amountText(productPrice)} kr`;
  }

  const unitPrice = parseAmount(offer.unitPrice);
  if (unitPrice !== undefined) {
    return `${amountText(unitPrice)} kr${priceUnit ? `/${priceUnit}` : ""}`;
  }

  const description = sourceText(offer.description);
  if (description) {
    return description;
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
    if (
      unit &&
      priceUnitFrom(unit) !== undefined &&
      priceUnitFrom(unit) === priceUnitFrom(offer.baseUnit)
    ) {
      return undefined;
    }
    return `${amountText(sizeFrom)}${unit ? ` ${unit}` : ""}`;
  }
  return undefined;
}

function limitText(offer: TjekOffer): string | undefined {
  const direct = sourceText(offer.limitText);
  if (direct) {
    return direct;
  }
  const match = offer.description?.match(
    /\bmax\s+(\d+)\s*(?:(?:st\s*\/\s*)|(?:per\s+))?hushåll\b/i,
  );
  return match ? `Max ${match[1]} per hushåll` : undefined;
}

export function normalizeTjekOffer(
  store: Store,
  chain: Chain,
  sourceStoreId: string,
  sourceBusinessId: string,
  expectedPublicationId: string,
  offer: TjekOffer,
  runDate: string,
  weekEnd: string,
): Offer | undefined {
  const linkedBusinessIds = businessIdsFromOffer(offer);
  if (linkedBusinessIds.length === 0) {
    throw new Error(`Tjek-erbjudandet "${offer.name}" saknar varumärkeskoppling.`);
  }
  if (linkedBusinessIds.some((businessId) => businessId !== sourceBusinessId)) {
    throw new Error(
      `Tjek kopplade ett erbjudande till fel ${chain}-varumärke (${offer.name}).`,
    );
  }
  const linkedPublicationIds = publicationIdsFromOffer(offer);
  if (
    linkedPublicationIds.length === 0 ||
    linkedPublicationIds.some(
      (publicationId) => publicationId !== expectedPublicationId,
    )
  ) {
    throw new Error(
      `Tjek kopplade ett erbjudande till fel publikation (${offer.name}).`,
    );
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
  const bundlePrice =
    quantity > 1 && /(\d+)\s*(?:för|for)\s*\d+/iu.test(text)
      ? mechanicAmount
      : undefined;
  const memberText = memberPriceText(offer);
  const memberTextAmount = memberText
    ? amountFromMechanic(memberText)
    : undefined;
  const memberPrice = parseAmount(offer.membershipPrice) ?? memberTextAmount;
  const price =
    bundlePrice ??
    memberPrice ??
    parseAmount(offer.fromPrice) ??
    parseAmount(offer.price) ??
    (priceUnit === "kg" || priceUnit === "l" ? undefined : mechanicAmount);
  const sourceUnitPrice = parseAmount(offer.unitPrice);
  const memberUnitPrice =
    parseAmount(offer.membershipPrice) ??
    (memberTextAmount !== undefined
      ? quantity > 1 && /(\d+)\s*(?:för|for)\s*\d+/iu.test(memberText ?? "")
        ? memberTextAmount / quantity
        : memberTextAmount
      : undefined);
  const unitPrice =
    priceUnit === "kg" || priceUnit === "l"
      ? memberTextAmount !== undefined &&
        priceUnitFrom(memberText) === priceUnit
        ? memberTextAmount
        : sourceUnitPrice && sourceUnitPrice > 0
          ? sourceUnitPrice
          : mechanicAmount
      : (memberPrice !== undefined && sourceUnitPrice === memberPrice
          ? memberPrice
          : undefined) ??
        memberUnitPrice ??
        (sourceUnitPrice && sourceUnitPrice > 0
          ? sourceUnitPrice
          : price !== undefined
            ? price / quantity
            : undefined);
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
  const limit = limitText(offer);

  return {
    id: `${normalizedKey(chain).replace(/\s+/g, "-")}:${encodeURIComponent(sourceStoreId)}:${encodeURIComponent(sourceId(offer.publicId))}`,
    chain,
    storeId: store.id,
    name: offer.name.trim(),
    mechanicText: text,
    category: mapTjekCategory(category),
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
  if (status === 401 || status === 403 || status === 429) {
    return `Tjek nekade begäran (HTTP ${status}); uppdateringen avbryts utan återförsök.`;
  }
  return `Tjek svarade med HTTP ${status}.`;
}

async function refreshTjek(
  chain: Chain,
  discovery: StoreDiscoveryConfig,
  context: ChainRefreshContext,
  throttle?: TjekRequestThrottle,
): Promise<ChainRefreshResult> {
  let requestStarted = false;
  let discoveredStores: Store[] = [];

  const requestJson = async (
    url: string,
    init: RequestInit,
    label: string,
  ): Promise<unknown> => {
    if (requestStarted || throttle?.requestStarted) {
      await context.sleep(TJEK_REQUEST_DELAY_MS);
    }
    requestStarted = true;
    if (throttle) {
      throttle.requestStarted = true;
    }
    const response = await context.fetcher(url, { ...init, credentials: "omit" });
    if (!response.ok) {
      throw new Error(requestError(response.status));
    }
    try {
      return await response.json();
    } catch {
      throw new Error(`Tjek svarade inte med giltig JSON (${label}).`);
    }
  };

  const requestAction = (
    action: string,
    parameters: Record<string, unknown>,
    label: string,
  ) => {
    const encodedCommand = Buffer.from(
      JSON.stringify([action, parameters]),
      "utf8",
    ).toString("base64");
    return requestJson(
      TJEK_ENDPOINT,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: [encodedCommand] }),
      },
      label,
    );
  };

  const requestPublicationPages = (publicationId: string) =>
    requestJson(
      `${TJEK_PUBLICATION_PAGES_ENDPOINT}/${encodeURIComponent(publicationId)}/pages?from=1&to=20`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      },
      "publikationssidor",
    );

  try {
    const businessesResponse = await requestAction("businesses", {}, "butiker");
    const businesses = parseResponse(
      TjekBusinessesResponseSchema,
      businessesResponse,
      "butiker",
    ).value;
    const chainBusinesses = businesses.filter((business) =>
      isBusinessForChain(business, chain),
    );
    if (chainBusinesses.length === 0) {
      throw new Error(
        `Tjek saknar ett verifierat ${chain}-varumärke för butiksupptäckt.`,
      );
    }

    const sourceStoresById = new Map<string, TjekStore>();
    const sourceBusinessIdsByStoreId = new Map<string, string>();
    for (const business of chainBusinesses) {
      const businessId = sourceId(business.publicId);
      const storesResponse = await requestAction(
        "stores",
        {
          businessId,
          pagination: { offset: 0, limit: TJEK_STORE_LIMIT },
        },
        "butiker",
      );
      const sourceStores = parseResponse(
        TjekStoresResponseSchema,
        storesResponse,
        "butiker",
      ).value.data;
      if (sourceStores.length === TJEK_STORE_LIMIT) {
        throw new Error(
          `Tjek-listan över ${chain}-butiker nådde den verifierade gränsen på ${TJEK_STORE_LIMIT} poster.`,
        );
      }

      for (const store of sourceStores) {
        const id = sourceId(store.id);
        const previous = sourceStoresById.get(id);
        if (
          previous &&
          (previous.name !== store.name ||
            previous.city !== store.city ||
            previous.streetAddress !== store.streetAddress)
        ) {
          throw new Error(`Tjek returnerade motstridiga data för Store ${id}.`);
        }
        sourceStoresById.set(id, store);
        const previousBusinessId = sourceBusinessIdsByStoreId.get(id);
        if (previousBusinessId && previousBusinessId !== businessId) {
          throw new Error(
            `Tjek kopplade Store ${id} till flera ${chain}-varumärken.`,
          );
        }
        sourceBusinessIdsByStoreId.set(id, businessId);
      }
    }

    const locationStores = discoverStores(
      [...sourceStoresById.values()],
      {
        ...discovery,
        exactCity: {
          field: "city",
          value: discovery.exactCity.value,
        },
      },
      chain,
      (store) => sourceId(store.id),
    );
    if (locationStores.some((store) => !store.name.trim())) {
      throw new Error(
        `Tjek returnerade en ${chain}-butik utan visningsnamn i ${discovery.exactCity.value}.`,
      );
    }
    discoveredStores = locationStores.map((store) =>
      storeFromTjekStore(store, chain),
    );
    if (discoveredStores.length === 0) {
      throw new Error(
        `Inga ${chain}-butiker återstod i ${discovery.exactCity.value} efter Store-överskrivningar.`,
      );
    }
    if (chain !== "Coop") {
      throw new Error(
        `Tjek-flödet efter Store-discovery är ännu inte verifierat för ${chain}; inga erbjudanden hämtades.`,
      );
    }

    const offers: Offer[] = [];
    for (const sourceStore of locationStores) {
      const sourceStoreId = sourceId(sourceStore.id);
      const store = storeFromTjekStore(sourceStore, chain);
      const businessId = sourceBusinessIdsByStoreId.get(sourceStoreId);
      if (!businessId) {
        throw new Error(`Tjek saknar varumärkeskoppling för Store ${sourceStoreId}.`);
      }
      if (!sourceStore.coordinates) {
        throw new Error(
          `Tjek-Store ${sourceStoreId} saknar koordinater för publikationssökning.`,
        );
      }

      const frontsResponse = await requestAction(
        "fronts",
        {
          businessIds: [businessId],
          localBusinessIds: [sourceStoreId],
          coordinates: {
            latitude: sourceStore.coordinates.latitude,
            longitude: sourceStore.coordinates.longitude,
          },
        },
        "publikationer",
      );
      const publications = publicationsFromResponse(
        frontsResponse,
        "publikationer",
        businessId,
      );
      const currentPublications = publications
        .map(publicationDetails)
        .filter(
          (publication) =>
            publication.validTo >= context.runDate &&
            publication.validFrom <= context.offerWeekEnd,
        );
      if (currentPublications.length === 0) {
        throw new Error(
          `Tjek returnerade ingen verifierad aktuell publikation för Store ${sourceStoreId}.`,
        );
      }

      for (const publication of currentPublications) {
        const pagesResponse = await requestPublicationPages(publication.id);
        const pages = parseResponse(
          TjekPublicationPagesResponseSchema,
          pagesResponse,
          "publikationssidor",
        ).pages;
        const offerIds = new Set(
          Object.values(pages).flatMap((page) =>
            page.hotspots?.map((hotspot) => sourceId(hotspot.offer.id)) ?? [],
          ),
        );
        if (offerIds.size === 0) {
          throw new Error(
            `Tjek-publikationen ${publication.id} saknar verifierade Offer-ID:n.`,
          );
        }

        for (const offerId of offerIds) {
          const offerResponse = await requestAction(
            "offer",
            { publicId: offerId },
            "erbjudanden",
          );
          const sourceOffer = parseResponse(
            TjekOfferResponseSchema,
            offerResponse,
            `erbjudande ${offerId}`,
          ).value;
          if (sourceId(sourceOffer.publicId) !== offerId) {
            throw new Error(
              `Tjek returnerade fel Offer-ID för publikationen ${publication.id}.`,
            );
          }
          const offer = normalizeTjekOffer(
            store,
            chain,
            sourceStoreId,
            businessId,
            publication.id,
            sourceOffer,
            context.runDate,
            context.offerWeekEnd,
          );
          if (offer) {
            offers.push(offer);
          }
        }
      }
    }
    if (offers.length === 0) {
      throw new Error(
        `Tjek returnerade inga aktuella erbjudanden för ${chain} i ${discovery.exactCity.value}.`,
      );
    }

    return { stores: discoveredStores, offers };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Okänt fel.";
    throw new ChainRefreshError(message.slice(0, 240), discoveredStores);
  }
}

export function createTjekSourceAdapter<Location extends SnapshotLocation>(
  chain: Chain,
  discovery: StoreDiscoveryConfig,
  source = TJEK_SOURCE,
  throttle?: TjekRequestThrottle,
): ChainSourceAdapter<Location> {
  return {
    chain,
    source,
    refresh: (_location, context) =>
      refreshTjek(chain, discovery, context, throttle),
  };
}
