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
  Pencil,
  Trash2,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
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
import { TableRowActions } from "@/components/table-row-actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { canDelete, canEdit } from "@/lib/permissions";

export interface ExpenseEntryRow {
  id: string;
  entry_number: string;
  vendor_invoice_number: string | null;
  issue_date: string;
  description: string;
  units: string;
  unit_cost: string;
  gst_amount: string;
  discount_amount: string;
  total_amount: string;
  entry_month: string | null;
  payment_method?: string | null;
  reference_number?: string | null;
  status: string;
  created_at: string;
  expense_categories: { name: string; slug: string | null } | null;
  profiles?: { full_name: string };
}

interface ExpensesTableProps {
  entries: ExpenseEntryRow[];
  toolbarLeft?: ReactNode;
  userRole?: string;
  fromDate?: string;
  toDate?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  recorded: { label: "Recorded", className: "bg-amber-100 text-amber-800" },
  paid: { label: "Paid", className: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled", className: "bg-slate-100 text-slate-800" },
};

export function ExpensesTable({
  entries,
  toolbarLeft,
  userRole,
  fromDate = "",
  toDate = "",
}: ExpensesTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [filters, setFilters] = useState({
    entry_number: "",
    vendor_invoice: "",
    category: "",
    method: "",
    reference: "",
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

  const processedEntries = useMemo(() => {
    let filtered = [...entries];

    if (filters.entry_number) {
      filtered = filtered.filter((e) =>
        e.entry_number.toLowerCase().includes(filters.entry_number.toLowerCase()),
      );
    }
    if (filters.vendor_invoice) {
      filtered = filtered.filter((e) =>
        (e.vendor_invoice_number || "")
          .toLowerCase()
          .includes(filters.vendor_invoice.toLowerCase()),
      );
    }
    if (filters.category) {
      filtered = filtered.filter((e) =>
        (e.expense_categories?.name || "")
          .toLowerCase()
          .includes(filters.category.toLowerCase()),
      );
    }
    if (filters.method) {
      const q = filters.method.toLowerCase();
      filtered = filtered.filter((e) =>
        (e.payment_method || "")
          .toLowerCase()
          .replace("_", " ")
          .includes(q),
      );
    }
    if (filters.reference) {
      const q = filters.reference.toLowerCase();
      filtered = filtered.filter((e) =>
        (e.reference_number || "").toLowerCase().includes(q),
      );
    }

    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal: string | number = "";
        let bVal: string | number = "";
        switch (sortColumn) {
          case "entry_number":
            aVal = a.entry_number;
            bVal = b.entry_number;
            break;
          case "category":
            aVal = a.expense_categories?.name || "";
            bVal = b.expense_categories?.name || "";
            break;
          case "payment_method":
            aVal = (a.payment_method || "").replace("_", " ");
            bVal = (b.payment_method || "").replace("_", " ");
            break;
          case "reference_number":
            aVal = a.reference_number || "";
            bVal = b.reference_number || "";
            break;
          case "issue_date":
            aVal = new Date(a.issue_date).getTime();
            bVal = new Date(b.issue_date).getTime();
            break;
          case "total_amount":
            aVal = Number(a.total_amount);
            bVal = Number(b.total_amount);
            break;
          case "entry_month":
            aVal = a.entry_month || "";
            bVal = b.entry_month || "";
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
  }, [entries, filters, sortColumn, sortDirection]);

  const pagination = usePagination({
    items: processedEntries,
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
    if (!entryToDelete) return;
    setIsDeleting(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("expense_entries")
      .delete()
      .eq("id", entryToDelete);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete expense entry.",
      });
    } else {
      toast({
        variant: "success",
        title: "Entry deleted",
        description: "The expense entry has been deleted successfully.",
      });
      router.refresh();
    }
    setIsDeleting(false);
    setDeleteDialogOpen(false);
    setEntryToDelete(null);
  };

  const handleExport = () => {
    const enriched = processedEntries.map((e) => ({
      ...e,
      category_name: e.expense_categories?.name || "—",
    }));

    const columns: ExportColumn[] = [
      { key: "entry_number", label: "Entry Number" },
      { key: "vendor_invoice_number", label: "Invoice Number" },
      { key: "category_name", label: "Category" },
      { key: "description", label: "Description" },
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
      { key: "entry_month", label: "Month" },
      {
        key: "units",
        label: "Units",
        formatter: (v) => Number(v).toFixed(3),
      },
      {
        key: "unit_cost",
        label: "Unit Cost",
        formatter: (v) => Number(v).toFixed(2),
      },
      {
        key: "total_amount",
        label: "Total Amount",
        formatter: (v) => Number(v).toFixed(2),
      },
    ];

    const dateSuffix =
      fromDate && toDate ? `_${fromDate}_to_${toDate}` : `_${getTimestamp()}`;
    exportToCSV(enriched, columns, `expenses${dateSuffix}.csv`);
    void exportToPDF(
      enriched,
      columns,
      "Expenses",
      `expenses${dateSuffix}.pdf`,
    );
  };

  const allowEdit = canEdit(userRole);
  const allowDelete = canDelete(userRole);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {toolbarLeft}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>
                <button
                  type="button"
                  className="font-semibold"
                  onClick={() => handleSort("entry_number")}
                >
                  Entry # <SortIcon column="entry_number" />
                </button>
              </TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>
                <button
                  type="button"
                  className="font-semibold"
                  onClick={() => handleSort("category")}
                >
                  Category <SortIcon column="category" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  className="font-semibold"
                  onClick={() => handleSort("payment_method")}
                >
                  Method <SortIcon column="payment_method" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  className="font-semibold"
                  onClick={() => handleSort("reference_number")}
                >
                  Reference <SortIcon column="reference_number" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  className="font-semibold"
                  onClick={() => handleSort("issue_date")}
                >
                  Date <SortIcon column="issue_date" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  className="font-semibold"
                  onClick={() => handleSort("entry_month")}
                >
                  Month <SortIcon column="entry_month" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  type="button"
                  className="font-semibold"
                  onClick={() => handleSort("total_amount")}
                >
                  Amount <SortIcon column="total_amount" />
                </button>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
            <TableRow className="bg-muted/30">
              <TableCell className="py-2">
                <Input
                  placeholder="Filter..."
                  value={filters.entry_number}
                  onChange={(e) =>
                    handleFilterChange("entry_number", e.target.value)
                  }
                  className="h-8"
                />
              </TableCell>
              <TableCell className="py-2">
                <Input
                  placeholder="Filter..."
                  value={filters.vendor_invoice}
                  onChange={(e) =>
                    handleFilterChange("vendor_invoice", e.target.value)
                  }
                  className="h-8"
                />
              </TableCell>
              <TableCell className="py-2">
                <Input
                  placeholder="Filter..."
                  value={filters.category}
                  onChange={(e) =>
                    handleFilterChange("category", e.target.value)
                  }
                  className="h-8"
                />
              </TableCell>
              <TableCell className="py-2">
                <Input
                  placeholder="Filter..."
                  value={filters.method}
                  onChange={(e) =>
                    handleFilterChange("method", e.target.value)
                  }
                  className="h-8"
                />
              </TableCell>
              <TableCell className="py-2">
                <Input
                  placeholder="Filter..."
                  value={filters.reference}
                  onChange={(e) =>
                    handleFilterChange("reference", e.target.value)
                  }
                  className="h-8"
                />
              </TableCell>
              <TableCell colSpan={5} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  No expense entries found
                </TableCell>
              </TableRow>
            ) : (
              pagination.paginatedItems.map((entry) => {
                const status =
                  statusConfig[entry.status] || {
                    label: entry.status,
                    className: "bg-slate-100 text-slate-800",
                  };
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {entry.entry_number}
                    </TableCell>
                    <TableCell>{entry.vendor_invoice_number || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {entry.expense_categories?.name || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize text-sm">
                      {entry.payment_method
                        ? entry.payment_method.replace("_", " ")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {entry.reference_number || "—"}
                    </TableCell>
                    <TableCell>
                      {formatIndianDate(entry.issue_date, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      {entry.entry_month
                        ? new Date(`${entry.entry_month}-01`).toLocaleDateString(
                            "en-IN",
                            { month: "short", year: "numeric" },
                          )
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ₹{Number(entry.total_amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge className={status.className}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <EntryHistoryButton
                          entityType="expense_entry"
                          entityId={entry.id}
                          createdAt={entry.created_at}
                          createdByName={entry.profiles?.full_name}
                        />
                        <TableRowActions>
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/expenses/${entry.id}`}>
                              <Eye />
                              View
                            </Link>
                          </DropdownMenuItem>
                          {allowEdit && entry.status !== "cancelled" && (
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/expenses/${entry.id}/edit`}>
                                <Pencil />
                                Edit
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {allowDelete && (
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => {
                                setEntryToDelete(entry.id);
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
        itemsPerPage={itemsPerPage}
        totalItems={processedEntries.length}
        onPageChange={pagination.goToPage}
        onItemsPerPageChange={setItemsPerPage}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The expense entry will be permanently
              removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
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
    </div>
  );
}
