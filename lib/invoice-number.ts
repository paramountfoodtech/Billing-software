import type { SupabaseClient } from "@supabase/supabase-js";

export const INVOICE_NUMBER_MAX_LENGTH = 6;

export type InvoiceNumberPatternType = "general" | "client_specific";

/** Either exactly 4 digits, or one uppercase letter + number from 1 to 10000. */
export const INVOICE_NUMBER_PATTERN =
  /^(?:\d{4}|[A-Z](?:[1-9]\d{0,3}|10000))$/;

/** Single letter prefix, or a full valid invoice number used as the series start. */
export const INVOICE_NUMBER_PATTERN_CONFIG =
  /^(?:[A-Z]|\d{4}|[A-Z](?:[1-9]\d{0,3}|10000))$/;

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

export function getInvoiceNumberPatternConfigError(value: string): string | null {
  const normalized = sanitizeInvoiceNumberInput(value.trim());
  if (!normalized) {
    return "Enter a letter prefix (e.g. A) or a starting invoice number (e.g. A1, 0001).";
  }

  if (!INVOICE_NUMBER_PATTERN_CONFIG.test(normalized)) {
    return "Use a single capital letter (e.g. A), a 4-digit number (e.g. 0001), or letter + number (e.g. A1).";
  }

  return null;
}

export function isValidInvoiceNumber(value: string): boolean {
  const normalized = value.trim();
  return normalized.length > 0 && getInvoiceNumberFormatError(normalized) === null;
}

export function getStartingInvoiceNumberFromPattern(pattern: string): string {
  const normalized = sanitizeInvoiceNumberInput(pattern.trim());
  if (!normalized || getInvoiceNumberPatternConfigError(normalized)) {
    return "";
  }

  if (/^[A-Z]$/.test(normalized)) {
    return `${normalized}1`;
  }

  return normalized;
}

export function invoiceNumberMatchesClientPattern(
  invoiceNumber: string,
  pattern: string,
): boolean {
  const number = sanitizeInvoiceNumberInput(invoiceNumber.trim());
  const normalizedPattern = sanitizeInvoiceNumberInput(pattern.trim());
  if (!number || !normalizedPattern || !isValidInvoiceNumber(number)) {
    return false;
  }

  if (/^[A-Z]$/.test(normalizedPattern)) {
    return number.startsWith(normalizedPattern) && /^[A-Z]\d+$/.test(number);
  }

  if (/^\d{4}$/.test(normalizedPattern)) {
    return /^\d{4}$/.test(number);
  }

  const letterMatch = normalizedPattern.match(/^([A-Z])\d+$/);
  if (letterMatch) {
    return number.startsWith(letterMatch[1]) && /^[A-Z]\d+$/.test(number);
  }

  return false;
}

export type ClientInvoicePattern = {
  id: string;
  invoice_number_pattern_type?: string | null;
  invoice_number_pattern?: string | null;
};

export type InvoiceNumberRecord = {
  invoice_number: string;
  client_id: string;
  created_at?: string | null;
};

/** True when the invoice belongs to the org-wide general series (not client-specific). */
export function isGeneralSeriesInvoice(
  invoice: InvoiceNumberRecord,
  clients: ClientInvoicePattern[],
): boolean {
  const client = clients.find((c) => c.id === invoice.client_id);
  if (
    client?.invoice_number_pattern_type === "client_specific" &&
    client.invoice_number_pattern?.trim()
  ) {
    return false;
  }

  for (const c of clients) {
    if (
      c.invoice_number_pattern_type === "client_specific" &&
      c.invoice_number_pattern?.trim() &&
      invoiceNumberMatchesClientPattern(
        invoice.invoice_number,
        c.invoice_number_pattern,
      )
    ) {
      return false;
    }
  }

  return isValidInvoiceNumber(invoice.invoice_number);
}

/** Latest invoice number in the general org series (ignores client-specific patterns). */
export function findLastGeneralOrgInvoiceNumber(
  invoices: InvoiceNumberRecord[],
  clients: ClientInvoicePattern[],
): string | null {
  const sorted = [...invoices].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });

  for (const invoice of sorted) {
    if (isGeneralSeriesInvoice(invoice, clients)) {
      return sanitizeInvoiceNumberInput(invoice.invoice_number);
    }
  }

  return null;
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

/**
 * Resolve the next invoice number for a client based on pattern mode.
 * General → org-wide general series only. Client Specific → that client's pattern series.
 */
export function resolveNextInvoiceNumberForClient(options: {
  patternType?: InvoiceNumberPatternType | string | null;
  pattern?: string | null;
  /** Last invoice in the general org series (not client-specific numbers). */
  lastGeneralOrgInvoiceNumber?: string | null;
  lastClientInvoiceNumber?: string | null;
}): string {
  const {
    patternType,
    pattern,
    lastGeneralOrgInvoiceNumber,
    lastClientInvoiceNumber,
  } = options;

  if (patternType === "client_specific" && pattern?.trim()) {
    if (lastClientInvoiceNumber) {
      const next = getNextInvoiceNumber(lastClientInvoiceNumber);
      if (next) return next;
    }
    return getStartingInvoiceNumberFromPattern(pattern);
  }

  if (lastGeneralOrgInvoiceNumber) {
    return getNextInvoiceNumber(lastGeneralOrgInvoiceNumber);
  }

  return "0001";
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
