import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper";
import { ExpenseReportsPageClient } from "@/components/expense-reports-page-client";
import type {
  ExpenseReportCategoryRow,
  ExpenseSalaryMonthRow,
} from "@/components/expense-reports-table";

export const revalidate = 0;

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
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "super_admin" && profile.role !== "admin")) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const today = new Date();
  const reportYear = params.year ? parseInt(params.year) : today.getFullYear();
  const reportMonth = params.month ? parseInt(params.month) : today.getMonth() + 1;

  const monthStart = `${reportYear}-${String(reportMonth).padStart(2, "0")}-01`;
  const daysInMonth = new Date(reportYear, reportMonth, 0).getDate();
  const monthEnd = `${reportYear}-${String(reportMonth).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const monthLabel = new Date(reportYear, reportMonth - 1, 1).toLocaleDateString(
    "en-IN",
    { month: "long", year: "numeric" },
  );

  const { data: monthEntries } = await supabase
    .from("expense_entries")
    .select(
      `
      id,
      total_amount,
      salary_month,
      expense_categories(id, name, slug)
    `,
    )
    .gte("issue_date", monthStart)
    .lte("issue_date", monthEnd)
    .neq("status", "cancelled");

  const entries = monthEntries || [];

  const categoryMap = new Map<string, ExpenseReportCategoryRow>();
  const salaryMonthMap = new Map<string, ExpenseSalaryMonthRow>();

  for (const entry of entries) {
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

    if (cat.slug === "salary" && entry.salary_month) {
      const sm = entry.salary_month as string;
      const salaryRow = salaryMonthMap.get(sm);
      if (salaryRow) {
        salaryRow.entryCount += 1;
        salaryRow.totalAmount += amount;
      } else {
        salaryMonthMap.set(sm, {
          month: sm,
          entryCount: 1,
          totalAmount: amount,
        });
      }
    }
  }

  const categoryRows = Array.from(categoryMap.values()).sort(
    (a, b) => b.totalAmount - a.totalAmount,
  );
  const salaryMonthRows = Array.from(salaryMonthMap.values()).sort((a, b) =>
    a.month.localeCompare(b.month),
  );
  const grandTotal = categoryRows.reduce((sum, r) => sum + r.totalAmount, 0);

  return (
    <DashboardPageWrapper title="Expense Reports">
      <Suspense
        fallback={
          <div className="w-full p-8 text-sm text-muted-foreground">
            Loading expense reports…
          </div>
        }
      >
        <ExpenseReportsPageClient
          reportYear={reportYear}
          reportMonth={reportMonth}
          monthLabel={monthLabel}
          categoryRows={categoryRows}
          salaryMonthRows={salaryMonthRows}
          grandTotal={grandTotal}
        />
      </Suspense>
    </DashboardPageWrapper>
  );
}
