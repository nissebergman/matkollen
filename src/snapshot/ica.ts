import { z } from "zod";
import { mapIcaCategory } from "../domain/categories";
import { stockholmDate } from "../domain/date";
import {
  SCHEMA_VERSION,
  SnapshotSchema,
  type Offer,
  type Snapshot,
  type Store,
} from "../domain/snapshot";
import type {
  LocationConfig,
  StoreDiscoveryConfig,
} from "./config";
import { discoverStores } from "./store-discovery";

export const ICA_REQUEST_DELAY_MS = 1_000;

export const ICA_SOURCE = "ica-first-party";
const ICA_ORIGIN = "https://www.ica.se";
const ICA_STORE_SEARCH_ORIGIN = "https://apim-pub.gw.ica.se";

export type IcaLocation = Pick<LocationConfig, "id" | "name">;

export interface IcaJobDependencies {
  fetcher?: typeof fetch;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
  previousSnapshot?: unknown;
}

const optionalText = z.string().nullable().optional();
const nonBlankText = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0);
const sourceIdentifier = z.union([
  nonBlankText,
  z.number().int().nonnegative(),
]);
const optionalIdentifier = z.union([
  z.string().min(1),
  z.number().int().nonnegative(),
  z.null(),
]).optional();

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
  const numericTokens = normalized.match(/\d[\d\s.,:]*\d|\d/g);
  if (!numericTokens || numericTokens.length !== 1) {
    return undefined;
  }

  let amount = numericTokens[0].replace(/[\s\u00a0]/g, "");
  const colon = amount.lastIndexOf(":");
  if (colon >= 0) {
    if (amount.includes(",") || amount.includes(".") || amount.indexOf(":") !== colon) {
      return undefined;
    }
    amount = `${amount.slice(0, colon)}.${amount.slice(colon + 1)}`;
  }
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

const optionalAmount = z
  .union([
    z.number().finite().nonnegative(),
    z.string().refine((value) => parseAmount(value) !== undefined),
    z.null(),
  ])
  .optional();

