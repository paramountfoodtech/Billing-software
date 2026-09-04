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
  Pencil,
  Trash2,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileText,
  Eye,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatIndianDate } from "@/lib/date-time";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
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
import { exportToCSV, ExportColumn, getTimestamp } from "@/lib/export-utils";
import { Input } from "@/components/ui/input";
import { EntryHistoryButton } from "@/components/entry-history-button";
import { IconTooltip } from "@/components/icon-tooltip";
import { TableRowActions } from "@/components/table-row-actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  canDelete,
  canDeleteChallan,
  canEditChallan,
} from "@/lib/permissions";

interface Challan {
  id: string;
  challan_number: string;
  purchaser_id: string;
  challan_date: string;
  num_boxes: number;
  total_weight_kg: string;
  total_birds?: number | null;
  status: string;
  purchase_invoice_id: string | null;
  created_at: string;
  purchasers: { name: string; purchaser_code: string };
  profiles?: { full_name: string };
  purchase_invoices?: { amount_paid: string | number } | null;
}

interface ChallansTableProps {
  challans: Challan[];
  userRole?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-800" },
  final: { label: "Final", className: "bg-blue-100 text-blue-800" },
  invoiced: { label: "Invoiced", className: "bg-green-100 text-green-800" },
};

export function ChallansTable({ challans, userRole }: ChallansTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const allowDelete = canDelete(userRole);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [challanToDelete, setChallanToDelete] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>("challan_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [filters, setFilters] = useState({
    challan_number: "",
    purchaser: "",
    status: "all",
  });

  const statusOptions = [
    { value: "all", label: "All Statuses" },
    { value: "draft", label: "Draft" },
    { value: "final", label: "Final" },
    { value: "invoiced", label: "Invoiced" },
  ];

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

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column)
      return <ArrowUpDown className="ml-2 h-4 w-4 inline opacity-40" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4 inline" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4 inline" />
    );
  };

  const processedChallans = useMemo(() => {
    let filtered = [...challans];

    if (filters.challan_number) {
      filtered = filtered.filter((c) =>
        c.challan_number
          .toLowerCase()
          .includes(filters.challan_number.toLowerCase()),
      );
    }
    if (filters.purchaser) {
      filtered = filtered.filter((c) =>
        c.purchasers.name
          .toLowerCase()
          .includes(filters.purchaser.toLowerCase()),
      );
    }
    if (filters.status !== "all") {
      filtered = filtered.filter((c) => c.status === filters.status);
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
          case "challan_date":
            aVal = a.challan_date;
            bVal = b.challan_date;
            break;
          case "total_weight_kg":
            aVal = Number(a.total_weight_kg);
            bVal = Number(b.total_weight_kg);
            break;
          case "total_birds":
            aVal = Number(a.total_birds || 0);
            bVal = Number(b.total_birds || 0);
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
    } else {
      filtered.sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime(),
      );
    }

    return filtered;
  }, [challans, filters, sortColumn, sortDirection]);

  const { currentPage, totalPages, paginatedItems, goToPage } = usePagination({
    items: processedChallans,
    itemsPerPage,
  });

  const handleDelete = async () => {
    if (!challanToDelete) return;
    setIsDeleting(true);
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from("challans")
        .delete()
        .eq("id", challanToDelete);

      if (error) throw error;

      toast({
        variant: "success",
        title: "Purchase challan deleted",
        description: "The purchase challan has been removed successfully.",
      });
      router.refresh();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Cannot delete purchase challan",
        description:
          error instanceof Error ? error.message : "An error occurred.",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setChallanToDelete(null);
    }
  };

  const handleExport = () => {
    const columns: ExportColumn[] = [
      { key: "challan_number", label: "Purchase Challan Number" },
      { key: "purchaser_name", label: "Purchaser" },
      {
        key: "challan_date",
        label: "Date",
        formatter: (date) =>
          formatIndianDate(date, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }),
      },
      { key: "num_boxes", label: "Boxes" },
      {
        key: "total_weight_kg",
        label: "Total Weight (KG)",
        formatter: (val) => (val != null ? Number(val).toFixed(3) : ""),
      },
      {
        key: "total_birds",
        label: "Birds",
        formatter: (val) => (val != null ? String(Number(val)) : "0"),
      },
      {
        key: "status",
        label: "Status",
        formatter: (status) =>
          statusConfig[status as keyof typeof statusConfig]?.label || status,
      },
    ];
    exportToCSV(
      processedChallans.map((c) => ({
        ...c,
        purchaser_name: c.purchasers.name,
      })),
      columns,
      `challans-${getTimestamp()}.csv`,
    );
    toast({
      variant: "success",
      title: "Exported",
      description: `${processedChallans.length} purchase challan(s) exported to CSV successfully.`,
    });
  };

  if (challans.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-white">
        <p className="text-muted-foreground">
          No purchase challans found. Create your first purchase challan to get started.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <IconTooltip label="Export to CSV">
          <Button onClick={handleExport} size="sm" variant="outline">
            <Download className="h-4 w-4" />
          </Button>
        </IconTooltip>
      </div>
      <div className="rounded-lg border bg-white overflow-x-auto">
        <Table className="text-xs sm:text-sm">
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                onClick={() => handleSort("challan_number")}
              >
                Purchase challan #
                <SortIcon column="challan_number" />
              </TableHead>
              <TableHead className="px-2 sm:px-4 py-2 sm:py-3">Purchaser</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                onClick={() => handleSort("challan_date")}
              >
                Date
                <SortIcon column="challan_date" />
              </TableHead>
              <TableHead className="hidden sm:table-cell px-2 sm:px-4 py-2 sm:py-3">
                Boxes
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                onClick={() => handleSort("total_weight_kg")}
              >
                Weight (KG)
                <SortIcon column="total_weight_kg" />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                onClick={() => handleSort("total_birds")}
              >
                Birds
                <SortIcon column="total_birds" />
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
              <TableHead className="px-2 sm:px-4 py-2">
                <Input
                  placeholder="Filter..."
                  value={filters.challan_number}
                  onChange={(e) =>
                    handleFilterChange("challan_number", e.target.value)
                  }
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="px-2 sm:px-4 py-2">
                <Input
                  placeholder="Filter..."
                  value={filters.purchaser}
                  onChange={(e) =>
                    handleFilterChange("purchaser", e.target.value)
                  }
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="px-2 sm:px-4 py-2" />
              <TableHead className="hidden sm:table-cell" />
              <TableHead className="px-2 sm:px-4 py-2" />
              <TableHead className="px-2 sm:px-4 py-2" />
              <TableHead className="px-2 sm:px-4 py-2">
                <SearchableSelect
                  value={filters.status}
                  onValueChange={(value) => handleFilterChange("status", value)}
                  options={statusOptions}
                  placeholder="Status"
                />
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedItems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground py-12"
                >
                  No purchase challans found for the selected filters.
                </TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((challan) => {
                const statusInfo = statusConfig[challan.status] || {
                  label: challan.status,
                  className: "bg-gray-100 text-gray-800",
                };
                return (
                  <TableRow key={challan.id} className="text-xs sm:text-sm">
                    <TableCell className="font-mono px-2 sm:px-4 py-2 sm:py-3">
                      {challan.challan_number}
                    </TableCell>
                    <TableCell className="px-2 sm:px-4 py-2 sm:py-3">
                      <div>
                        <div className="font-medium">{challan.purchasers.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {challan.purchasers.purchaser_code}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-2 sm:px-4 py-2 sm:py-3">
                      {formatIndianDate(challan.challan_date)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell px-2 sm:px-4 py-2 sm:py-3">
                      {challan.num_boxes}
                    </TableCell>
                    <TableCell className="px-2 sm:px-4 py-2 sm:py-3">
                      {Number(challan.total_weight_kg).toFixed(3)}
                    </TableCell>
                    <TableCell className="px-2 sm:px-4 py-2 sm:py-3">
                      {Number(challan.total_birds || 0).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="px-2 sm:px-4 py-2 sm:py-3">
                      <Badge variant="secondary" className={statusInfo.className}>
                        {statusInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3">
                      <div className="flex items-center justify-end gap-1">
                        <EntryHistoryButton
                          entityType="challan"
                          entityId={challan.id}
                          createdAt={challan.created_at}
                          createdByName={challan.profiles?.full_name}
                        />
                        <TableRowActions>
                          {(challan.status !== "invoiced" ||
                            !challan.purchase_invoice_id) && (
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/challans/${challan.id}`}>
                                <Eye />
                                View
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {challan.status === "final" && (
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/dashboard/purchase-invoices/new?challan_id=${challan.id}`}
                              >
                                <FileText />
                                Create invoice
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {challan.status === "invoiced" &&
                            challan.purchase_invoice_id && (
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/dashboard/purchase-invoices/${challan.purchase_invoice_id}`}
                                >
                                  <FileText />
                                  View invoice
                                </Link>
                              </DropdownMenuItem>
                            )}
                          {canEditChallan(
                            userRole,
                            challan.status,
                            challan.purchase_invoices?.amount_paid,
                          ) && (
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/dashboard/challans/${challan.id}/edit`}
                              >
                                <Pencil />
                                Edit
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {allowDelete && canDeleteChallan(challan) && (
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => {
                                setChallanToDelete(challan.id);
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
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={goToPage}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={setItemsPerPage}
        totalItems={processedChallans.length}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete purchase challan?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Draft, final, and unlocked purchase
              challans can be deleted by Super Admin.
              can be deleted by Super Admin.
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
