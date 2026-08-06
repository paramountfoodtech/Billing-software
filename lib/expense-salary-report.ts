/**
 * Helpers for relating payroll salaries to expense reporting without
 * treating salary as a regular expense entry.
 */

export type ExpenseEntryForSalaryFilter = {
  id?: string;
  notes?: string | null;
  description?: string | null;
  expense_categories?:
    | { slug?: string | null }
    | { slug?: string | null }[]
    | null;
};

export function isLegacySalaryExpenseEntry(
  entry: ExpenseEntryForSalaryFilter,
  linkedExpenseEntryIds?: Set<string>,
): boolean {
  if (entry.id && linkedExpenseEntryIds?.has(entry.id)) return true;

  const catRaw = entry.expense_categories;
  const cat = Array.isArray(catRaw) ? catRaw[0] : catRaw;
  if (cat?.slug === "salary") return true;
  if (entry.notes?.includes("Auto-generated salary expense")) return true;
  if (entry.description?.startsWith("Salary:")) return true;
  return false;
}
