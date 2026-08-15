"use client"

import { useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MonthYearPicker } from "@/components/month-year-picker"
import { ReportsTable } from "@/components/reports-table"
import { ProductReportsTable } from "@/components/product-reports-table"
import {
  DateRangeReportsPanel,
  MonthlyReportsPanel,
} from "@/components/monthly-reports-panel"
import { FinancialYearSelector } from "@/components/financial-year-selector"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatIndianStatementDate } from "@/lib/date-time"
import type { ReportPeriodMode } from "@/lib/report-period"

type ClientRow = {
  id: string
  name: string
  sale: number
  todaySaleQty: number
  todaySaleValue: number
  saleKgs: number
  payments: number
  outstanding: number
  oldBal: number
  creditBalance: number
}

type ProductRow = {
  id: string
  name: string
  currentMonthSaleValue: number
  todaySaleQty: number
  todaySaleValue: number
  totalSaleKgs: number
  avgQtyPerDay: number
}

type ClientOption = { id: string; name: string }

type ReportsTab = "overview" | "monthly" | "dateRange"

interface ReportsPageClientProps {
  reportYear: number
  reportMonth: number
  monthLabel: string
  monthStart: string
  monthEnd: string
  daysInMonth: number
  periodMode: ReportPeriodMode
  periodLabel: string
  periodStart: string
  periodEnd: string
  daysInPeriod: number
  multiMonths: number
  fy: string
  rows: ClientRow[]
  productRows: ProductRow[]
  clients: ClientOption[]
  initialFromDate: string
  initialToDate: string
}

function resolveTab(value: string | null): ReportsTab {
  if (value === "monthly") return "monthly"
  if (value === "dateRange") return "dateRange"
  return "overview"
}

const PERIOD_MODE_OPTIONS = [
  { value: "month", label: "Single month" },
  { value: "multi", label: "Last N months (up to 6)" },
  { value: "range", label: "Date range" },
  { value: "fy", label: "Financial year" },
]

const MULTI_MONTH_OPTIONS = [2, 3, 4, 5, 6].map((n) => ({
  value: String(n),
  label: `Last ${n} months`,
}))

