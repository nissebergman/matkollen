import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseSnapshot } from "../domain/snapshot";
import { LINKOPING_HEMKOP } from "./config";
import { buildHemkopSnapshot } from "./job";

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
  const outputPath = resolve(process.argv[2] ?? "public/snapshots/linkoping.json");
  const previousSnapshot = await readPreviousSnapshot(outputPath);
  const snapshot = await buildHemkopSnapshot(LINKOPING_HEMKOP, {
    previousSnapshot,
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`Snapshot sparad: ${outputPath}`);

  const hemkopStatus = snapshot.chains.find((chain) => chain.chain === "Hemköp");
  if (hemkopStatus && hemkopStatus.status !== "ok") {
    console.error(hemkopStatus.error ?? "Hemköp uppdaterades inte.");
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Snapshot-jobbet misslyckades.");
  process.exitCode = 1;
});
