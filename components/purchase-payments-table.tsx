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
  Trash2,
  Download,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
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

interface PurchasePayment {
  id: string;
  purchase_invoice_id: string;
  amount: string;
  payment_date: string;
  payment_method: string;
  reference_number: string | null;
  status: string;
  created_at?: string;
  profiles?: { full_name: string } | null;
  purchase_invoices: {
    id: string;
    invoice_number: string;
    total_amount: string;
    amount_paid: string;
    purchaser_id?: string;
    purchasers: { name: string };
  };
}

interface PurchasePaymentsTableProps {
  payments: PurchasePayment[];
  toolbarLeft?: ReactNode;
  userRole?: string;
  fromDate?: string;
  toDate?: string;
}

const statusConfig = {
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800" },
  completed: { label: "Completed", className: "bg-green-100 text-green-800" },
  failed: { label: "Failed", className: "bg-red-100 text-red-800" },
  refunded: { label: "Refunded", className: "bg-slate-100 text-slate-800" },
};

export function PurchasePaymentsTable({
  payments,
  toolbarLeft,
  userRole,
  fromDate = "",
  toDate = "",
}: PurchasePaymentsTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [filters, setFilters] = useState({
    invoice: "",
    purchaser: "",
    method: "",
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

  const processedPayments = useMemo(() => {
    let filtered = [...payments];

    if (filters.invoice) {
      filtered = filtered.filter((p) =>
        p.purchase_invoices.invoice_number
          .toLowerCase()
          .includes(filters.invoice.toLowerCase()),
      );
    }
    if (filters.purchaser) {
      filtered = filtered.filter((p) =>
        p.purchase_invoices.purchasers.name
          .toLowerCase()
          .includes(filters.purchaser.toLowerCase()),
      );
    }
    if (filters.method) {
      filtered = filtered.filter((p) =>
        p.payment_method.toLowerCase().includes(filters.method.toLowerCase()),
      );
    }

    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal: string | number = "";
        let bVal: string | number = "";
        switch (sortColumn) {
          case "date":
            aVal = new Date(a.payment_date).getTime();
            bVal = new Date(b.payment_date).getTime();
            break;
          case "invoice":
            aVal = a.purchase_invoices.invoice_number;
            bVal = b.purchase_invoices.invoice_number;
            break;
          case "purchaser":
            aVal = a.purchase_invoices.purchasers.name;
            bVal = b.purchase_invoices.purchasers.name;
            break;
          case "amount":
            aVal = Number(a.amount);
            bVal = Number(b.amount);
            break;
          case "method":
            aVal = a.payment_method;
            bVal = b.payment_method;
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
  }, [payments, filters, sortColumn, sortDirection]);

  const pagination = usePagination({
    items: processedPayments,
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

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    const supabase = createClient();

    try {
      const { data: payment, error: fetchError } = await supabase
        .from("purchase_payments")
        .select("purchase_invoice_id, amount")
        .eq("id", id)
        .maybeSingle();

      if (fetchError || !payment) throw new Error("Payment not found");

      const { data: invoice, error: invoiceFetchError } = await supabase
        .from("purchase_invoices")
        .select("amount_paid, total_amount")
        .eq("id", payment.purchase_invoice_id)
        .maybeSingle();

      if (invoiceFetchError || !invoice) throw new Error("Invoice not found");

      const newAmountPaid = Math.max(
        0,
        Number(invoice.amount_paid) - Number(payment.amount),
      );
      const totalAmount = Number(invoice.total_amount);
      let newStatus = "recorded";
      if (newAmountPaid >= totalAmount - 0.01) newStatus = "paid";
      else if (newAmountPaid > 0) newStatus = "partially_paid";

      const { error: deleteError } = await supabase
        .from("purchase_payments")
        .delete()
        .eq("id", id);
      if (deleteError) throw deleteError;

      const { error: updateError } = await supabase
        .from("purchase_invoices")
        .update({ amount_paid: newAmountPaid, status: newStatus })
        .eq("id", payment.purchase_invoice_id);
      if (updateError) throw updateError;

      toast({
        variant: "success",
        title: "Payment deleted",
        description:
          "The payment has been deleted and the invoice status updated.",
      });
      router.refresh();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete payment.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = () => {
    const columns: ExportColumn[] = [
      {
        key: "purchase_invoices",
        label: "Invoice Number",
        formatter: (inv) => inv?.invoice_number || "",
      },
      {
        key: "purchase_invoices",
        label: "Purchaser",
        formatter: (inv) => inv?.purchasers?.name || "",
      },
      {
        key: "amount",
        label: "Amount",
        formatter: (amount) => Number(amount).toFixed(2),
      },
      {
        key: "payment_date",
        label: "Payment Date",
        formatter: (date) =>
          formatIndianDate(date, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }),
      },
      { key: "payment_method", label: "Payment Method" },
      { key: "reference_number", label: "Reference Number" },
      {
        key: "status",
        label: "Status",
        formatter: (status) =>
          statusConfig[status as keyof typeof statusConfig]?.label || status,
      },
    ];

    exportToCSV(
      processedPayments,
      columns,
      `purchase-payments-${getTimestamp()}.csv`,
    );
    toast({
      variant: "success",
      title: "Exported",
      description: `${processedPayments.length} payment(s) exported to CSV successfully.`,
    });
  };

  const handleExportPDF = async () => {
    const enriched = processedPayments.map((p) => ({
      invoice_number: p.purchase_invoices.invoice_number,
      purchaser_name: p.purchase_invoices.purchasers.name,
      amount_fmt: `Rs.${Number(p.amount).toFixed(2)}`,
      payment_date_fmt: formatIndianDate(p.payment_date, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
      method_label: p.payment_method.replace(/_/g, " "),
      status_label:
        statusConfig[p.status as keyof typeof statusConfig]?.label || p.status,
      reference_number: p.reference_number || "",
    }));

    const pdfColumns: ExportColumn[] = [
      { key: "payment_date_fmt", label: "Date", widthFrac: 0.1 },
      { key: "invoice_number", label: "Invoice #", widthFrac: 0.1 },
      { key: "purchaser_name", label: "Purchaser", widthFrac: 0.22 },
      { key: "amount_fmt", label: "Amount", widthFrac: 0.1, align: "right" },
      { key: "method_label", label: "Method", widthFrac: 0.12 },
      { key: "reference_number", label: "Reference", widthFrac: 0.16 },
      { key: "status_label", label: "Status", widthFrac: 0.2 },
    ];

    const rangeLabel =
      fromDate || toDate ? ` (${fromDate || "..."} to ${toDate || "..."})` : "";
    await exportToPDF(
      enriched,
      pdfColumns,
      `Purchase Payments${rangeLabel}`,
      `purchase-payments-${getTimestamp()}.pdf`,
    );
    toast({
      variant: "success",
      title: "Exported",
      description: `${enriched.length} payment(s) exported to PDF successfully.`,
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
                disabled={processedPayments.length === 0}
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
                disabled={processedPayments.length === 0}
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
                onClick={() => handleSort("date")}
              >
                Date
                <SortIcon column="date" />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                onClick={() => handleSort("invoice")}
              >
                Invoice
                <SortIcon column="invoice" />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                onClick={() => handleSort("purchaser")}
              >
                Purchaser
                <SortIcon column="purchaser" />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                onClick={() => handleSort("amount")}
              >
                Amount
                <SortIcon column="amount" />
              </TableHead>
              <TableHead
                className="hidden md:table-cell cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                onClick={() => handleSort("method")}
              >
                Method
                <SortIcon column="method" />
              </TableHead>
              <TableHead className="hidden lg:table-cell px-2 sm:px-4 py-2 sm:py-3">
                Reference
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
              <TableHead className="px-2 sm:px-4 py-2 sm:py-3" />
              <TableHead className="px-2 sm:px-4 py-2 sm:py-3">
                <Input
                  placeholder="Filter..."
                  value={filters.invoice}
                  onChange={(e) => handleFilterChange("invoice", e.target.value)}
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
              <TableHead className="px-2 sm:px-4 py-2 sm:py-3" />
              <TableHead className="hidden md:table-cell px-2 sm:px-4 py-2 sm:py-3">
                <Input
                  placeholder="Filter..."
                  value={filters.method}
                  onChange={(e) => handleFilterChange("method", e.target.value)}
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="hidden lg:table-cell px-2 sm:px-4 py-2 sm:py-3" />
              <TableHead className="px-2 sm:px-4 py-2 sm:py-3" />
              <TableHead className="px-2 sm:px-4 py-2 sm:py-3" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedItems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-8 text-muted-foreground"
                >
                  No purchase payments found.
                </TableCell>
              </TableRow>
            ) : (
              pagination.paginatedItems.map((payment) => {
                const config =
                  statusConfig[payment.status as keyof typeof statusConfig] ||
                  statusConfig.completed;
                return (
                  <TableRow key={payment.id}>
                    <TableCell className="px-2 sm:px-4 py-2 sm:py-3">
                      {formatIndianDate(payment.payment_date)}
                    </TableCell>
                    <TableCell className="font-mono px-2 sm:px-4 py-2 sm:py-3">
                      {payment.purchase_invoices.invoice_number}
                    </TableCell>
                    <TableCell className="px-2 sm:px-4 py-2 sm:py-3">
                      {payment.purchase_invoices.purchasers.name}
                    </TableCell>
                    <TableCell className="px-2 sm:px-4 py-2 sm:py-3 font-medium text-green-700">
                      ₹
                      {Number(payment.amount).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="hidden md:table-cell capitalize px-2 sm:px-4 py-2 sm:py-3">
                      {payment.payment_method.replace("_", " ")}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground px-2 sm:px-4 py-2 sm:py-3">
                      {payment.reference_number || "—"}
                    </TableCell>
                    <TableCell className="px-2 sm:px-4 py-2 sm:py-3">
                      <Badge variant="secondary" className={config.className}>
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3">
                      <div className="flex justify-end gap-1">
                        <EntryHistoryButton
                          entityType="purchase_payment"
                          entityId={payment.id}
                          createdAt={payment.created_at}
                          createdByName={payment.profiles?.full_name}
                        />
                        <IconTooltip label="View payment">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/dashboard/purchase-payments/${payment.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        </IconTooltip>
                        {userRole === "super_admin" && (
                          <IconTooltip label="Delete payment">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setPaymentToDelete(payment.id);
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
        totalItems={processedPayments.length}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reverse the payment amount on the linked purchase invoice.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => paymentToDelete && handleDelete(paymentToDelete)}
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
