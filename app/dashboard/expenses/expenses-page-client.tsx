"use client";

import { useState } from "react";
import { ExpensesTable } from "@/components/expenses-table";
import {
  FinancialYearSelector,
  getFinancialYear,
  getFinancialYearDateRange,
} from "@/components/financial-year-selector";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ExpenseEntryRow } from "@/components/expenses-table";

interface ExpensesPageClientProps {
  entries: ExpenseEntryRow[];
  userRole?: string;
}

export function ExpensesPageClient({
  entries,
  userRole,
}: ExpensesPageClientProps) {
  const [selectedFY, setSelectedFY] = useState<string>(getFinancialYear());
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const filteredEntries = entries.filter((entry) => {
    const { start, end } = getFinancialYearDateRange(selectedFY);
    const issueDate = entry.issue_date;
    if (issueDate < start || issueDate > end) return false;
    if (fromDate && issueDate < fromDate) return false;
    if (toDate && issueDate > toDate) return false;
    return true;
  });

  return (
    <ExpensesTable
      entries={filteredEntries}
      userRole={userRole}
      fromDate={fromDate}
      toDate={toDate}
      toolbarLeft={
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">FY:</span>
            <FinancialYearSelector
              selectedYear={selectedFY}
              onYearChange={setSelectedFY}
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="from_date" className="text-sm text-muted-foreground">
              From
            </Label>
            <Input
              id="from_date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-auto h-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="to_date" className="text-sm text-muted-foreground">
              To
            </Label>
            <Input
              id="to_date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-auto h-9"
            />
          </div>
        </div>
      }
    />
  );
}
