import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { imageCatalog } from "./catalog";
import { compressProductImage, downloadSourceImage, validateProductImage } from "./processing";

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

  for (const image of imageCatalog) {
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
      throw new Error(`Missing ${image.id}.jpg; run npm run images:sync after checking its source and license`);
    }
    const bytes = await compressProductImage(await downloadSourceImage(image.downloadUrl));
    await writeFile(path, bytes, { flag: "wx" });
    console.log(`${image.id}: imported (${bytes.length} bytes)`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
