import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSnapshot, type Snapshot } from "../domain/snapshot";
import { LINKOPING_HEMKOP, LINKOPING_SNAPSHOT_ADAPTERS } from "./config";
import {
  buildSnapshot,
  type ChainSourceAdapter,
  type SnapshotJobDependencies,
} from "./runner";
import type { HemkopLocation } from "./job";

export interface SnapshotCliOptions {
  outputPath?: string;
  location?: HemkopLocation;
  adapters?: readonly ChainSourceAdapter<HemkopLocation>[];
  dependencies?: SnapshotJobDependencies;
  readPrevious?: (path: string) => Promise<unknown>;
  writeSnapshot?: (path: string, snapshot: Snapshot) => Promise<void>;
  log?: (message: string) => void;
  error?: (message: string) => void;
}

export interface SnapshotCliResult {
  snapshot: Snapshot;
  exitCode: 0 | 1;
}

async function readPreviousSnapshot(path: string): Promise<unknown> {
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

async function writeSnapshotFile(path: string, snapshot: Snapshot): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

export async function runSnapshotCli(
  options: SnapshotCliOptions = {},
): Promise<SnapshotCliResult> {
  const outputPath = resolve(
    options.outputPath ?? process.argv[2] ?? "public/snapshots/linkoping.json",
  );
  const dependencies = options.dependencies ?? {};
  const previousSnapshot =
    dependencies.previousSnapshot !== undefined
      ? dependencies.previousSnapshot
      : await (options.readPrevious ?? readPreviousSnapshot)(outputPath);
  const snapshot = await buildSnapshot(
    options.location ?? LINKOPING_HEMKOP,
    options.adapters ?? LINKOPING_SNAPSHOT_ADAPTERS,
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
    const result = await runSnapshotCli();
    if (result.exitCode !== 0) {
      process.exitCode = result.exitCode;
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
