import { z } from "zod";
import { CHAINS } from "../domain/snapshot";
import sourceConfig from "./locations.json";

const cityField = z
  .string()
  .min(1)
  .refine((value) =>
    value.split(".").every(
      (part) =>
        /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(part) &&
        !["__proto__", "prototype", "constructor"].includes(part),
    ),
  );

const StoreDiscoverySchema = z
  .object({
    exactCity: z
      .object({
        field: cityField,
        value: z.string().trim().min(1),
      })
      .strict(),
    pinStoreIds: z.array(z.string().trim().min(1)).optional(),
    excludeStoreIds: z.array(z.string().trim().min(1)).optional(),
  })
  .strict();

const ChainLocationSchema = z
  .object({
    source: z.string().trim().min(1),
    storeDiscovery: StoreDiscoverySchema,
  })
  .strict();

const chainsSchema = z
  .object({
    ICA: ChainLocationSchema.optional(),
    Coop: ChainLocationSchema.optional(),
    Hemköp: ChainLocationSchema.optional(),
  })
  .strict()
  .refine((chains) => CHAINS.some((chain) => chains[chain] !== undefined));

const LocationSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: z.string().trim().min(1),
    chains: chainsSchema,
  })
  .strict();

const LocationRegistrySchema = z
  .object({
    defaultLocationId: z.string().min(1),
    locations: z.array(LocationSchema).min(1),
  })
  .strict()
  .superRefine((registry, context) => {
    const ids = new Set<string>();
    for (const [index, location] of registry.locations.entries()) {
      if (ids.has(location.id)) {
        context.addIssue({
          code: "custom",
          message: "Location ids must be unique",
          path: ["locations", index, "id"],
        });
      }
      ids.add(location.id);
    }
    if (!ids.has(registry.defaultLocationId)) {
      context.addIssue({
        code: "custom",
        message: "The default Location must be configured",
        path: ["defaultLocationId"],
      });
    }
  });

export type StoreDiscoveryConfig = z.infer<typeof StoreDiscoverySchema>;
export type ChainLocationConfig = z.infer<typeof ChainLocationSchema>;
export type LocationConfig = z.infer<typeof LocationSchema>;
export type LocationRegistry = z.infer<typeof LocationRegistrySchema>;

export const LOCATION_REGISTRY = LocationRegistrySchema.parse(sourceConfig);
export const LOCATIONS = LOCATION_REGISTRY.locations;
export const DEFAULT_LOCATION_ID = LOCATION_REGISTRY.defaultLocationId;
