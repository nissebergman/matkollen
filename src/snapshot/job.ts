import {
  CHAINS,
  type Snapshot,
} from "../domain/snapshot";
import {
  COOP_TJEK_SOURCE,
  type CoopLocation,
} from "./coop";
import {
  COOP_FLYER_PDF_SOURCE,
  COOP_FLYER_PDF_SOURCE_ADAPTER,
} from "./coop-pdf";
import { buildIcaSnapshot, ICA_SOURCE } from "./ica";
import type { LocationConfig } from "./config";
import {
  createTjekSourceAdapter,
  TJEK_SOURCE,
} from "./tjek";
import {
  ChainRefreshError,
  buildSnapshot,
  type ChainSourceAdapter,
  type SnapshotJobDependencies as RunnerJobDependencies,
} from "./runner";
import {
  HEMKOP_SOURCE,
  HEMKOP_SOURCE_ADAPTER,
  type HemkopLocation,
} from "./hemkop";

export interface SnapshotJobDependencies extends RunnerJobDependencies {
  previousSnapshots?: Readonly<Record<string, unknown>>;
}

export function snapshotLocationFromConfig(
  location: LocationConfig,
): HemkopLocation {
  const hemkopConfiguration = location.chains.Hemköp;
  return {
    id: location.id,
    name: location.name,
    ...(hemkopConfiguration
      ? {
          city: hemkopConfiguration.storeDiscovery.exactCity.value,
          storeDiscovery: hemkopConfiguration.storeDiscovery,
        }
      : {}),
  };
}

export function snapshotAdaptersFromConfig(
  location: LocationConfig,
): ChainSourceAdapter<HemkopLocation>[] {
  const adapters: ChainSourceAdapter<HemkopLocation>[] = [];

  for (const chain of CHAINS) {
    const configuration = location.chains[chain];
    if (!configuration) {
      continue;
    }

    if (chain === "ICA" && configuration.source === ICA_SOURCE) {
      const discovery = configuration.storeDiscovery;
      adapters.push({
        chain,
        source: ICA_SOURCE,
        async refresh(location, context) {
          const snapshot = await buildIcaSnapshot(
            { id: location.id, name: location.name },
            discovery,
            {
              fetcher: context.fetcher,
              now: context.now,
              sleep: context.sleep,
              waitForRequest: context.waitForRequest,
            },
          );
          const status = snapshot.chains.find(
            (chainStatus) => chainStatus.chain === "ICA",
          );
          // Surface ICA failures so the shared runner can apply stale-data fallback.
          if (!status || status.status !== "ok") {
            throw new ChainRefreshError(
              status?.error ?? "ICA-källan returnerade ingen lyckad uppdatering.",
              snapshot.stores,
            );
          }
          return {
            stores: snapshot.stores,
            offers: snapshot.offers,
            ...(status.error ? { warning: status.error } : {}),
          };
        },
      });
      continue;
    }

    if (chain === "Hemköp" && configuration.source === HEMKOP_SOURCE) {
      adapters.push(HEMKOP_SOURCE_ADAPTER);
      continue;
    }

    if (
      configuration.source === TJEK_SOURCE ||
      (chain === "Coop" && configuration.source === COOP_TJEK_SOURCE)
    ) {
      adapters.push(
        createTjekSourceAdapter<HemkopLocation>(
          chain,
          configuration.storeDiscovery,
          configuration.source,
        ),
      );
      continue;
    }

    if (chain === "Coop" && configuration.source === COOP_FLYER_PDF_SOURCE) {
      adapters.push({
        chain: COOP_FLYER_PDF_SOURCE_ADAPTER.chain,
        source: COOP_FLYER_PDF_SOURCE_ADAPTER.source,
        refresh: (snapshotLocation, context) =>
          COOP_FLYER_PDF_SOURCE_ADAPTER.refresh(
            {
              id: snapshotLocation.id,
              name: snapshotLocation.name,
              storeDiscovery: configuration.storeDiscovery,
            } satisfies CoopLocation,
            context,
          ),
      });
      continue;
    }

    const source = configuration.source;
    adapters.push({
      chain,
      source,
      async refresh() {
        throw new Error(
          `Källan "${source}" för ${chain} är inte implementerad i Snapshot-jobbet.`,
        );
      },
    });
  }

  return adapters;
}

export async function buildSnapshotForLocation(
  location: LocationConfig,
  dependencies: SnapshotJobDependencies = {},
): Promise<Snapshot> {
  const {
    previousSnapshot: sharedPreviousSnapshot,
    previousSnapshots,
    ...runnerDependencies
  } = dependencies;
  return buildSnapshot(
    snapshotLocationFromConfig(location),
    snapshotAdaptersFromConfig(location),
    {
      ...runnerDependencies,
      previousSnapshot:
        previousSnapshots?.[location.id] ?? sharedPreviousSnapshot,
    },
  );
}

export async function buildSnapshots(
  locations: readonly LocationConfig[],
  dependencies: SnapshotJobDependencies = {},
): Promise<Snapshot[]> {
  const snapshots: Snapshot[] = [];
  const requestPacingState = dependencies.requestPacingState ?? {
    startedSources: new Set<string>(),
  };
  for (const location of locations) {
    snapshots.push(
      await buildSnapshotForLocation(location, {
        ...dependencies,
        requestPacingState,
      }),
    );
  }
  return snapshots;
}
