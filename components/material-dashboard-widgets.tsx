import { Activity, PackageCheck, Scale, TrendingUp } from "lucide-react"
import type { ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { KpiValue } from "@/components/kpi-value"
import { createClient } from "@/lib/supabase/server"
import { getIndianToday } from "@/lib/date-time"
import { fmtPercent } from "@/lib/material-calculations"

function formatKg(value: number) {
  return `${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} KG`
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function OpsKpiCard({
  title,
  icon,
  display,
  className,
}: {
  title: string
  icon: ReactNode
  display: string
  className?: string
}) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-xs sm:text-sm font-medium truncate">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="min-w-0">
        <KpiValue display={display} className={className}>
          {display}
        </KpiValue>
      </CardContent>
    </Card>
  )
}

export async function MaterialDashboardWidgets() {
  const supabase = await createClient()
  const today = getIndianToday()
  const monthStart = `${today.slice(0, 8)}01`

  const [todayStockResult, todayProcessingResult, monthStockResult, monthProcessingResult] =
    await Promise.all([
      supabase
        .from("material_stock_entries")
        .select("bridge_weight_kg")
        .eq("purchase_date", today),
      supabase
        .from("material_processing_entries")
        .select(
          "processed_weight_kg, mortality_weight_kg, actual_leftover_weight_kg, yield_percent",
        )
        .eq("processing_date", today)
        .maybeSingle(),
      supabase
        .from("material_stock_entries")
        .select("bridge_weight_kg")
        .gte("purchase_date", monthStart)
        .lte("purchase_date", today),
      supabase
        .from("material_processing_entries")
        .select("processed_weight_kg, mortality_weight_kg, yield_percent")
        .gte("processing_date", monthStart)
        .lte("processing_date", today),
    ])

  const todayPurchasedWeight = (todayStockResult.data || []).reduce(
    (sum, row) => sum + Number(row.bridge_weight_kg || 0),
    0,
  )
  const todayProcessing = todayProcessingResult.data
  const monthlyPurchaseWeight = (monthStockResult.data || []).reduce(
    (sum, row) => sum + Number(row.bridge_weight_kg || 0),
    0,
  )
  const monthProcessing = monthProcessingResult.data || []
  const monthlyProcessingWeight = monthProcessing.reduce(
    (sum, row) => sum + Number(row.processed_weight_kg || 0),
    0,
  )
  const monthlyMortalityWeight = monthProcessing.reduce(
    (sum, row) => sum + Number(row.mortality_weight_kg || 0),
    0,
  )
  const monthlyAverageYield = average(
    monthProcessing.map((entry) => Number(entry.yield_percent || 0)),
  )

  const todayYield = `${fmtPercent(todayProcessing?.yield_percent)}%`
  const monthYield = `${fmtPercent(monthlyAverageYield)}%`

  return (
    <div className="mt-8 space-y-6">
      <div>
        <h2 className="mb-3 text-lg font-semibold">Today&apos;s Operations</h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          <OpsKpiCard
            title="Purchased Weight"
            icon={<Scale className="h-4 w-4 shrink-0 text-blue-600" />}
            display={formatKg(todayPurchasedWeight)}
            className="text-blue-700"
          />
          <OpsKpiCard
            title="Processed Weight"
            icon={<PackageCheck className="h-4 w-4 shrink-0 text-green-600" />}
            display={formatKg(Number(todayProcessing?.processed_weight_kg || 0))}
            className="text-green-700"
          />
          <OpsKpiCard
            title="Mortality Weight"
            icon={<Activity className="h-4 w-4 shrink-0 text-red-600" />}
            display={formatKg(Number(todayProcessing?.mortality_weight_kg || 0))}
            className="text-red-600"
          />
          <OpsKpiCard
            title="Leftover Weight"
            icon={<Scale className="h-4 w-4 shrink-0 text-amber-600" />}
            display={formatKg(
              Number(todayProcessing?.actual_leftover_weight_kg || 0),
            )}
            className="text-amber-700"
          />
          <OpsKpiCard
            title="Yield %"
            icon={<TrendingUp className="h-4 w-4 shrink-0 text-purple-600" />}
            display={todayYield}
            className="text-purple-700"
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Monthly Operations</h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <OpsKpiCard
            title="Purchase Weight"
            icon={<Scale className="h-4 w-4 shrink-0 text-blue-600" />}
            display={formatKg(monthlyPurchaseWeight)}
            className="text-blue-700"
          />
          <OpsKpiCard
            title="Processing Weight"
            icon={<PackageCheck className="h-4 w-4 shrink-0 text-green-600" />}
            display={formatKg(monthlyProcessingWeight)}
            className="text-green-700"
          />
          <OpsKpiCard
            title="Mortality Weight"
            icon={<Activity className="h-4 w-4 shrink-0 text-red-600" />}
            display={formatKg(monthlyMortalityWeight)}
            className="text-red-600"
          />
          <OpsKpiCard
            title="Average Yield %"
            icon={<TrendingUp className="h-4 w-4 shrink-0 text-purple-600" />}
            display={monthYield}
            className="text-purple-700"
          />
        </div>
      </div>
    </div>
  )
}
