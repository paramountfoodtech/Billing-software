/** Helpers for purchase invoices linked to one or more challans. */

export function formatChallanNumbers(
  numbers: Array<string | null | undefined>,
  empty = "—",
): string {
  const cleaned = numbers
    .map((n) => (n || "").trim())
    .filter(Boolean);
  if (cleaned.length === 0) return empty;
  return cleaned.join(", ");
}

export function sumChallanWeightKg(
  challans: Array<{ total_weight_kg?: string | number | null }>,
): number {
  return challans.reduce(
    (sum, c) => sum + (Number(c.total_weight_kg) || 0),
    0,
  );
}

export function sumChallanBirds(
  challans: Array<{ total_birds?: number | null }>,
): number {
  return challans.reduce(
    (sum, c) => sum + Math.max(0, Math.round(Number(c.total_birds) || 0)),
    0,
  );
}
