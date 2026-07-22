import type { SupabaseClient } from "@supabase/supabase-js";

export async function isPurchaserInvoiceNumberDuplicate(
  supabase: SupabaseClient,
  organizationId: string,
  purchaserInvoiceNumber: string,
  excludeInvoiceId?: string,
): Promise<{ isDuplicate: boolean; error: Error | null }> {
  const normalized = purchaserInvoiceNumber.trim();
  if (!normalized) {
    return { isDuplicate: false, error: null };
  }

  let query = supabase
    .from("purchase_invoices")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("purchaser_invoice_number", normalized)
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

export function isPurchaserInvoiceNumberUniqueViolation(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  return /duplicate key|unique constraint|purchase_invoices_organization_purchaser_invoice_number/i.test(
    error.message || "",
  );
}
