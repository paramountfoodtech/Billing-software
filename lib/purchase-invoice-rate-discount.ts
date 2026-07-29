import {
  buildPriceCategoryDateLookup,
  getPriceForCategoryOnDate,
  getPriceForCategoryOnDateFromLookup,
  type PriceCategoryHistoryEntry,
} from "@/lib/utils";

export type PurchaseInvoiceForRateDiscount = {
  issue_date: string;
  price_per_kg: string | number;
};

export function getPurchaseInvoiceRateDiscount(
  invoice: PurchaseInvoiceForRateDiscount,
  liveCategoryId: string | null | undefined,
  priceHistory: PriceCategoryHistoryEntry[],
): number | null {
  if (!liveCategoryId) return null;
  const enteredRate = Number(invoice.price_per_kg || 0);
  if (enteredRate <= 0) return null;
  const liveRate = getPriceForCategoryOnDate(
    liveCategoryId,
    invoice.issue_date,
    priceHistory,
  );
  if (liveRate == null) return null;
  return enteredRate - liveRate;
}

export function getPurchaseInvoiceRateDiscountFromLookup(
  invoice: PurchaseInvoiceForRateDiscount,
  liveCategoryId: string | null | undefined,
  lookup: Map<string, number>,
): number | null {
  if (!liveCategoryId) return null;
  const enteredRate = Number(invoice.price_per_kg || 0);
  if (enteredRate <= 0) return null;
  const liveRate = getPriceForCategoryOnDateFromLookup(
    liveCategoryId,
    invoice.issue_date,
    lookup,
  );
  if (liveRate == null) return null;
  return enteredRate - liveRate;
}

export function createPurchaseInvoiceRateDiscountLookup(
  priceHistory: PriceCategoryHistoryEntry[],
) {
  return buildPriceCategoryDateLookup(priceHistory);
}

export function formatPurchaseInvoiceRateDiscount(
  value: number | null,
  options?: { includeUnit?: boolean; currencySymbol?: string },
): string {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  const currency = options?.currencySymbol ?? "₹";
  const amount = `${sign}${currency}${value.toFixed(2)}`;
  return options?.includeUnit === false ? amount : `${amount} / KG`;
}
