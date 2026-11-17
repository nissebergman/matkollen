import type { Snapshot } from "../domain/snapshot";
import type { StoreDiscoveryConfig } from "./config";
import {
  buildSnapshot,
  type ChainRefreshContext,
  type ChainRefreshResult,
  type ChainSourceAdapter,
  type SnapshotJobDependencies,
} from "./runner";
import {
  createTjekSourceAdapter,
  type TjekLocation,
} from "./tjek";

export { TJEK_REQUEST_DELAY_MS } from "./tjek";
export const COOP_TJEK_SOURCE = "coop-tjek";

export interface CoopLocation extends TjekLocation {}

export type CoopJobDependencies = SnapshotJobDependencies;

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

export const COOP_SOURCE_ADAPTER: ChainSourceAdapter<CoopLocation> = {
  chain: "Coop",
  source: COOP_TJEK_SOURCE,
  refresh(
    location: CoopLocation,
    context: ChainRefreshContext,
  ): Promise<ChainRefreshResult> {
    return createTjekSourceAdapter<CoopLocation>(
      "Coop",
      discoveryFor(location),
      COOP_TJEK_SOURCE,
    ).refresh(location, context);
  },
};

export function buildCoopSnapshot(
  location: CoopLocation,
  dependencies: CoopJobDependencies = {},
): Promise<Snapshot> {
  return buildSnapshot(location, [COOP_SOURCE_ADAPTER], dependencies);
}
