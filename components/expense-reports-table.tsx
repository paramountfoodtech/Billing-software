"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ExpenseReportCategoryRow {
  categoryId: string;
  categoryName: string;
  slug: string | null;
  entryCount: number;
  totalAmount: number;
  salaryMonth?: string | null;
}

export interface ExpenseSalaryMonthRow {
  month: string;
  totalAmount: number;
  entryCount: number;
}

interface ExpenseReportsTableProps {
  categoryRows: ExpenseReportCategoryRow[];
  salaryMonthRows: ExpenseSalaryMonthRow[];
  monthLabel: string;
  grandTotal: number;
}

function formatINR(amount: number) {
  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatSalaryMonth(month: string) {
  return new Date(`${month}-01`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export function ExpenseReportsTable({
  categoryRows,
  salaryMonthRows,
  monthLabel,
  grandTotal,
}: ExpenseReportsTableProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Expenses by Category — {monthLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          {categoryRows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No expense entries for this month
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Entries</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryRows.map((row) => (
                  <TableRow key={row.categoryId}>
                    <TableCell className="font-medium">
                      {row.categoryName}
                    </TableCell>
                    <TableCell className="text-right">{row.entryCount}</TableCell>
                    <TableCell className="text-right font-medium">
                      ₹{formatINR(row.totalAmount)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell />
                  <TableCell className="text-right">₹{formatINR(grandTotal)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {salaryMonthRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Salary by Month (entries in {monthLabel})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Salary Month</TableHead>
                  <TableHead className="text-right">Entries</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salaryMonthRows.map((row) => (
                  <TableRow key={row.month}>
                    <TableCell className="font-medium">
                      {formatSalaryMonth(row.month)}
                    </TableCell>
                    <TableCell className="text-right">{row.entryCount}</TableCell>
                    <TableCell className="text-right font-medium">
                      ₹{formatINR(row.totalAmount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
