import type { SupabaseClient } from "@supabase/supabase-js";

export const INVOICE_NUMBER_MAX_LENGTH = 6;

/** Either exactly 4 digits, or one uppercase letter + number from 1 to 10000. */
export const INVOICE_NUMBER_PATTERN =
  /^(?:\d{4}|[A-Z](?:[1-9]\d{0,3}|10000))$/;

export function sanitizeInvoiceNumberInput(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, INVOICE_NUMBER_MAX_LENGTH);
}

export function getInvoiceNumberFormatError(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  if (normalized.length > INVOICE_NUMBER_MAX_LENGTH) {
    return `Invoice number must be at most ${INVOICE_NUMBER_MAX_LENGTH} characters.`;
  }

  if (!INVOICE_NUMBER_PATTERN.test(normalized)) {
    return "Use a 4-digit number (e.g. 0001) or one capital letter followed by a number from 1 to 10000 (e.g. A1, B1234).";
  }

  return null;
}

export function isValidInvoiceNumber(value: string): boolean {
  const normalized = value.trim();
  return normalized.length > 0 && getInvoiceNumberFormatError(normalized) === null;
}

export function getNextInvoiceNumber(value: string): string {
  const normalized = sanitizeInvoiceNumberInput(value.trim());
  if (!normalized || !INVOICE_NUMBER_PATTERN.test(normalized)) {
    return "";
  }

  const fourDigitMatch = normalized.match(/^(\d{4})$/);
  if (fourDigitMatch) {
    const next = Number(fourDigitMatch[1]) + 1;
    if (next > 9999) {
      return "";
    }
    return next.toString().padStart(4, "0");
  }

  const letterNumberMatch = normalized.match(/^([A-Z])(\d+)$/);
  if (letterNumberMatch) {
    const prefix = letterNumberMatch[1];
    const next = Number(letterNumberMatch[2]) + 1;
    if (next > 10000) {
      return "";
    }

    const candidate = `${prefix}${next}`;
    if (candidate.length > INVOICE_NUMBER_MAX_LENGTH) {
      return "";
    }
    return candidate;
  }

  return "";
}

export async function isInvoiceNumberDuplicate(
  supabase: SupabaseClient,
  organizationId: string,
  invoiceNumber: string,
  excludeInvoiceId?: string,
): Promise<{ isDuplicate: boolean; error: Error | null }> {
  const normalized = invoiceNumber.trim();
  if (!normalized) {
    return { isDuplicate: false, error: null };
  }

  let query = supabase
    .from("invoices")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("invoice_number", normalized)
    .limit(1);

  if (excludeInvoiceId) {
    query = query.neq("id", excludeInvoiceId);
  }

  const { data, error } = await query;

  if (error) {
    return { isDuplicate: false, error };
  }

  return {
    isDuplicate: Boolean(data?.length),
    error: null,
  };
}
