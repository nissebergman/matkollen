import { z } from "zod";
import { CATEGORIES } from "./categories";

export const SCHEMA_VERSION = 1;
export const CHAINS = ["ICA", "Coop", "Hemköp"] as const;
export const PRICE_UNITS = ["st", "kg", "l"] as const;

export type Chain = (typeof CHAINS)[number];

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  });
const isoDateTime = z.string().datetime({ offset: true });

export const OfferSchema = z
  .object({
    id: z.string().min(1),
    chain: z.enum(CHAINS),
    storeId: z.string().min(1),
    name: z.string().min(1),
    mechanicText: z.string().min(1),
    category: z.enum(CATEGORIES),
    validTo: isoDate,
    sourceUrl: z.string().url().refine((value) => value.startsWith("https://")),
    brand: z.string().min(1).optional(),
    packageSize: z.string().min(1).optional(),
    quantity: z.number().int().positive().optional(),
    price: z.number().finite().nonnegative().optional(),
    unitPrice: z.number().finite().nonnegative().optional(),
    priceUnit: z.enum(PRICE_UNITS).optional(),
    regularPrice: z.number().finite().nonnegative().optional(),
    comparisonPriceText: z.string().min(1).optional(),
    limitText: z.string().min(1).optional(),
    validFrom: isoDate.optional(),
    imageUrl: z.string().url().refine((value) => value.startsWith("https://")).optional(),
    sourceCategory: z.string().optional(),
  })
  .strict()
  .superRefine((offer, context) => {
    if (offer.validFrom && offer.validFrom > offer.validTo) {
      context.addIssue({
        code: "custom",
        message: "validFrom must not be later than validTo",
        path: ["validFrom"],
      });
    }
  });

export const StoreSchema = z
  .object({
    id: z.string().min(1),
    chain: z.enum(CHAINS),
    name: z.string().min(1),
    address: z.string().min(1),
  })
  .strict();

export const ChainStatusSchema = z
  .object({
    chain: z.enum(CHAINS),
    source: z.string().min(1),
    status: z.enum(["ok", "stale", "failed"]),
    lastAttemptAt: isoDateTime,
    lastSuccessAt: isoDateTime.nullable(),
    error: z.string().min(1).optional(),
  })
  .strict();

export const SnapshotSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    location: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
      })
      .strict(),
    generatedAt: isoDateTime,
    chains: z.array(ChainStatusSchema),
    stores: z.array(StoreSchema),
    offers: z.array(OfferSchema),
  })
  .strict()
  .superRefine((snapshot, context) => {
    const chainIds = new Set<string>();
    for (const [index, chain] of snapshot.chains.entries()) {
      if (chainIds.has(chain.chain)) {
        context.addIssue({
          code: "custom",
          message: "A Chain can appear only once",
          path: ["chains", index, "chain"],
        });
      }
      chainIds.add(chain.chain);
    }

    const stores = new Map<string, (typeof snapshot.stores)[number]>();
    for (const [index, store] of snapshot.stores.entries()) {
      if (!chainIds.has(store.chain)) {
        context.addIssue({
          code: "custom",
          message: "Store must refer to a Chain in the Snapshot",
          path: ["stores", index, "chain"],
        });
      }
      if (stores.has(store.id)) {
        context.addIssue({
          code: "custom",
          message: "Store ids must be unique",
          path: ["stores", index, "id"],
        });
      }
      stores.set(store.id, store);
    }

    const offerIds = new Set<string>();
    for (const [index, offer] of snapshot.offers.entries()) {
      if (!chainIds.has(offer.chain)) {
        context.addIssue({
          code: "custom",
          message: "Offer must refer to a Chain in the Snapshot",
          path: ["offers", index, "chain"],
        });
      }
      if (offerIds.has(offer.id)) {
        context.addIssue({
          code: "custom",
          message: "Offer ids must be unique",
          path: ["offers", index, "id"],
        });
      }
      offerIds.add(offer.id);

      const store = stores.get(offer.storeId);
      if (!store || store.chain !== offer.chain) {
        context.addIssue({
          code: "custom",
          message: "Offer must refer to a Store in the same Chain",
          path: ["offers", index, "storeId"],
        });
      }
    }
  });

export type Offer = z.infer<typeof OfferSchema>;
export type Store = z.infer<typeof StoreSchema>;
export type ChainStatus = z.infer<typeof ChainStatusSchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;

export function parseSnapshot(value: unknown): Snapshot {
  return SnapshotSchema.parse(value);
}
