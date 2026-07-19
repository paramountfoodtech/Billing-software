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
import { formatIndianDate, getIndianToday } from "@/lib/date-time"
import { exportToCSV, exportToPDF, type ExportColumn, getTimestamp } from "@/lib/export-utils"
import { fmtPercent } from "@/lib/material-calculations"
import { usePagination } from "@/hooks/use-pagination"
import { TablePagination } from "@/components/table-pagination"
import { EntryHistoryButton } from "@/components/entry-history-button"
import { IconTooltip } from "@/components/icon-tooltip"
import { getProfileDisplayName, logEntryHistory } from "@/lib/entry-history"
import { getEntryStockBreakdown } from "@/lib/material-processing"
import type { MaterialProcessingEntry } from "@/lib/material-processing"

interface MaterialProcessingTableProps {
  entries: MaterialProcessingEntry[]
  userRole: string
}

function formatKg(value: string | number | null | undefined) {
  return Number(value || 0).toFixed(2)
}

export function MaterialProcessingTable({
  entries,
  userRole,
}: MaterialProcessingTableProps) {
  const router = useRouter()
  const { toast } = useToast()
  const canEditEntries = userRole === "super_admin"
  const today = getIndianToday()
  const [entryToDelete, setEntryToDelete] = useState<MaterialProcessingEntry | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [sortColumn, setSortColumn] = useState<string | null>("processing_date")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [itemsPerPage, setItemsPerPage] = useState(25)
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

    if (dateFrom) filtered = filtered.filter((e) => e.processing_date >= dateFrom)
    if (dateTo) filtered = filtered.filter((e) => e.processing_date <= dateTo)

    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal: string | number = ""
        let bVal: string | number = ""
        switch (sortColumn) {
          case "processing_date":
            aVal = a.processing_date; bVal = b.processing_date; break
          case "purchased_weight_kg":
            aVal = Number(a.purchased_weight_kg); bVal = Number(b.purchased_weight_kg); break
          case "processed_weight_kg":
            aVal = Number(a.processed_weight_kg); bVal = Number(b.processed_weight_kg); break
          case "mortality_weight_kg":
            aVal = Number(a.mortality_weight_kg); bVal = Number(b.mortality_weight_kg); break
          case "actual_leftover_weight_kg":
            aVal = Number(a.actual_leftover_weight_kg); bVal = Number(b.actual_leftover_weight_kg); break
          case "yield_percent":
            aVal = Number(a.yield_percent); bVal = Number(b.yield_percent); break
        }
        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1
        return 0
      })
    }

    return filtered
  }, [entries, dateFrom, dateTo, sortColumn, sortDirection])

  const pagination = usePagination({ items: processedEntries, itemsPerPage })

  const exportColumns: ExportColumn[] = [
    { key: "processing_date", label: "Processing Date", formatter: (date) => formatIndianDate(date), widthFrac: 0.12 },
    { key: "current_stock_weight_kg", label: "Current Stock KG", formatter: (val) => Number(val || 0).toFixed(2), widthFrac: 0.1, align: "right" },
    { key: "carryover_expected_weight_kg", label: "Carry-over Expected KG", formatter: (val) => Number(val || 0).toFixed(2), widthFrac: 0.1, align: "right" },
    { key: "carryover_actual_weight_kg", label: "Carry-over Actual KG", formatter: (val) => Number(val || 0).toFixed(2), widthFrac: 0.1, align: "right" },
    { key: "carryover_from_date", label: "Carry-over From", formatter: (date) => (date ? formatIndianDate(date) : "—"), widthFrac: 0.1 },
    { key: "purchased_birds", label: "Total Birds", widthFrac: 0.08, align: "right" },
    { key: "purchased_weight_kg", label: "Total Weight KG", formatter: (val) => Number(val || 0).toFixed(2), widthFrac: 0.1, align: "right" },
    { key: "processed_birds", label: "Processed Birds", widthFrac: 0.1, align: "right" },
    { key: "processed_weight_kg", label: "Processed Weight KG", formatter: (val) => Number(val || 0).toFixed(2), widthFrac: 0.13, align: "right" },
    { key: "mortality_birds", label: "Mortality Birds", widthFrac: 0.1, align: "right" },
    { key: "mortality_weight_kg", label: "Mortality Weight KG", formatter: (val) => Number(val || 0).toFixed(2), widthFrac: 0.13, align: "right" },
    { key: "actual_leftover_weight_kg", label: "Actual Leftover KG", formatter: (val) => Number(val || 0).toFixed(2), widthFrac: 0.12, align: "right" },
    { key: "yield_percent", label: "Yield %", formatter: (val) => fmtPercent(val), widthFrac: 0.05, align: "right" },
  ]

  const handleExport = () => {
    if (processedEntries.length === 0) {
      toast({
        variant: "destructive",
        title: "No data",
        description: "There are no processing entries to export.",
      })
      return
    }
    const enriched = processedEntries.map((entry) => {
      const breakdown = getEntryStockBreakdown(entry)
      return {
        ...entry,
        current_stock_weight_kg: breakdown.stockWeightKg,
        carryover_expected_weight_kg: breakdown.carryoverExpectedWeightKg,
        carryover_actual_weight_kg: breakdown.carryoverWeightKg,
        carryover_from_date: breakdown.carryoverFromDate,
      }
    })
    exportToCSV(enriched, exportColumns, `material-processing-${getTimestamp()}.csv`)
    toast({
      variant: "success",
      title: "Exported",
      description: `${processedEntries.length} processing entr${processedEntries.length === 1 ? "y" : "ies"} exported to CSV successfully.`,
    })
  }

  const handleExportPDF = async () => {
    if (processedEntries.length === 0) {
      toast({
        variant: "destructive",
        title: "No data",
        description: "There are no processing entries to export.",
      })
      return
    }
    const enriched = processedEntries.map((entry) => {
      const breakdown = getEntryStockBreakdown(entry)
      return {
        ...entry,
        current_stock_weight_kg: breakdown.stockWeightKg,
        carryover_expected_weight_kg: breakdown.carryoverExpectedWeightKg,
        carryover_actual_weight_kg: breakdown.carryoverWeightKg,
        carryover_from_date: breakdown.carryoverFromDate,
      }
    })
    await exportToPDF(
      enriched,
      exportColumns,
      "Material Processing Report",
      `material-processing-${getTimestamp()}.pdf`,
    )
    toast({
      variant: "success",
      title: "Exported",
      description: `${processedEntries.length} processing entr${processedEntries.length === 1 ? "y" : "ies"} exported to PDF successfully.`,
    })
  }

  const handleDelete = async () => {
    if (!entryToDelete) return
    if (!canEditEntries) {
      toast({
        variant: "destructive",
        title: "Read only access",
        description: "Only Super Admin can delete processing entries.",
      })
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
      if (!profile?.organization_id || profile.role !== "super_admin") {
        throw new Error("You do not have permission to delete processing entries")
      }

      const userName = await getProfileDisplayName(supabase, user.id)
      await logEntryHistory(supabase, {
        organizationId: profile.organization_id,
        entityType: "material_processing",
        entityId: entryToDelete.id,
        action: "updated",
        userId: user.id,
        userName,
        summary: `Deleted processing entry for ${entryToDelete.processing_date}`,
      })

      const { error } = await supabase
        .from("material_processing_entries")
        .delete()
        .eq("id", entryToDelete.id)
      if (error) throw error

      toast({
        variant: "success",
        title: "Processing entry deleted",
        description: `Processing entry for ${entryToDelete.processing_date} removed successfully.`,
      })
      router.refresh()
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete processing entry.",
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
        <p className="text-muted-foreground">No processing entries found. Add your first processing entry to get started.</p>
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
              <TableHead className="cursor-pointer whitespace-nowrap" onClick={() => handleSort("processing_date")}>
                Date <SortIcon column="processing_date" />
              </TableHead>
              <TableHead className="text-center cursor-pointer whitespace-nowrap" onClick={() => handleSort("purchased_weight_kg")}>
                Purchased Weight (KG) <SortIcon column="purchased_weight_kg" />
              </TableHead>
              <TableHead className="text-center cursor-pointer whitespace-nowrap" onClick={() => handleSort("processed_weight_kg")}>
                Processed Weight (KG) <SortIcon column="processed_weight_kg" />
              </TableHead>
              <TableHead className="text-center cursor-pointer whitespace-nowrap" onClick={() => handleSort("mortality_weight_kg")}>
                Mortality Weight (KG) <SortIcon column="mortality_weight_kg" />
              </TableHead>
              <TableHead className="text-center cursor-pointer whitespace-nowrap" onClick={() => handleSort("actual_leftover_weight_kg")}>
                Leftover Weight (KG) <SortIcon column="actual_leftover_weight_kg" />
              </TableHead>
              <TableHead className="text-center whitespace-nowrap">Used Stock (KG)</TableHead>
              <TableHead className="text-center cursor-pointer whitespace-nowrap" onClick={() => handleSort("yield_percent")}>
                Yield % <SortIcon column="yield_percent" />
              </TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedItems.map((entry) => {
              const breakdown = getEntryStockBreakdown(entry)
              const usedStock =
                Number(entry.actual_leftover_weight_kg || 0)
                + Number(entry.processed_weight_kg || 0)
                - Number(entry.mortality_weight_kg || 0)
              const purchasedKg = Number(entry.purchased_weight_kg || 0)
              const yieldPct = purchasedKg > 0 ? (usedStock / purchasedKg) * 100 : 0
              return (
                <TableRow key={entry.id} className="hover:bg-slate-50/60">
                  <TableCell className="whitespace-nowrap font-medium">{formatIndianDate(entry.processing_date)}</TableCell>
                  <TableCell className="text-center">
                    <span className="font-semibold">{formatKg(entry.purchased_weight_kg)}</span>
                    <span className="block text-[11px] text-muted-foreground leading-tight">
                      {entry.purchased_birds} birds
                    </span>
                    {(breakdown.stockWeightKg > 0 || breakdown.carryoverWeightKg > 0) && (
                      <span className="block text-[10px] text-muted-foreground leading-tight mt-0.5">
                        {breakdown.stockWeightKg.toFixed(2)} stock +{" "}
                        {breakdown.carryoverWeightKg.toFixed(2)} carry-over
                      </span>
                    )}
                    {breakdown.carryoverDiffersFromExpected && (
                      <span className="block text-[10px] text-amber-600 leading-tight">
                        Carry-over adjusted from expected
                      </span>
                    )}
                  </TableCell>
                  {/* Processed */}
                  <TableCell className="text-center">
                    <span className="font-semibold">{formatKg(entry.processed_weight_kg)}</span>
                    <span className="block text-[11px] text-muted-foreground leading-tight">{entry.processed_birds} birds</span>
                  </TableCell>
                  {/* Mortality */}
                  <TableCell className="text-center">
                    <span className="font-semibold">{formatKg(entry.mortality_weight_kg)}</span>
                    <span className="block text-[11px] text-muted-foreground leading-tight">{entry.mortality_birds} birds</span>
                  </TableCell>
                  {/* Leftover */}
                  <TableCell className="text-center">
                    <span className="font-semibold">{formatKg(entry.actual_leftover_weight_kg)}</span>
                    <span className="block text-[11px] text-muted-foreground leading-tight">{entry.actual_leftover_birds} birds</span>
                  </TableCell>
                  {/* Used Stock */}
                  <TableCell className="text-center tabular-nums">{usedStock.toFixed(2)}</TableCell>
                  {/* Yield */}
                  <TableCell className="text-center tabular-nums">
                    <span className={yieldPct < 90 ? "text-amber-600 font-medium" : "font-semibold"}>
                      {fmtPercent(yieldPct)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-1">
                      <EntryHistoryButton entityType="material_processing" entityId={entry.id} />
                      <IconTooltip label="View processing entry">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/operations/processing/${entry.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </IconTooltip>
                      {canEditEntries && (
                        <>
                          <IconTooltip label="Edit processing entry">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/dashboard/operations/processing/${entry.id}/edit`}>
                                <Pencil className="h-4 w-4" />
                              </Link>
                            </Button>
                          </IconTooltip>
                          <IconTooltip label="Delete processing entry">
                            <Button variant="ghost" size="sm" onClick={() => { setEntryToDelete(entry); setDeleteDialogOpen(true) }}>
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </IconTooltip>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
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
            <AlertDialogTitle>Delete processing entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the processing entry for {entryToDelete?.processing_date}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
