"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Eye,
  Trash2,
  Download,
  FileText,
  Files,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Banknote,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatIndianDate } from "@/lib/date-time";
import { useRouter } from "next/navigation";
import { useState, useMemo, ReactNode } from "react";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/table-pagination";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { exportToCSV, exportToPDF, ExportColumn, getTimestamp } from "@/lib/export-utils";
import { exportConsolidatedPurchaseInvoicesPDF } from "@/lib/purchase-invoice-consolidated-pdf";
import { Input } from "@/components/ui/input";
import { EntryHistoryButton } from "@/components/entry-history-button";
import { IconTooltip } from "@/components/icon-tooltip";
import { TableRowActions } from "@/components/table-row-actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { canDelete, canEditPurchaseInvoice } from "@/lib/permissions";
import {
  createPurchaseInvoiceRateDiscountLookup,
  formatPurchaseInvoiceRateDiscount,
  getPurchaseInvoiceRateDiscountFromLookup,
} from "@/lib/purchase-invoice-rate-discount";
import type { PriceCategoryHistoryEntry } from "@/lib/utils";

interface PurchaseInvoice {
  id: string;
  invoice_number: string;
  purchaser_invoice_number?: string | null;
  purchaser_id: string | null;
  issue_date: string;
  total_weight_kg: string;
  total_birds?: number | null;
  price_per_kg: string;
  total_amount: string;
  amount_paid: string;
  status: string;
  created_at: string;
  purchasers: { name: string; purchaser_code: string } | null;
  challans: { challan_number: string };
  profiles?: { full_name: string };
}

function getAverage(invoice: {
  total_weight_kg: string | number;
  total_birds?: number | null;
}) {
  const weight = Number(invoice.total_weight_kg || 0);
  const birds = Number(invoice.total_birds || 0);
  if (birds <= 0 || weight <= 0) return null;
  return weight / birds;
}

function getChallanLabel(invoice: PurchaseInvoice) {
  return invoice.challans.challan_number !== "—"
    ? invoice.challans.challan_number
    : "—";
}

interface PurchaseInvoicesTableProps {
  invoices: PurchaseInvoice[];
  toolbarLeft?: ReactNode;
  userRole?: string;
  fromDate?: string;
  toDate?: string;
  liveCategoryId?: string | null;
  priceHistory?: PriceCategoryHistoryEntry[];
}

