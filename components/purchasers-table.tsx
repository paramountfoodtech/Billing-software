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
import {
  Pencil,
  Trash2,
  Mail,
  Phone,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
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

interface Purchaser {
  id: string;
  purchaser_code: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
  outstanding?: number;
  profiles?: { full_name: string };
}

interface PurchasersTableProps {
  purchasers: Purchaser[];
}

export function PurchasersTable({ purchasers }: PurchasersTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [purchaserToDelete, setPurchaserToDelete] = useState<string | null>(null);

  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [filters, setFilters] = useState({ name: "", code: "", city: "" });

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

  const processedPurchasers = useMemo(() => {
    let filtered = [...purchasers];

    if (filters.name) {
      filtered = filtered.filter((p) =>
        p.name.toLowerCase().includes(filters.name.toLowerCase()),
      );
    }
    if (filters.code) {
      filtered = filtered.filter((p) =>
        p.purchaser_code.toLowerCase().includes(filters.code.toLowerCase()),
      );
    }
    if (filters.city) {
      filtered = filtered.filter((p) =>
        (p.city || "").toLowerCase().includes(filters.city.toLowerCase()),
      );
    }

    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal: string | number = "";
        let bVal: string | number = "";
        switch (sortColumn) {
          case "name":
            aVal = a.name;
            bVal = b.name;
            break;
          case "purchaser_code":
            aVal = a.purchaser_code;
            bVal = b.purchaser_code;
            break;
          case "city":
            aVal = a.city || "";
            bVal = b.city || "";
            break;
          case "outstanding":
            aVal = a.outstanding || 0;
            bVal = b.outstanding || 0;
            break;
          case "created_at":
            aVal = a.created_at;
            bVal = b.created_at;
            break;
        }
        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [purchasers, filters, sortColumn, sortDirection]);

  const { currentPage, totalPages, paginatedItems, goToPage } = usePagination({
    items: processedPurchasers,
    itemsPerPage,
  });

  const handleDelete = async () => {
    if (!purchaserToDelete) return;
    setIsDeleting(true);
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from("purchasers")
        .delete()
        .eq("id", purchaserToDelete);

      if (error) throw error;

      toast({
        variant: "success",
        title: "Purchaser deleted",
        description: "The purchaser has been removed successfully.",
      });
      router.refresh();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Cannot delete purchaser",
        description:
          error instanceof Error
            ? error.message.includes("violates foreign key")
              ? "This purchaser has challans or invoices linked. Remove those first."
              : error.message
            : "An error occurred while deleting.",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setPurchaserToDelete(null);
    }
  };

  const handleExport = () => {
    const columns: ExportColumn[] = [
      { key: "purchaser_code", label: "Purchaser ID" },
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "city", label: "City" },
      { key: "state", label: "State" },
      {
        key: "outstanding",
        label: "Outstanding (₹)",
        formatter: (val) => (val != null ? Number(val).toFixed(2) : ""),
      },
      {
        key: "created_at",
        label: "Created Date",
        formatter: (date) =>
          formatIndianDate(date, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }),
      },
    ];
    exportToCSV(processedPurchasers, columns, `purchasers-${getTimestamp()}.csv`);
    toast({
      variant: "success",
      title: "Exported",
      description: `${processedPurchasers.length} purchaser(s) exported to CSV successfully.`,
    });
  };

  if (purchasers.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-white">
        <p className="text-muted-foreground">
          No purchasers found. Add your first purchaser to get started.
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
                onClick={() => handleSort("purchaser_code")}
              >
                ID
                <SortIcon column="purchaser_code" />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                onClick={() => handleSort("name")}
              >
                Name
                <SortIcon column="name" />
              </TableHead>
              <TableHead className="hidden sm:table-cell px-2 sm:px-4 py-2 sm:py-3">
                Contact
              </TableHead>
              <TableHead
                className="hidden md:table-cell cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                onClick={() => handleSort("city")}
              >
                Location
                <SortIcon column="city" />
              </TableHead>
              <TableHead
                className="hidden lg:table-cell cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                onClick={() => handleSort("outstanding")}
              >
                Outstanding
                <SortIcon column="outstanding" />
              </TableHead>
              <TableHead
                className="hidden md:table-cell cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3"
                onClick={() => handleSort("created_at")}
              >
                Created
                <SortIcon column="created_at" />
              </TableHead>
              <TableHead className="text-right px-2 sm:px-4 py-2 sm:py-3">
                Actions
              </TableHead>
            </TableRow>
            <TableRow>
              <TableHead className="px-2 sm:px-4 py-2">
                <Input
                  placeholder="Filter..."
                  value={filters.code}
                  onChange={(e) => handleFilterChange("code", e.target.value)}
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="px-2 sm:px-4 py-2">
                <Input
                  placeholder="Filter..."
                  value={filters.name}
                  onChange={(e) => handleFilterChange("name", e.target.value)}
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="hidden sm:table-cell px-2 sm:px-4 py-2" />
              <TableHead className="hidden md:table-cell px-2 sm:px-4 py-2">
                <Input
                  placeholder="Filter..."
                  value={filters.city}
                  onChange={(e) => handleFilterChange("city", e.target.value)}
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="hidden lg:table-cell" />
              <TableHead className="hidden md:table-cell" />
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedItems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground py-12"
                >
                  No purchasers found for the selected filters.
                </TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((purchaser) => (
                <TableRow key={purchaser.id} className="text-xs sm:text-sm">
                  <TableCell className="font-mono px-2 sm:px-4 py-2 sm:py-3">
                    {purchaser.purchaser_code}
                  </TableCell>
                  <TableCell className="font-medium px-2 sm:px-4 py-2 sm:py-3 max-w-[120px] sm:max-w-none truncate">
                    {purchaser.name}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell px-2 sm:px-4 py-2 sm:py-3">
                    <div className="flex flex-col gap-1">
                      {purchaser.email && (
                        <div className="flex items-center gap-1 text-xs sm:text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{purchaser.email}</span>
                        </div>
                      )}
                      {purchaser.phone && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3 flex-shrink-0" />
                          <span>{purchaser.phone}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell px-2 sm:px-4 py-2 sm:py-3">
                    {[purchaser.city, purchaser.state].filter(Boolean).join(", ") ||
                      "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell px-2 sm:px-4 py-2 sm:py-3">
                    {(purchaser.outstanding || 0) > 0 ? (
                      <span className="font-medium text-red-600">
                        ₹
                        {(purchaser.outstanding || 0).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">₹0.00</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell px-2 sm:px-4 py-2 sm:py-3 text-muted-foreground">
                    {formatIndianDate(purchaser.created_at)}
                  </TableCell>
                  <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3">
                    <div className="flex items-center justify-end gap-1">
                      <EntryHistoryButton
                        entityType="purchaser"
                        entityId={purchaser.id}
                        createdAt={purchaser.created_at}
                        createdByName={purchaser.profiles?.full_name}
                      />
                      <IconTooltip label="Edit purchaser">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/purchasers/${purchaser.id}/edit`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                      </IconTooltip>
                      <IconTooltip label="Delete purchaser">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPurchaserToDelete(purchaser.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </IconTooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))
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
        totalItems={processedPurchasers.length}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete purchaser?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Purchasers with linked challans or
              invoices cannot be deleted.
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
