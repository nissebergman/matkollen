import { Buffer } from "node:buffer";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { z } from "zod";
import { mapCoopCategory } from "../domain/categories";
import type { Offer, Snapshot, Store } from "../domain/snapshot";
import type { StoreDiscoveryConfig } from "./config";
import {
  ChainRefreshError,
  buildSnapshot,
  type ChainRefreshContext,
  type ChainRefreshResult,
  type ChainSourceAdapter,
  type SnapshotJobDependencies,
} from "./runner";
import type { CoopLocation } from "./coop";

export const COOP_FLYER_PDF_SOURCE = "coop-flyer-pdf";
export const COOP_PDF_REQUEST_DELAY_MS = 1_000;

const COOP_WEBSITE_ORIGIN = "https://www.coop.se";
const COOP_STORE_PAGE_URL = `${COOP_WEBSITE_ORIGIN}/butiker-erbjudanden/`;
const COOP_API_ORIGIN = "https://proxy.api.coop.se";
const COOP_STORE_MAP_URL =
  `${COOP_API_ORIGIN}/external/store/stores/map` +
  "?conceptIds=12,6,95&invertFilter=true&api-version=v2";
const COOP_PDF_ORIGIN = "https://dr.coop.se";
const COOP_MAX_PDF_BYTES = 30 * 1024 * 1024;
const NON_BLANK_TEXT = z.string().trim().min(1);
const OPTIONAL_TEXT = z.string().trim().nullable().optional();
const SOURCE_IDENTIFIER = z.union([
  NON_BLANK_TEXT,
  z.number().int().nonnegative().finite(),
]);

const SourceAddressSchema = z.union([
  NON_BLANK_TEXT,
  z
    .object({
      city: OPTIONAL_TEXT,
      town: OPTIONAL_TEXT,
      street: OPTIONAL_TEXT,
      streetAddress: OPTIONAL_TEXT,
      streetName: OPTIONAL_TEXT,
      line1: OPTIONAL_TEXT,
      postalCode: OPTIONAL_TEXT,
    })
    .passthrough(),
  z.null(),
]);

const CoopMapStoreSchema = z
  .object({
    storeId: SOURCE_IDENTIFIER,
    ledgerAccountNumber: z.string().trim().min(1),
    name: NON_BLANK_TEXT,
    city: NON_BLANK_TEXT,
    address: SourceAddressSchema.optional(),
    postalCode: OPTIONAL_TEXT,
  })
  .passthrough();

const CoopStoreMapResponseSchema = z.union([
  z.array(CoopMapStoreSchema),
  z.object({ value: z.array(CoopMapStoreSchema) }).passthrough(),
  z.object({ stores: z.array(CoopMapStoreSchema) }).passthrough(),
]);

const CoopFlyerSchema = z
  .object({
    id: SOURCE_IDENTIFIER,
    startDate: NON_BLANK_TEXT,
    stopDate: NON_BLANK_TEXT,
    current: z.boolean(),
    pdfExists: z.boolean(),
    pdfUrl: z.string().trim().min(1).nullable().optional(),
    isHemmaBilaga: z.boolean().optional(),
  })
  .passthrough();

const CoopStoreDetailsSchema = z
  .object({
    id: SOURCE_IDENTIFIER,
    ledgerAccountNumber: z.string().trim().min(1),
    name: NON_BLANK_TEXT,
    city: OPTIONAL_TEXT,
    address: SourceAddressSchema.optional(),
    flyers: z.array(CoopFlyerSchema),
  })
  .passthrough();

type CoopMapStore = z.infer<typeof CoopMapStoreSchema>;
type CoopStoreDetails = z.infer<typeof CoopStoreDetailsSchema>;
type CoopFlyer = z.infer<typeof CoopFlyerSchema>;

interface DatedFlyer {
  source: CoopFlyer;
  validFrom: string;
  validTo: string;
  pdfUrl: string;
}

interface TextPart {
  x: number;
  value: string;
}

interface TextLine {
  y: number;
  parts: TextPart[];
}

interface ParsedMechanic {
  text: string;
  productPrefix: string;
  productSuffix?: string;
  quantity: number;
  amount?: number;
  priceUnit?: Offer["priceUnit"];
}

