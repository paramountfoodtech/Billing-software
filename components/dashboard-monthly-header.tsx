"use client";

import { MonthYearPicker } from "@/components/month-year-picker";

interface DashboardMonthlyHeaderProps {
  reportYear: number;
  reportMonth: number;
  monthLabel: string;
}

export function DashboardMonthlyHeader({
  reportYear,
  reportMonth,
  monthLabel,
}: DashboardMonthlyHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs sm:text-sm text-muted-foreground">
        Monthly summary:{" "}
        <span className="font-semibold text-foreground">{monthLabel}</span>
      </p>
      <MonthYearPicker
        currentYear={reportYear}
        currentMonth={reportMonth}
        basePath="/dashboard"
      />
    </div>
  );
}
