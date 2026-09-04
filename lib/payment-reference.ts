import type { SupabaseClient } from "@supabase/supabase-js";

export async function isPaymentReferenceDuplicate(
  supabase: SupabaseClient,
  organizationId: string,
  referenceNumber: string,
  excludeId?: {
    table?: "payments" | "purchase_payments" | "expense_entries";
    id?: string;
  },
): Promise<{ isDuplicate: boolean; error: Error | null }> {
  const normalized = referenceNumber.trim();
  if (!normalized) {
    return { isDuplicate: false, error: null };
  }

  let salesQuery = supabase
    .from("payments")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("reference_number", normalized)
    .limit(1);

  if (excludeId?.table === "payments" && excludeId.id) {
    salesQuery = salesQuery.neq("id", excludeId.id);
  }

  let purchaseQuery = supabase
    .from("purchase_payments")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("reference_number", normalized)
    .limit(1);

  if (excludeId?.table === "purchase_payments" && excludeId.id) {
    purchaseQuery = purchaseQuery.neq("id", excludeId.id);
  }

  let expenseQuery = supabase
    .from("expense_entries")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("reference_number", normalized)
    .limit(1);

  if (excludeId?.table === "expense_entries" && excludeId.id) {
    expenseQuery = expenseQuery.neq("id", excludeId.id);
  }

  const [salesResult, purchaseResult, expenseResult] = await Promise.all([
    salesQuery,
    purchaseQuery,
    expenseQuery,
  ]);

  if (salesResult.error) {
    return { isDuplicate: false, error: salesResult.error };
  }
  if (purchaseResult.error) {
    return { isDuplicate: false, error: purchaseResult.error };
  }
  if (expenseResult.error && expenseResult.error.code !== "42703") {
    return { isDuplicate: false, error: expenseResult.error };
  }

  return {
    isDuplicate:
      Boolean(salesResult.data?.length) ||
      Boolean(purchaseResult.data?.length) ||
      Boolean(expenseResult.data?.length),
    error: null,
  };
}
