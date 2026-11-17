import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseSnapshot, type Snapshot } from "../domain/snapshot";
import { buildCoopSnapshot } from "./coop";
import { LINKOPING_COOP } from "./config";
import { mergeChainSnapshot } from "./merge";

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

async function main(): Promise<void> {
  const outputPath = resolve(process.argv[2] ?? "public/snapshots/linkoping.json");
  const previousSnapshot = await readPreviousSnapshot(outputPath);
  const refreshed = await buildCoopSnapshot(LINKOPING_COOP, {
    previousSnapshot,
  });
  const snapshot = mergeChainSnapshot(previousSnapshot, refreshed);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`Snapshot sparad: ${outputPath}`);

  const coopStatus = snapshot.chains.find((chain) => chain.chain === "Coop");
  if (coopStatus && coopStatus.status !== "ok") {
    console.error(coopStatus.error ?? "Coop uppdaterades inte.");
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Snapshot-jobbet misslyckades.");
  process.exitCode = 1;
});
