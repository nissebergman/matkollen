import {
  SCHEMA_VERSION,
  SnapshotSchema,
  StoreSchema,
  type Chain,
  type Offer,
  type Snapshot,
  type Store,
} from "../domain/snapshot";
import { stockholmDate } from "../domain/date";
import { currentOfferWeekEnd } from "./source-parsing";

export interface SnapshotLocation {
  id: string;
  name: string;
}

export interface SnapshotRequestPacingState {
  startedSources: Set<string>;
}

export interface SnapshotJobDependencies {
  fetcher?: typeof fetch;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
  previousSnapshot?: unknown;
  requestPacingState?: SnapshotRequestPacingState;
}

export interface ChainRefreshContext {
  fetcher: typeof fetch;
  now: () => Date;
  sleep: (milliseconds: number) => Promise<void>;
  waitForRequest: (source: string, minimumDelayMs: number) => Promise<void>;
  attemptAt: string;
  runDate: string;
  offerWeekEnd: string;
}

export interface ChainRefreshResult {
  stores: Store[];
  offers: Offer[];
  warning?: string;
}

export interface ChainSourceAdapter<Location extends SnapshotLocation = SnapshotLocation> {
  chain: Chain;
  source: string;
  refresh: (
    location: Location,
    context: ChainRefreshContext,
  ) => Promise<ChainRefreshResult>;
}

export class ChainRefreshError extends Error {
  constructor(
    message: string,
    readonly stores: Store[] = [],
  ) {
    super(message);
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim().slice(0, 240);
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim().slice(0, 240);
  }
  return "Okänt fel.";
}

function isFixtureSource(source: string): boolean {
  return source.endsWith("-fixture");
}

function partialStores(error: unknown, chain: Chain): Store[] {
  if (!(error instanceof ChainRefreshError)) {
    return [];
  }

  const stores: Store[] = [];
  const ids = new Set<string>();
  for (const candidate of error.stores) {
    const parsed = StoreSchema.safeParse(candidate);
    if (
      parsed.success &&
      parsed.data.chain === chain &&
      !ids.has(parsed.data.id)
    ) {
      stores.push(parsed.data);
      ids.add(parsed.data.id);
    }
  }
  return stores;
}

function assertUniqueAcrossChains(
  existing: Snapshot[],
  candidate: Snapshot,
): void {
  const storeIds = new Set(
    existing.flatMap((snapshot) => snapshot.stores.map((store) => store.id)),
  );
  for (const store of candidate.stores) {
    if (storeIds.has(store.id)) {
      throw new Error(`Store-id ${store.id} förekommer i mer än en Chain.`);
    }
  }

  const offerIds = new Set(
    existing.flatMap((snapshot) => snapshot.offers.map((offer) => offer.id)),
  );
  for (const offer of candidate.offers) {
    if (offerIds.has(offer.id)) {
      throw new Error(`Offer-id ${offer.id} förekommer i mer än en Chain.`);
    }
  }
}

function chainSnapshot(
  location: SnapshotLocation,
  chain: Chain,
  source: string,
  status: "ok" | "stale" | "failed",
  attemptAt: string,
  completedAt: string,
  lastSuccessAt: string | null,
  stores: Store[],
  offers: Offer[],
  error?: string,
): Snapshot {
  return SnapshotSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    location: { id: location.id, name: location.name },
    generatedAt: completedAt,
    chains: [
      {
        chain,
        source,
        status,
        lastAttemptAt: attemptAt,
        lastSuccessAt,
        ...(error ? { error } : {}),
      },
    ],
    stores,
    offers,
  });
}

