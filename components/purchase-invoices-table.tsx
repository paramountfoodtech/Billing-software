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
import {
  Eye,
  Trash2,
  Download,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Banknote,
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
import { Input } from "@/components/ui/input";
import { EntryHistoryButton } from "@/components/entry-history-button";
import { IconTooltip } from "@/components/icon-tooltip";

interface PurchaseInvoice {
  id: string;
  invoice_number: string;
  purchaser_id: string | null;
  issue_date: string;
  total_weight_kg: string;
  price_per_kg: string;
  total_amount: string;
  amount_paid: string;
  status: string;
  invoice_type?: string;
  description?: string | null;
  created_at: string;
  purchasers: { name: string; purchaser_code: string } | null;
  challans: { challan_number: string };
  profiles?: { full_name: string };
}

function getChallanOrTypeLabel(invoice: PurchaseInvoice) {
  if (invoice.challans.challan_number !== "—") {
    return invoice.challans.challan_number;
  }
  if (invoice.invoice_type === "salary") return "Salary";
  if (invoice.invoice_type === "expense") return "Expense";
  return "—";
}

interface PurchaseInvoicesTableProps {
  invoices: PurchaseInvoice[];
  toolbarLeft?: ReactNode;
  userRole?: string;
  fromDate?: string;
  toDate?: string;
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
}: PurchaseInvoicesTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [filters, setFilters] = useState({
    invoice_number: "",
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

    if (filters.invoice_number) {
      filtered = filtered.filter((inv) =>
        inv.invoice_number
          .toLowerCase()
          .includes(filters.invoice_number.toLowerCase()),
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
          case "invoice_number":
            aVal = a.invoice_number;
            bVal = b.invoice_number;
            break;
          case "purchaser":
            aVal = a.purchasers?.name ?? "N/A";
            bVal = b.purchasers?.name ?? "N/A";
            break;
          case "issue_date":
            aVal = new Date(a.issue_date).getTime();
            bVal = new Date(b.issue_date).getTime();
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
    }

    return filtered;
  }, [invoices, filters, sortColumn, sortDirection]);

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
      toast({
        variant: "success",
        title: "Invoice deleted",
        description: "The purchase invoice has been deleted successfully.",
      });
      router.refresh();
    }
    setIsDeleting(false);
    setDeleteDialogOpen(false);
    setInvoiceToDelete(null);
  };

  const handleExport = () => {
    const enriched = processedInvoices.map((inv) => ({
      ...inv,
      purchaser_name: inv.purchasers?.name ?? "N/A",
      challan_number: getChallanOrTypeLabel(inv),
      due_amount: (
        Number(inv.total_amount) - Number(inv.amount_paid)
      ).toFixed(2),
      status_label:
        statusConfig[inv.status as keyof typeof statusConfig]?.label ||
        inv.status,
    }));

    const columns: ExportColumn[] = [
      { key: "invoice_number", label: "Invoice Number" },
      { key: "challan_number", label: "Challan" },
      { key: "purchaser_name", label: "Purchaser" },
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
      {
        key: "total_weight_kg",
        label: "Weight (KG)",
        formatter: (v) => Number(v).toFixed(3),
      },
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
    const enriched = processedInvoices.map((inv) => ({
      invoice_number: inv.invoice_number,
      challan_number: getChallanOrTypeLabel(inv),
      purchaser_name: inv.purchasers?.name ?? "N/A",
      issue_date_fmt: formatIndianDate(inv.issue_date, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
      weight_fmt: `${Number(inv.total_weight_kg).toFixed(3)} KG`,
      total_fmt: `Rs.${Number(inv.total_amount).toFixed(2)}`,
      paid_fmt: `Rs.${Number(inv.amount_paid).toFixed(2)}`,
      due_fmt: `Rs.${(Number(inv.total_amount) - Number(inv.amount_paid)).toFixed(2)}`,
      status_label:
        statusConfig[inv.status as keyof typeof statusConfig]?.label ||
        inv.status,
    }));

    const pdfColumns: ExportColumn[] = [
      { key: "invoice_number", label: "Invoice #", widthFrac: 0.1 },
      { key: "challan_number", label: "Challan", widthFrac: 0.1 },
      { key: "purchaser_name", label: "Purchaser", widthFrac: 0.18 },
      { key: "issue_date_fmt", label: "Date", widthFrac: 0.1 },
      { key: "weight_fmt", label: "Weight", widthFrac: 0.1 },
      { key: "total_fmt", label: "Total", widthFrac: 0.1, align: "right" },
      { key: "paid_fmt", label: "Paid", widthFrac: 0.1, align: "right" },
      { key: "due_fmt", label: "Due", widthFrac: 0.1, align: "right" },
      { key: "status_label", label: "Status", widthFrac: 0.12 },
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
                disabled={processedInvoices.length === 0}
              >
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">PDF</span>
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
                className="cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                onClick={() => handleSort("invoice_number")}
              >
                Invoice #<SortIcon column="invoice_number" />
              </TableHead>
              <TableHead className="hidden sm:table-cell px-2 sm:px-4 py-2 sm:py-3">
                Challan
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                onClick={() => handleSort("purchaser")}
              >
                Purchaser
                <SortIcon column="purchaser" />
              </TableHead>
              <TableHead
                className="hidden md:table-cell cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                onClick={() => handleSort("issue_date")}
              >
                Issue Date
                <SortIcon column="issue_date" />
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
              <TableHead className="px-2 sm:px-4 py-2 sm:py-3">
                <Input
                  placeholder="Filter..."
                  value={filters.invoice_number}
                  onChange={(e) =>
                    handleFilterChange("invoice_number", e.target.value)
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
              <TableHead className="hidden md:table-cell px-2 sm:px-4 py-2 sm:py-3" />
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
                  colSpan={9}
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
                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono font-medium px-2 sm:px-4 py-2 sm:py-3">
                      {invoice.invoice_number}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell px-2 sm:px-4 py-2 sm:py-3">
                      {getChallanOrTypeLabel(invoice)}
                    </TableCell>
                    <TableCell className="px-2 sm:px-4 py-2 sm:py-3">
                      {invoice.purchasers?.name ?? "N/A"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell px-2 sm:px-4 py-2 sm:py-3">
                      {formatIndianDate(invoice.issue_date)}
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
                        {due > 0.01 && invoice.status !== "cancelled" && (
                          <IconTooltip label="Record payment">
                            <Button variant="ghost" size="sm" asChild>
                              <Link
                                href={`/dashboard/purchase-payments/new?invoice_id=${invoice.id}${invoice.purchaser_id ? `&purchaser_id=${invoice.purchaser_id}` : ""}`}
                              >
                                <Banknote className="h-4 w-4 text-green-600" />
                              </Link>
                            </Button>
                          </IconTooltip>
                        )}
                        <IconTooltip label="View purchase invoice">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/dashboard/purchase-invoices/${invoice.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        </IconTooltip>
                        {userRole !== "accountant" && (
                          <IconTooltip label="Delete purchase invoice">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setInvoiceToDelete(invoice.id);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </IconTooltip>
                        )}
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
              be deleted.
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
