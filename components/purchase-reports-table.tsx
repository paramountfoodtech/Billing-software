"use client";

import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { IconTooltip } from "@/components/icon-tooltip";
import { Input } from "@/components/ui/input";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  FileText,
} from "lucide-react";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/table-pagination";
import { useToast } from "@/hooks/use-toast";
import { exportToCSV, exportToPDF, ExportColumn, getTimestamp } from "@/lib/export-utils";

export interface PurchaserReportRow {
  id: string;
  name: string;
  purchase: number;
  todayPurchaseKg: number;
  todayPurchaseValue: number;
  purchaseKgs: number;
  payments: number;
  outstanding: number;
  oldBal: number;
}

export interface ChallanTrackingRow {
  id: string;
  challan_number: string;
  purchaser_name: string;
  challan_date: string;
  total_weight_kg: number;
  status: string;
  invoice_number: string | null;
}

interface PurchaseReportsTableProps {
  purchaserRows: PurchaserReportRow[];
  challanRows: ChallanTrackingRow[];
  monthLabel: string;
  activeTab: "purchaser" | "challan";
}

export function PurchaseReportsTable({
  purchaserRows,
  challanRows,
  monthLabel,
  activeTab,
}: PurchaseReportsTableProps) {
  const { toast } = useToast();
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [purchaserFilter, setPurchaserFilter] = useState("");
  const [challanFilter, setChallanFilter] = useState("");

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column)
      return <ArrowUpDown className="ml-2 h-4 w-4 inline opacity-40" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4 inline" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4 inline" />
    );
  };

  const processedPurchaserRows = useMemo(() => {
    let filtered = [...purchaserRows];
    if (purchaserFilter) {
      filtered = filtered.filter((r) =>
        r.name.toLowerCase().includes(purchaserFilter.toLowerCase()),
      );
    }
    if (sortColumn) {
      filtered.sort((a, b) => {
        const aVal = (a as Record<string, unknown>)[sortColumn] as number | string;
        const bVal = (b as Record<string, unknown>)[sortColumn] as number | string;
        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [purchaserRows, purchaserFilter, sortColumn, sortDirection]);

  const processedChallanRows = useMemo(() => {
    let filtered = [...challanRows];
    if (challanFilter) {
      const q = challanFilter.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.challan_number.toLowerCase().includes(q) ||
          r.purchaser_name.toLowerCase().includes(q) ||
          (r.invoice_number || "").toLowerCase().includes(q),
      );
    }
    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal: string | number = "";
        let bVal: string | number = "";
        switch (sortColumn) {
          case "challan_number":
            aVal = a.challan_number;
            bVal = b.challan_number;
            break;
          case "purchaser_name":
            aVal = a.purchaser_name;
            bVal = b.purchaser_name;
            break;
          case "challan_date":
            aVal = a.challan_date;
            bVal = b.challan_date;
            break;
          case "total_weight_kg":
            aVal = a.total_weight_kg;
            bVal = b.total_weight_kg;
            break;
          case "status":
            aVal = a.status;
            bVal = b.status;
            break;
        }
        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [challanRows, challanFilter, sortColumn, sortDirection]);

  const activeRows =
    activeTab === "purchaser" ? processedPurchaserRows : processedChallanRows;
  const pagination = usePagination({ items: activeRows, itemsPerPage });

  const handleExportPurchaserCSV = () => {
    const columns: ExportColumn[] = [
      { key: "name", label: "Purchaser" },
      { key: "purchase", label: "Purchase (Rs)", formatter: (v) => v.toFixed(2) },
      { key: "purchaseKgs", label: "Weight (KG)", formatter: (v) => v.toFixed(3) },
      { key: "payments", label: "Payments (Rs)", formatter: (v) => v.toFixed(2) },
      { key: "outstanding", label: "Outstanding (Rs)", formatter: (v) => v.toFixed(2) },
      { key: "oldBal", label: "Old Balance (Rs)", formatter: (v) => v.toFixed(2) },
    ];
    exportToCSV(
      processedPurchaserRows,
      columns,
      `purchase-report-${getTimestamp()}.csv`,
    );
    toast({ variant: "success", title: "Exported", description: "Report exported to CSV." });
  };

  const handleExportPurchaserPDF = async () => {
    const enriched = processedPurchaserRows.map((r) => ({
      name: r.name,
      purchase_fmt: `Rs.${r.purchase.toFixed(2)}`,
      kgs_fmt: r.purchaseKgs.toFixed(3),
      payments_fmt: `Rs.${r.payments.toFixed(2)}`,
      outstanding_fmt: `Rs.${r.outstanding.toFixed(2)}`,
      oldBal_fmt: `Rs.${r.oldBal.toFixed(2)}`,
    }));
    await exportToPDF(
      enriched,
      [
        { key: "name", label: "Purchaser", widthFrac: 0.22 },
        { key: "purchase_fmt", label: "Purchase", widthFrac: 0.16, align: "right" },
        { key: "kgs_fmt", label: "Weight KG", widthFrac: 0.12, align: "right" },
        { key: "payments_fmt", label: "Payments", widthFrac: 0.16, align: "right" },
        { key: "outstanding_fmt", label: "Outstanding", widthFrac: 0.17, align: "right" },
        { key: "oldBal_fmt", label: "Old Bal", widthFrac: 0.17, align: "right" },
      ],
      `Purchase Report — ${monthLabel}`,
      `purchase-report-${getTimestamp()}.pdf`,
    );
    toast({ variant: "success", title: "Exported", description: "Report exported to PDF." });
  };

  const handleExportChallanCSV = () => {
    const columns: ExportColumn[] = [
      { key: "challan_number", label: "Challan" },
      { key: "purchaser_name", label: "Purchaser" },
      { key: "challan_date", label: "Date" },
      { key: "total_weight_kg", label: "Weight (KG)", formatter: (v) => v.toFixed(3) },
      { key: "status", label: "Status" },
      { key: "invoice_number", label: "Invoice" },
    ];
    exportToCSV(
      processedChallanRows.map((r) => ({
        ...r,
        invoice_number: r.invoice_number || "",
      })),
      columns,
      `challan-tracking-${getTimestamp()}.csv`,
    );
    toast({ variant: "success", title: "Exported", description: "Report exported to CSV." });
  };

  const handleExportChallanPDF = async () => {
    const enriched = processedChallanRows.map((r) => ({
      challan_number: r.challan_number,
      purchaser_name: r.purchaser_name,
      challan_date: r.challan_date,
      weight_fmt: r.total_weight_kg.toFixed(3),
      status: r.status,
      invoice_number: r.invoice_number || "—",
    }));
    await exportToPDF(
      enriched,
      [
        { key: "challan_number", label: "Challan", widthFrac: 0.14 },
        { key: "purchaser_name", label: "Purchaser", widthFrac: 0.22 },
        { key: "challan_date", label: "Date", widthFrac: 0.12 },
        { key: "weight_fmt", label: "Weight", widthFrac: 0.12, align: "right" },
        { key: "status", label: "Status", widthFrac: 0.14 },
        { key: "invoice_number", label: "Invoice", widthFrac: 0.14 },
      ],
      `Challan Tracking — ${monthLabel}`,
      `challan-tracking-${getTimestamp()}.pdf`,
    );
    toast({ variant: "success", title: "Exported", description: "Report exported to PDF." });
  };

  if (activeTab === "challan") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">Challan vs Invoice Tracking — {monthLabel}</h3>
          <div className="flex gap-2">
            <IconTooltip label="Export to CSV">
              <Button variant="outline" size="sm" onClick={handleExportChallanCSV}>
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
            </IconTooltip>
            <IconTooltip label="Export to PDF">
              <Button variant="outline" size="sm" onClick={handleExportChallanPDF}>
                <FileText className="h-4 w-4 mr-2" />
                PDF
              </Button>
            </IconTooltip>
          </div>
        </div>
        <div className="rounded-lg border bg-white overflow-x-auto">
          <Table className="text-xs sm:text-sm">
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("challan_number")}
                >
                  Challan <SortIcon column="challan_number" />
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("purchaser_name")}
                >
                  Purchaser <SortIcon column="purchaser_name" />
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("challan_date")}
                >
                  Date <SortIcon column="challan_date" />
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("total_weight_kg")}
                >
                  Weight (KG) <SortIcon column="total_weight_kg" />
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("status")}
                >
                  Status <SortIcon column="status" />
                </TableHead>
                <TableHead>Invoice</TableHead>
              </TableRow>
              <TableRow>
                <TableHead colSpan={6}>
                  <Input
                    placeholder="Filter challan, purchaser, or invoice..."
                    value={challanFilter}
                    onChange={(e) => setChallanFilter(e.target.value)}
                    className="h-7 text-xs max-w-sm"
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagination.paginatedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No challans for this period.
                  </TableCell>
                </TableRow>
              ) : (
                pagination.paginatedItems.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono">{row.challan_number}</TableCell>
                    <TableCell>{row.purchaser_name}</TableCell>
                    <TableCell>{row.challan_date}</TableCell>
                    <TableCell>{row.total_weight_kg.toFixed(3)}</TableCell>
                    <TableCell className="capitalize">{row.status}</TableCell>
                    <TableCell>{row.invoice_number || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <TablePagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={pagination.goToPage}
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={setItemsPerPage}
          totalItems={processedChallanRows.length}
        />
      </div>
    );
  }

  const totals = processedPurchaserRows.reduce(
    (acc, row) => ({
      purchase: acc.purchase + row.purchase,
      purchaseKgs: acc.purchaseKgs + row.purchaseKgs,
      payments: acc.payments + row.payments,
      outstanding: acc.outstanding + row.outstanding,
    }),
    { purchase: 0, purchaseKgs: 0, payments: 0, outstanding: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">Purchaser-wise Report — {monthLabel}</h3>
        <div className="flex gap-2">
          <IconTooltip label="Export to CSV">
            <Button variant="outline" size="sm" onClick={handleExportPurchaserCSV}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
          </IconTooltip>
          <IconTooltip label="Export to PDF">
            <Button variant="outline" size="sm" onClick={handleExportPurchaserPDF}>
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </IconTooltip>
        </div>
      </div>
      <div className="rounded-lg border bg-white overflow-x-auto">
        <Table className="text-xs sm:text-sm">
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("name")}
              >
                Purchaser <SortIcon column="name" />
              </TableHead>
              <TableHead
                className="text-right cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("purchase")}
              >
                Purchase (₹) <SortIcon column="purchase" />
              </TableHead>
              <TableHead
                className="text-right cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("purchaseKgs")}
              >
                Weight (KG) <SortIcon column="purchaseKgs" />
              </TableHead>
              <TableHead
                className="text-right cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("payments")}
              >
                Payments (₹) <SortIcon column="payments" />
              </TableHead>
              <TableHead
                className="text-right cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("outstanding")}
              >
                Outstanding (₹) <SortIcon column="outstanding" />
              </TableHead>
              <TableHead
                className="text-right cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("oldBal")}
              >
                Old Bal (₹) <SortIcon column="oldBal" />
              </TableHead>
            </TableRow>
            <TableRow>
              <TableHead colSpan={6}>
                <Input
                  placeholder="Filter purchaser..."
                  value={purchaserFilter}
                  onChange={(e) => setPurchaserFilter(e.target.value)}
                  className="h-7 text-xs max-w-sm"
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No purchase data for this period.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {pagination.paginatedItems.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right">
                      ₹{row.purchase.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">{row.purchaseKgs.toFixed(3)}</TableCell>
                    <TableCell className="text-right">
                      ₹{row.payments.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      ₹{row.outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      ₹{row.oldBal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-slate-50">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">
                    ₹{totals.purchase.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">{totals.purchaseKgs.toFixed(3)}</TableCell>
                  <TableCell className="text-right">
                    ₹{totals.payments.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    ₹{totals.outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
      <TablePagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        onPageChange={pagination.goToPage}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={setItemsPerPage}
        totalItems={processedPurchaserRows.length}
      />
    </div>
  );
}
