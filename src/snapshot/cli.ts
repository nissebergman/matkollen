import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseSnapshot } from "../domain/snapshot";
import { LOCATION_REGISTRY } from "./config";
import { buildSnapshots } from "./job";

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

async function main(): Promise<void> {
  const outputArgument = process.argv[2];
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
  const previousSnapshots: Record<string, unknown> = {};

  for (const location of LOCATION_REGISTRY.locations) {
    previousSnapshots[location.id] = await readPreviousSnapshot(
      outputPathFor(location.id),
    );
  }

  const snapshots = await buildSnapshots(LOCATION_REGISTRY.locations, {
    previousSnapshots,
  });
  let hasFailures = false;
  for (const snapshot of snapshots) {
    const outputPath = outputPathFor(snapshot.location.id);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    console.log(`Snapshot sparad: ${outputPath}`);

    for (const chain of snapshot.chains) {
      if (chain.status !== "ok") {
        console.error(`${snapshot.location.name} · ${chain.chain}: ${chain.error}`);
        hasFailures = true;
      }
    }
  }
  if (hasFailures) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Snapshot-jobbet misslyckades.");
  process.exitCode = 1;
});
