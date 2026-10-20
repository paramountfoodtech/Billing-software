import { normalizeDateString } from "@/lib/date-time";

export type FyMonthlyRow = {
  monthKey: string;
  label: string;
  sale: number;
  purchase: number;
  expenses: number;
  gross: number;
  net: number;
};

type Dated = { total_amount: string | number; status?: string };

/** Month keys (YYYY-MM) for an April–March financial year, e.g. "2025-2026". */
export function getFyMonthKeys(fy: string): string[] {
  const [startYear] = fy.split("-").map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const monthIndex = (3 + i) % 12; // Apr = 3
    const year = startYear + (3 + i >= 12 ? 1 : 0);
    return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  });
}

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const name = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", {
    month: "short",
    timeZone: "UTC",
  });
  return `${normalizeDateString(name)} ${y}`;
}

/** Month-wise Sale / Purchase / Expenses / Gross / Net for one financial year. */
export function buildFyMonthlyRows(input: {
  fy: string;
  invoices: Array<Dated & { issue_date: string }>;
  purchases: Array<Dated & { issue_date: string }>;
  expenses: Array<{ total_amount: string | number; month: string | null }>;
}): { rows: FyMonthlyRow[]; total: FyMonthlyRow } {
  const keys = getFyMonthKeys(input.fy);
  const buckets = new Map(
    keys.map((k) => [k, { sale: 0, purchase: 0, expenses: 0 }]),
  );

  for (const inv of input.invoices) {
    if (inv.status === "cancelled") continue;
    const b = buckets.get(inv.issue_date.slice(0, 7));
    if (b) b.sale += Number(inv.total_amount);
  }
  for (const inv of input.purchases) {
    if (inv.status === "cancelled") continue;
    const b = buckets.get(inv.issue_date.slice(0, 7));
    if (b) b.purchase += Number(inv.total_amount);
  }
  for (const exp of input.expenses) {
    const b = exp.month ? buckets.get(exp.month) : undefined;
    if (b) b.expenses += Number(exp.total_amount);
  }

  const rows: FyMonthlyRow[] = keys.map((monthKey) => {
    const b = buckets.get(monthKey)!;
    const gross = b.sale - b.purchase;
    return {
      monthKey,
      label: monthLabel(monthKey),
      ...b,
      gross,
      net: gross - b.expenses,
    };
  });

  const sale = rows.reduce((s, r) => s + r.sale, 0);
  const purchase = rows.reduce((s, r) => s + r.purchase, 0);
  const expenses = rows.reduce((s, r) => s + r.expenses, 0);
  const gross = sale - purchase;

  return {
    rows,
    total: {
      monthKey: "total",
      label: `FY ${input.fy} total`,
      sale,
      purchase,
      expenses,
      gross,
      net: gross - expenses,
    },
  };
}
