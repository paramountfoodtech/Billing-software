"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Download, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { MonthYearPicker } from "@/components/month-year-picker"
import { useToast } from "@/hooks/use-toast"
import { formatIndianDate, formatIndianStatementDate, getIndianToday } from "@/lib/date-time"
import { exportToCSV, exportToPDF, type ExportColumn, getTimestamp } from "@/lib/export-utils"
import { fmtPercent } from "@/lib/material-calculations"
import { getEntryStockBreakdown } from "@/lib/material-processing"
import type { MaterialProcessingEntry } from "@/components/material-processing-form"

type OperationsTab = "daily" | "monthly" | "dateRange"

function resolveTab(value: string | null): OperationsTab {
  if (value === "monthly") return "monthly"
  if (value === "dateRange") return "dateRange"
  return "daily"
}

interface MaterialReportsPageClientProps {
  processingEntries: MaterialProcessingEntry[]
  reportYear: number
  reportMonth: number
  monthLabel: string
  initialFromDate: string
  initialToDate: string
}

type YieldRow = {
  date: string
  current_stock_weight_kg: number
  carryover_expected_weight_kg: number
  carryover_actual_weight_kg: number
  carryover_from_date: string | null
  purchased_birds: number
  purchased_weight_kg: number
  processed_birds: number
  processed_weight_kg: number
  mortality_weight_kg: number
  actual_leftover_weight_kg: number
  yield_percent: number
}