const AMOUNT_PATTERN = String.raw`\d+(?:[ \u00a0.,]\d{3})*(?:[.,]\d{1,2})?`;
const PRICE_PATTERN = new RegExp(
  `(${AMOUNT_PATTERN})\\s*(kr\\b|:-)(?:\\s*(?:\\/|per\\s*)(kg|l|st|styck|liter))?`,
  "iu",
);
const MULTI_BUY_PRICE_PATTERN = new RegExp(
  `\\b(\\d+)\\s*(?:för|for)\\s*(${AMOUNT_PATTERN})\\s*(kr\\b|:-)(?:\\s*(?:\\/|per\\s*)(kg|l|st|styck|liter))?`,
  "iu",
);
const MULTI_BUY_TEXT_PATTERN = /\b(\d+)\s*(?:för|for)\s*(\d+)\b/iu;
const OFFER_LABEL_PATTERN =
  /(?:medlemspris|stammispris|klubbpris|specialpris|kampanjpris|veckans pris|pris)\s*:?\s*/giu;
const ORDINARY_PRICE_PATTERN =
  /\b(?:ordinarie(?:\s+pris)?|normalpris|ord\.?\s*pris)\b/iu;
const COMPARISON_PRICE_PATTERN =
  /\b(?:jämförpris|jmf\.?\s*pris|jfr\.?\s*[-–]?\s*pris)\s*:?\s*(.+)$/iu;
const LIMIT_PATTERN = /^(?:max(?:imum)?\.?\b|högst\b)/iu;

function describeValidationError(error: z.ZodError): string {
  const issue = error.issues[0];
  const path = issue.path.length ? issue.path.join(".") : "response";
  return `fältet ${path} har ett oväntat format`;
}