const IcaStoreSearchRecordSchema = z
  .object({
    id: sourceIdentifier,
    name: nonBlankText,
    marketingName: nonBlankText.optional(),
    visitingCity: nonBlankText,
    accountNumber: z.union([nonBlankText, z.number().int().nonnegative()]).optional(),
    url: z.string().url().optional(),
    urls: z
      .array(
        z
          .object({
            type: nonBlankText,
            url: nonBlankText,
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

const IcaStoreSearchPageSchema = z
  .object({
    documents: z.array(IcaStoreSearchRecordSchema),
    stats: z
      .object({
        totalHits: z.number().int().nonnegative(),
      })
      .passthrough(),
  })
  .passthrough();

const IcaTokenSchema = z
  .object({
    isAnonymous: z.boolean().optional(),
    token: optionalText,
    accessToken: optionalText,
    access_token: optionalText,
  })
  .passthrough();

const IcaOfferStoreSchema = z
  .object({
    BMSStoreId: optionalIdentifier,
    regularPrice: optionalAmount,
    referencePriceText: optionalText,
  })
  .passthrough();

const IcaOfferSchema = z
  .object({
    id: optionalIdentifier,
    details: z
      .object({
        name: nonBlankText,
        mechanicInfo: nonBlankText,
        brand: optionalText,
        packageInformation: optionalText,
        limitText: optionalText,
      })
      .passthrough(),
    category: z
      .object({
        articleGroupName: optionalText,
      })
      .passthrough()
      .nullable()
      .optional(),
    validFrom: z.string().min(1).nullable().optional(),
    validTo: nonBlankText,
    comparisonPrice: z.union([z.string(), z.number().finite(), z.null()]).optional(),
    parsedMechanics: z
      .object({
        quantity: z
          .union([
            z.number().int().positive(),
            z.string().regex(/^[1-9]\d*$/),
            z.null(),
          ])
          .optional(),
        value4: optionalText,
      })
      .passthrough()
      .nullable()
      .optional(),
    stores: z.array(IcaOfferStoreSchema).optional(),
    picture: z
      .object({
        baseUrl: optionalText,
        fileName: optionalText,
      })
      .passthrough()
      .nullable()
      .optional(),
    eans: z
      .array(
        z
          .object({
            image: optionalText,
          })
          .passthrough(),
      )
      .optional(),
    traits: z.array(z.string()).optional(),
    limitText: optionalText,
  })
  .passthrough();

type IcaStoreSearchRecord = z.infer<typeof IcaStoreSearchRecordSchema>;
type IcaOffer = z.infer<typeof IcaOfferSchema>;

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function sourceText(value: string | null | undefined): string | undefined {
  const text = value?.trim();
  return text || undefined;
}

function describeValidationError(error: z.ZodError): string {
  const issue = error.issues[0];
  const path = issue.path.length ? issue.path.join(".") : "response";
  return `fältet ${path} har ett oväntat format`;
}

function parseResponse<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`Ogiltigt svar från ICA (${label}): ${describeValidationError(result.error)}.`);
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

function dateFromSource(value: string | null | undefined): string | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  const date = value.trim().match(/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/)?.[1];
  return date && isIsoDate(date) ? date : undefined;
}

function currentOfferWeekEnd(today: string): string {
  const day = new Date(`${today}T00:00:00.000Z`).getUTCDay();
  const daysUntilSunday = (7 - day) % 7;
  const end = new Date(`${today}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + daysUntilSunday);
  return end.toISOString().slice(0, 10);
}

function balancedValueAt(source: string, start: number): string | undefined {
  const first = source[start];
  if (first !== "{" && first !== "[") {
    return undefined;
  }

  const expectedClosers: string[] = [];
  let quote: string | undefined;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = undefined;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "{") {
      expectedClosers.push("}");
    } else if (character === "[") {
      expectedClosers.push("]");
    } else if (character === "}" || character === "]") {
      if (expectedClosers.pop() !== character) {
        return undefined;
      }
      if (expectedClosers.length === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  return undefined;
}

function readQuoted(source: string, start: number): { value: string; next: number } | undefined {
  const quote = source[start];
  if (quote !== '"' && quote !== "'") {
    return undefined;
  }
  let escaped = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === quote) {
      const raw = source.slice(start, index + 1);
      try {
        return {
          value: quote === '"' ? JSON.parse(raw) as string : raw.slice(1, -1),
          next: index + 1,
        };
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function propertyValue(source: string, property: string): string | undefined {
  if (source[0] !== "{") {
    return undefined;
  }

  let index = 1;
  while (index < source.length) {
    while (/\s|,/.test(source[index] ?? "")) {
      index += 1;
    }
    if (source[index] === "}") {
      return undefined;
    }

    let key: string | undefined;
    const quoted = readQuoted(source, index);
    if (quoted) {
      key = quoted.value;
      index = quoted.next;
    } else {
      const identifier = source.slice(index).match(/^[A-Za-z_$][\w$]*/)?.[0];
      if (!identifier) {
        return undefined;
      }
      key = identifier;
      index += identifier.length;
    }

    while (/\s/.test(source[index] ?? "")) {
      index += 1;
    }
    if (source[index] !== ":") {
      return undefined;
    }
    index += 1;
    while (/\s/.test(source[index] ?? "")) {
      index += 1;
    }

    const valueStart = index;
    if (key === property) {
      return balancedValueAt(source, valueStart);
    }

    const character = source[index];
    if (character === "{" || character === "[") {
      const value = balancedValueAt(source, index);
      if (!value) {
        return undefined;
      }
      index += value.length;
    } else if (character === '"' || character === "'") {
      const value = readQuoted(source, index);
      if (!value) {
        return undefined;
      }
      index = value.next;
    } else {
      while (index < source.length && source[index] !== "," && source[index] !== "}") {
        index += 1;
      }
    }
  }
  return undefined;
}

function weeklyOffersFromHtml(html: string): unknown {
  const marker = "window.__INITIAL_DATA__";
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error("ICA:sidan saknar det förväntade erbjudandetillståndet.");
  }
  const stateStart = html.indexOf("{", markerIndex + marker.length);
  const state = stateStart >= 0 ? balancedValueAt(html, stateStart) : undefined;
  if (!state) {
    throw new Error("ICA:sidans inbäddade data har ett oväntat format.");
  }

  const offers = propertyValue(state, "offers");
  const weeklyOffers = offers ? propertyValue(offers, "weeklyOffers") : undefined;
  if (!weeklyOffers || weeklyOffers[0] !== "[") {
    throw new Error("ICA:sidan saknar veckans erbjudanden i det förväntade formatet.");
  }
  try {
    return JSON.parse(weeklyOffers) as unknown;
  } catch {
    throw new Error("ICA:sidans erbjudandelista innehåller ogiltig JSON.");
  }
}

function sourceStoreId(store: IcaStoreSearchRecord): string {
  return String(store.id);
}

function offerPageUrl(store: IcaStoreSearchRecord): string {
  const offerUrl = store.urls?.find((entry) => entry.type === "Erbjudande")?.url;
  if (offerUrl) {
    let url: URL;
    try {
      url = new URL(offerUrl, ICA_ORIGIN);
    } catch {
      throw new Error(`ICA-butiken "${store.name}" har en ogiltig erbjudandelänk.`);
    }
    if (url.origin !== ICA_ORIGIN || !url.pathname.startsWith("/erbjudanden/")) {
      throw new Error(`ICA-butiken "${store.name}" har en ogiltig erbjudandelänk.`);
    }
    if (!url.pathname.endsWith("/")) {
      url.pathname = `${url.pathname}/`;
    }
    return url.toString();
  }

  if (store.accountNumber === undefined) {
    throw new Error(`ICA-butiken "${store.name}" saknar en erbjudandelänk.`);
  }
  const name = store.marketingName ?? store.name;
  const slug = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, " och ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) {
    throw new Error(`ICA-butiken "${store.name}" saknar en giltig erbjudandelänk.`);
  }
  return new URL(
    `/erbjudanden/${slug}-${encodeURIComponent(String(store.accountNumber))}/`,
    ICA_ORIGIN,
  ).toString();
}

function storeFromSource(source: IcaStoreSearchRecord): Store {
  return {
    id: `ICA:${sourceStoreId(source)}`,
    chain: "ICA",
    name: (source.marketingName ?? source.name).trim(),
    address: source.visitingCity.trim(),
  };
}

function amountFromMechanic(text: string): number | undefined {
  const price = text.match(/(\d[\d\s.,:]*\d|\d)\s*kr\b/i);
  return price ? parseAmount(price[1]) : undefined;
}

function positiveInteger(value: number | undefined): number | undefined {
  return value && Number.isInteger(value) && value > 0 ? value : undefined;
}

function quantityFor(offer: IcaOffer, text: string): number {
  const multiBuy = text.match(/(\d+)\s*för\s*\d+/iu);
  const fromText = multiBuy ? Number(multiBuy[1]) : undefined;
  const fromMechanics = offer.parsedMechanics?.quantity;
  const parsedQuantity =
    typeof fromMechanics === "number"
      ? fromMechanics
      : typeof fromMechanics === "string"
        ? Number(fromMechanics)
        : undefined;
  return positiveInteger(fromText) ?? positiveInteger(parsedQuantity) ?? 1;
}

function priceUnitFrom(offer: IcaOffer, text: string): Offer["priceUnit"] {
  const value = `${text} ${offer.parsedMechanics?.value4 ?? ""}`.toLowerCase();
  if (/(?:\/|\b)kg\b/.test(value)) {
    return "kg";
  }
  if (/(?:\/|\b)l\b|liter/.test(value)) {
    return "l";
  }
  if (/(?:\/|\b)st\b|styck/.test(value)) {
    return "st";
  }
  return undefined;
}

function dateOrFail(value: string | null | undefined, label: string): string {
  const date = dateFromSource(value);
  if (!date) {
    throw new Error(`ICA-erbjudandet "${label}" har ett ogiltigt giltighetsdatum.`);
  }
  return date;
}

function storeOfferDetails(
  offer: IcaOffer,
  storeId: string,
): z.infer<typeof IcaOfferStoreSchema> | undefined {
  return offer.stores?.find(
    (store) =>
      store.BMSStoreId !== null &&
      store.BMSStoreId !== undefined &&
      String(store.BMSStoreId) === storeId,
  );
}

function amountFromReferencePrice(value: string | null | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const price = value.match(/(\d[\d\s.,:]*\d|\d)\s*kr\b/i);
  return price ? parseAmount(price[1]) : undefined;
}

function imageUrl(offer: IcaOffer): string | undefined {
  const eanImage = offer.eans
    ?.map((ean) => sourceText(ean.image))
    .find((value) => value?.startsWith("https://"));
  return eanImage;
}

function stableOfferId(storeId: string, offer: IcaOffer, text: string): string {
  const sourceId =
    offer.id ??
    `${offer.details.name}:${text}:${offer.validFrom ?? ""}:${offer.validTo}`;
  return `ica:${encodeURIComponent(storeId)}:${encodeURIComponent(String(sourceId))}`;
}

function normalizeOffer(
  store: IcaStoreSearchRecord,
  offer: IcaOffer,
  sourceUrl: string,
  runDate: string,
  weekEnd: string,
): Offer | undefined {
  const text = offer.details.mechanicInfo.trim();
  const validFrom =
    offer.validFrom === undefined || offer.validFrom === null
      ? undefined
      : dateOrFail(offer.validFrom, offer.details.name);
  const validTo = dateOrFail(offer.validTo, offer.details.name);
  if (validFrom && validFrom > validTo) {
    throw new Error(`ICA-erbjudandet "${offer.details.name}" har ett ogiltigt giltighetsintervall.`);
  }
  if (validTo < runDate || (validFrom && validFrom > weekEnd)) {
    return undefined;
  }

  const storeId = `ICA:${sourceStoreId(store)}`;
  const sourceStore = storeOfferDetails(offer, sourceStoreId(store));
  const quantity = quantityFor(offer, text);
  const price = amountFromMechanic(text);
  const regularPrice =
    parseAmount(sourceStore?.regularPrice) ??
    amountFromReferencePrice(sourceStore?.referencePriceText);
  const comparisonPrice =
    typeof offer.comparisonPrice === "string"
      ? sourceText(offer.comparisonPrice)
      : offer.comparisonPrice === undefined || offer.comparisonPrice === null
        ? undefined
        : String(offer.comparisonPrice);
  const brand = sourceText(offer.details.brand);
  const packageSize = sourceText(offer.details.packageInformation);
  const limitText =
    sourceText(offer.limitText) ?? sourceText(offer.details.limitText);
  const sourceCategory = sourceText(offer.category?.articleGroupName);
  const image = imageUrl(offer);
  const priceUnit = priceUnitFrom(offer, text);

  return {
    id: stableOfferId(storeId, offer, text),
    chain: "ICA",
    storeId,
    name: offer.details.name.trim(),
    mechanicText: text,
    category: mapIcaCategory(sourceCategory),
    validTo,
    sourceUrl,
    quantity,
    ...(brand ? { brand } : {}),
    ...(packageSize ? { packageSize } : {}),
    ...(price !== undefined ? { price, unitPrice: price / quantity } : {}),
    ...(priceUnit ? { priceUnit } : {}),
    ...(regularPrice !== undefined ? { regularPrice } : {}),
    ...(comparisonPrice ? { comparisonPriceText: comparisonPrice } : {}),
    ...(limitText ? { limitText } : {}),
    ...(validFrom ? { validFrom } : {}),
    ...(image ? { imageUrl: image } : {}),
    ...(sourceCategory ? { sourceCategory } : {}),
  };
}

function requestedStoreSearchUrl(city: string, offset: number): string {
  const url = new URL(
    "/sverige/digx/storesearch/v1/searchbyquery",
    ICA_STORE_SEARCH_ORIGIN,
  );
  url.searchParams.set("query", city);
  url.searchParams.set("take", "100");
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("onlyOnline", "false");
  url.searchParams.set("onlyOnlineB2B", "false");
  return url.toString();
}

function responseError(status: number, label: string): string {
  if (status === 403 || status === 429) {
    return `ICA nekade begäran för ${label} (HTTP ${status}); uppdateringen avbryts utan återförsök.`;
  }
  return `ICA svarade med HTTP ${status} vid hämtning av ${label}.`;
}

function getPreviousIcaSnapshot(
  value: unknown,
  locationId: string,
): { snapshot: Snapshot; source: Snapshot["chains"][number] } | undefined {
  const result = SnapshotSchema.safeParse(value);
  if (!result.success || result.data.location.id !== locationId) {
    return undefined;
  }
  const source = result.data.chains.find((chain) => chain.chain === "ICA");
  return source ? { snapshot: result.data, source } : undefined;
}

export async function buildIcaSnapshot(
  location: IcaLocation,
  discovery: StoreDiscoveryConfig,
  dependencies: IcaJobDependencies = {},
): Promise<Snapshot> {
  const fetcher = dependencies.fetcher ?? globalThis.fetch;
  const now = dependencies.now ?? (() => new Date());
  const sleep = dependencies.sleep ?? defaultSleep;
  const attemptAt = now().toISOString();
  const runDate = stockholmDate(new Date(attemptAt));
  const weekEnd = currentOfferWeekEnd(runDate);
  let requestStarted = false;
  let discoveredStores: Store[] = [];

  const request = async (
    url: string,
    label: string,
    headers: Record<string, string> = {},
  ): Promise<Response> => {
    if (requestStarted) {
      await sleep(ICA_REQUEST_DELAY_MS);
    }
    requestStarted = true;
    const response = await fetcher(url, {
      method: "GET",
      headers: { Accept: "application/json", ...headers },
      credentials: "omit",
    });
    if (!response.ok) {
      throw new Error(responseError(response.status, label));
    }
    return response;
  };

  const responseJson = async (
    url: string,
    label: string,
    headers: Record<string, string> = {},
  ): Promise<unknown> => {
    const response = await request(url, label, headers);
    try {
      return await response.json();
    } catch {
      throw new Error(`ICA svarade inte med giltig JSON vid hämtning av ${label}.`);
    }
  };

  try {
    const tokenResponse = parseResponse(
      IcaTokenSchema,
      await responseJson(`${ICA_ORIGIN}/e11/public-access-token`, "anonym åtkomsttoken"),
      "anonym åtkomsttoken",
    );
    const accessToken =
      sourceText(tokenResponse.accessToken) ??
      sourceText(tokenResponse.access_token) ??
      sourceText(tokenResponse.token);
    if (tokenResponse.isAnonymous !== true || !accessToken) {
      throw new Error("ICA:s åtkomsttoken är inte märkt som anonym.");
    }

    const sourceStores: IcaStoreSearchRecord[] = [];
    let offset = 0;
    let totalHits: number | undefined;
    do {
      const page = parseResponse(
        IcaStoreSearchPageSchema,
        await responseJson(
          requestedStoreSearchUrl(discovery.exactCity.value, offset),
          "butikslistan",
          { Authorization: `Bearer ${accessToken}` },
        ),
        "butikslistan",
      );
      if (totalHits === undefined) {
        totalHits = page.stats.totalHits;
      } else if (page.stats.totalHits !== totalHits) {
        throw new Error("ICA:s butikslista ändrades under hämtningen.");
      }
      sourceStores.push(...page.documents);
      offset += page.documents.length;
      if (offset > totalHits) {
        throw new Error("ICA:s butikslista innehåller fler poster än rapporterat.");
      }
      if (page.documents.length === 0 && offset < totalHits) {
        throw new Error("ICA:s butikslista saknar en förväntad sida.");
      }
    } while (offset < (totalHits ?? 0));

    const matchingStores = discoverStores(
      sourceStores,
      discovery,
      "ICA",
      sourceStoreId,
    );
    const mappedStores = matchingStores.map(storeFromSource);
    discoveredStores = [...new Map(mappedStores.map((store) => [store.id, store])).values()];
    if (discoveredStores.length !== mappedStores.length) {
      throw new Error("ICA:s butikslista innehåller dubbla Store ids.");
    }

    const offers: Offer[] = [];
    const offersByStore = new Map<string, number>();
    for (const sourceStore of matchingStores) {
      const sourceId = sourceStoreId(sourceStore);
      const storeId = `ICA:${sourceId}`;
      const sourceUrl = offerPageUrl(sourceStore);
      const pageResponse = await request(sourceUrl, "butikens erbjudanden", {
        Accept: "text/html",
      });
      let html: string;
      try {
        html = await pageResponse.text();
      } catch {
        throw new Error("ICA svarade inte med giltig HTML för butikens erbjudanden.");
      }
      const sourceOffers = parseResponse(
        z.array(IcaOfferSchema),
        weeklyOffersFromHtml(html),
        "veckans erbjudanden",
      );
      let storeOfferCount = 0;
      for (const sourceOffer of sourceOffers) {
        const offer = normalizeOffer(
          sourceStore,
          sourceOffer,
          sourceUrl,
          runDate,
          weekEnd,
        );
        if (offer) {
          offers.push(offer);
          storeOfferCount += 1;
        }
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
          chain: "ICA",
          source: ICA_SOURCE,
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
    const previous = getPreviousIcaSnapshot(
      dependencies.previousSnapshot,
      location.id,
    );
    const canReusePrevious =
      previous?.source.source === ICA_SOURCE &&
      previous.source.status !== "failed";
    const previousOffers =
      (canReusePrevious ? previous?.snapshot.offers : undefined)?.filter(
        (offer) =>
          offer.chain === "ICA" &&
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
          chain: "ICA",
          source: ICA_SOURCE,
          status: stale ? "stale" : "failed",
          lastAttemptAt: attemptAt,
          lastSuccessAt: canReusePrevious
            ? previous?.source.lastSuccessAt ?? null
            : null,
          error: message.slice(0, 240),
        },
      ],
      stores: stale
        ? previous?.snapshot.stores.filter((store) => store.chain === "ICA") ?? []
        : discoveredStores,
      offers: stale ? previousOffers : [],
    });
  }
}