function failedChainSnapshot<Location extends SnapshotLocation>(
  location: Location,
  adapter: ChainSourceAdapter<Location>,
  attemptAt: string,
  completedAt: string,
  runDate: string,
  weekEnd: string,
  previous: Snapshot | undefined,
  failure: unknown,
  allowPreviousOffers: boolean,
): Snapshot {
  const previousStatus = previous?.chains.find(
    (status) => status.chain === adapter.chain,
  );
  const canReusePrevious =
    previousStatus !== undefined && !isFixtureSource(previousStatus.source);
  const previousOffers =
    allowPreviousOffers && canReusePrevious && previousStatus.status !== "failed"
      ? previous?.offers.filter(
          (offer) =>
            offer.chain === adapter.chain &&
            offer.validTo >= runDate &&
            (!offer.validFrom || offer.validFrom <= weekEnd),
        ) ?? []
      : [];
  const stale = previousOffers.length > 0;
  const stores = stale
    ? previous?.stores.filter((store) => store.chain === adapter.chain) ?? []
    : allowPreviousOffers
      ? partialStores(failure, adapter.chain)
      : [];
  const lastSuccessAt = canReusePrevious ? previousStatus.lastSuccessAt : null;

  return chainSnapshot(
    location,
    adapter.chain,
    adapter.source,
    stale ? "stale" : "failed",
    attemptAt,
    completedAt,
    lastSuccessAt,
    stores,
    stale ? previousOffers : [],
    errorMessage(failure),
  );
}

export async function buildSnapshot<Location extends SnapshotLocation>(
  location: Location,
  adapters: readonly ChainSourceAdapter<Location>[],
  dependencies: SnapshotJobDependencies = {},
): Promise<Snapshot> {
  if (adapters.length === 0) {
    throw new Error("Minst en Chain-adapter måste konfigureras.");
  }
  const seenChains = new Set<Chain>();
  for (const adapter of adapters) {
    if (seenChains.has(adapter.chain)) {
      throw new Error(`Det finns mer än en adapter för ${adapter.chain}.`);
    }
    if (!adapter.source.trim()) {
      throw new Error(`Adaptern för ${adapter.chain} saknar en källa.`);
    }
    seenChains.add(adapter.chain);
  }

  const fetcher = dependencies.fetcher ?? globalThis.fetch;
  const now = dependencies.now ?? (() => new Date());
  const sleep =
    dependencies.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const requestPacingState = dependencies.requestPacingState ?? {
    startedSources: new Set<string>(),
  };
  const runDate = stockholmDate(now());
  const weekEnd = currentOfferWeekEnd(runDate);
  const previousResult =
    dependencies.previousSnapshot === undefined
      ? undefined
      : SnapshotSchema.safeParse(dependencies.previousSnapshot);
  const previous =
    previousResult?.success && previousResult.data.location.id === location.id
      ? previousResult.data
      : undefined;
  const results: Snapshot[] = [];

  for (const adapter of adapters) {
    const attemptAt = now().toISOString();
    const waitForRequest = async (
      source: string,
      minimumDelayMs: number,
    ): Promise<void> => {
      if (requestPacingState.startedSources.has(source)) {
        await sleep(minimumDelayMs);
      }
      requestPacingState.startedSources.add(source);
    };
    let result: Snapshot;
    try {
      const refreshed = await adapter.refresh(location, {
        fetcher,
        now,
        sleep,
        waitForRequest,
        attemptAt,
        runDate,
        offerWeekEnd: weekEnd,
      });
      const completedAt = now().toISOString();
      result = chainSnapshot(
        location,
        adapter.chain,
        adapter.source,
        "ok",
        attemptAt,
        completedAt,
        completedAt,
        refreshed.stores,
        refreshed.offers,
        refreshed.warning,
      );
      assertUniqueAcrossChains(results, result);
    } catch (error) {
      const completedAt = now().toISOString();
      result = failedChainSnapshot(
        location,
        adapter,
        attemptAt,
        completedAt,
        runDate,
        weekEnd,
        previous,
        error,
        true,
      );
      try {
        assertUniqueAcrossChains(results, result);
      } catch (previousDataError) {
        result = failedChainSnapshot(
          location,
          adapter,
          attemptAt,
          completedAt,
          runDate,
          weekEnd,
          previous,
          new Error(
            `${errorMessage(error)} Föregående Chain-data kunde inte återanvändas: ${errorMessage(previousDataError)}`,
          ),
          false,
        );
        assertUniqueAcrossChains(results, result);
      }
    }
    results.push(result);
  }

  return SnapshotSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    location: { id: location.id, name: location.name },
    generatedAt: now().toISOString(),
    chains: results.flatMap((result) => result.chains),
    stores: results.flatMap((result) => result.stores),
    offers: results.flatMap((result) => result.offers),
  });
}
