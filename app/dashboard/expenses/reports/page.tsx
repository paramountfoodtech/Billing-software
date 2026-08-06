import { createClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/supabase/fetch-all";
import { redirect } from "next/navigation";
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper";
import { ExpenseReportsPageClient } from "@/components/expense-reports-page-client";
import {
  buildExpenseCategoryRows,
  dedupeExpenseEntriesById,
  resolveReportMonthYear,
  type ExpenseEntryForReport,
} from "@/lib/expense-report-aggregation";

export const revalidate = 0;

const ENTRY_SELECT = `
  id,
  total_amount,
  entry_month,
  issue_date,
  description,
  notes,
  expense_categories(id, name, slug)
`;

export default async function ExpenseReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();

  if (
    !profile?.organization_id ||
    (profile.role !== "super_admin" && profile.role !== "admin")
  ) {
    redirect("/dashboard");
  }

  const organizationId = profile.organization_id;
  const params = await searchParams;
  const {
    reportYear,
    reportMonth,
    reportMonthKey,
    monthStart,
    monthEnd,
    monthLabel,
  } = resolveReportMonthYear(params);

  // Prefer entry_month; fall back to issue_date for legacy rows.
  // Paid salaries come from payroll (hr_salary), not expense_entries.
  const [byEntryMonth, legacyByIssueDate, paidSalaries, linkedExpenseIds] =
    await Promise.all([
      fetchAllPages<ExpenseEntryForReport>(async (from, to) => {
        const { data, error } = await supabase
          .from("expense_entries")
          .select(ENTRY_SELECT)
          .eq("organization_id", organizationId)
          .eq("entry_month", reportMonthKey)
          .neq("status", "cancelled")
          .order("id", { ascending: true })
          .range(from, to);
        return { data: data as ExpenseEntryForReport[] | null, error };
      }),
      fetchAllPages<ExpenseEntryForReport>(async (from, to) => {
        const { data, error } = await supabase
          .from("expense_entries")
          .select(ENTRY_SELECT)
          .eq("organization_id", organizationId)
          .is("entry_month", null)
          .gte("issue_date", monthStart)
          .lte("issue_date", monthEnd)
          .neq("status", "cancelled")
          .order("id", { ascending: true })
          .range(from, to);
        return { data: data as ExpenseEntryForReport[] | null, error };
      }),
      fetchAllPages<{ net_payable: string | number }>(async (from, to) => {
        const { data, error } = await supabase
          .from("hr_salary")
          .select("net_payable")
          .eq("organization_id", organizationId)
          .eq("salary_month", reportMonthKey)
          .eq("payment_status", "paid")
          .order("id", { ascending: true })
          .range(from, to);
        return { data, error };
      }),
      fetchAllPages<{ expense_entry_id: string }>(async (from, to) => {
        const { data, error } = await supabase
          .from("hr_salary")
          .select("expense_entry_id")
          .eq("organization_id", organizationId)
          .not("expense_entry_id", "is", null)
          .order("id", { ascending: true })
          .range(from, to);
        return { data, error };
      }),
    ]);

  const entries = dedupeExpenseEntriesById([
    ...byEntryMonth,
    ...legacyByIssueDate,
  ]);
  const linkedExpenseEntryIds = new Set(
    linkedExpenseIds.map((row) => row.expense_entry_id),
  );

  const { categoryRows, grandTotal } = buildExpenseCategoryRows(
    entries,
    paidSalaries,
    linkedExpenseEntryIds,
  );

  return (
    <DashboardPageWrapper title="Expense Reports">
      <ExpenseReportsPageClient
        reportYear={reportYear}
        reportMonth={reportMonth}
        monthLabel={monthLabel}
        categoryRows={categoryRows}
        grandTotal={grandTotal}
      />
    </DashboardPageWrapper>
  );
}