function parseResponse<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Ogiltigt svar från Coop (${label}): ${describeValidationError(result.error)}.`,
    );
  }
  return result.data;
}

function sourceId(value: string | number): string {
  return String(value);
}

function coopSourceStoreId(configuredId: string): string {
  return configuredId.startsWith("Coop:")
    ? configuredId.slice("Coop:".length)
    : configuredId;
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

function mapStoresFromResponse(value: unknown): CoopMapStore[] {
  const parsed = parseResponse(
    CoopStoreMapResponseSchema,
    value,
    "butikskarta",
  );
  if (Array.isArray(parsed)) {
    return parsed;
  }
  const record = parsed as {
    value?: CoopMapStore[];
    stores?: CoopMapStore[];
  };
  return record.value ?? record.stores ?? [];
}

function locationDiscovery(location: CoopLocation): StoreDiscoveryConfig {
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

function discoverCoopStores(
  sourceStores: CoopMapStore[],
  discovery: StoreDiscoveryConfig,
): CoopMapStore[] {
  const ids = sourceStores.map((store) => sourceId(store.storeId));
  if (new Set(ids).size !== ids.length) {
    throw new Error("Coops butikskarta innehåller dubbla Store ids.");
  }

  const pinIds = new Set((discovery.pinStoreIds ?? []).map(coopSourceStoreId));
  const excludeIds = new Set(
    (discovery.excludeStoreIds ?? []).map(coopSourceStoreId),
  );
  const availableIds = new Set(ids);
  const missingPins = [...pinIds].filter((id) => !availableIds.has(id));
  if (missingPins.length) {
    throw new Error(
      `Konfigurerade Coop-butiker hittades inte: ${missingPins.join(", ")}.`,
    );
  }

  const matching = sourceStores.filter((store) => {
    const id = sourceId(store.storeId);
    return (
      !excludeIds.has(id) &&
      (pinIds.has(id) ||
        sourceField(store, discovery.exactCity.field) ===
          discovery.exactCity.value)
    );
  });
  if (matching.length === 0) {
    throw new Error(
      `Inga Coop-butiker hittades för ${discovery.exactCity.value}.`,
    );
  }
  return matching;
}

function dateFromFlyer(value: string, field: string): string {
  const date = value.match(
    /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/,
  );
  if (!date) {
    throw new Error(`Coop-flyern har ett ogiltigt ${field}.`);
  }
  const normalized = date[1];
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== normalized ||
    (date[2] !== undefined &&
      (Number(date[2]) > 23 ||
        Number(date[3]) > 59 ||
        Number(date[4]) > 59))
  ) {
    throw new Error(`Coop-flyern har ett ogiltigt ${field}.`);
  }
  return normalized;
}

function trustedFlyerUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value, COOP_PDF_ORIGIN);
  } catch {
    throw new Error("Coop-flyern saknar en giltig PDF-länk.");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() !== "dr.coop.se" ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw new Error("Coop-flyern har en PDF-länk utanför dr.coop.se.");
  }
  if (
    [...url.searchParams.keys()].some((key) =>
      /(?:token|secret|signature|credential|session|bearer|password)|(?:^|[_-])(?:auth|sig)(?:$|[_-])|^(?:api|subscription|access|client)[_-]?key$/iu.test(key),
    )
  ) {
    throw new Error("Coop-flyerns PDF-länk innehåller åtkomstuppgifter.");
  }
  return url.toString();
}

function currentFlyers(
  store: Store,
  details: CoopStoreDetails,
  runDate: string,
  weekEnd: string,
): DatedFlyer[] {
  const current = details.flyers.filter((flyer) => flyer.current);
  const relevant: DatedFlyer[] = [];
  for (const flyer of current) {
    const validFrom = dateFromFlyer(flyer.startDate, "startdatum");
    const validTo = dateFromFlyer(flyer.stopDate, "slutdatum");
    if (validFrom > validTo) {
      throw new Error(`Coop-flyern för ${store.name} har ett ogiltigt giltighetsintervall.`);
    }
    if (validTo < runDate || validFrom > weekEnd) {
      continue;
    }
    if (!flyer.pdfExists || !flyer.pdfUrl) {
      throw new Error(`Coop-butiken ${store.name} saknar en aktuell PDF-flyer.`);
    }
    relevant.push({
      source: flyer,
      validFrom,
      validTo,
      pdfUrl: trustedFlyerUrl(flyer.pdfUrl),
    });
  }

  if (relevant.length === 0) {
    throw new Error(
      `Coop-butiken ${store.name} saknar en aktuell PDF-flyer för Offer Week.`,
    );
  }
  return relevant;
}

function addressParts(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  if (typeof value !== "object" || value === null) {
    return [];
  }
  const address = value as Record<string, unknown>;
  const street =
    address.streetAddress ??
    address.street ??
    address.streetName ??
    address.line1;
  return [
    typeof street === "string" ? street.trim() : "",
    typeof address.postalCode === "string" ? address.postalCode.trim() : "",
  ].filter(Boolean);
}

function storeAddress(
  details: CoopStoreDetails,
  mapStore: CoopMapStore,
  city: string,
): string {
  const parts = [
    ...addressParts(details.address),
    ...addressParts(mapStore.address),
    typeof mapStore.postalCode === "string" ? mapStore.postalCode.trim() : "",
    city,
  ].filter(Boolean);
  return [...new Set(parts)].join(", ") || city;
}

function storeFromMap(store: CoopMapStore, city: string): Store {
  const storeCity = store.city.trim() || city;
  return {
    id: `Coop:${sourceId(store.storeId)}`,
    chain: "Coop",
    name: store.name.trim(),
    address: storeAddress(
      {
        id: store.storeId,
        ledgerAccountNumber: store.ledgerAccountNumber,
        name: store.name,
        city: store.city,
        flyers: [],
      },
      store,
      storeCity,
    ),
  };
}

function storeFromDetails(
  details: CoopStoreDetails,
  mapStore: CoopMapStore,
  city: string,
): Store {
  const storeCity = details.city?.trim() || mapStore.city.trim() || city;
  return {
    id: `Coop:${sourceId(mapStore.storeId)}`,
    chain: "Coop",
    name: details.name.trim(),
    address: storeAddress(details, mapStore, storeCity),
  };
}

function scriptUrlFromPublicPage(page: string): string {
  const scripts = [
    ...page.matchAll(
      /<script\b[^>]*?\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/giu,
    ),
  ]
    .map((match) => match[1] ?? match[2] ?? match[3])
    .filter((source): source is string => Boolean(source))
    .map((source) => source.replaceAll("&amp;", "&"));
  const source = scripts.find(
    (candidate) =>
      /storesApp/i.test(candidate) && /\.js(?:[?#]|$)/i.test(candidate),
  );
  if (!source) {
    throw new Error("Coops publika butikssida saknar sin Store-konfiguration.");
  }

  let url: URL;
  try {
    url = new URL(source, COOP_STORE_PAGE_URL);
  } catch {
    throw new Error("Coops publika butikssida har en ogiltig konfigurationslänk.");
  }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    (host !== "coop.se" && !host.endsWith(".coop.se"))
  ) {
    throw new Error("Coops publika butikssida länkar till en extern konfiguration.");
  }
  return url.toString();
}

function subscriptionKeyFromPublicConfig(
  page: string,
  script: string,
): string {
  const config = `${page}\n${script}`;
  const directHeader = config.match(
    /["']?Ocp-Apim-Subscription-Key["']?\s*:\s*["']([^"']+)["']/iu,
  );
  const publicConfig = config.match(
    /(?:subscription[-_]?key|ocpApimSubscriptionKey|apiSubscriptionKey|storeApiKey)\s*[:=]\s*["']([^"']+)["']/iu,
  );
  const key = (directHeader?.[1] ?? publicConfig?.[1])?.trim();
  if (!key) {
    throw new Error(
      "Coops publika butikskonfiguration saknar en läsbar API-nyckel.",
    );
  }
  return key;
}

async function responseJson(response: Response, label: string): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error(`Coop svarade inte med giltig JSON (${label}).`);
  }
}

function formatRequestError(status: number): string {
  if (status === 401 || status === 403 || status === 429) {
    return `Coop nekade begäran (HTTP ${status}); uppdateringen avbryts utan återförsök.`;
  }
  return `Coop svarade med HTTP ${status}.`;
}

function parseAmount(value: string): number | undefined {
  let normalized = value.replace(/[ \u00a0]/g, "");
  const comma = normalized.lastIndexOf(",");
  const dot = normalized.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    normalized =
      comma > dot
        ? normalized.replace(/\./gu, "").replace(",", ".")
        : normalized.replace(/,/gu, "");
  } else if (comma >= 0) {
    normalized = normalized.replace(",", ".");
  } else if ((normalized.match(/\./gu) ?? []).length > 1) {
    const lastDot = normalized.lastIndexOf(".");
    normalized = `${normalized.slice(0, lastDot).replace(/\./gu, "")}${normalized.slice(lastDot)}`;
  }
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}

function priceUnitFrom(value: string | undefined): Offer["priceUnit"] {
  switch (value?.toLowerCase()) {
    case "kg":
      return "kg";
    case "l":
      return "l";
    case "st":
    case "styck":
      return "st";
    case "liter":
      return "l";
    default:
      return undefined;
  }
}

function cleanText(value: string): string {
  return value
    .replace(/^[\s|•·–—-]+|(?<!:)[\s|•·–—-]+$/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function mechanicLabelStart(line: string, priceIndex: number): number {
  const labels = [...line.matchAll(OFFER_LABEL_PATTERN)];
  const label = labels
    .filter(
      (match) =>
        match.index !== undefined &&
        match.index < priceIndex &&
        priceIndex - match.index < 48,
    )
    .at(-1);
  return label?.index ?? priceIndex;
}

function parseMechanic(line: string): ParsedMechanic | undefined {
  const multiBuyPrice = MULTI_BUY_PRICE_PATTERN.exec(line);
  const singlePrice = PRICE_PATTERN.exec(line);
  const textOnlyMulti = MULTI_BUY_TEXT_PATTERN.exec(line);
  const match =
    multiBuyPrice &&
    (!singlePrice || multiBuyPrice.index <= singlePrice.index)
      ? multiBuyPrice
      : singlePrice;

  if (match && match.index !== undefined) {
    const start = mechanicLabelStart(line, match.index);
    const end = match.index + match[0].length;
    const text = cleanText(line.slice(start, end));
    const productPrefix = cleanText(line.slice(0, start));
    const productSuffix = cleanText(line.slice(end));
    const quantity = Number(
      (multiBuyPrice ?? textOnlyMulti)?.[1] ?? 1,
    );
    if (multiBuyPrice) {
      const amount = parseAmount(multiBuyPrice[2]);
      const priceUnit = priceUnitFrom(multiBuyPrice[4]);
      return {
        text,
        productPrefix,
        ...(productSuffix ? { productSuffix } : {}),
        quantity: Number(multiBuyPrice[1]),
        ...(amount !== undefined ? { amount } : {}),
        ...(priceUnit ? { priceUnit } : {}),
      };
    }

    const amount = parseAmount(singlePrice![1]);
    const priceUnit = priceUnitFrom(singlePrice![3]);
    return {
      text,
      productPrefix,
      ...(productSuffix ? { productSuffix } : {}),
      quantity: textOnlyMulti ? Number(textOnlyMulti[1]) : quantity,
      ...(amount !== undefined ? { amount } : {}),
      ...(priceUnit ? { priceUnit } : {}),
    };
  }

  if (textOnlyMulti && textOnlyMulti.index !== undefined) {
    const start = mechanicLabelStart(line, textOnlyMulti.index);
    const end = textOnlyMulti.index + textOnlyMulti[0].length;
    const productSuffix = cleanText(line.slice(end));
    return {
      text: cleanText(line.slice(start, end)),
      productPrefix: cleanText(line.slice(0, start)),
      ...(productSuffix ? { productSuffix } : {}),
      quantity: Number(textOnlyMulti[1]),
    };
  }
  return undefined;
}

function ordinaryPriceFrom(
  line: string,
): { amount: number; priceUnit?: Offer["priceUnit"] } | undefined {
  const match = PRICE_PATTERN.exec(line);
  if (!match) {
    return undefined;
  }
  const amount = parseAmount(match[1]);
  if (amount === undefined) {
    return undefined;
  }
  const priceUnit = priceUnitFrom(match[3]);
  return { amount, ...(priceUnit ? { priceUnit } : {}) };
}

function packageSizeFrom(name: string): string | undefined {
  return name.match(
    /\b\d+(?:[.,]\d+)?\s*(?:kg|g|l|ml|cl|st|pack)\b/iu,
  )?.[0];
}

function brandFrom(name: string): { name: string; brand?: string } {
  const brand = name.match(/^(?:varumärke|märke|brand)\s*:\s*([^|;]+)[|;]\s*(.+)$/iu);
  return brand
    ? { name: cleanText(brand[2]), brand: cleanText(brand[1]) }
    : { name };
}

function productFromSuffix(value: string): {
  name: string;
  brand?: string;
  qualifierText?: string;
} {
  const suffix = cleanText(value);
  const qualifier = suffix.match(/\s+(gäller ej\b.*)$/iu);
  const productText = cleanText(
    qualifier ? suffix.slice(0, qualifier.index) : suffix,
  );
  const qualifierText = qualifier ? cleanText(qualifier[1]) : undefined;
  const sentences = productText
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => cleanText(sentence).replace(/[.!?]+$/u, ""))
    .filter(Boolean);

  if (sentences.length > 1) {
    const brand = sentences[0];
    const nextSentence = sentences[1];
    if (
      nextSentence
        .toLocaleLowerCase()
        .startsWith(`${brand.toLocaleLowerCase()} `)
    ) {
      return {
        name: cleanText(nextSentence.slice(brand.length)),
        brand,
        ...(qualifierText ? { qualifierText } : {}),
      };
    }
  }

  return {
    name: productText,
    ...(qualifierText ? { qualifierText } : {}),
  };
}

function isNoiseLine(line: string): boolean {
  return /^(?:veckans erbjudanden?|aktuella erbjudanden?|erbjudanden?|coop|gäller denna vecka)$/iu.test(
    line.trim(),
  );
}

function parseFlyerOffers(
  lines: string[],
  store: Store,
  flyer: DatedFlyer,
  runDate: string,
  weekEnd: string,
): Offer[] {
  const offers: Offer[] = [];
  const pendingNameLines: string[] = [];
  let category: Offer["category"] = "Övrigt";
  let sourceCategory: string | undefined;
  let pendingLimitText: string | undefined;
  let lastOffer: Offer | undefined;

  for (const rawLine of lines) {
    const line = cleanText(rawLine);
    if (!line || isNoiseLine(line)) {
      continue;
    }

    const mappedCategory = mapCoopCategory(line);
    if (mappedCategory !== "Övrigt" && line.length <= 48) {
      category = mappedCategory;
      sourceCategory = line;
      pendingNameLines.length = 0;
      pendingLimitText = undefined;
      lastOffer = undefined;
      continue;
    }

    if (ORDINARY_PRICE_PATTERN.test(line)) {
      const ordinary = ordinaryPriceFrom(line);
      if (
        lastOffer &&
        ordinary &&
        (!ordinary.priceUnit ||
          !lastOffer.priceUnit ||
          ordinary.priceUnit === lastOffer.priceUnit)
      ) {
        lastOffer.regularPrice = ordinary.amount;
      }
      pendingNameLines.length = 0;
      continue;
    }

    let comparisonPriceText: string | undefined;
    let mechanicLine = line;
    const comparison = line.match(COMPARISON_PRICE_PATTERN);
    if (comparison && comparison.index !== undefined) {
      comparisonPriceText = cleanText(comparison[1]);
      mechanicLine = cleanText(line.slice(0, comparison.index));
      if (!mechanicLine || !parseMechanic(mechanicLine)) {
        if (lastOffer) {
          lastOffer.comparisonPriceText = comparisonPriceText;
        }
        pendingNameLines.length = 0;
        continue;
      }
    }
    if (LIMIT_PATTERN.test(line)) {
      if (lastOffer) {
        lastOffer.limitText = line;
      } else {
        pendingLimitText = [pendingLimitText, line].filter(Boolean).join(" ");
      }
      pendingNameLines.length = 0;
      continue;
    }

    const mechanic = parseMechanic(mechanicLine);
    if (!mechanic) {
      pendingNameLines.push(line);
      if (pendingNameLines.length > 3) {
        pendingNameLines.shift();
      }
      continue;
    }

    const rawName = mechanic.productPrefix || pendingNameLines.join(" ");
    const suffixProduct = productFromSuffix(mechanic.productSuffix ?? "");
    const product = rawName
      ? brandFrom(cleanText(rawName))
      : suffixProduct;
    if (!product.name) {
      throw new Error(
        `Coop-flyern för ${store.name} innehåller ett pris utan produktnamn.`,
      );
    }
    if (flyer.validTo < runDate || flyer.validFrom > weekEnd) {
      pendingNameLines.length = 0;
      continue;
    }

    const priceUnit = mechanic.priceUnit;
    const quantity = Math.max(1, mechanic.quantity);
    const hasUnitPrice = priceUnit === "kg" || priceUnit === "l";
    const price =
      mechanic.amount === undefined
        ? undefined
        : hasUnitPrice
          ? undefined
          : priceUnit === "st"
            ? mechanic.amount * quantity
            : mechanic.amount;
    const unitPrice =
      mechanic.amount === undefined
        ? undefined
        : hasUnitPrice || priceUnit === "st"
          ? mechanic.amount
          : mechanic.amount / quantity;
    const offer: Offer = {
      id: [
        "coop-pdf",
        encodeURIComponent(store.id.slice("Coop:".length)),
        encodeURIComponent(sourceId(flyer.source.id)),
        offers.length,
      ].join(":"),
      chain: "Coop",
      storeId: store.id,
      name: product.name,
      mechanicText: cleanText(
        [mechanic.text, suffixProduct.qualifierText].filter(Boolean).join(" "),
      ),
      category,
      validFrom: flyer.validFrom,
      validTo: flyer.validTo,
      sourceUrl: flyer.pdfUrl,
      ...(product.brand ? { brand: product.brand } : {}),
      ...(packageSizeFrom(product.name)
        ? { packageSize: packageSizeFrom(product.name) }
        : {}),
      ...(quantity > 1 ? { quantity } : {}),
      ...(price !== undefined ? { price } : {}),
      ...(unitPrice !== undefined ? { unitPrice } : {}),
      ...(priceUnit ? { priceUnit } : {}),
      ...(pendingLimitText ? { limitText: pendingLimitText } : {}),
      ...(comparisonPriceText ? { comparisonPriceText } : {}),
      ...(sourceCategory ? { sourceCategory } : {}),
    };
    offers.push(offer);
    lastOffer = offer;
    pendingLimitText = undefined;
    pendingNameLines.length = 0;
  }

  if (offers.length === 0) {
    throw new Error(
      `Coop-flyern för ${store.name} innehåller inga extraherbara erbjudanden.`,
    );
  }
  return offers;
}

async function extractPdfLines(bytes: Uint8Array): Promise<string[]> {
  if (
    bytes.byteLength < 8 ||
    Buffer.from(bytes.slice(0, 5)).toString("ascii") !== "%PDF-"
  ) {
    throw new Error("Coop-flyern är inte en giltig PDF.");
  }

  const loadingTask = getDocument({
    data: bytes,
    useSystemFonts: true,
  });
  try {
    const document = await loadingTask.promise;
    if (document.numPages === 0) {
      throw new Error("Coop-flyern saknar sidor.");
    }

    const lines: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const rows: TextLine[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) {
          continue;
        }
        const x = Number(item.transform[4]);
        const y = Number(item.transform[5]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          continue;
        }
        let row = rows.find((candidate) => Math.abs(candidate.y - y) <= 2.5);
        if (!row) {
          row = { y, parts: [] };
          rows.push(row);
        }
        row.parts.push({ x, value: item.str });
      }
      lines.push(
        ...rows
          .sort((left, right) => right.y - left.y)
          .map((row) =>
            row.parts
              .sort((left, right) => left.x - right.x)
              .map((part) => part.value)
              .join(" ")
              .replace(/\s+/gu, " ")
              .trim(),
          )
          .filter(Boolean),
      );
    }
    return lines;
  } catch {
    throw new Error("Coop-flyern kunde inte läsas som en text-PDF.");
  } finally {
    await loadingTask.destroy();
  }
}

async function refreshCoopFlyerPdf(
  location: CoopLocation,
  context: ChainRefreshContext,
): Promise<ChainRefreshResult> {
  let requestStarted = false;
  let discoveredStores: Store[] = [];
  const request = async (
    url: string,
    init: RequestInit,
    label: string,
  ): Promise<Response> => {
    if (requestStarted) {
      await context.sleep(COOP_PDF_REQUEST_DELAY_MS);
    }
    requestStarted = true;
    let response: Response;
    try {
      response = await context.fetcher(url, {
        ...init,
        credentials: "omit",
        redirect: "error",
      });
    } catch {
      throw new Error(`Coop kunde inte hämta ${label}.`);
    }
    if (!response.ok) {
      throw new Error(formatRequestError(response.status));
    }
    return response;
  };

  try {
    const pageResponse = await request(
      COOP_STORE_PAGE_URL,
      { method: "GET", headers: { Accept: "text/html" } },
      "Coops publika butikssida",
    );
    const page = await pageResponse.text();
    const storesScriptUrl = scriptUrlFromPublicPage(page);
    const scriptResponse = await request(
      storesScriptUrl,
      { method: "GET", headers: { Accept: "application/javascript" } },
      "Coops publika butikskonfiguration",
    );
    const script = await scriptResponse.text();
    const subscriptionKey = subscriptionKeyFromPublicConfig(page, script);
    const apiHeaders = {
      Accept: "application/json",
      "Ocp-Apim-Subscription-Key": subscriptionKey,
    };

    const mapResponse = await request(
      COOP_STORE_MAP_URL,
      { method: "GET", headers: apiHeaders },
      "Coops butikskarta",
    );
    const mapStores = mapStoresFromResponse(
      await responseJson(mapResponse, "butikskarta"),
    );
    const discovery = locationDiscovery(location);
    const matchingStores = discoverCoopStores(mapStores, discovery);
    discoveredStores = matchingStores.map((store) =>
      storeFromMap(store, discovery.exactCity.value),
    );
    const uniqueStores = new Map(
      discoveredStores.map((store) => [store.id, store]),
    );
    if (uniqueStores.size !== discoveredStores.length) {
      throw new Error("Coops butikskarta innehåller dubbla Store ids.");
    }

    const offers: Offer[] = [];
    const storeOfferIds = new Set<string>();
    for (const mapStore of matchingStores) {
      const ledgerAccountNumber = mapStore.ledgerAccountNumber;
      const detailUrl = new URL(
        `/external/store/stores/${encodeURIComponent(ledgerAccountNumber)}`,
        COOP_API_ORIGIN,
      );
      detailUrl.searchParams.set("api-version", "v7");
      detailUrl.searchParams.set("onlyVisibleOpeningHours", "true");
      detailUrl.searchParams.set("includeFlyers", "true");
      const detailResponse = await request(
        detailUrl.toString(),
        { method: "GET", headers: apiHeaders },
        `butiksuppgifter för ${mapStore.name}`,
      );
      const details = parseResponse(
        CoopStoreDetailsSchema,
        await responseJson(detailResponse, `butiksuppgifter för ${mapStore.name}`),
        `butiksuppgifter för ${mapStore.name}`,
      );
      if (
        sourceId(details.id) !== sourceId(mapStore.storeId) ||
        details.ledgerAccountNumber !== ledgerAccountNumber
      ) {
        throw new Error(
          `Coops butiksuppgifter kunde inte kopplas till ${mapStore.name}.`,
        );
      }
      if (
        details.city &&
        details.city.trim() !== mapStore.city.trim()
      ) {
        throw new Error(
          `Coops butiksuppgifter placerade ${mapStore.name} i fel stad.`,
        );
      }

      const store = storeFromDetails(
        details,
        mapStore,
        discovery.exactCity.value,
      );
      uniqueStores.set(store.id, store);
      const flyers = currentFlyers(
        store,
        details,
        context.runDate,
        context.offerWeekEnd,
      );
      for (const flyer of flyers) {
        const pdfResponse = await request(
          flyer.pdfUrl,
          { method: "GET", headers: { Accept: "application/pdf" } },
          `PDF-flyer för ${store.name}`,
        );
        const contentType = pdfResponse.headers
          .get("content-type")
          ?.split(";", 1)[0]
          .trim()
          .toLowerCase();
        if (
          contentType &&
          contentType !== "application/pdf" &&
          contentType !== "application/octet-stream"
        ) {
          throw new Error(
            `Coops flyer för ${store.name} returnerade inte en PDF.`,
          );
        }
        const contentLength = Number(pdfResponse.headers.get("content-length"));
        if (Number.isFinite(contentLength) && contentLength > COOP_MAX_PDF_BYTES) {
          throw new Error(`Coops PDF-flyer för ${store.name} är för stor.`);
        }
        const bytes = new Uint8Array(await pdfResponse.arrayBuffer());
        if (bytes.byteLength > COOP_MAX_PDF_BYTES) {
          throw new Error(`Coops PDF-flyer för ${store.name} är för stor.`);
        }
        const lines = await extractPdfLines(bytes);
        const flyerOffers = parseFlyerOffers(
          lines,
          store,
          flyer,
          context.runDate,
          context.offerWeekEnd,
        );
        for (const offer of flyerOffers) {
          if (storeOfferIds.has(offer.id)) {
            throw new Error(`Coop-flyern innehåller dubbla Offer ids (${store.name}).`);
          }
          storeOfferIds.add(offer.id);
          offers.push(offer);
        }
      }
    }

    return { stores: [...uniqueStores.values()], offers };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Okänt fel.";
    throw new ChainRefreshError(message.slice(0, 240), discoveredStores);
  }
}

export const COOP_FLYER_PDF_SOURCE_ADAPTER: ChainSourceAdapter<CoopLocation> = {
  chain: "Coop",
  source: COOP_FLYER_PDF_SOURCE,
  refresh: refreshCoopFlyerPdf,
};

export function buildCoopFlyerPdfSnapshot(
  location: CoopLocation,
  dependencies: SnapshotJobDependencies = {},
): Promise<Snapshot> {
  return buildSnapshot(location, [COOP_FLYER_PDF_SOURCE_ADAPTER], dependencies);
}
