import type { SupabaseClient } from "@supabase/supabase-js";
import { getIndianToday } from "@/lib/date-time";

export interface ClientPricingRuleSnapshot {
  client_id: string;
  product_id: string;
  price_rule_type: string;
  price_rule_value?: number | string | null;
  price_category_id?: string | null;
  fixed_base_value?: number | null;
  conditional_threshold?: number | null;
  conditional_discount_below?: number | null;
  conditional_discount_above_equal?: number | null;
  notes?: string | null;
}

export interface ClientPricingHistoryEntry extends ClientPricingRuleSnapshot {
  effective_from: string;
  created_at?: string;
}

type PricingRuleFields = ClientPricingRuleSnapshot;

export type ClientPricingRuleIndex = Map<string, ClientPricingHistoryEntry[]>;

function sortPricingHistoryEntries(
  entries: ClientPricingHistoryEntry[],
): ClientPricingHistoryEntry[] {
  return [...entries].sort((a, b) => {
    const dateCompare = b.effective_from.localeCompare(a.effective_from);
    if (dateCompare !== 0) return dateCompare;
    return (b.created_at || "").localeCompare(a.created_at || "");
  });
}

export function buildClientPricingRuleIndex(
  history: ClientPricingHistoryEntry[],
): ClientPricingRuleIndex {
  const index: ClientPricingRuleIndex = new Map();

  for (const row of history) {
    const key = `${row.client_id}:${row.product_id}`;
    const existing = index.get(key) ?? [];
    existing.push(row);
    index.set(key, existing);
  }

  for (const [key, entries] of index) {
    index.set(key, sortPricingHistoryEntries(entries));
  }

  return index;
}

export function getClientPricingRuleForDate(
  clientId: string,
  productId: string,
  onDate: string,
  history: ClientPricingHistoryEntry[],
  currentRules: PricingRuleFields[] = [],
  index?: ClientPricingRuleIndex,
): PricingRuleFields | null {
  const key = `${clientId}:${productId}`;
  const indexedEntries = index?.get(key);

  if (indexedEntries?.length) {
    const match = indexedEntries.find((row) => row.effective_from <= onDate);
    if (match) return match;
  } else if (!index) {
    const applicable = sortPricingHistoryEntries(
      history.filter(
        (row) =>
          row.client_id === clientId &&
          row.product_id === productId &&
          row.effective_from <= onDate,
      ),
    );

    if (applicable.length > 0) {
      return applicable[0];
    }
  }

  const current = currentRules.find(
    (rule) => rule.client_id === clientId && rule.product_id === productId,
  );

  return current ?? null;
}

export function buildClientPricingHistoryRow(
  organizationId: string,
  clientProductPricingId: string,
  clientId: string,
  productId: string,
  rule: {
    price_rule_type: string;
    price_rule_value?: number | string | null;
    price_category_id?: string | null;
    fixed_base_value?: number | null;
    conditional_threshold?: number | null;
    conditional_discount_below?: number | null;
    conditional_discount_above_equal?: number | null;
    notes?: string | null;
  },
  createdBy: string,
  effectiveFrom?: string,
) {
  const today = getIndianToday();

  return {
    organization_id: organizationId,
    client_product_pricing_id: clientProductPricingId,
    client_id: clientId,
    product_id: productId,
    price_rule_type: rule.price_rule_type,
    price_rule_value:
      rule.price_rule_value != null ? Number(rule.price_rule_value) : null,
    price_category_id: rule.price_category_id ?? null,
    fixed_base_value:
      rule.fixed_base_value != null ? Number(rule.fixed_base_value) : null,
    conditional_threshold:
      rule.conditional_threshold != null
        ? Number(rule.conditional_threshold)
        : null,
    conditional_discount_below:
      rule.conditional_discount_below != null
        ? Number(rule.conditional_discount_below)
        : null,
    conditional_discount_above_equal:
      rule.conditional_discount_above_equal != null
        ? Number(rule.conditional_discount_above_equal)
        : null,
    notes: rule.notes ?? null,
    effective_from: effectiveFrom || today,
    created_by: createdBy,
  };
}

export async function logClientPricingHistory(
  supabase: SupabaseClient,
  row: ReturnType<typeof buildClientPricingHistoryRow>,
) {
  const { error } = await supabase
    .from("client_product_pricing_history")
    .insert(row);

  if (error) {
    console.error("Failed to log client pricing history:", error);
  }
}
