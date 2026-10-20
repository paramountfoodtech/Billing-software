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
    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="bi-eyebrow !mb-0 flex-1">
        <span>Monthly summary</span>
        <span className="bi-chip normal-case tracking-normal font-normal" data-tone="accent">
          <strong>{monthLabel}</strong>
        </span>
      </h2>
      <MonthYearPicker
        currentYear={reportYear}
        currentMonth={reportMonth}
        basePath="/dashboard"
      />
    </div>
  );
}
