"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MonthYearPicker } from "@/components/month-year-picker"
import { ReportsTable } from "@/components/reports-table"
import { ProductReportsTable } from "@/components/product-reports-table"
import { MonthlyReportsPanel } from "@/components/monthly-reports-panel"

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

interface ReportsPageClientProps {
  reportYear: number
  reportMonth: number
  monthLabel: string
  monthStart: string
  monthEnd: string
  daysInMonth: number
  rows: ClientRow[]
  productRows: ProductRow[]
  clients: ClientOption[]
}

export function ReportsPageClient({
  reportYear,
  reportMonth,
  monthLabel,
  monthStart,
  monthEnd,
  daysInMonth,
  rows,
  productRows,
  clients,
}: ReportsPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab =
    searchParams.get("tab") === "monthly" ? "monthly" : "overview"

  const setTab = (value: string) => {
    const next = new URLSearchParams(searchParams.toString())
    if (value === "overview") {
      next.delete("tab")
    } else {
      next.set("tab", value)
    }
    const qs = next.toString()
    router.push(qs ? `/dashboard/reports?${qs}` : "/dashboard/reports")
  }

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Monthly Report:{" "}
            <span className="font-semibold text-foreground">{monthLabel}</span>
          </p>
        </div>
        <MonthYearPicker currentYear={reportYear} currentMonth={reportMonth} />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="flex w-full flex-wrap justify-start sm:w-auto">
          <TabsTrigger value="overview">Sales reports</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8 outline-none">
          <div>
            <h2 className="mb-3 text-lg font-semibold">Client Sales Report</h2>
            <ReportsTable rows={rows} daysInMonth={daysInMonth} monthLabel={monthLabel} />
          </div>
          <div>
            <h2 className="mb-3 text-lg font-semibold">Product Sales Report</h2>
            <ProductReportsTable
              rows={productRows}
              daysInMonth={daysInMonth}
              monthLabel={monthLabel}
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
      </Tabs>
    </div>
  )
}
