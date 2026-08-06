"use client";

import { MonthYearPicker } from "@/components/month-year-picker";
import {
  ExpenseReportsTable,
  type ExpenseReportCategoryRow,
} from "@/components/expense-reports-table";

interface ExpenseReportsPageClientProps {
  reportYear: number;
  reportMonth: number;
  monthLabel: string;
  categoryRows: ExpenseReportCategoryRow[];
  grandTotal: number;
}

export function ExpenseReportsPageClient({
  reportYear,
  reportMonth,
  monthLabel,
  categoryRows,
  grandTotal,
}: ExpenseReportsPageClientProps) {
  return (
    <div className="w-full p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Monthly Report:{" "}
            <span className="font-semibold text-foreground">{monthLabel}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Includes expense entries for the selected month, plus paid payroll
            salaries. Salaries are not listed under Expenses — only paid ones
            appear here.
          </p>
        </div>
        <MonthYearPicker
          currentYear={reportYear}
          currentMonth={reportMonth}
          basePath="/dashboard/expenses/reports"
        />
      </div>

      <ExpenseReportsTable
        categoryRows={categoryRows}
        monthLabel={monthLabel}
        grandTotal={grandTotal}
      />
    </div>
  );
}
