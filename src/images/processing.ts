import sharp from "sharp";

const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_BYTES = 20 * 1024;

export async function validateProductImage(bytes: Buffer): Promise<void> {
  const metadata = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata();
  if (
    metadata.format !== "jpeg" || metadata.width !== 192 || metadata.height !== 192 ||
    metadata.exif !== undefined || metadata.icc !== undefined ||
    metadata.iptc !== undefined || metadata.xmp !== undefined || bytes.length > MAX_IMAGE_BYTES
  ) {
    throw new Error("Catalogue images must be metadata-free 192x192 JPEGs of at most 20 KiB");
  }
}

export async function compressProductImage(bytes: Buffer): Promise<Buffer> {
  const encoded = await sharp(bytes, { limitInputPixels: 40_000_000, failOn: "error" })
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize(192, 192, { fit: "contain", background: "#ffffff" })
    .jpeg({ quality: 55, mozjpeg: true, chromaSubsampling: "4:2:0" })
    .toBuffer();
  await validateProductImage(encoded);
  return encoded;
}

const THUMBNAIL_WIDTH = 330;

/**
 * Wikimedia rate-limits bulk original downloads and asks clients to use one of
 * its standard thumbnail widths instead. Every catalogue source is wider than
 * 330px, which is still well above the 192px derivative.
 */
export function commonsThumbnailUrl(downloadUrl: string, width = THUMBNAIL_WIDTH): string {
  const url = new URL(downloadUrl);
  const match = /^\/wikipedia\/commons\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)$/.exec(url.pathname);
  if (url.hostname !== "upload.wikimedia.org" || !match) {
    throw new Error("Expected an original Wikimedia Commons upload URL");
  }
  const [, shard, subshard, file] = match;
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${shard}/${subshard}/${file}/${width}px-${file}`;
}

export class RateLimitedError extends Error {}

export async function downloadSourceImage(
  url: string,
  fetchSource: typeof fetch = fetch,
): Promise<Buffer> {
  const response = await fetchSource(url, {
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
    headers: {
      "User-Agent": "MatkollenImageCatalog/1.0 (https://github.com/nissebergman/matkollen)",
      Accept: "image/jpeg",
    },
  });
  if (!response.ok) {
    await response.body?.cancel();
    const message = `Image source returned HTTP ${response.status}; stopped without retrying`;
    throw response.status === 429 ? new RateLimitedError(message) : new Error(message);
  }
  if (
    response.headers.get("content-type")?.split(";")[0].trim() !== "image/jpeg" ||
    Number(response.headers.get("content-length")) > MAX_SOURCE_BYTES
  ) {
    await response.body?.cancel();
    throw new Error("Image source must serve a JPEG of at most 12 MiB");
  }
  if (!response.body) {
    throw new Error("Image source returned an empty body");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_SOURCE_BYTES) {
      await reader.cancel();
      throw new Error("Image source exceeded 12 MiB");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
