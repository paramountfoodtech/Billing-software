import type { SupabaseClient } from "@supabase/supabase-js";

export async function isPaymentReferenceDuplicate(
  supabase: SupabaseClient,
  organizationId: string,
  referenceNumber: string,
): Promise<{ isDuplicate: boolean; error: Error | null }> {
  const normalized = referenceNumber.trim();
  if (!normalized) {
    return { isDuplicate: false, error: null };
  }

  const [salesResult, purchaseResult] = await Promise.all([
    supabase
      .from("payments")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("reference_number", normalized)
      .limit(1),
    supabase
      .from("purchase_payments")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("reference_number", normalized)
      .limit(1),
  ]);

  if (salesResult.error) {
    return { isDuplicate: false, error: salesResult.error };
  }
  if (purchaseResult.error) {
    return { isDuplicate: false, error: purchaseResult.error };
  }

  return {
    isDuplicate:
      Boolean(salesResult.data?.length) ||
      Boolean(purchaseResult.data?.length),
    error: null,
  };
}
