import { getIndianCurrentMonth } from "@/lib/date-time";
import {
  isLegacySalaryExpenseEntry,
  type ExpenseEntryForSalaryFilter,
} from "@/lib/expense-salary-report";
import type { ExpenseReportCategoryRow } from "@/components/expense-reports-table";

export type ExpenseEntryForReport = ExpenseEntryForSalaryFilter & {
  id: string;
  total_amount: string | number;
  entry_month?: string | null;
  issue_date?: string | null;
  expense_categories?:
    | { id: string; name: string; slug: string | null }
    | { id: string; name: string; slug: string | null }[]
    | null;
};

export type PaidSalaryForReport = {
  net_payable: string | number;
  salary_month?: string;
};

/** Resolve report month/year from query params using IST defaults. */
export function resolveReportMonthYear(params: {
  month?: string;
  year?: string;
}): {
  reportYear: number;
  reportMonth: number;
  reportMonthKey: string;
  monthStart: string;
  monthEnd: string;
  monthLabel: string;
} {
  const current = getIndianCurrentMonth();
  const [currentYear, currentMonth] = current.split("-").map(Number);

  let reportYear = params.year ? parseInt(params.year, 10) : currentYear;
  let reportMonth = params.month ? parseInt(params.month, 10) : currentMonth;

  if (!Number.isFinite(reportYear) || reportYear < 2000 || reportYear > 2100) {
    reportYear = currentYear;
  }
  if (!Number.isFinite(reportMonth) || reportMonth < 1 || reportMonth > 12) {
    reportMonth = currentMonth;
  }

  const reportMonthKey = `${reportYear}-${String(reportMonth).padStart(2, "0")}`;
  const monthStart = `${reportMonthKey}-01`;
  const daysInMonth = new Date(reportYear, reportMonth, 0).getDate();
  const monthEnd = `${reportMonthKey}-${String(daysInMonth).padStart(2, "0")}`;
  const monthLabel = new Date(reportYear, reportMonth - 1, 1).toLocaleDateString(
    "en-IN",
    { month: "long", year: "numeric" },
  );

  return {
    reportYear,
    reportMonth,
    reportMonthKey,
    monthStart,
    monthEnd,
    monthLabel,
  };
}

export function dedupeExpenseEntriesById<T extends { id: string }>(
  entries: T[],
): T[] {
  const byId = new Map<string, T>();
  for (const entry of entries) {
    byId.set(entry.id, entry);
  }
  return Array.from(byId.values());
}

/** Aggregate expense categories + paid payroll salaries into report rows. */
export function buildExpenseCategoryRows(
  entries: ExpenseEntryForReport[],
  paidSalaries: PaidSalaryForReport[],
  linkedExpenseEntryIds?: Set<string>,
): { categoryRows: ExpenseReportCategoryRow[]; grandTotal: number } {
  const categoryMap = new Map<string, ExpenseReportCategoryRow>();

  for (const entry of entries) {
    if (isLegacySalaryExpenseEntry(entry, linkedExpenseEntryIds)) continue;

    const catRaw = entry.expense_categories;
    const cat = (Array.isArray(catRaw) ? catRaw[0] : catRaw) as {
      id: string;
      name: string;
      slug: string | null;
    } | null;
    if (!cat) continue;

    const amount = Number(entry.total_amount);
    const existing = categoryMap.get(cat.id);
    if (existing) {
      existing.entryCount += 1;
      existing.totalAmount += amount;
    } else {
      categoryMap.set(cat.id, {
        categoryId: cat.id,
        categoryName: cat.name,
        slug: cat.slug,
        entryCount: 1,
        totalAmount: amount,
      });
    }
  }

  if (paidSalaries.length > 0) {
    const salaryTotal = paidSalaries.reduce(
      (sum, row) => sum + Number(row.net_payable),
      0,
    );
    categoryMap.set("payroll-salary", {
      categoryId: "payroll-salary",
      categoryName: "Salary",
      slug: "salary",
      entryCount: paidSalaries.length,
      totalAmount: salaryTotal,
    });
  }

  const categoryRows = Array.from(categoryMap.values()).sort(
    (a, b) => b.totalAmount - a.totalAmount,
  );
  const grandTotal = categoryRows.reduce((sum, r) => sum + r.totalAmount, 0);
  return { categoryRows, grandTotal };
}

/** Build KPI expense amounts (non-salary expenses + paid payroll). */
export function buildExpenseAmountsForKpi(
  entries: ExpenseEntryForSalaryFilter & {
    id?: string;
    total_amount: string | number;
  }[],
  paidSalaries: PaidSalaryForReport[],
  linkedExpenseEntryIds?: Set<string>,
): Array<{ total_amount: string | number }> {
  return [
    ...entries
      .filter((entry) => !isLegacySalaryExpenseEntry(entry, linkedExpenseEntryIds))
      .map((entry) => ({ total_amount: entry.total_amount })),
    ...paidSalaries.map((row) => ({ total_amount: row.net_payable })),
  ];
}