export function MaterialReportsPageClient({
  processingEntries,
  reportYear,
  reportMonth,
  monthLabel,
  initialFromDate,
  initialToDate,
}: MaterialReportsPageClientProps) {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Tab state in URL
  const activeTab = resolveTab(searchParams.get("tab"))

  const handleTabChange = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === "daily") {
      params.delete("tab")
      params.delete("from")
      params.delete("to")
    } else if (tab === "monthly") {
      params.set("tab", "monthly")
      params.delete("from")
      params.delete("to")
    } else {
      params.set("tab", "dateRange")
      if (!params.get("from")) params.set("from", initialFromDate)
      if (!params.get("to")) params.set("to", initialToDate)
    }
    const qs = params.toString()
    router.push(qs ? `/dashboard/operations/reports?${qs}` : "/dashboard/operations/reports")
  }

  const handleDateRangeChange = useCallback(
    (from: string, to: string) => {
      const next = new URLSearchParams(searchParams.toString())
      next.set("tab", "dateRange")
      next.set("from", from)
      next.set("to", to)
      router.push(`/dashboard/operations/reports?${next.toString()}`)
    },
    [router, searchParams],
  )

  // Month context derived from props
  const monthKey = `${reportYear}-${String(reportMonth).padStart(2, "0")}`
  const monthStart = `${monthKey}-01`
  const daysInMonth = new Date(reportYear, reportMonth, 0).getDate()
  const monthEnd = `${monthKey}-${String(daysInMonth).padStart(2, "0")}`

  // Daily date: today if within selected month, else first day of month
  const today = getIndianToday()
  const maxSelectableDate = today < monthEnd ? today : monthEnd
  const defaultDailyDate = today.startsWith(monthKey) ? today : monthStart
  const [dailyDate, setDailyDate] = useState(defaultDailyDate)

  // Date range state (for the separate Date Range tab)
  const dateRangeFrom = searchParams.get("from") || initialFromDate
  const dateRangeTo = searchParams.get("to") || initialToDate
  const [rangeStart, setRangeStart] = useState(dateRangeFrom)
  const [rangeEnd, setRangeEnd] = useState(dateRangeTo)

  useEffect(() => {
    setDailyDate(defaultDailyDate)
  }, [defaultDailyDate])

  useEffect(() => {
    setRangeStart(dateRangeFrom)
    setRangeEnd(dateRangeTo)
  }, [dateRangeFrom, dateRangeTo])

  const dateRangeLabel =
    dateRangeFrom && dateRangeTo
      ? `${formatIndianStatementDate(dateRangeFrom)} to ${formatIndianStatementDate(dateRangeTo)}`
      : "Select a date range"

  const yieldRows = useMemo<YieldRow[]>(
    () =>
      processingEntries.map((entry) => {
        const breakdown = getEntryStockBreakdown(entry)
        return {
          date: entry.processing_date,
          current_stock_weight_kg: breakdown.stockWeightKg,
          carryover_expected_weight_kg: breakdown.carryoverExpectedWeightKg,
          carryover_actual_weight_kg: breakdown.carryoverWeightKg,
          carryover_from_date: breakdown.carryoverFromDate,
          purchased_birds: entry.purchased_birds,
          purchased_weight_kg: Number(entry.purchased_weight_kg || 0),
          processed_birds: entry.processed_birds,
          processed_weight_kg: Number(entry.processed_weight_kg || 0),
          mortality_weight_kg: Number(entry.mortality_weight_kg || 0),
          actual_leftover_weight_kg: Number(entry.actual_leftover_weight_kg || 0),
          yield_percent: Number(entry.yield_percent || 0),
        }
      }),
    [processingEntries],
  )

  // Daily: filter to selected date
  const dailyRows = yieldRows.filter((row) => row.date === dailyDate)

  const rangeRows = yieldRows.filter((row) => row.date >= rangeStart && row.date <= rangeEnd)

  const reportColumns: ExportColumn[] = [
    { key: "date", label: "Date", formatter: (date) => formatIndianDate(date) },
    {
      key: "current_stock_weight_kg",
      label: "Current Stock KG",
      formatter: (val) => Number(val || 0).toFixed(2),
    },
    {
      key: "carryover_expected_weight_kg",
      label: "Carry-over Expected KG",
      formatter: (val) => Number(val || 0).toFixed(2),
    },
    {
      key: "carryover_actual_weight_kg",
      label: "Carry-over Actual KG",
      formatter: (val) => Number(val || 0).toFixed(2),
    },
    {
      key: "carryover_from_date",
      label: "Carry-over From",
      formatter: (date) => (date ? formatIndianDate(date) : "—"),
    },
    { key: "purchased_birds", label: "Total Birds" },
    {
      key: "purchased_weight_kg",
      label: "Total Weight KG",
      formatter: (val) => Number(val || 0).toFixed(2),
    },
    { key: "processed_birds", label: "Processed Birds" },
    { key: "processed_weight_kg", label: "Processed Weight KG", formatter: (val) => Number(val || 0).toFixed(2) },
    { key: "mortality_weight_kg", label: "Mortality Weight KG", formatter: (val) => Number(val || 0).toFixed(2) },
    { key: "actual_leftover_weight_kg", label: "Leftover Weight KG", formatter: (val) => Number(val || 0).toFixed(2) },
    { key: "yield_percent", label: "Yield %", formatter: (val) => fmtPercent(val) },
  ]

  const canExportRows = (rows: unknown[]) => {
    if (rangeStart && rangeEnd && rangeStart > rangeEnd) {
      toast({
        variant: "destructive",
        title: "Invalid date range",
        description: "From date must be on or before To date.",
      })
      return false
    }
    if (rows.length === 0) {
      toast({
        variant: "destructive",
        title: "No data",
        description: "There are no rows to export for this report.",
      })
      return false
    }
    return true
  }

  const exportRows = (rows: YieldRow[], columns: ExportColumn[], filename: string) => {
    if (!canExportRows(rows)) return
    exportToCSV(rows, columns, filename)
    toast({
      variant: "success",
      title: "Exported",
      description: `${rows.length} row(s) exported to CSV successfully.`,
    })
  }

  const exportRowsPDF = async (
    rows: YieldRow[],
    columns: ExportColumn[],
    title: string,
    filename: string,
  ) => {
    if (!canExportRows(rows)) return
    await exportToPDF(rows, columns, title, filename)
    toast({
      variant: "success",
      title: "Exported",
      description: `${rows.length} row(s) exported to PDF successfully.`,
    })
  }

  const ReportTable = ({ rows }: { rows: YieldRow[] }) => (
    <div className="rounded-lg border bg-white overflow-x-auto">
      <Table className="text-xs sm:text-sm">
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead className="text-center">Purchased KG</TableHead>
            <TableHead className="text-center">Processed KG</TableHead>
            <TableHead className="text-center">Mortality KG</TableHead>
            <TableHead className="text-center">Leftover KG</TableHead>
            <TableHead className="text-center">Yield %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                No report data found for this period.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.date} className="hover:bg-slate-50/60">
                <TableCell className="font-medium whitespace-nowrap">
                  {formatIndianDate(row.date)}
                </TableCell>
                <TableCell className="text-center">
                  <span className="font-semibold">{row.purchased_weight_kg.toFixed(2)}</span>
                  <span className="block text-[11px] text-muted-foreground leading-tight">
                    {row.purchased_birds} birds
                  </span>
                  {(row.current_stock_weight_kg > 0 || row.carryover_actual_weight_kg > 0) && (
                    <span className="block text-[10px] text-muted-foreground leading-tight mt-0.5">
                      {row.current_stock_weight_kg.toFixed(2)} stock +{" "}
                      {row.carryover_actual_weight_kg.toFixed(2)} carry-over
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <span className="font-semibold">{row.processed_weight_kg.toFixed(2)}</span>
                  <span className="block text-[11px] text-muted-foreground leading-tight">{row.processed_birds} birds</span>
                </TableCell>
                <TableCell className="text-center tabular-nums">{row.mortality_weight_kg.toFixed(2)}</TableCell>
                <TableCell className="text-center tabular-nums">{row.actual_leftover_weight_kg.toFixed(2)}</TableCell>
                <TableCell className="text-center tabular-nums">
                  <span className={row.yield_percent < 90 ? "text-amber-600 font-medium" : "font-semibold"}>
                    {fmtPercent(row.yield_percent)}%
                  </span>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8">
      {/* Header: context label + MonthYearPicker */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {activeTab === "daily" ? (
              <>
                Daily Yield Report:{" "}
                <span className="font-semibold text-foreground">{formatIndianDate(dailyDate)}</span>
              </>
            ) : activeTab === "dateRange" ? (
              <>
                Date Range Report:{" "}
                <span className="font-semibold text-foreground">{dateRangeLabel}</span>
              </>
            ) : (
              <>
                Monthly Report:{" "}
                <span className="font-semibold text-foreground">{monthLabel}</span>
              </>
            )}
          </p>
        </div>
        {activeTab === "monthly" && (
          <MonthYearPicker
            currentYear={reportYear}
            currentMonth={reportMonth}
            basePath="/dashboard/operations/reports"
          />
        )}
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="flex w-full flex-wrap justify-start sm:w-auto">
          <TabsTrigger value="daily">Daily Yield</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Yield</TabsTrigger>
          <TabsTrigger value="dateRange">Date Range</TabsTrigger>
        </TabsList>

        {/* Daily */}
        <TabsContent value="daily" className="space-y-4 outline-none">
          <h2 className="mb-3 text-lg font-semibold">Daily Yield Report</h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="daily-date">Date</Label>
                <Input
                  id="daily-date"
                  type="date"
                  min={monthStart}
                  max={maxSelectableDate}
                  value={dailyDate}
                  onChange={(e) => setDailyDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportRows(dailyRows, reportColumns, `daily-yield-${dailyDate}-${getTimestamp()}.csv`)}
              >
                <Download className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">CSV</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportRowsPDF(dailyRows, reportColumns, `Daily Yield Report (${formatIndianDate(dailyDate)})`, `daily-yield-${dailyDate}-${getTimestamp()}.pdf`)}
              >
                <FileText className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">PDF</span>
              </Button>
            </div>
          </div>
          <ReportTable rows={dailyRows} />
        </TabsContent>

        {/* Monthly - full month, no range pickers */}
        <TabsContent value="monthly" className="space-y-4 outline-none">
          <h2 className="mb-3 text-lg font-semibold">Monthly Yield Report</h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <p className="text-xs sm:text-sm text-muted-foreground">
              Showing all entries for{" "}
              <span className="font-semibold text-foreground">{monthLabel}</span>
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportRows(yieldRows, reportColumns, `monthly-yield-${monthStart}-to-${monthEnd}-${getTimestamp()}.csv`)}
              >
                <Download className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">CSV</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportRowsPDF(yieldRows, reportColumns, `Monthly Yield Report (${monthLabel})`, `monthly-yield-${monthStart}-to-${monthEnd}-${getTimestamp()}.pdf`)}
              >
                <FileText className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">PDF</span>
              </Button>
            </div>
          </div>
          <ReportTable rows={yieldRows} />
        </TabsContent>

        {/* Date Range */}
        <TabsContent value="dateRange" className="space-y-4 outline-none">
          <h2 className="mb-3 text-lg font-semibold">Date Range Yield Report</h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-2">
                <Label htmlFor="range-start" className="text-muted-foreground">From</Label>
                <Input
                  id="range-start"
                  type="date"
                  className="min-w-[140px]"
                  max={rangeEnd || undefined}
                  value={rangeStart}
                  onChange={(e) => {
                    setRangeStart(e.target.value)
                    if (e.target.value && rangeEnd) handleDateRangeChange(e.target.value, rangeEnd)
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="range-end" className="text-muted-foreground">To</Label>
                <Input
                  id="range-end"
                  type="date"
                  className="min-w-[140px]"
                  min={rangeStart || undefined}
                  value={rangeEnd}
                  onChange={(e) => {
                    setRangeEnd(e.target.value)
                    if (rangeStart && e.target.value) handleDateRangeChange(rangeStart, e.target.value)
                  }}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportRows(rangeRows, reportColumns, `date-range-yield-${rangeStart}-to-${rangeEnd}-${getTimestamp()}.csv`)}
              >
                <Download className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">CSV</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportRowsPDF(rangeRows, reportColumns, `Date Range Yield Report (${formatIndianDate(rangeStart)} to ${formatIndianDate(rangeEnd)})`, `date-range-yield-${rangeStart}-to-${rangeEnd}-${getTimestamp()}.pdf`)}
              >
                <FileText className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">PDF</span>
              </Button>
            </div>
          </div>
          <ReportTable rows={rangeRows} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
