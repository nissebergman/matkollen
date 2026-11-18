import type { ZodError, ZodType } from "zod";

export function describeValidationError(error: ZodError): string {
  const issue = error.issues[0];
  const path = issue.path.length ? issue.path.join(".") : "response";
  return `fältet ${path} har ett oväntat format`;
}

export function parseResponse<T>(
  schema: ZodType<T>,
  value: unknown,
  label: string,
  source: string,
): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Ogiltigt svar från ${source} (${label}): ${describeValidationError(result.error)}.`,
    );
  }
  return result.data;
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function parseAmount(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  }
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  if (normalized.startsWith("-")) {
    return undefined;
  }
  const numericTokens = normalized.match(/\d[\d\s.,]*\d|\d/g);
  if (!numericTokens || numericTokens.length !== 1) {
    return undefined;
  }
  let amount = numericTokens[0].replace(/\s|\u00a0/g, "");
  if (!/^\d+(?:[.,]\d+)*$/.test(amount)) {
    return undefined;
  }

  const comma = amount.lastIndexOf(",");
  const dot = amount.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    if (comma > dot) {
      amount = amount.replace(/\./g, "").replace(",", ".");
    } else {
      amount = amount.replace(/,/g, "");
    }
  } else if (comma >= 0) {
    amount = amount.replace(",", ".");
  } else if ((amount.match(/\./g) ?? []).length > 1) {
    const lastDot = amount.lastIndexOf(".");
    amount = `${amount.slice(0, lastDot).replace(/\./g, "")}${amount.slice(lastDot)}`;
  }

  const parsed = Number(amount);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function sourceText(value: string | null | undefined): string | undefined {
  const text = value?.trim();
  return text || undefined;
}

export function sourceId(value: string | number): string {
  return String(value);
}

export function amountFromMechanic(text: string): number | undefined {
  const price = text.match(/(\d[\d\s.,]*)\s*kr\b/i);
  return price ? parseAmount(price[1]) : undefined;
}

export function positiveInteger(value: number | undefined): number | undefined {
  return value && Number.isInteger(value) && value > 0 ? value : undefined;
}

export function currentOfferWeekEnd(today: string): string {
  const day = new Date(`${today}T00:00:00.000Z`).getUTCDay();
  const daysUntilSunday = (7 - day) % 7;
  const end = new Date(`${today}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + daysUntilSunday);
  return end.toISOString().slice(0, 10);
}
