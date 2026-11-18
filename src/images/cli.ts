import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { imageCatalog } from "./catalog";
import {
  commonsThumbnailUrl,
  compressProductImage,
  downloadSourceImage,
  RateLimitedError,
  validateProductImage,
} from "./processing";

const PAUSE_BETWEEN_DOWNLOADS_MS = 1_000;

async function main(args: string[]): Promise<void> {
  if (args.some((arg) => arg !== "--download") || args.length > 1) {
    throw new Error("Usage: npm run images:check | npm run images:sync");
  }
  const download = args.includes("--download");
  const directory = fileURLToPath(new URL("../../public/images/products/", import.meta.url));
  if (imageCatalog.length === 0) {
    throw new Error("The curated image catalogue is empty");
  }
  if (download) await mkdir(directory, { recursive: true });

  const failures: string[] = [];
  let downloaded = 0;
  let rateLimited = false;
  for (const image of imageCatalog) {
    try {
      const path = resolve(directory, `${image.id}.jpg`);
      const existing = await readFile(path).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return undefined;
        throw error;
      });
      if (existing) {
        await validateProductImage(existing);
        console.log(`${image.id}: verified (${existing.length} bytes)`);
        continue;
      }
      if (!download) {
        throw new Error("missing; run npm run images:sync after checking its source and license");
      }
      if (rateLimited) {
        throw new Error("skipped after the image source rate-limited this run");
      }
      if (downloaded++ > 0) await sleep(PAUSE_BETWEEN_DOWNLOADS_MS);
      const source = await downloadSourceImage(commonsThumbnailUrl(image.downloadUrl));
      const bytes = await compressProductImage(source);
      await writeFile(path, bytes, { flag: "wx" });
      console.log(`${image.id}: imported (${bytes.length} bytes)`);
    } catch (error) {
      if (error instanceof RateLimitedError) rateLimited = true;
      failures.push(`${image.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(`${failures.length} of ${imageCatalog.length} images failed:\n${failures.join("\n")}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
