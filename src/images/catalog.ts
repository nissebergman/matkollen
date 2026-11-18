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

function normalized(text: string): string {
  return text.normalize("NFC").trim().toLocaleLowerCase("sv-SE");
}

function nameTokens(name: string): string[] {
  return normalized(name).split(/[^\p{L}]+/u).filter(Boolean);
}

const keywordSchema = z.string().trim().regex(/^\p{Ll}+$/u, "Expected one lowercase word");

const imageSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1),
  sourceTitle: z.string().trim().min(1),
  keywords: z.array(keywordSchema).min(1),
  exclude: z.array(keywordSchema).optional(),
  author: z.string().trim().min(1),
  license: z.literal("CC0-1.0"),
  licenseUrl: z.literal("https://creativecommons.org/publicdomain/zero/1.0/"),
  sourceUrl: httpsUrl("commons.wikimedia.org"),
  downloadUrl: httpsUrl("upload.wikimedia.org"),
  verifiedAt: z.iso.date(),
});

export const imageCatalogSchema = z.array(imageSchema).superRefine((images, context) => {
  const ids = new Set<string>();
  const keywords = new Set<string>();
  images.forEach((image, index) => {
    if (ids.has(image.id)) {
      context.addIssue({ code: "custom", path: [index, "id"], message: "Duplicate image id" });
    }
    ids.add(image.id);
    image.keywords.forEach((keyword, keywordIndex) => {
      if (keywords.has(keyword)) {
        context.addIssue({
          code: "custom",
          path: [index, "keywords", keywordIndex],
          message: "Ambiguous image keyword",
        });
      }
      keywords.add(keyword);
    });
  });
});

export const imageCatalog = imageCatalogSchema.parse(catalogData);
export type ProductImage = z.infer<typeof imageSchema>;

// Swedish compounds put the head noun last ("snacktomater", "grillkorv"), so a
// suffix match outranks a prefix match ("potatischips" is chips, not potatoes).
// Keywords shorter than four letters only match whole words ("ost", "lax").
function matchScore(token: string, keyword: string): number {
  if (token === keyword) return 200 + keyword.length;
  if (keyword.length < 4) return 0;
  if (token.endsWith(keyword)) return 100 + keyword.length;
  if (token.startsWith(keyword)) return keyword.length;
  return 0;
}

export function productImage(offer: Pick<Offer, "name">): ProductImage | undefined {
  const tokens = nameTokens(offer.name);
  let best: ProductImage | undefined;
  let bestScore = 0;
  for (const image of imageCatalog) {
    const candidates = tokens.filter((token) =>
      !image.exclude?.some((term) => matchScore(token, term) > 0));
    for (const keyword of image.keywords) {
      for (const token of candidates) {
        const score = matchScore(token, keyword);
        if (score > bestScore) {
          best = image;
          bestScore = score;
        }
      }
    }
  }
  return best;
}
