// @vitest-environment node
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { imageCatalog, imageCatalogSchema, productImage } from "../src/images/catalog";
import {
  compressProductImage,
  downloadSourceImage,
  validateProductImage,
} from "../src/images/processing";

describe("local product image catalogue", () => {
  it("only matches curated full names, including case and whitespace normalization", () => {
    expect(productImage({ name: " CHIPS,  Ringar och Bågar " })?.id).toBe("potato-chips");
    expect(productImage({ name: "Krossade tomater" })).toBeUndefined();
    expect(productImage({ name: "Granatäpple" })).toBeUndefined();
    expect(productImage({ name: "Taco kryddmix, nachochips" })).toBeUndefined();
  });

  it("rejects ambiguous aliases, unsafe paths/hosts, and licenses outside the CC0 policy", () => {
    const image = imageCatalog[0];
    expect(imageCatalogSchema.safeParse([image, { ...image, id: "another" }]).success).toBe(false);
    expect(imageCatalogSchema.safeParse([{ ...image, id: "../outside" }]).success).toBe(false);
    expect(imageCatalogSchema.safeParse([{
      ...image, downloadUrl: "https://example.com/image.jpg",
    }]).success).toBe(false);
    expect(imageCatalogSchema.safeParse([{ ...image, license: "CC-BY-SA-3.0" }]).success).toBe(false);
  });

  it("resizes and compresses a photo to a metadata-free 192x192 JPEG", async () => {
    const source = await sharp({
      create: { width: 480, height: 240, channels: 3, background: "#f33c11" },
    }).withMetadata({ orientation: 6 }).jpeg().toBuffer();

    await expect(validateProductImage(source)).rejects.toThrow("192x192");
    const result = await compressProductImage(source);
    await expect(validateProductImage(result)).resolves.toBeUndefined();
    const metadata = await sharp(result).metadata();
    expect(metadata).toMatchObject({ format: "jpeg", width: 192, height: 192 });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    expect(result.length).toBeLessThanOrEqual(20 * 1024);
  });

  it("stops on access denial without retrying", async () => {
    const fetchSource = vi.fn<typeof fetch>().mockResolvedValue(new Response("Denied", { status: 403 }));
    await expect(downloadSourceImage(imageCatalog[0].downloadUrl, fetchSource))
      .rejects.toThrow("HTTP 403");
    expect(fetchSource).toHaveBeenCalledTimes(1);
  });
});
