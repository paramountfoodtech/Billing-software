"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Download, Eye, FileText, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { fmtPercent } from "@/lib/material-calculations"
import { formatIndianDate, getIndianToday } from "@/lib/date-time"
import { exportToCSV, exportToPDF, type ExportColumn, getTimestamp } from "@/lib/export-utils"
import { usePagination } from "@/hooks/use-pagination"
import { TablePagination } from "@/components/table-pagination"
import { EntryHistoryButton } from "@/components/entry-history-button"
import { IconTooltip } from "@/components/icon-tooltip"
import { getProfileDisplayName, logEntryHistory } from "@/lib/entry-history"
import type { MaterialStockEntry } from "@/components/material-stock-form"
import type { MaterialProcessingEntry } from "@/components/material-processing-form"

interface MaterialStockTableProps {
  entries: MaterialStockEntry[]
  processingEntries: MaterialProcessingEntry[]
  userRole: string
}

function formatKg(value: string | number | null | undefined) {
  return Number(value || 0).toFixed(2)
}

export function MaterialStockTable({ entries, processingEntries, userRole }: MaterialStockTableProps) {
  const router = useRouter()
  const { toast } = useToast()
  const canWrite = userRole === "super_admin" || userRole === "admin"
  const today = getIndianToday()
  const processingDates = useMemo(
    () => new Set(processingEntries.map((entry) => entry.processing_date)),
    [processingEntries],
  )
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [entryToDelete, setEntryToDelete] = useState<MaterialStockEntry | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [sortColumn, setSortColumn] = useState<string | null>("purchase_date")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [filters, setFilters] = useState({
    vehicle_number: "",
  })
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return <ArrowUpDown className="ml-2 h-4 w-4 inline opacity-40" />
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4 inline" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4 inline" />
    )
  }

  const processedEntries = useMemo(() => {
    let filtered = [...entries]

    if (filters.vehicle_number) {
      filtered = filtered.filter((entry) =>
        (entry.vehicle_number || "").toLowerCase().includes(filters.vehicle_number.toLowerCase()),
      )
    }
    if (dateFrom) {
      filtered = filtered.filter((entry) => entry.purchase_date >= dateFrom)
    }
    if (dateTo) {
      filtered = filtered.filter((entry) => entry.purchase_date <= dateTo)
    }

    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal: string | number = ""
        let bVal: string | number = ""
        switch (sortColumn) {
          case "purchase_date":
            aVal = a.purchase_date
            bVal = b.purchase_date
            break
          case "farm_weight_kg":
            aVal = Number(a.farm_weight_kg)
            bVal = Number(b.farm_weight_kg)
            break
          case "bridge_weight_kg":
            aVal = Number(a.bridge_weight_kg)
            bVal = Number(b.bridge_weight_kg)
            break
          case "variance_percent":
            aVal = Number(a.variance_percent || 0)
            bVal = Number(b.variance_percent || 0)
            break
        }
        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1
        return 0
      })
    }

    return filtered
  }, [entries, filters, dateFrom, dateTo, sortColumn, sortDirection])

  const pagination = usePagination({ items: processedEntries, itemsPerPage })

  const exportColumns: ExportColumn[] = [
    { key: "reference_number", label: "Reference Number", widthFrac: 0.16 },
    { key: "purchase_date", label: "Purchase Date", formatter: (date) => formatIndianDate(date), widthFrac: 0.11 },
    { key: "vehicle_number", label: "Vehicle Number", widthFrac: 0.12 },
    { key: "farm_birds", label: "Farm Birds", widthFrac: 0.08, align: "right" },
    { key: "farm_weight_kg", label: "Farm Weight KG", formatter: (val) => Number(val || 0).toFixed(2), widthFrac: 0.1, align: "right" },
    { key: "bridge_birds", label: "Bridge Birds", widthFrac: 0.08, align: "right" },
    { key: "bridge_weight_kg", label: "Bridge Weight KG", formatter: (val) => Number(val || 0).toFixed(2), widthFrac: 0.1, align: "right" },
    { key: "difference_kg", label: "Difference KG", formatter: (val) => Number(val || 0).toFixed(2), widthFrac: 0.1, align: "right" },
    { key: "variance_percent", label: "Variance %", formatter: (val) => fmtPercent(val), widthFrac: 0.08, align: "right" },
    { key: "remarks", label: "Remarks", widthFrac: 0.07 },
  ]

  const handleExport = () => {
    if (processedEntries.length === 0) {
      toast({
        variant: "destructive",
        title: "No data",
        description: "There are no stock entries to export.",
      })
      return
    }
    exportToCSV(processedEntries, exportColumns, `material-stock-${getTimestamp()}.csv`)
    toast({
      variant: "success",
      title: "Exported",
      description: `${processedEntries.length} stock entr${processedEntries.length === 1 ? "y" : "ies"} exported to CSV successfully.`,
    })
  }

  const handleExportPDF = async () => {
    if (processedEntries.length === 0) {
      toast({
        variant: "destructive",
        title: "No data",
        description: "There are no stock entries to export.",
      })
      return
    }
    await exportToPDF(
      processedEntries,
      exportColumns,
      "Material Stock Report",
      `material-stock-${getTimestamp()}.pdf`,
    )
    toast({
      variant: "success",
      title: "Exported",
      description: `${processedEntries.length} stock entr${processedEntries.length === 1 ? "y" : "ies"} exported to PDF successfully.`,
    })
  }

  const handleDelete = async () => {
    if (!entryToDelete) return
    if (!canWrite) {
      toast({
        variant: "destructive",
        title: "Read only access",
        description: "Accountants can view operations but cannot delete entries.",
      })
      return
    }
    if (processingDates.has(entryToDelete.purchase_date)) {
      toast({
        variant: "destructive",
        title: "Cannot delete stock entry",
        description: `Processing already exists for ${formatIndianDate(entryToDelete.purchase_date)}. Delete or edit that processing entry before removing this stock entry.`,
      })
      setDeleteDialogOpen(false)
      setEntryToDelete(null)
      return
    }

    setIsDeleting(true)
    const supabase = createClient()
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Authentication required")

      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id, role")
        .eq("id", user.id)
        .single()
      if (!profile?.organization_id || !["super_admin", "admin"].includes(profile.role)) {
        throw new Error("You do not have permission to delete stock entries")
      }

      const { data: linkedProcessing, error: linkedProcessingError } = await supabase
        .from("material_processing_entries")
        .select("id")
        .eq("organization_id", profile.organization_id)
        .eq("processing_date", entryToDelete.purchase_date)
        .limit(1)
      if (linkedProcessingError) throw linkedProcessingError
      if ((linkedProcessing || []).length > 0) {
        throw new Error(
          `Processing already exists for ${formatIndianDate(entryToDelete.purchase_date)}. Delete or edit that processing entry before removing this stock entry.`,
        )
      }

      const userName = await getProfileDisplayName(supabase, user.id)
      await logEntryHistory(supabase, {
        organizationId: profile.organization_id,
        entityType: "material_stock",
        entityId: entryToDelete.id,
        action: "updated",
        userId: user.id,
        userName,
        summary: `Deleted stock entry ${entryToDelete.reference_number}`,
      })

      const { error } = await supabase
        .from("material_stock_entries")
        .delete()
        .eq("id", entryToDelete.id)
      if (error) throw error

      toast({
        variant: "success",
        title: "Stock entry deleted",
        description: `${entryToDelete.reference_number} removed successfully.`,
      })
      router.refresh()
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete stock entry.",
      })
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
      setEntryToDelete(null)
    }
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-white">
        <p className="text-muted-foreground">No stock entries found. Add your first stock entry to get started.</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">From:</span>
          <Input
            type="date"
            className="h-8 w-36 text-xs"
            max={dateTo || today}
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <span className="text-xs text-muted-foreground font-medium">To:</span>
          <Input
            type="date"
            className="h-8 w-36 text-xs"
            max={today}
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
          {(dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs px-2"
              onClick={() => { setDateFrom(""); setDateTo("") }}
            >
              Clear
            </Button>
          )}
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <IconTooltip label="Export to CSV">
            <Button onClick={handleExport} size="sm" variant="outline" className="flex-1 sm:flex-none">
              <Download className="h-4 w-4" />
              <span className="ml-2">CSV</span>
            </Button>
          </IconTooltip>
          <IconTooltip label="Export to PDF">
            <Button onClick={handleExportPDF} size="sm" variant="outline" className="flex-1 sm:flex-none">
              <FileText className="h-4 w-4" />
              <span className="ml-2">PDF</span>
            </Button>
          </IconTooltip>
        </div>
      </div>

      <div className="rounded-lg border bg-white overflow-x-auto">
        <Table className="text-xs sm:text-sm">
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer whitespace-nowrap" onClick={() => handleSort("purchase_date")}>
                Date <SortIcon column="purchase_date" />
              </TableHead>
              <TableHead className="hidden md:table-cell">Vehicle</TableHead>
              <TableHead
                className="text-center cursor-pointer whitespace-nowrap"
                onClick={() => handleSort("farm_weight_kg")}
              >
                Farm Weight (KG) <SortIcon column="farm_weight_kg" />
              </TableHead>
              <TableHead
                className="text-center cursor-pointer whitespace-nowrap"
                onClick={() => handleSort("bridge_weight_kg")}
              >
                Bridge Weight (KG) <SortIcon column="bridge_weight_kg" />
              </TableHead>
              <TableHead className="text-center whitespace-nowrap">Diff KG</TableHead>
              <TableHead
                className="text-center cursor-pointer whitespace-nowrap"
                onClick={() => handleSort("variance_percent")}
              >
                Variance <SortIcon column="variance_percent" />
              </TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
            <TableRow>
              <TableHead className="py-1" />
              <TableHead className="hidden md:table-cell py-1">
                <Input className="h-7 text-xs" placeholder="Filter..." value={filters.vehicle_number} onChange={(e) => setFilters({ vehicle_number: e.target.value })} />
              </TableHead>
              <TableHead colSpan={5} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedItems.map((entry) => (
              <TableRow key={entry.id} className="hover:bg-slate-50/60">
                <TableCell className="whitespace-nowrap">{formatIndianDate(entry.purchase_date)}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">{entry.vehicle_number || "—"}</TableCell>
                {/* Farm: KG bold, birds count subdued below */}
                <TableCell className="text-center">
                  <span className="font-semibold">{formatKg(entry.farm_weight_kg)}</span>
                  <span className="block text-[11px] text-muted-foreground leading-tight">{entry.farm_birds} birds</span>
                </TableCell>
                {/* Bridge: KG bold, birds count subdued below */}
                <TableCell className="text-center">
                  <span className="font-semibold">{formatKg(entry.bridge_weight_kg)}</span>
                  <span className="block text-[11px] text-muted-foreground leading-tight">{entry.bridge_birds} birds</span>
                </TableCell>
                <TableCell className="text-center tabular-nums">{formatKg(entry.difference_kg)}</TableCell>
                <TableCell className="text-center tabular-nums">
                  <span className={Number(entry.variance_percent || 0) > 1 ? "text-amber-600 font-medium" : ""}>
                    {fmtPercent(entry.variance_percent)}%
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <EntryHistoryButton entityType="material_stock" entityId={entry.id} />
                    <IconTooltip label="View stock entry">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/operations/stock/${entry.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </IconTooltip>
                    {canWrite && (
                      <>
                        <IconTooltip label="Edit stock entry">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/dashboard/operations/stock/${entry.id}/edit`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                        </IconTooltip>
                        <IconTooltip label="Delete stock entry">
                          <Button variant="ghost" size="sm" onClick={() => { setEntryToDelete(entry); setDeleteDialogOpen(true) }}>
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </IconTooltip>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        totalItems={pagination.totalItems}
        itemsPerPage={itemsPerPage}
        onPageChange={pagination.goToPage}
        onItemsPerPageChange={setItemsPerPage}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete stock entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {entryToDelete && processingDates.has(entryToDelete.purchase_date)
                ? `Processing already exists for ${formatIndianDate(entryToDelete.purchase_date)}, so this stock entry cannot be deleted.`
                : `This will permanently remove ${entryToDelete?.reference_number}. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting || Boolean(entryToDelete && processingDates.has(entryToDelete.purchase_date))}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
