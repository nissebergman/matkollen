import type { Chain } from "../domain/snapshot";
import type { StoreDiscoveryConfig } from "./config";

function sourceField(value: unknown, path: string): unknown {
  let current = value;
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

export function discoverStores<T>(
  stores: readonly T[],
  discovery: StoreDiscoveryConfig,
  chain: Chain,
  sourceStoreId: (store: T) => string,
): T[] {
  const prefix = `${chain}:`;
  const normalizeOverrideId = (id: string) =>
    id.startsWith(prefix) ? id.slice(prefix.length) : id;
  const pinIds = new Set(
    (discovery.pinStoreIds ?? []).map(normalizeOverrideId),
  );
  const excludeIds = new Set(
    (discovery.excludeStoreIds ?? []).map(normalizeOverrideId),
  );
  const availableIds = new Set(stores.map(sourceStoreId));
  const missingPins = [...pinIds].filter((id) => !availableIds.has(id));
  if (missingPins.length) {
    throw new Error(
      `Konfigurerade ${chain}-butiker hittades inte: ${missingPins.join(", ")}.`,
    );
  }

  const matchesCity = (store: T) =>
    sourceField(store, discovery.exactCity.field) === discovery.exactCity.value;
  if (!stores.some(matchesCity) && pinIds.size === 0) {
    throw new Error(
      `Inga ${chain}-butiker hittades för ${discovery.exactCity.value}.`,
    );
  }

  return stores.filter((store) => {
    const id = sourceStoreId(store);
    return !excludeIds.has(id) && (pinIds.has(id) || matchesCity(store));
  });
}
