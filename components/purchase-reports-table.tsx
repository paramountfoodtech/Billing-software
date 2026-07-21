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
  Files,
} from "lucide-react";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/table-pagination";
import { useToast } from "@/hooks/use-toast";
import { exportToCSV, exportToPDF, ExportColumn, getTimestamp } from "@/lib/export-utils";
import { createClient } from "@/lib/supabase/client";
import { exportConsolidatedPurchaseInvoicesPDF } from "@/lib/purchase-invoice-consolidated-pdf";
import { formatIndianDate, getIndianToday } from "@/lib/date-time";

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
  purchaser_id?: string | null;
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
  fromDate?: string;
  toDate?: string;
  selectedPurchaserId?: string | null;
  selectedPurchaserName?: string;
}

export function PurchaseReportsTable({
  purchaserRows,
  challanRows,
  monthLabel,
  activeTab,
  fromDate = "",
  toDate = "",
  selectedPurchaserId = null,
  selectedPurchaserName = "All Purchasers",
}: PurchaseReportsTableProps) {
  const { toast } = useToast();
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [purchaserFilter, setPurchaserFilter] = useState("");
  const [challanFilter, setChallanFilter] = useState("");
  const [isExporting, setIsExporting] = useState(false);

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

  const fetchExportInvoices = async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication required");

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      throw new Error("User must belong to an organization");
    }

    let query = supabase
      .from("purchase_invoices")
      .select(
        `
        id,
        invoice_number,
        purchaser_invoice_number,
        purchaser_id,
        issue_date,
        total_weight_kg,
        price_per_kg,
        total_amount,
        amount_paid,
        status,
        description,
        purchasers(name, purchaser_code),
        challans!purchase_invoices_challan_id_fkey(challan_number)
      `,
      )
      .eq("organization_id", profile.organization_id)
      .or("invoice_type.eq.challan,invoice_type.is.null")
      .order("issue_date", { ascending: true });

    if (fromDate) query = query.gte("issue_date", fromDate);
    if (toDate) query = query.lte("issue_date", toDate);
    if (selectedPurchaserId) {
      query = query.eq("purchaser_id", selectedPurchaserId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  };

  const fetchRelatedRows = async () => {
    if (!selectedPurchaserId) {
      return { payments: [] as any[], challans: [] as any[] };
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication required");

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      throw new Error("User must belong to an organization");
    }

    const { data: purchaserInvoices, error: invError } = await supabase
      .from("purchase_invoices")
      .select("id, invoice_number")
      .eq("organization_id", profile.organization_id)
      .eq("purchaser_id", selectedPurchaserId);

    if (invError) throw invError;

    const invoiceIds = (purchaserInvoices || []).map((i) => i.id);
    const invoiceNumberById = new Map(
      (purchaserInvoices || []).map((i) => [i.id, i.invoice_number]),
    );

    const [paymentsResult, challansResult] = await Promise.all([
      invoiceIds.length > 0
        ? supabase
            .from("purchase_payments")
            .select(
              "payment_date, amount, payment_method, notes, purchase_invoice_id",
            )
            .in("purchase_invoice_id", invoiceIds)
            .gte("payment_date", fromDate || "1900-01-01")
            .lte("payment_date", toDate || getIndianToday())
            .order("payment_date", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("challans")
        .select(
          "challan_number, challan_date, total_weight_kg, total_birds, status",
        )
        .eq("organization_id", profile.organization_id)
        .eq("purchaser_id", selectedPurchaserId)
        .gte("challan_date", fromDate || "1900-01-01")
        .lte("challan_date", toDate || getIndianToday())
        .order("challan_date", { ascending: true }),
    ]);

    if (paymentsResult.error) throw paymentsResult.error;
    if (challansResult.error) throw challansResult.error;

    return {
      payments: (paymentsResult.data || []).map((p: any) => ({
        ...p,
        invoice_number: invoiceNumberById.get(p.purchase_invoice_id) || "",
      })),
      challans: challansResult.data || [],
    };
  };

  const handleExportPurchaserCSV = async () => {
    setIsExporting(true);
    try {
      // Summary rows always
      const summaryColumns: ExportColumn[] = [
        { key: "name", label: "Purchaser" },
        { key: "purchase", label: "Purchase (Rs)", formatter: (v) => Number(v).toFixed(2) },
        { key: "purchaseKgs", label: "Weight (KG)", formatter: (v) => Number(v).toFixed(3) },
        { key: "payments", label: "Payments (Rs)", formatter: (v) => Number(v).toFixed(2) },
        { key: "outstanding", label: "Outstanding (Rs)", formatter: (v) => Number(v).toFixed(2) },
        { key: "oldBal", label: "Old Balance (Rs)", formatter: (v) => Number(v).toFixed(2) },
      ];

      if (!selectedPurchaserId) {
        exportToCSV(
          processedPurchaserRows,
          summaryColumns,
          `purchase-report-${getTimestamp()}.csv`,
        );
        toast({
          variant: "success",
          title: "Exported",
          description: "Purchaser report exported to CSV.",
        });
        return;
      }

      // Detailed CSV for selected purchaser: invoices + payments + challans
      const invoices = await fetchExportInvoices();
      const related = await fetchRelatedRows();
      const rows = [
        ...invoices.map((inv: any) => ({
          record_type: "Purchase Invoice",
          reference: inv.invoice_number,
          purchaser: inv.purchasers?.name || selectedPurchaserName,
          date: inv.issue_date,
          challan: inv.challans?.challan_number || "",
          weight_kg: Number(inv.total_weight_kg || 0).toFixed(3),
          amount: Number(inv.total_amount || 0).toFixed(2),
          paid: Number(inv.amount_paid || 0).toFixed(2),
          due: (
            Number(inv.total_amount || 0) - Number(inv.amount_paid || 0)
          ).toFixed(2),
          status: inv.status,
          notes: inv.description || "",
        })),
        ...related.payments.map((p: any) => ({
          record_type: "Payment",
          reference: p.invoice_number || "",
          purchaser: selectedPurchaserName,
          date: p.payment_date,
          challan: "",
          weight_kg: "",
          amount: Number(p.amount || 0).toFixed(2),
          paid: Number(p.amount || 0).toFixed(2),
          due: "",
          status: p.payment_method || "",
          notes: p.notes || "",
        })),
        ...related.challans.map((c: any) => ({
          record_type: "Purchase Challan",
          reference: c.challan_number,
          purchaser: selectedPurchaserName,
          date: c.challan_date,
          challan: c.challan_number,
          weight_kg: Number(c.total_weight_kg || 0).toFixed(3),
          amount: "",
          paid: "",
          due: "",
          status: c.status,
          notes: `Birds: ${Number(c.total_birds || 0)}`,
        })),
      ];

      exportToCSV(
        rows,
        [
          { key: "record_type", label: "Type" },
          { key: "reference", label: "Reference" },
          { key: "purchaser", label: "Purchaser" },
          {
            key: "date",
            label: "Date",
            formatter: (v) =>
              formatIndianDate(v, {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }),
          },
          { key: "challan", label: "Challan" },
          { key: "weight_kg", label: "Weight (KG)" },
          { key: "amount", label: "Amount" },
          { key: "paid", label: "Paid" },
          { key: "due", label: "Due" },
          { key: "status", label: "Status / Method" },
          { key: "notes", label: "Notes" },
        ],
        `purchase-report-${selectedPurchaserName.replace(/\s+/g, "-").toLowerCase()}-${getTimestamp()}.csv`,
      );
      toast({
        variant: "success",
        title: "Exported",
        description: `${rows.length} row(s) exported (invoices, payments, challans).`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to export CSV.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPurchaserPDF = async () => {
    setIsExporting(true);
    try {
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
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportConsolidated = async () => {
    setIsExporting(true);
    toast({
      title: "Generating PDF",
      description: "Please wait while we generate the consolidated PDF...",
    });
    try {
      const invoices = await fetchExportInvoices();
      if (invoices.length === 0) {
        toast({
          variant: "destructive",
          title: "No data",
          description: "No purchase invoices found for the selected filters.",
        });
        return;
      }

      const count = await exportConsolidatedPurchaseInvoicesPDF({
        invoiceIds: invoices.map((inv: any) => inv.id),
        fromDate,
        toDate,
        filenamePrefix: selectedPurchaserId
          ? `consolidated_purchase_${selectedPurchaserName.replace(/\s+/g, "_").toLowerCase()}`
          : "consolidated_purchase_invoices",
      });

      toast({
        variant: "success",
        title: "Exported",
        description: `Consolidated PDF with ${count} purchase invoice(s) downloaded.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to generate consolidated PDF.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportChallanCSV = async () => {
    setIsExporting(true);
    try {
      if (!selectedPurchaserId) {
        const columns: ExportColumn[] = [
          { key: "challan_number", label: "Purchase challan" },
          { key: "purchaser_name", label: "Purchaser" },
          { key: "challan_date", label: "Date" },
          { key: "total_weight_kg", label: "Weight (KG)", formatter: (v) => Number(v).toFixed(3) },
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
        return;
      }

      // Selected purchaser: include challans + related invoices/payments
      const invoices = await fetchExportInvoices();
      const related = await fetchRelatedRows();
      const rows = [
        ...processedChallanRows.map((r) => ({
          record_type: "Purchase Challan",
          reference: r.challan_number,
          purchaser: r.purchaser_name,
          date: r.challan_date,
          challan: r.challan_number,
          weight_kg: r.total_weight_kg.toFixed(3),
          amount: "",
          paid: "",
          due: "",
          status: r.status,
          notes: r.invoice_number ? `Invoice: ${r.invoice_number}` : "",
        })),
        ...invoices.map((inv: any) => ({
          record_type: "Purchase Invoice",
          reference: inv.invoice_number,
          purchaser: inv.purchasers?.name || selectedPurchaserName,
          date: inv.issue_date,
          challan: inv.challans?.challan_number || "",
          weight_kg: Number(inv.total_weight_kg || 0).toFixed(3),
          amount: Number(inv.total_amount || 0).toFixed(2),
          paid: Number(inv.amount_paid || 0).toFixed(2),
          due: (
            Number(inv.total_amount || 0) - Number(inv.amount_paid || 0)
          ).toFixed(2),
          status: inv.status,
          notes: inv.description || "",
        })),
        ...related.payments.map((p: any) => ({
          record_type: "Payment",
          reference: p.invoice_number || "",
          purchaser: selectedPurchaserName,
          date: p.payment_date,
          challan: "",
          weight_kg: "",
          amount: Number(p.amount || 0).toFixed(2),
          paid: Number(p.amount || 0).toFixed(2),
          due: "",
          status: p.payment_method || "",
          notes: p.notes || "",
        })),
      ];

      exportToCSV(
        rows,
        [
          { key: "record_type", label: "Type" },
          { key: "reference", label: "Reference" },
          { key: "purchaser", label: "Purchaser" },
          {
            key: "date",
            label: "Date",
            formatter: (v) =>
              formatIndianDate(v, {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }),
          },
          { key: "challan", label: "Challan" },
          { key: "weight_kg", label: "Weight (KG)" },
          { key: "amount", label: "Amount" },
          { key: "paid", label: "Paid" },
          { key: "due", label: "Due" },
          { key: "status", label: "Status / Method" },
          { key: "notes", label: "Notes" },
        ],
        `challan-tracking-${selectedPurchaserName.replace(/\s+/g, "-").toLowerCase()}-${getTimestamp()}.csv`,
      );
      toast({
        variant: "success",
        title: "Exported",
        description: `${rows.length} row(s) exported (challans, invoices, payments).`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to export CSV.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportChallanPDF = async () => {
    setIsExporting(true);
    try {
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
          { key: "challan_number", label: "Purchase challan", widthFrac: 0.14 },
          { key: "purchaser_name", label: "Purchaser", widthFrac: 0.22 },
          { key: "challan_date", label: "Date", widthFrac: 0.12 },
          { key: "weight_fmt", label: "Weight", widthFrac: 0.12, align: "right" },
          { key: "status", label: "Status", widthFrac: 0.14 },
          { key: "invoice_number", label: "Invoice", widthFrac: 0.14 },
        ],
        `Purchase challan tracking — ${monthLabel}`,
        `challan-tracking-${getTimestamp()}.pdf`,
      );
      toast({ variant: "success", title: "Exported", description: "Report exported to PDF." });
    } finally {
      setIsExporting(false);
    }
  };

  const exportButtons = (tab: "purchaser" | "challan") => (
    <div className="flex gap-2">
      <IconTooltip label="Export to CSV">
        <Button
          variant="outline"
          size="sm"
          disabled={isExporting}
          onClick={tab === "purchaser" ? handleExportPurchaserCSV : handleExportChallanCSV}
        >
          <Download className="h-4 w-4 mr-2" />
          CSV
        </Button>
      </IconTooltip>
      <IconTooltip label="Export to PDF">
        <Button
          variant="outline"
          size="sm"
          disabled={isExporting}
          onClick={tab === "purchaser" ? handleExportPurchaserPDF : handleExportChallanPDF}
        >
          <FileText className="h-4 w-4 mr-2" />
          PDF
        </Button>
      </IconTooltip>
      <IconTooltip label="Export consolidated PDF">
        <Button
          variant="outline"
          size="sm"
          disabled={isExporting}
          onClick={handleExportConsolidated}
        >
          <Files className="h-4 w-4 mr-2" />
          Consolidated
        </Button>
      </IconTooltip>
    </div>
  );

  if (activeTab === "challan") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">
            Purchase challan vs invoice tracking — {monthLabel}
          </h3>
          {exportButtons("challan")}
        </div>
        <div className="rounded-lg border bg-white overflow-x-auto">
          <Table className="text-xs sm:text-sm">
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("challan_number")}
                >
                  Purchase challan <SortIcon column="challan_number" />
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
                    placeholder="Filter purchase challan, purchaser, or invoice..."
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
                    No purchase challans for this period.
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
        {exportButtons("purchaser")}
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
