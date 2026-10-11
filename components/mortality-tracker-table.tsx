"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Pencil,
  Eye,
  Trash2,
  Truck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  FileText,
  CalendarDays,
  Bird,
  Weight,
  Coins,
} from "lucide-react"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { formatIndianDate, getIndianToday } from "@/lib/date-time"
import { exportToCSV, exportToPDF, type ExportColumn, getTimestamp } from "@/lib/export-utils"
import { usePagination } from "@/hooks/use-pagination"
import { TablePagination } from "@/components/table-pagination"
import { IconTooltip } from "@/components/icon-tooltip"
import { MortalityTrackerForm } from "@/components/mortality-tracker-form"
import type { MortalityTrackerEntry } from "@/lib/mortality-tracker"

interface MortalityTrackerTableProps {
  entries: MortalityTrackerEntry[]
  userRole: string
  organizationId: string
  configCategoryId: string | null
  categoryName?: string | null
  priceCategories: { id: string; name: string }[]
  datePriceMap?: Record<string, number>
}

function fmtKg(v: number | string | null | undefined) {
  return Number(v ?? 0).toFixed(3)
}
function fmtVal(v: number | string | null | undefined) {
  if (v == null) return "—"
  return "₹" + Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtRate(v: number | string | null | undefined) {
  if (v == null) return "—"
  return "₹" + Number(v).toFixed(2)
}

export function MortalityTrackerTable({
  entries,
  userRole,
  organizationId,
  configCategoryId,
  categoryName,
  priceCategories,
  datePriceMap,
}: MortalityTrackerTableProps) {
  const router = useRouter()
  const { toast } = useToast()
  const canDelete = userRole === "super_admin"

  // Check if EOD (Closing of the Day) is completed (both birds and kg > 0)
  const isEODComplete = (item: MortalityTrackerEntry) => {
    return Number(item.closing_birds || 0) > 0 && Number(item.closing_kg || 0) > 0
  }

  // Editable by all roles until EOD data is entered; after EOD only super_admin can edit
  const canEditEntry = (item: MortalityTrackerEntry) => {
    if (userRole === "super_admin") return true
    return !isEODComplete(item)
  }

  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [sortColumn, setSortColumn] = useState<string>("entry_date")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [itemsPerPage, setItemsPerPage] = useState(25)

  const [editingEntry, setEditingEntry] = useState<MortalityTrackerEntry | null>(null)
  const [entryToDelete, setEntryToDelete] = useState<MortalityTrackerEntry | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Enrich raw entries with real-time day rates and calculated totals
  const enrichedEntries = useMemo(() => {
    return entries.map((e) => {
      const dynamicRate = datePriceMap && e.entry_date in datePriceMap ? datePriceMap[e.entry_date] : null
      const storedRate = e.live_paper_rate != null ? Number(e.live_paper_rate) : null
      const activeRate = dynamicRate != null ? dynamicRate : storedRate

      const rowVehicleBirds = Number(e.vehicle_mortality_birds || 0)
      const rowVehicleKg = Number(e.vehicle_mortality_kg || 0)
      const rowOpeningBirds = Number(e.opening_birds || 0)
      const rowOpeningKg = Number(e.opening_kg || 0)
      const rowAfternoonBirds = Number(e.afternoon_birds || 0)
      const rowAfternoonKg = Number(e.afternoon_kg || 0)
      const rowClosingBirds = Number(e.closing_birds || 0)
      const rowClosingKg = Number(e.closing_kg || 0)

      const rowBirds = e.total_birds != null ? Number(e.total_birds) : (
        rowVehicleBirds + rowOpeningBirds + rowAfternoonBirds + rowClosingBirds
      )
      const rowKg = e.total_kg != null ? Number(e.total_kg) : (
        rowVehicleKg + rowOpeningKg + rowAfternoonKg + rowClosingKg
      )
      const rowValue = activeRate != null ? +(rowKg * activeRate).toFixed(2) : (
        e.total_value != null ? Number(e.total_value) : null
      )

      return {
        ...e,
        vehicle_mortality_birds: rowVehicleBirds,
        vehicle_mortality_kg: rowVehicleKg,
        opening_birds: rowOpeningBirds,
        opening_kg: rowOpeningKg,
        afternoon_birds: rowAfternoonBirds,
        afternoon_kg: rowAfternoonKg,
        closing_birds: rowClosingBirds,
        closing_kg: rowClosingKg,
        total_birds: rowBirds,
        total_kg: rowKg,
        live_paper_rate: activeRate,
        total_value: rowValue,
      }
    })
  }, [entries, datePriceMap])

  // Filter and sort entries
  const processedEntries = useMemo(() => {
    let result = enrichedEntries.filter((e) => {
      if (search) {
        const s = search.toLowerCase()
        const matchMain = e.vehicle_number ? e.vehicle_number.toLowerCase().includes(s) : false
        const matchVehicles = e.vehicle_entries?.some((v) =>
          v.vehicle_number ? v.vehicle_number.toLowerCase().includes(s) : false
        )
        if (!matchMain && !matchVehicles) return false
      }
      if (dateFrom && e.entry_date < dateFrom) return false
      if (dateTo && e.entry_date > dateTo) return false
      return true
    })

    if (sortColumn) {
      result.sort((a, b) => {
        let aVal: any = a[sortColumn as keyof MortalityTrackerEntry] ?? ""
        let bVal: any = b[sortColumn as keyof MortalityTrackerEntry] ?? ""

        if (typeof aVal === "number" || typeof bVal === "number") {
          aVal = Number(aVal || 0)
          bVal = Number(bVal || 0)
          return sortDirection === "asc" ? aVal - bVal : bVal - aVal
        }

        aVal = String(aVal).toLowerCase()
        bVal = String(bVal).toLowerCase()
        return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      })
    }

    return result
  }, [enrichedEntries, search, dateFrom, dateTo, sortColumn, sortDirection])

  // Pagination hook
  const pagination = usePagination({
    items: processedEntries,
    itemsPerPage,
  })

  // Grand summary totals across all filtered entries
  const grandTotals = useMemo(() => {
    let vehicleBirds = 0
    let vehicleKg = 0
    let openingBirds = 0
    let openingKg = 0
    let afternoonBirds = 0
    let afternoonKg = 0
    let closingBirds = 0
    let closingKg = 0
    let totalBirds = 0
    let totalKg = 0
    let totalValue = 0

    for (const e of processedEntries) {
      vehicleBirds += Number(e.vehicle_mortality_birds || 0)
      vehicleKg += Number(e.vehicle_mortality_kg || 0)
      openingBirds += Number(e.opening_birds || 0)
      openingKg += Number(e.opening_kg || 0)
      afternoonBirds += Number(e.afternoon_birds || 0)
      afternoonKg += Number(e.afternoon_kg || 0)
      closingBirds += Number(e.closing_birds || 0)
      closingKg += Number(e.closing_kg || 0)
      totalBirds += Number(e.total_birds || 0)
      totalKg += Number(e.total_kg || 0)
      if (e.total_value != null) {
        totalValue += Number(e.total_value)
      }
    }

    return {
      vehicleBirds,
      vehicleKg,
      openingBirds,
      openingKg,
      afternoonBirds,
      afternoonKg,
      closingBirds,
      closingKg,
      totalBirds,
      totalKg,
      totalValue,
    }
  }, [processedEntries])

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("desc")
    }
  }

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-1.5 h-3.5 w-3.5 inline opacity-40" />
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1.5 h-3.5 w-3.5 inline text-slate-800" />
    ) : (
      <ArrowDown className="ml-1.5 h-3.5 w-3.5 inline text-slate-800" />
    )
  }

  // Export columns definition
  const exportColumns: ExportColumn[] = [
    { key: "entry_date", label: "Date", formatter: (val) => formatIndianDate(val) },
    { key: "vehicle_number", label: "Vehicle Number", formatter: (val) => val || "—" },
    { key: "vehicle_mortality_birds", label: "Vehicle Birds" },
    { key: "vehicle_mortality_kg", label: "Vehicle KGs", formatter: fmtKg },
    { key: "opening_birds", label: "Opening Birds" },
    { key: "opening_kg", label: "Opening KGs", formatter: fmtKg },
    { key: "afternoon_birds", label: "Afternoon Birds" },
    { key: "afternoon_kg", label: "Afternoon KGs", formatter: fmtKg },
    { key: "closing_birds", label: "Closing Birds" },
    { key: "closing_kg", label: "Closing KGs", formatter: fmtKg },
    { key: "total_birds", label: "Total Birds" },
    { key: "total_kg", label: "Total KGs", formatter: fmtKg },
    { key: "live_paper_rate", label: "Live Rate (Rs/kg)", formatter: (val) => val != null ? Number(val).toFixed(2) : "—" },
    { key: "total_value", label: "Total Value (Rs)", formatter: (val) => val != null ? Number(val).toFixed(2) : "—" },
    { key: "notes", label: "Notes", formatter: (val) => val || "" },
  ]

  const handleExportCSV = () => {
    if (processedEntries.length === 0) {
      toast({ variant: "destructive", title: "No data", description: "There is no data to export." })
      return
    }
    exportToCSV(processedEntries, exportColumns, `mortality-tracker-${getTimestamp()}.csv`)
    toast({ variant: "success", title: "Exported", description: `${processedEntries.length} entries exported to CSV.` })
  }

  const handleExportPDF = async () => {
    if (processedEntries.length === 0) {
      toast({ variant: "destructive", title: "No data", description: "There is no data to export." })
      return
    }
    await exportToPDF(
      processedEntries,
      exportColumns,
      "Mortality Tracker Report",
      `mortality-tracker-${getTimestamp()}.pdf`
    )
    toast({ variant: "success", title: "Exported", description: `${processedEntries.length} entries exported to PDF.` })
  }

  const handleDelete = async () => {
    if (!entryToDelete || !canDelete) return
    setIsDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from("mortality_tracker_entries").delete().eq("id", entryToDelete.id)
    if (error) {
      toast({ variant: "destructive", title: "Delete failed", description: error.message })
    } else {
      toast({ variant: "success", title: "Entry deleted" })
      router.refresh()
    }
    setEntryToDelete(null)
    setIsDeleting(false)
  }

  return (
    <div className="space-y-4">
      {/* KPI summary ribbon */}
      {processedEntries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2.5 px-3 py-1.5">
            <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700 shadow-2xs">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Entries</p>
              <p className="text-base font-bold text-slate-800">{processedEntries.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-1.5">
            <div className="p-2 rounded-lg bg-sky-50 border border-sky-200 text-sky-700 shadow-2xs">
              <Bird className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Total Birds</p>
              <p className="text-base font-bold text-slate-800">{grandTotals.totalBirds.toLocaleString("en-IN")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-1.5">
            <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 shadow-2xs">
              <Weight className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Total KGs</p>
              <p className="text-base font-bold text-slate-800">{grandTotals.totalKg.toFixed(3)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-1.5">
            <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-2xs">
              <Coins className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Total Est. Value</p>
              <p className="text-base font-bold text-indigo-700">₹{grandTotals.totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar: Filters on left, Export buttons on right */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Input
            id="mortality-search"
            placeholder="Search vehicle number..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              pagination.goToPage(1)
            }}
            className="w-full sm:w-[200px] h-9 text-xs"
          />
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500 whitespace-nowrap">From</label>
            <Input
              type="date"
              max={getIndianToday()}
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                pagination.goToPage(1)
              }}
              className="w-36 h-9 text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500 whitespace-nowrap">To</label>
            <Input
              type="date"
              max={getIndianToday()}
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                pagination.goToPage(1)
              }}
              className="w-36 h-9 text-xs"
            />
          </div>
          {(search || dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-slate-500 text-xs px-2"
              onClick={() => {
                setSearch("")
                setDateFrom("")
                setDateTo("")
                pagination.goToPage(1)
              }}
            >
              Clear
            </Button>
          )}
        </div>

        {/* Export buttons */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <IconTooltip label="Export to CSV">
            <Button onClick={handleExportCSV} size="sm" variant="outline" className="h-9 text-xs">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              CSV
            </Button>
          </IconTooltip>
          <IconTooltip label="Export to PDF">
            <Button onClick={handleExportPDF} size="sm" variant="outline" className="h-9 text-xs">
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              PDF
            </Button>
          </IconTooltip>
        </div>
      </div>

      {/* Main Tabular Component */}
      <div className="rounded-lg border bg-white overflow-x-auto shadow-xs">
        <Table className="text-xs sm:text-sm">
          <TableHeader>
            <TableRow className="bg-slate-50/80 border-b">
              <TableHead
                className="cursor-pointer whitespace-nowrap font-semibold py-3"
                onClick={() => handleSort("entry_date")}
              >
                Date <SortIcon column="entry_date" />
              </TableHead>
              <TableHead
                className="cursor-pointer whitespace-nowrap font-semibold py-3"
                onClick={() => handleSort("vehicle_number")}
              >
                Vehicle <SortIcon column="vehicle_number" />
              </TableHead>
              <TableHead className="text-center font-semibold whitespace-nowrap bg-purple-50/60 py-3">
                From Vehicle
              </TableHead>
              <TableHead className="text-center font-semibold whitespace-nowrap py-3">
                Opening
              </TableHead>
              <TableHead className="text-center font-semibold whitespace-nowrap py-3">
                Afternoon
              </TableHead>
              <TableHead className="text-center font-semibold whitespace-nowrap py-3">
                Closing
              </TableHead>
              <TableHead
                className="text-right cursor-pointer whitespace-nowrap font-semibold py-3"
                onClick={() => handleSort("total_birds")}
              >
                Total Birds <SortIcon column="total_birds" />
              </TableHead>
              <TableHead
                className="text-right cursor-pointer whitespace-nowrap font-semibold py-3"
                onClick={() => handleSort("total_kg")}
              >
                Total KGs <SortIcon column="total_kg" />
              </TableHead>
              <TableHead
                className="text-right cursor-pointer whitespace-nowrap font-semibold py-3"
                onClick={() => handleSort("live_paper_rate")}
              >
                Rate/KG <SortIcon column="live_paper_rate" />
              </TableHead>
              <TableHead className="text-center font-semibold py-3 w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12 text-slate-400">
                  <p className="text-base font-medium">No mortality entries found</p>
                  <p className="text-xs mt-1">Add your first entry using the button above or clear filters.</p>
                </TableCell>
              </TableRow>
            ) : (
              pagination.paginatedItems.map((item: MortalityTrackerEntry) => {
                const vehicleList = item.vehicle_entries && item.vehicle_entries.length > 0 ? item.vehicle_entries : null

                return (
                  <TableRow key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell className="whitespace-nowrap font-medium text-slate-800">
                      {formatIndianDate(item.entry_date)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {vehicleList && vehicleList.length > 1 ? (
                        <div
                          className="flex items-center gap-1.5 cursor-help"
                          title={vehicleList.map(v => `${v.vehicle_number || "Vehicle"}: ${v.birds} birds, ${fmtKg(v.kg)} kg`).join("\n")}
                        >
                          <Truck className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                          <span className="font-semibold text-purple-700">{vehicleList.length} vehicles</span>
                        </div>
                      ) : (
                        <span className="text-slate-700">{item.vehicle_number || "—"}</span>
                      )}
                    </TableCell>
                    {/* From Vehicle */}
                    <TableCell className="text-center bg-purple-50/30">
                      <span className="font-semibold text-purple-900">
                        {(item.vehicle_mortality_birds ?? 0).toLocaleString("en-IN")}
                      </span>
                      <span className="block text-[11px] text-purple-700 font-mono leading-tight">
                        {fmtKg(item.vehicle_mortality_kg)} kg
                      </span>
                    </TableCell>
                    {/* Opening */}
                    <TableCell className="text-center">
                      <span className="font-medium text-slate-800">
                        {(item.opening_birds ?? 0).toLocaleString("en-IN")}
                      </span>
                      <span className="block text-[11px] text-muted-foreground font-mono leading-tight">
                        {fmtKg(item.opening_kg)} kg
                      </span>
                    </TableCell>
                    {/* Afternoon */}
                    <TableCell className="text-center">
                      <span className="font-medium text-slate-800">
                        {(item.afternoon_birds ?? 0).toLocaleString("en-IN")}
                      </span>
                      <span className="block text-[11px] text-muted-foreground font-mono leading-tight">
                        {fmtKg(item.afternoon_kg)} kg
                      </span>
                    </TableCell>
                    {/* Closing */}
                    <TableCell className="text-center">
                      <span className="font-medium text-slate-800">
                        {(item.closing_birds ?? 0).toLocaleString("en-IN")}
                      </span>
                      <span className="block text-[11px] text-muted-foreground font-mono leading-tight">
                        {fmtKg(item.closing_kg)} kg
                      </span>
                    </TableCell>
                    {/* Total Birds */}
                    <TableCell className="text-right font-bold text-slate-900">
                      {(item.total_birds ?? 0).toLocaleString("en-IN")}
                    </TableCell>
                    {/* Total KGs */}
                    <TableCell className="text-right font-bold text-slate-900 font-mono">
                      {fmtKg(item.total_kg)}
                    </TableCell>
                    {/* Live Rate */}
                    <TableCell className="text-right text-emerald-700 font-medium">
                      {fmtRate(item.live_paper_rate)}
                    </TableCell>
                    {/* Actions */}
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {canEditEntry(item) ? (
                          <IconTooltip label="Edit">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-slate-500 hover:text-slate-900"
                              onClick={() => setEditingEntry(item)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </IconTooltip>
                        ) : (
                          <IconTooltip label="View">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-slate-500 hover:text-slate-900"
                              onClick={() => setEditingEntry(item)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </IconTooltip>
                        )}
                        {canDelete && (
                          <IconTooltip label="Delete">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setEntryToDelete(item)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </IconTooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination component */}
      {pagination.totalPages > 1 && (
        <TablePagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={pagination.goToPage}
          onItemsPerPageChange={(size) => {
            setItemsPerPage(size)
            pagination.goToPage(1)
          }}
          showItemsPerPage
        />
      )}

      {/* Edit Entry Dialog */}
      <Dialog open={Boolean(editingEntry)} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEntry && canEditEntry(editingEntry) ? "Edit Mortality Entry" : "View Mortality Entry"} —{" "}
              {editingEntry ? formatIndianDate(editingEntry.entry_date) : ""}
            </DialogTitle>
          </DialogHeader>
          {editingEntry && (
            <div className="pt-2">
              <MortalityTrackerForm
                selectedEntry={editingEntry}
                userRole={userRole}
                organizationId={organizationId}
                configCategoryId={configCategoryId}
                priceCategories={priceCategories}
                onCancelEdit={() => setEditingEntry(null)}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={Boolean(entryToDelete)} onOpenChange={(open) => !open && setEntryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete mortality entry?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the mortality entry for{" "}
              <span className="font-semibold text-slate-800">
                {entryToDelete ? formatIndianDate(entryToDelete.entry_date) : ""}
              </span>
              ? This action cannot be undone.
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
  )
}
