export const CATEGORIES = [
  "Frukt & grönt",
  "Kött & chark",
  "Fisk & skaldjur",
  "Mejeri & ost",
  "Bröd & bageri",
  "Skafferi",
  "Fryst",
  "Dryck",
  "Godis & snacks",
  "Hushåll & hygien",
  "Barn",
  "Djur",
  "Övrigt",
] as const;

export type Category = (typeof CATEGORIES)[number];

const sourceCategoryMap: Record<string, Category> = {
  barn: "Barn",
  brod: "Bröd & bageri",
  "brod-bageri": "Bröd & bageri",
  dryck: "Dryck",
  djur: "Djur",
  fisk: "Fisk & skaldjur",
  "fisk-skaldjur": "Fisk & skaldjur",
  frukt: "Frukt & grönt",
  "frukt-gront": "Frukt & grönt",
  "frukt-och-gront": "Frukt & grönt",
  fryst: "Fryst",
  godis: "Godis & snacks",
  "godis-snacks": "Godis & snacks",
  hushall: "Hushåll & hygien",
  "hushall-hygien": "Hushåll & hygien",
  kott: "Kött & chark",
  "kott-chark": "Kött & chark",
  mejeri: "Mejeri & ost",
  "mejeri-ost": "Mejeri & ost",
  skafferi: "Skafferi",
};

function sourceCategoryKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_&]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function mapHemkopCategory(sourceCategory?: string | null): Category {
  const firstSegment = sourceCategory?.split("|", 1)[0] ?? "";
  return sourceCategoryMap[sourceCategoryKey(firstSegment)] ?? "Övrigt";
}

export function mapIcaCategory(sourceCategory?: string | null): Category {
  return sourceCategoryMap[sourceCategoryKey(sourceCategory ?? "")] ?? "Övrigt";
}
