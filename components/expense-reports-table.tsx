"use client";

import { useMemo } from "react";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconTooltip } from "@/components/icon-tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import {
  exportToCSV,
  exportToPDF,
  type ExportColumn,
  getTimestamp,
} from "@/lib/export-utils";

export interface ExpenseReportCategoryRow {
  categoryId: string;
  categoryName: string;
  slug: string | null;
  entryCount: number;
  totalAmount: number;
  entryMonth?: string | null;
}

interface ExpenseReportsTableProps {
  categoryRows: ExpenseReportCategoryRow[];
  monthLabel: string;
  grandTotal: number;
}

const PIE_COLORS = [
  "#2563eb",
  "#16a34a",
  "#ea580c",
  "#9333ea",
  "#db2777",
  "#0891b2",
  "#ca8a04",
  "#4f46e5",
  "#dc2626",
  "#0d9488",
];

const OTHER_COLOR = "#94a3b8";
const MAX_PIE_SLICES = 6;

function formatINR(amount: number) {
  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type PieSlice = {
  name: string;
  value: number;
  color: string;
  percent: number;
};

/** Keep the largest categories; fold the rest into "Other". */
function buildPieSlices(
  rows: ExpenseReportCategoryRow[],
  total: number,
): PieSlice[] {
  const positive = rows
    .filter((row) => row.totalAmount > 0)
    .sort((a, b) => b.totalAmount - a.totalAmount);

  if (positive.length === 0 || total <= 0) return [];

  const top = positive.slice(0, MAX_PIE_SLICES - 1);
  const rest = positive.slice(MAX_PIE_SLICES - 1);
  const restTotal = rest.reduce((sum, row) => sum + row.totalAmount, 0);

  const slices: PieSlice[] = top.map((row, index) => ({
    name: row.categoryName,
    value: row.totalAmount,
    color: PIE_COLORS[index % PIE_COLORS.length],
    percent: row.totalAmount / total,
  }));

  if (rest.length === 1) {
    slices.push({
      name: rest[0].categoryName,
      value: rest[0].totalAmount,
      color: PIE_COLORS[slices.length % PIE_COLORS.length],
      percent: rest[0].totalAmount / total,
    });
  } else if (rest.length > 1 && restTotal > 0) {
    slices.push({
      name: `Other (${rest.length})`,
      value: restTotal,
      color: OTHER_COLOR,
      percent: restTotal / total,
    });
  }

  return slices;
}

export function ExpenseReportsTable({
  categoryRows,
  monthLabel,
  grandTotal,
}: ExpenseReportsTableProps) {
  const { toast } = useToast();

  const pieData = useMemo(
    () => buildPieSlices(categoryRows, grandTotal),
    [categoryRows, grandTotal],
  );

  const exportRows = categoryRows.map((row) => ({
    category: row.categoryName,
    entries: row.entryCount,
    total_amount: row.totalAmount,
    total_amount_fmt: `Rs.${formatINR(row.totalAmount)}`,
  }));

  const handleExportCSV = () => {
    if (exportRows.length === 0) return;

    const columns: ExportColumn[] = [
      { key: "category", label: "Category" },
      { key: "entries", label: "Entries" },
      {
        key: "total_amount",
        label: "Total Amount",
        formatter: (value) => Number(value || 0).toFixed(2),
      },
    ];

    const rowsWithTotal = [
      ...exportRows,
      {
        category: "Total",
        entries: "",
        total_amount: grandTotal,
        total_amount_fmt: `Rs.${formatINR(grandTotal)}`,
      },
    ];

    exportToCSV(
      rowsWithTotal,
      columns,
      `expense-report-${monthLabel.replace(/\s+/g, "-").toLowerCase()}-${getTimestamp()}.csv`,
    );
    toast({
      variant: "success",
      title: "Exported",
      description: `${categoryRows.length} category row(s) exported to CSV successfully.`,
    });
  };

  const handleExportPDF = async () => {
    if (exportRows.length === 0) return;

    const columns: ExportColumn[] = [
      { key: "category", label: "Category" },
      { key: "entries", label: "Entries" },
      { key: "total_amount_fmt", label: "Total Amount" },
    ];

    const rowsWithTotal = [
      ...exportRows,
      {
        category: "Total",
        entries: "",
        total_amount: grandTotal,
        total_amount_fmt: `Rs.${formatINR(grandTotal)}`,
      },
    ];

    await exportToPDF(
      rowsWithTotal,
      columns,
      `Expense Report (${monthLabel})`,
      `expense-report-${monthLabel.replace(/\s+/g, "-").toLowerCase()}-${getTimestamp()}.pdf`,
    );
    toast({
      variant: "success",
      title: "Exported",
      description: `${categoryRows.length} category row(s) exported to PDF successfully.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <IconTooltip label="Export to CSV">
          <Button
            onClick={handleExportCSV}
            size="sm"
            variant="outline"
            disabled={categoryRows.length === 0}
          >
            <Download className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">CSV</span>
          </Button>
        </IconTooltip>
        <IconTooltip label="Export to PDF">
          <Button
            onClick={handleExportPDF}
            size="sm"
            variant="outline"
            disabled={categoryRows.length === 0}
          >
            <FileText className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">PDF</span>
          </Button>
        </IconTooltip>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
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
                    <TableCell className="text-right">
                      ₹{formatINR(grandTotal)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category Share</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="h-[320px] flex items-center justify-center text-muted-foreground">
                No expense data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={360}>
                <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="42%"
                    innerRadius={48}
                    outerRadius={88}
                    paddingAngle={pieData.length > 1 ? 2 : 0}
                    dataKey="value"
                    nameKey="name"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => {
                      const amount = Number(value ?? 0);
                      const pct =
                        grandTotal > 0
                          ? ((amount / grandTotal) * 100).toFixed(1)
                          : "0.0";
                      return [`₹${formatINR(amount)} (${pct}%)`, String(name)];
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    align="center"
                    layout="horizontal"
                    wrapperStyle={{
                      paddingTop: 12,
                      maxHeight: 96,
                      overflowY: "auto",
                      fontSize: 12,
                      lineHeight: "18px",
                    }}
                    formatter={(value) => {
                      const slice = pieData.find((s) => s.name === value);
                      if (!slice) return value;
                      return `${value} (${(slice.percent * 100).toFixed(0)}%)`;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
