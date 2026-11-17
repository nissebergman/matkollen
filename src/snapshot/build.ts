import type { Snapshot } from "../domain/snapshot";
import type { LocationConfig } from "./config";
import { buildSnapshots, type SnapshotJobDependencies } from "./job";

export async function buildLocationSnapshot(
  location: LocationConfig,
  dependencies: SnapshotJobDependencies = {},
): Promise<Snapshot> {
  const [snapshot] = await buildSnapshots([location], dependencies);
  if (!snapshot) {
    throw new Error("Snapshot-jobbet kunde inte bygga den konfigurerade Locationen.");
  }
  return snapshot;
}