export function ReportsPageClient({
  reportYear,
  reportMonth,
  monthLabel,
  monthStart,
  monthEnd,
  daysInMonth,
  periodMode,
  periodLabel,
  periodStart,
  periodEnd,
  daysInPeriod,
  multiMonths,
  fy,
  rows,
  productRows,
  clients,
  initialFromDate,
  initialToDate,
}: ReportsPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = resolveTab(searchParams.get("tab"))

  const pushParams = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString())
      mutate(next)
      const qs = next.toString()
      router.push(qs ? `/dashboard/reports?${qs}` : "/dashboard/reports")
    },
    [router, searchParams],
  )

  const setTab = (value: string) => {
    pushParams((next) => {
      if (value === "overview") {
        next.delete("tab")
      } else if (value === "monthly") {
        next.set("tab", "monthly")
        // Keep from/to when Client Sales Report is in date-range mode
        if (next.get("period") !== "range") {
          next.delete("from")
          next.delete("to")
        }
      } else {
        next.set("tab", "dateRange")
        if (!next.get("from")) next.set("from", initialFromDate)
        if (!next.get("to")) next.set("to", initialToDate)
      }
    })
  }

  const handleDateRangeChange = useCallback(
    (from: string, to: string) => {
      pushParams((next) => {
        next.set("tab", "dateRange")
        next.set("from", from)
        next.set("to", to)
      })
    },
    [pushParams],
  )

  const setPeriodMode = (mode: string) => {
    pushParams((next) => {
      if (mode === "month") {
        next.delete("period")
        next.delete("months")
        next.delete("fy")
        if (tab === "overview") {
          next.delete("from")
          next.delete("to")
        }
      } else {
        next.set("period", mode)
        if (mode === "multi") {
          if (!next.get("months")) next.set("months", String(multiMonths))
          next.delete("fy")
          if (tab === "overview") {
            next.delete("from")
            next.delete("to")
          }
        } else if (mode === "range") {
          next.delete("months")
          next.delete("fy")
          if (!next.get("from")) next.set("from", periodStart || monthStart)
          if (!next.get("to")) next.set("to", periodEnd || initialToDate)
        } else if (mode === "fy") {
          next.delete("months")
          next.set("fy", fy)
          if (tab === "overview") {
            next.delete("from")
            next.delete("to")
          }
        }
      }
    })
  }

  const setMultiMonths = (value: string) => {
    pushParams((next) => {
      next.set("period", "multi")
      next.set("months", value)
    })
  }

  const setFy = (value: string) => {
    pushParams((next) => {
      next.set("period", "fy")
      next.set("fy", value)
    })
  }

  const setOverviewRange = (from: string, to: string) => {
    pushParams((next) => {
      next.set("period", "range")
      next.set("from", from)
      next.set("to", to)
      next.delete("tab")
    })
  }

  const dateRangeFrom = searchParams.get("from") || initialFromDate
  const dateRangeTo = searchParams.get("to") || initialToDate
  const dateRangeLabel =
    dateRangeFrom && dateRangeTo
      ? `${formatIndianStatementDate(dateRangeFrom)} to ${formatIndianStatementDate(dateRangeTo)}`
      : "Select a date range"

  const overviewRangeFrom = searchParams.get("from") || periodStart
  const overviewRangeTo = searchParams.get("to") || periodEnd

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {tab === "dateRange" ? (
              <>
                Date Range Report:{" "}
                <span className="font-semibold text-foreground">
                  {dateRangeLabel}
                </span>
              </>
            ) : tab === "overview" ? (
              <>
                Client Sales Report:{" "}
                <span className="font-semibold text-foreground">
                  {periodLabel}
                </span>
              </>
            ) : (
              <>
                Monthly Report:{" "}
                <span className="font-semibold text-foreground">
                  {monthLabel}
                </span>
              </>
            )}
          </p>
        </div>
        {tab === "monthly" && (
          <MonthYearPicker currentYear={reportYear} currentMonth={reportMonth} />
        )}
        {tab === "overview" &&
          (periodMode === "month" || periodMode === "multi") && (
            <MonthYearPicker
              currentYear={reportYear}
              currentMonth={reportMonth}
            />
          )}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="flex w-full flex-wrap justify-start sm:w-auto">
          <TabsTrigger value="overview">Sales reports</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Reports</TabsTrigger>
          <TabsTrigger value="dateRange">Date Range</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8 outline-none">
          <div className="rounded-lg border bg-white p-4 space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
              <div className="space-y-1.5 min-w-[200px]">
                <Label className="text-xs text-muted-foreground">
                  Report period
                </Label>
                <SearchableSelect
                  value={periodMode}
                  onValueChange={setPeriodMode}
                  options={PERIOD_MODE_OPTIONS}
                  placeholder="Select period"
                  searchPlaceholder="Type period..."
                  triggerClassName="w-full lg:w-[240px]"
                />
              </div>

              {periodMode === "multi" && (
                <div className="space-y-1.5 min-w-[160px]">
                  <Label className="text-xs text-muted-foreground">
                    Number of months
                  </Label>
                  <SearchableSelect
                    value={String(multiMonths)}
                    onValueChange={setMultiMonths}
                    options={MULTI_MONTH_OPTIONS}
                    placeholder="Months"
                    searchPlaceholder="Type months..."
                    triggerClassName="w-full lg:w-[180px]"
                  />
                </div>
              )}

              {periodMode === "fy" && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Financial year
                  </Label>
                  <FinancialYearSelector selectedYear={fy} onYearChange={setFy} />
                </div>
              )}

              {periodMode === "range" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="client-report-from" className="text-xs text-muted-foreground">
                      From
                    </Label>
                    <Input
                      id="client-report-from"
                      type="date"
                      value={overviewRangeFrom}
                      max={overviewRangeTo}
                      onChange={(e) =>
                        setOverviewRange(e.target.value, overviewRangeTo)
                      }
                      className="w-full lg:w-[170px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="client-report-to" className="text-xs text-muted-foreground">
                      To
                    </Label>
                    <Input
                      id="client-report-to"
                      type="date"
                      value={overviewRangeTo}
                      min={overviewRangeFrom}
                      onChange={(e) =>
                        setOverviewRange(overviewRangeFrom, e.target.value)
                      }
                      className="w-full lg:w-[170px]"
                    />
                  </div>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Showing sales for{" "}
              <span className="font-medium text-foreground">{periodLabel}</span>
              {periodMode === "multi" && (
                <> (ending in the selected month)</>
              )}
              .
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold">Client Sales Report</h2>
            <ReportsTable
              rows={rows}
              daysInMonth={daysInPeriod}
              monthLabel={periodLabel}
              saleColumnLabel={
                periodMode === "month" ? "Current Month Sale" : "Period Sale"
              }
            />
          </div>
          <div>
            <h2 className="mb-3 text-lg font-semibold">Product Sales Report</h2>
            <ProductReportsTable
              rows={productRows}
              daysInMonth={daysInPeriod}
              monthLabel={periodLabel}
              saleColumnLabel={
                periodMode === "month" ? "Current Month Sale" : "Period Sale"
              }
            />
          </div>
        </TabsContent>

        <TabsContent value="monthly" className="outline-none">
          <h2 className="mb-3 text-lg font-semibold">Monthly sales statement</h2>
          <MonthlyReportsPanel
            clients={clients}
            reportYear={reportYear}
            reportMonth={reportMonth}
            monthStart={monthStart}
            monthEnd={monthEnd}
            monthLabel={monthLabel}
          />
        </TabsContent>

        <TabsContent value="dateRange" className="outline-none">
          <h2 className="mb-3 text-lg font-semibold">Date range sales statement</h2>
          <DateRangeReportsPanel
            clients={clients}
            initialFromDate={dateRangeFrom}
            initialToDate={dateRangeTo}
            onDateRangeChange={handleDateRangeChange}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
