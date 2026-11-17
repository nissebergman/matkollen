import { SCHEMA_VERSION, SnapshotSchema, type Snapshot } from "../domain/snapshot";
import { buildHemkopSnapshot } from "./job";
import { buildIcaSnapshot } from "./ica";
import type { LocationConfig, SnapshotJobDependencies } from "./types";

export async function buildLocationSnapshot(
  location: LocationConfig,
  dependencies: SnapshotJobDependencies = {},
): Promise<Snapshot> {
  const ica = await buildIcaSnapshot(location, dependencies);
  const hemkop = await buildHemkopSnapshot(location, dependencies);
  const now = dependencies.now ?? (() => new Date());

  return SnapshotSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    location: { id: location.id, name: location.name },
    generatedAt: now().toISOString(),
    chains: [...ica.chains, ...hemkop.chains],
    stores: [...ica.stores, ...hemkop.stores],
    offers: [...ica.offers, ...hemkop.offers],
  });
}
