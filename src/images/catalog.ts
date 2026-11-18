import { z } from "zod";
import catalogData from "./catalog.json";
import type { Offer } from "../domain/snapshot";

function httpsUrl(host?: string) {
  return z.url().refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      !url.port && (host === undefined || url.hostname === host);
  }, "Expected a public HTTPS source URL");
}

function normalizedName(name: string): string {
  return name.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("sv-SE");
}

const imageSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1),
  sourceTitle: z.string().trim().min(1),
  names: z.array(z.string().trim().min(1)).min(1),
  author: z.string().trim().min(1),
  license: z.literal("CC0-1.0"),
  licenseUrl: z.literal("https://creativecommons.org/publicdomain/zero/1.0/"),
  sourceUrl: httpsUrl("commons.wikimedia.org"),
  downloadUrl: httpsUrl("upload.wikimedia.org"),
  verifiedAt: z.iso.date(),
});

export const imageCatalogSchema = z.array(imageSchema).superRefine((images, context) => {
  const ids = new Set<string>();
  const names = new Set<string>();
  images.forEach((image, index) => {
    if (ids.has(image.id)) {
      context.addIssue({ code: "custom", path: [index, "id"], message: "Duplicate image id" });
    }
    ids.add(image.id);
    image.names.forEach((name, nameIndex) => {
      const normalized = normalizedName(name);
      if (names.has(normalized)) {
        context.addIssue({
          code: "custom",
          path: [index, "names", nameIndex],
          message: "Ambiguous image alias",
        });
      }
      names.add(normalized);
    });
  });
});

export const imageCatalog = imageCatalogSchema.parse(catalogData);
export type ProductImage = z.infer<typeof imageSchema>;

const imagesByName = new Map(
  imageCatalog.flatMap((image) => image.names.map((name) => [normalizedName(name), image] as const)),
);

export function productImage(offer: Pick<Offer, "name">): ProductImage | undefined {
  return imagesByName.get(normalizedName(offer.name));
}
