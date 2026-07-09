"use client";

import { MonthYearPicker } from "@/components/month-year-picker";
import {
  ExpenseReportsTable,
  type ExpenseReportCategoryRow,
  type ExpenseSalaryMonthRow,
} from "@/components/expense-reports-table";

interface ExpenseReportsPageClientProps {
  reportYear: number;
  reportMonth: number;
  monthLabel: string;
  categoryRows: ExpenseReportCategoryRow[];
  salaryMonthRows: ExpenseSalaryMonthRow[];
  grandTotal: number;
}

export function ExpenseReportsPageClient({
  reportYear,
  reportMonth,
  monthLabel,
  categoryRows,
  salaryMonthRows,
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
        </div>
        <MonthYearPicker
          currentYear={reportYear}
          currentMonth={reportMonth}
          basePath="/dashboard/expenses/reports"
        />
      </div>

      <ExpenseReportsTable
        categoryRows={categoryRows}
        salaryMonthRows={salaryMonthRows}
        monthLabel={monthLabel}
        grandTotal={grandTotal}
      />
    </div>
  );
}
