import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSnapshot, type Snapshot } from "../domain/snapshot";
import { DEFAULT_LOCATION_ID, LOCATION_REGISTRY } from "./config";
import {
  buildSnapshots,
  snapshotAdaptersFromConfig,
  snapshotLocationFromConfig,
} from "./job";
import type { HemkopLocation } from "./hemkop";
import {
  buildSnapshot,
  type ChainSourceAdapter,
  type SnapshotJobDependencies as RunnerJobDependencies,
  type SnapshotLocation,
} from "./runner";

export interface SnapshotCliOptions<
  Location extends SnapshotLocation = HemkopLocation,
> {
  outputPath?: string;
  location?: Location;
  adapters?: readonly ChainSourceAdapter<Location>[];
  dependencies?: RunnerJobDependencies;
  readPrevious?: (path: string) => Promise<unknown>;
  writeSnapshot?: (path: string, snapshot: Snapshot) => Promise<void>;
  log?: (message: string) => void;
  error?: (message: string) => void;
}

export interface SnapshotCliResult {
  snapshot: Snapshot;
  exitCode: 0 | 1;
}

const defaultLocationConfig = LOCATION_REGISTRY.locations.find(
  (location) => location.id === DEFAULT_LOCATION_ID,
)!;

async function readPreviousSnapshot(path: string): Promise<Snapshot | undefined> {
  let contents: string;
  try {
    contents = await readFile(path, "utf8");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return undefined;
    }
    throw error;
  }

  try {
    return parseSnapshot(JSON.parse(contents));
  } catch {
    throw new Error(`Befintlig Snapshot är ogiltig och ersattes inte: ${path}`);
  }
}

export async function validateSnapshotDirectory(
  directory: string,
  { rejectFixtures = false }: { rejectFixtures?: boolean } = {},
): Promise<void> {
  const outputDirectory = resolve(directory);
  for (const location of LOCATION_REGISTRY.locations) {
    const snapshotPath = resolve(outputDirectory, `${location.id}.json`);
    let contents: string;
    try {
      contents = await readFile(snapshotPath, "utf8");
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        throw new Error(
          `Genererad Snapshot saknas för Location ${location.id}: ${snapshotPath}`,
        );
      }
      throw error;
    }

    let snapshot: Snapshot;
    try {
      snapshot = parseSnapshot(JSON.parse(contents));
    } catch {
      throw new Error(
        `Genererad Snapshot är ogiltig för Location ${location.id}: ${snapshotPath}`,
      );
    }
    if (
      snapshot.location.id !== location.id ||
      snapshot.location.name !== location.name
    ) {
      throw new Error(
        `Genererad Snapshot har fel Location: ${snapshotPath}`,
      );
    }
    if (rejectFixtures && snapshot.chains.some((chain) => chain.source.endsWith("-fixture"))) {
      throw new Error(`Snapshot innehåller testfixturer och får inte publiceras: ${snapshotPath}`);
    }
  }
}

async function writeSnapshotFile(path: string, snapshot: Snapshot): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

export async function runSnapshotCli<
  Location extends SnapshotLocation = HemkopLocation,
>(
  options: SnapshotCliOptions<Location> = {},
): Promise<SnapshotCliResult> {
  const outputPath = resolve(
    options.outputPath ??
      process.argv[2] ??
      `public/snapshots/${defaultLocationConfig.id}.json`,
  );
  const dependencies = options.dependencies ?? {};
  const previousSnapshot =
    dependencies.previousSnapshot !== undefined
      ? dependencies.previousSnapshot
      : await (options.readPrevious ?? readPreviousSnapshot)(outputPath);
  const snapshot = await buildSnapshot(
    options.location ??
      (snapshotLocationFromConfig(defaultLocationConfig) as Location),
    options.adapters ??
      (snapshotAdaptersFromConfig(
        defaultLocationConfig,
      ) as unknown as readonly ChainSourceAdapter<Location>[]),
    { ...dependencies, previousSnapshot },
  );

  await (options.writeSnapshot ?? writeSnapshotFile)(outputPath, snapshot);
  (options.log ?? console.log)(`Snapshot sparad: ${outputPath}`);

  const failures = snapshot.chains.filter((chain) => chain.status !== "ok");
  for (const chain of failures) {
    (options.error ?? console.error)(
      `${chain.chain}: ${chain.error ?? "Uppdateringen misslyckades."}`,
    );
  }
  return { snapshot, exitCode: failures.length > 0 ? 1 : 0 };
}

async function main(): Promise<void> {
  try {
    const outputArgument = process.argv[2];
    if (outputArgument === "--validate") {
      const directory = resolve(process.argv[3] ?? "public/snapshots");
      await validateSnapshotDirectory(directory, { rejectFixtures: true });
      console.log(`Snapshots validerade: ${directory}`);
      return;
    }

    const isJsonFile = outputArgument?.toLowerCase().endsWith(".json") ?? false;
    if (isJsonFile && LOCATION_REGISTRY.locations.length !== 1) {
      throw new Error("Ange en utdatamapp när fler än en Location är konfigurerad.");
    }
    const outputDirectory = resolve(
      isJsonFile ? "public/snapshots" : outputArgument ?? "public/snapshots",
    );
    const singleOutputFile = isJsonFile ? resolve(outputArgument!) : undefined;
    const outputPathFor = (locationId: string): string =>
      singleOutputFile ?? resolve(outputDirectory, `${locationId}.json`);
    const previousDirectory = process.env.SNAPSHOT_PREVIOUS_DIRECTORY
      ? resolve(process.env.SNAPSHOT_PREVIOUS_DIRECTORY)
      : outputDirectory;
    const previousPathFor = (locationId: string): string =>
      process.env.SNAPSHOT_PREVIOUS_DIRECTORY
        ? resolve(previousDirectory, `${locationId}.json`)
        : singleOutputFile ?? resolve(previousDirectory, `${locationId}.json`);
    const previousSnapshots: Record<string, unknown> = {};

    for (const location of LOCATION_REGISTRY.locations) {
      previousSnapshots[location.id] = await readPreviousSnapshot(
        previousPathFor(location.id),
      );
    }

    const snapshots = await buildSnapshots(LOCATION_REGISTRY.locations, {
      previousSnapshots,
    });
    let hasFailures = false;
    for (const snapshot of snapshots) {
      const outputPath = outputPathFor(snapshot.location.id);
      await writeSnapshotFile(outputPath, snapshot);
      console.log(`Snapshot sparad: ${outputPath}`);

      for (const chain of snapshot.chains) {
        if (chain.status !== "ok") {
          console.error(
            `${snapshot.location.name} · ${chain.chain}: ${chain.error}`,
          );
          hasFailures = true;
        }
      }
    }
    if (hasFailures) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Snapshot-jobbet misslyckades.",
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main();
}