const statusConfig = {
  recorded: { label: "Unpaid", className: "bg-amber-100 text-amber-800" },
  partially_paid: {
    label: "Partially Paid",
    className: "bg-yellow-100 text-yellow-800",
  },
  paid: { label: "Paid", className: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled", className: "bg-slate-100 text-slate-800" },
};

export function PurchaseInvoicesTable({
  invoices,
  toolbarLeft,
  userRole,
  fromDate = "",
  toDate = "",
  liveCategoryId = null,
  priceHistory = [],
}: PurchaseInvoicesTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const priceLookup = useMemo(
    () => createPurchaseInvoiceRateDiscountLookup(priceHistory),
    [priceHistory],
  );
  const getRateDiscount = (invoice: PurchaseInvoice) =>
    getPurchaseInvoiceRateDiscountFromLookup(
      invoice,
      liveCategoryId,
      priceLookup,
    );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState<"pdf" | "consolidated" | null>(
    null,
  );
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [filters, setFilters] = useState({
    purchaser_invoice_number: "",
    purchaser: "",
    challan: "",
    status: "",
  });

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleFilterChange = (column: string, value: string) => {
    setFilters((prev) => ({ ...prev, [column]: value }));
  };

  const processedInvoices = useMemo(() => {
    let filtered = [...invoices];

    if (filters.purchaser_invoice_number) {
      filtered = filtered.filter((inv) =>
        (inv.purchaser_invoice_number || "")
          .toLowerCase()
          .includes(filters.purchaser_invoice_number.toLowerCase()),
      );
    }
    if (filters.purchaser) {
      filtered = filtered.filter((inv) =>
        (inv.purchasers?.name ?? "N/A")
          .toLowerCase()
          .includes(filters.purchaser.toLowerCase()),
      );
    }
    if (filters.challan) {
      filtered = filtered.filter((inv) =>
        inv.challans.challan_number
          .toLowerCase()
          .includes(filters.challan.toLowerCase()),
      );
    }
    if (filters.status) {
      filtered = filtered.filter((inv) =>
        inv.status.toLowerCase().includes(filters.status.toLowerCase()),
      );
    }

    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal: string | number = "";
        let bVal: string | number = "";
        switch (sortColumn) {
          case "purchaser_invoice_number":
            aVal = a.purchaser_invoice_number || "";
            bVal = b.purchaser_invoice_number || "";
            break;
          case "purchaser":
            aVal = a.purchasers?.name ?? "N/A";
            bVal = b.purchasers?.name ?? "N/A";
            break;
          case "issue_date":
            aVal = new Date(a.issue_date).getTime();
            bVal = new Date(b.issue_date).getTime();
            break;
          case "total_weight_kg":
            aVal = Number(a.total_weight_kg);
            bVal = Number(b.total_weight_kg);
            break;
          case "total_birds":
            aVal = Number(a.total_birds || 0);
            bVal = Number(b.total_birds || 0);
            break;
          case "average":
            aVal = getAverage(a) ?? -1;
            bVal = getAverage(b) ?? -1;
            break;
          case "rate_discount":
            aVal = getRateDiscount(a) ?? Number.NEGATIVE_INFINITY;
            bVal = getRateDiscount(b) ?? Number.NEGATIVE_INFINITY;
            break;
          case "total_amount":
            aVal = Number(a.total_amount);
            bVal = Number(b.total_amount);
            break;
          case "amount_paid":
            aVal = Number(a.amount_paid);
            bVal = Number(b.amount_paid);
            break;
          case "due_amount":
            aVal = Number(a.total_amount) - Number(a.amount_paid);
            bVal = Number(b.total_amount) - Number(b.amount_paid);
            break;
          case "status":
            aVal = a.status;
            bVal = b.status;
            break;
          default:
            return 0;
        }
        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    } else {
      filtered.sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime(),
      );
    }

    return filtered;
  }, [invoices, filters, sortColumn, sortDirection, liveCategoryId, priceLookup]);

  const pagination = usePagination({
    items: processedInvoices,
    itemsPerPage,
  });

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column)
      return <ArrowUpDown className="ml-2 h-4 w-4 inline opacity-40" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4 inline" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4 inline" />
    );
  };

  const handleDelete = async () => {
    if (!invoiceToDelete) return;
    setIsDeleting(true);
    const supabase = createClient();

    const { data: invoice } = await supabase
      .from("purchase_invoices")
      .select("id")
      .eq("id", invoiceToDelete)
      .maybeSingle();

    const { data: linkedChallans } = await supabase
      .from("challans")
      .select("id")
      .eq("purchase_invoice_id", invoiceToDelete);

    const { error } = await supabase
      .from("purchase_invoices")
      .delete()
      .eq("id", invoiceToDelete);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete purchase invoice.",
      });
    } else {
      const challanIds = (linkedChallans || []).map((c) => c.id);
      if (challanIds.length > 0) {
        const { error: challanError } = await supabase
          .from("challans")
          .update({
            status: "final",
            purchase_invoice_id: null,
            updated_at: new Date().toISOString(),
          })
          .in("id", challanIds);

        if (challanError) {
          toast({
            variant: "destructive",
            title: "Invoice deleted, purchase challan unlock failed",
            description:
              "The purchase invoice was deleted, but linked purchase challans could not be unlocked for deletion.",
          });
        } else {
          toast({
            variant: "success",
            title: "Invoice deleted",
            description:
              "The purchase invoice was deleted and its linked purchase challans can now be deleted.",
          });
        }
      } else if (invoice) {
        toast({
          variant: "success",
          title: "Invoice deleted",
          description: "The purchase invoice has been deleted successfully.",
        });
      } else {
        toast({
          variant: "success",
          title: "Invoice deleted",
          description: "The purchase invoice has been deleted successfully.",
        });
      }
      router.refresh();
    }
    setIsDeleting(false);
    setDeleteDialogOpen(false);
    setInvoiceToDelete(null);
  };

  const handleExport = () => {
    const enriched = processedInvoices.map((inv) => {
      const average = getAverage(inv);
      const rateDiscount = getRateDiscount(inv);
      return {
        ...inv,
        purchaser_name: inv.purchasers?.name ?? "N/A",
        challan_number: getChallanLabel(inv),
        average_fmt: average != null ? average.toFixed(3) : "—",
        discount_fmt: formatPurchaseInvoiceRateDiscount(rateDiscount, {
          includeUnit: false,
        }),
        due_amount: (
          Number(inv.total_amount) - Number(inv.amount_paid)
        ).toFixed(2),
        status_label:
          statusConfig[inv.status as keyof typeof statusConfig]?.label ||
          inv.status,
      };
    });

    const columns: ExportColumn[] = [
      {
        key: "issue_date",
        label: "Issue Date",
        formatter: (date) =>
          formatIndianDate(date, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }),
      },
      { key: "purchaser_invoice_number", label: "Purchaser Invoice #" },
      { key: "challan_number", label: "Purchase challan" },
      { key: "purchaser_name", label: "Purchaser" },
      {
        key: "total_birds",
        label: "Birds",
        formatter: (v) => String(Number(v || 0)),
      },
      {
        key: "total_weight_kg",
        label: "Weight (KG)",
        formatter: (v) => Number(v).toFixed(3),
      },
      { key: "average_fmt", label: "Average" },
      { key: "discount_fmt", label: "Discount (/KG)" },
      {
        key: "total_amount",
        label: "Total Amount",
        formatter: (v) => Number(v).toFixed(2),
      },
      {
        key: "amount_paid",
        label: "Amount Paid",
        formatter: (v) => Number(v).toFixed(2),
      },
      { key: "due_amount", label: "Due Amount" },
      { key: "status_label", label: "Status" },
    ];

    exportToCSV(enriched, columns, `purchase-invoices-${getTimestamp()}.csv`);
    toast({
      variant: "success",
      title: "Exported",
      description: `${enriched.length} invoice(s) exported to CSV successfully.`,
    });
  };

  const handleExportPDF = async () => {
    setIsExporting("pdf");
    try {
      const enriched = processedInvoices.map((inv) => {
        const average = getAverage(inv);
        const rateDiscount = getRateDiscount(inv);
        return {
          purchaser_invoice_number: inv.purchaser_invoice_number || "—",
          challan_number: getChallanLabel(inv),
          purchaser_name: inv.purchasers?.name ?? "N/A",
          issue_date_fmt: formatIndianDate(inv.issue_date, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }),
          weight_fmt: `${Number(inv.total_weight_kg).toFixed(3)} KG`,
          birds_fmt: String(Number(inv.total_birds || 0)),
          average_fmt: average != null ? average.toFixed(3) : "—",
          discount_fmt: formatPurchaseInvoiceRateDiscount(rateDiscount, {
            includeUnit: false,
          }),
          total_fmt: `Rs.${Number(inv.total_amount).toFixed(2)}`,
          paid_fmt: `Rs.${Number(inv.amount_paid).toFixed(2)}`,
          due_fmt: `Rs.${(Number(inv.total_amount) - Number(inv.amount_paid)).toFixed(2)}`,
          status_label:
            statusConfig[inv.status as keyof typeof statusConfig]?.label ||
            inv.status,
        };
      });

      const pdfColumns: ExportColumn[] = [
        { key: "issue_date_fmt", label: "Date", widthFrac: 0.08 },
        { key: "purchaser_invoice_number", label: "Purchaser Invoice #", widthFrac: 0.1 },
        { key: "challan_number", label: "Purchase challan", widthFrac: 0.08 },
        { key: "purchaser_name", label: "Purchaser", widthFrac: 0.12 },
        { key: "birds_fmt", label: "Birds", widthFrac: 0.06 },
        { key: "weight_fmt", label: "Weight", widthFrac: 0.08 },
        { key: "average_fmt", label: "Average", widthFrac: 0.07 },
        { key: "discount_fmt", label: "Discount (/KG)", widthFrac: 0.09 },
        { key: "total_fmt", label: "Total", widthFrac: 0.08, align: "right" },
        { key: "paid_fmt", label: "Paid", widthFrac: 0.08, align: "right" },
        { key: "due_fmt", label: "Due", widthFrac: 0.08, align: "right" },
        { key: "status_label", label: "Status", widthFrac: 0.09 },
      ];

      const rangeLabel =
        fromDate || toDate ? ` (${fromDate || "..."} to ${toDate || "..."})` : "";
      await exportToPDF(
        enriched,
        pdfColumns,
        `Purchase Invoices${rangeLabel}`,
        `purchase-invoices-${getTimestamp()}.pdf`,
      );
      toast({
        variant: "success",
        title: "Exported",
        description: `${enriched.length} invoice(s) exported to PDF successfully.`,
      });
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportConsolidatedPDF = async () => {
    if (processedInvoices.length === 0) return;

    setIsExporting("consolidated");
    toast({
      title: "Generating PDF",
      description: "Please wait while we generate the consolidated PDF...",
    });

    try {
      const count = await exportConsolidatedPurchaseInvoicesPDF({
        invoiceIds: processedInvoices.map((inv) => inv.id),
        fromDate,
        toDate,
        liveCategoryId,
        priceHistory,
      });

      if (count === 0) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No valid purchase invoice data found to export.",
        });
        return;
      }

      toast({
        variant: "success",
        title: "Exported",
        description: `Consolidated PDF with ${count} purchase invoice(s) downloaded successfully.`,
      });
    } catch (error) {
      console.error("Consolidated purchase invoice export failed:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to generate consolidated PDF.",
      });
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-3 sm:gap-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">{toolbarLeft}</div>
          <div className="flex gap-2">
            <IconTooltip label="Export to CSV">
              <Button
                onClick={handleExport}
                size="sm"
                variant="outline"
                disabled={processedInvoices.length === 0}
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">CSV</span>
              </Button>
            </IconTooltip>
            <IconTooltip label="Export to PDF">
              <Button
                onClick={handleExportPDF}
                size="sm"
                variant="outline"
                disabled={processedInvoices.length === 0 || !!isExporting}
              >
                {isExporting === "pdf" ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                <span className="hidden sm:inline ml-2">
                  {isExporting === "pdf" ? "Exporting..." : "PDF"}
                </span>
              </Button>
            </IconTooltip>
            <IconTooltip label="Export consolidated PDF">
              <Button
                onClick={handleExportConsolidatedPDF}
                size="sm"
                variant="outline"
                disabled={processedInvoices.length === 0 || !!isExporting}
              >
                {isExporting === "consolidated" ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <Files className="h-4 w-4" />
                )}
                <span className="hidden sm:inline ml-2">
                  {isExporting === "consolidated" ? "Exporting..." : "Consolidated"}
                </span>
              </Button>
            </IconTooltip>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-white overflow-x-auto">
        <Table className="text-xs sm:text-sm">
          <TableHeader>
            <TableRow>
              <TableHead
                className="hidden md:table-cell cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                onClick={() => handleSort("issue_date")}
              >
                Issue Date
                <SortIcon column="issue_date" />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                onClick={() => handleSort("purchaser_invoice_number")}
              >
                Purchaser Invoice #
                <SortIcon column="purchaser_invoice_number" />
              </TableHead>
              <TableHead className="hidden sm:table-cell px-2 sm:px-4 py-2 sm:py-3">
                Purchase challan
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                onClick={() => handleSort("purchaser")}
              >
                Purchaser
                <SortIcon column="purchaser" />
              </TableHead>
              <TableHead
                className="hidden lg:table-cell cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                onClick={() => handleSort("total_birds")}
              >
                Birds
                <SortIcon column="total_birds" />
              </TableHead>
              <TableHead
                className="hidden lg:table-cell cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                onClick={() => handleSort("total_weight_kg")}
              >
                Weight (KG)
                <SortIcon column="total_weight_kg" />
              </TableHead>
              <TableHead
                className="hidden lg:table-cell cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                onClick={() => handleSort("average")}
              >
                Average
                <SortIcon column="average" />
              </TableHead>
              <TableHead
                className="hidden lg:table-cell cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                onClick={() => handleSort("rate_discount")}
              >
                Discount (/KG)
                <SortIcon column="rate_discount" />
              </TableHead>
              <TableHead
                className="hidden lg:table-cell cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                onClick={() => handleSort("total_amount")}
              >
                Total
                <SortIcon column="total_amount" />
              </TableHead>
              <TableHead
                className="hidden md:table-cell cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                onClick={() => handleSort("amount_paid")}
              >
                Paid
                <SortIcon column="amount_paid" />
              </TableHead>
              <TableHead
                className="hidden lg:table-cell cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                onClick={() => handleSort("due_amount")}
              >
                Due
                <SortIcon column="due_amount" />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                onClick={() => handleSort("status")}
              >
                Status
                <SortIcon column="status" />
              </TableHead>
              <TableHead className="text-right px-2 sm:px-4 py-2 sm:py-3">
                Actions
              </TableHead>
            </TableRow>
            <TableRow>
              <TableHead className="hidden md:table-cell px-2 sm:px-4 py-2 sm:py-3" />
              <TableHead className="px-2 sm:px-4 py-2 sm:py-3">
                <Input
                  placeholder="Filter..."
                  value={filters.purchaser_invoice_number}
                  onChange={(e) =>
                    handleFilterChange("purchaser_invoice_number", e.target.value)
                  }
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="hidden sm:table-cell px-2 sm:px-4 py-2 sm:py-3">
                <Input
                  placeholder="Filter..."
                  value={filters.challan}
                  onChange={(e) =>
                    handleFilterChange("challan", e.target.value)
                  }
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="px-2 sm:px-4 py-2 sm:py-3">
                <Input
                  placeholder="Filter..."
                  value={filters.purchaser}
                  onChange={(e) =>
                    handleFilterChange("purchaser", e.target.value)
                  }
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="hidden lg:table-cell px-2 sm:px-4 py-2 sm:py-3" />
              <TableHead className="hidden lg:table-cell px-2 sm:px-4 py-2 sm:py-3" />
              <TableHead className="hidden lg:table-cell px-2 sm:px-4 py-2 sm:py-3" />
              <TableHead className="hidden lg:table-cell px-2 sm:px-4 py-2 sm:py-3" />
              <TableHead className="hidden lg:table-cell px-2 sm:px-4 py-2 sm:py-3" />
              <TableHead className="hidden md:table-cell px-2 sm:px-4 py-2 sm:py-3" />
              <TableHead className="hidden lg:table-cell px-2 sm:px-4 py-2 sm:py-3" />
              <TableHead className="px-2 sm:px-4 py-2 sm:py-3">
                <Input
                  placeholder="Filter..."
                  value={filters.status}
                  onChange={(e) =>
                    handleFilterChange("status", e.target.value)
                  }
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="px-2 sm:px-4 py-2 sm:py-3" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedItems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={13}
                  className="text-center py-8 text-muted-foreground"
                >
                  No purchase invoices found.
                </TableCell>
              </TableRow>
            ) : (
              pagination.paginatedItems.map((invoice) => {
                const config =
                  statusConfig[invoice.status as keyof typeof statusConfig] ||
                  statusConfig.recorded;
                const due =
                  Number(invoice.total_amount) - Number(invoice.amount_paid);
                const average = getAverage(invoice);
                const rateDiscount = getRateDiscount(invoice);
                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="hidden md:table-cell px-2 sm:px-4 py-2 sm:py-3">
                      {formatIndianDate(invoice.issue_date)}
                    </TableCell>
                    <TableCell className="font-mono font-medium px-2 sm:px-4 py-2 sm:py-3">
                      {invoice.purchaser_invoice_number || "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell px-2 sm:px-4 py-2 sm:py-3">
                      {getChallanLabel(invoice)}
                    </TableCell>
                    <TableCell className="px-2 sm:px-4 py-2 sm:py-3">
                      {invoice.purchasers?.name ?? "N/A"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell px-2 sm:px-4 py-2 sm:py-3">
                      {Number(invoice.total_birds || 0).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell px-2 sm:px-4 py-2 sm:py-3">
                      {Number(invoice.total_weight_kg).toFixed(3)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell px-2 sm:px-4 py-2 sm:py-3">
                      {average != null ? average.toFixed(3) : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell px-2 sm:px-4 py-2 sm:py-3">
                      {formatPurchaseInvoiceRateDiscount(rateDiscount, {
                        includeUnit: false,
                      })}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell px-2 sm:px-4 py-2 sm:py-3">
                      ₹
                      {Number(invoice.total_amount).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="hidden md:table-cell px-2 sm:px-4 py-2 sm:py-3">
                      ₹
                      {Number(invoice.amount_paid).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell px-2 sm:px-4 py-2 sm:py-3 text-red-600">
                      ₹{due.toFixed(2)}
                    </TableCell>
                    <TableCell className="px-2 sm:px-4 py-2 sm:py-3">
                      <Badge variant="secondary" className={config.className}>
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3">
                      <div className="flex items-center justify-end gap-1">
                        <EntryHistoryButton
                          entityType="purchase_invoice"
                          entityId={invoice.id}
                          createdAt={invoice.created_at}
                          createdByName={invoice.profiles?.full_name}
                        />
                        <TableRowActions>
                          {due > 0.01 && invoice.status !== "cancelled" && (
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/dashboard/purchase-payments/new?invoice_id=${invoice.id}${invoice.purchaser_id ? `&purchaser_id=${invoice.purchaser_id}` : ""}`}
                              >
                                <Banknote />
                                Record payment
                              </Link>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/purchase-invoices/${invoice.id}`}>
                              <Eye />
                              View
                            </Link>
                          </DropdownMenuItem>
                          {canEditPurchaseInvoice(
                            userRole,
                            invoice.status,
                            invoice.amount_paid,
                          ) && (
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/dashboard/purchase-invoices/${invoice.id}/edit`}
                                >
                                  <Pencil />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                            )}
                          {canDelete(userRole) && (
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => {
                                setInvoiceToDelete(invoice.id);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </TableRowActions>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
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
        totalItems={processedInvoices.length}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete purchase invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Invoices with linked payments cannot
              be deleted. If this invoice was created from a purchase challan, the
              purchase challan will be unlocked so Super Admin can delete it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
