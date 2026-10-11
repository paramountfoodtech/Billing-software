"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Trash2, Plus, ChevronDown, ChevronRight, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { formatIndianDate, getIndianToday } from "@/lib/date-time"
import { groupEntriesByDate, type MortalityTrackerEntry, type MortalityDailyGroup } from "@/lib/mortality-tracker"
import { IconTooltip } from "@/components/icon-tooltip"
import { MortalityTrackerForm } from "@/components/mortality-tracker-form"

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

function DayGroup({
  group,
  userRole,
  organizationId,
  configCategoryId,
  priceCategories,
  onDelete,
}: {
  group: MortalityDailyGroup
  userRole: string
  organizationId: string
  configCategoryId: string | null
  priceCategories: { id: string; name: string }[]
  onDelete: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [editingEntry, setEditingEntry] = useState<MortalityTrackerEntry | null>(null)
  const canEdit = userRole === "super_admin" || userRole === "admin"
  const canDelete = userRole === "super_admin"
  const { consolidated } = group

  return (
    <Card className="border border-slate-200 overflow-hidden">
      {/* Day header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 cursor-pointer select-none hover:bg-slate-100 transition-colors"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2">
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          )}
          <span className="font-semibold text-slate-800 text-sm">
            {formatIndianDate(group.date, { day: "2-digit", month: "short", year: "numeric", weekday: "short" })}
          </span>
          <Badge variant="secondary" className="text-xs">
            {group.entries.length} vehicle{group.entries.length !== 1 ? "s" : ""}
          </Badge>
        </div>
        {/* Consolidated summary chips */}
        <div className="hidden sm:flex items-center gap-3 text-xs text-slate-600">
          <span>
            <span className="font-medium text-slate-800">{consolidated.total_birds.toLocaleString("en-IN")}</span> birds
          </span>
          <span className="text-slate-300">|</span>
          <span>
            <span className="font-medium text-slate-800">{Number(consolidated.total_kg).toFixed(3)}</span> kg
          </span>
          {consolidated.live_paper_rate != null && (
            <>
              <span className="text-slate-300">|</span>
              <span>
                Rate: <span className="font-medium text-emerald-700">{fmtRate(consolidated.live_paper_rate)}</span>
              </span>
            </>
          )}
          {consolidated.total_value != null && (
            <>
              <span className="text-slate-300">|</span>
              <span className="font-semibold text-indigo-700">{fmtVal(consolidated.total_value)}</span>
            </>
          )}
        </div>
      </div>

      {!collapsed && (
        <CardContent className="p-0">
          {editingEntry ? (
            <div className="p-4 bg-blue-50 border-b border-blue-200">
              <h3 className="text-sm font-semibold text-blue-700 mb-3">
                Editing: {editingEntry.vehicle_number}
              </h3>
              <MortalityTrackerForm
                selectedEntry={editingEntry}
                userRole={userRole}
                organizationId={organizationId}
                configCategoryId={configCategoryId}
                priceCategories={priceCategories}
                onCancelEdit={() => setEditingEntry(null)}
              />
            </div>
          ) : null}

          {/* Vehicle rows */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-25">
                  <TableHead className="text-xs font-semibold">Vehicle No</TableHead>
                  <TableHead className="text-xs font-semibold text-center" colSpan={2}>
                    Opening
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-center" colSpan={2}>
                    Afternoon
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-center" colSpan={2}>
                    Closing
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-right">Total Birds</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Total KGs</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Rate/KG</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Value</TableHead>
                  {canEdit && <TableHead className="text-xs w-16" />}
                </TableRow>
                <TableRow className="bg-slate-25 border-b-2">
                  <TableHead />
                  <TableHead className="text-xs text-slate-400 text-center">Birds</TableHead>
                  <TableHead className="text-xs text-slate-400 text-center">KGs</TableHead>
                  <TableHead className="text-xs text-slate-400 text-center">Birds</TableHead>
                  <TableHead className="text-xs text-slate-400 text-center">KGs</TableHead>
                  <TableHead className="text-xs text-slate-400 text-center">Birds</TableHead>
                  <TableHead className="text-xs text-slate-400 text-center">KGs</TableHead>
                  <TableHead />
                  <TableHead />
                  <TableHead />
                  <TableHead />
                  {canEdit && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.entries.map((entry) => (
                  <TableRow
                    key={entry.id}
                    className={`hover:bg-slate-50 ${editingEntry?.id === entry.id ? "bg-blue-50" : ""}`}
                  >
                    <TableCell className="font-mono text-sm font-medium text-slate-700">
                      {entry.vehicle_number}
                    </TableCell>
                    {/* Opening */}
                    <TableCell className="text-center text-sm">{(entry.opening_birds ?? 0).toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-center text-sm text-slate-600">{fmtKg(entry.opening_kg)}</TableCell>
                    {/* Afternoon */}
                    <TableCell className="text-center text-sm">{(entry.afternoon_birds ?? 0).toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-center text-sm text-slate-600">{fmtKg(entry.afternoon_kg)}</TableCell>
                    {/* Closing */}
                    <TableCell className="text-center text-sm">{(entry.closing_birds ?? 0).toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-center text-sm text-slate-600">{fmtKg(entry.closing_kg)}</TableCell>
                    {/* Totals */}
                    <TableCell className="text-right font-semibold text-sm">{(entry.total_birds ?? 0).toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right font-semibold text-sm">{fmtKg(entry.total_kg)}</TableCell>
                    <TableCell className="text-right text-sm text-emerald-700">{fmtRate(entry.live_paper_rate)}</TableCell>
                    <TableCell className="text-right text-sm font-medium text-indigo-700">{fmtVal(entry.total_value)}</TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <IconTooltip label="Edit">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => setEditingEntry(entry)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </IconTooltip>
                          {canDelete && (
                            <IconTooltip label="Delete">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => onDelete(entry.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </IconTooltip>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}

                {/* Consolidated EOD row */}
                <TableRow className="bg-indigo-50 border-t-2 border-indigo-200 font-semibold">
                  <TableCell className="text-indigo-700 text-xs uppercase tracking-wide">
                    EOD Total
                  </TableCell>
                  <TableCell colSpan={6} />
                  <TableCell className="text-right text-indigo-800">
                    {consolidated.total_birds.toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell className="text-right text-indigo-800">
                    {Number(consolidated.total_kg).toFixed(3)}
                  </TableCell>
                  <TableCell className="text-right text-emerald-700">
                    {fmtRate(consolidated.live_paper_rate)}
                  </TableCell>
                  <TableCell className="text-right text-indigo-800 text-base">
                    {fmtVal(consolidated.total_value)}
                  </TableCell>
                  {canEdit && <TableCell />}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      )}
    </Card>
  )
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
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (search && !e.vehicle_number.toLowerCase().includes(search.toLowerCase())) return false
      if (dateFrom && e.entry_date < dateFrom) return false
      if (dateTo && e.entry_date > dateTo) return false
      return true
    })
  }, [entries, search, dateFrom, dateTo])

  const groups = useMemo(
    () => groupEntriesByDate(filtered, datePriceMap, categoryName),
    [filtered, datePriceMap, categoryName]
  )

  const handleDelete = async () => {
    if (!deleteId) return
    setIsDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from("mortality_tracker_entries").delete().eq("id", deleteId)
    if (error) {
      toast({ variant: "destructive", title: "Delete failed", description: error.message })
    } else {
      toast({ variant: "success", title: "Entry deleted" })
      router.refresh()
    }
    setDeleteId(null)
    setIsDeleting(false)
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          id="mortality-search"
          placeholder="Search vehicle number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-[220px]"
        />
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 whitespace-nowrap">From</label>
          <Input type="date" max={getIndianToday()} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 whitespace-nowrap">To</label>
          <Input type="date" max={getIndianToday()} value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
        </div>
        {(search || dateFrom || dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-500"
            onClick={() => { setSearch(""); setDateFrom(""); setDateTo("") }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Groups */}
      {groups.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg">No mortality entries found</p>
          <p className="text-sm mt-1">Add your first entry using the button above.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <DayGroup
              key={group.date}
              group={group}
              userRole={userRole}
              organizationId={organizationId}
              configCategoryId={configCategoryId}
              priceCategories={priceCategories}
              onDelete={(id) => setDeleteId(id)}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={Boolean(deleteId)} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete mortality entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The entry will be permanently removed.
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
