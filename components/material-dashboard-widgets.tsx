import { Activity, PackageCheck, Scale, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
        .select("processed_weight_kg, mortality_weight_kg, actual_leftover_weight_kg, yield_percent")
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
    (sum, entry) => sum + Number(entry.bridge_weight_kg || 0),
    0,
  )
  const todayProcessing = todayProcessingResult.data
  const monthStock = monthStockResult.data || []
  const monthProcessing = monthProcessingResult.data || []

  const monthlyPurchaseWeight = monthStock.reduce(
    (sum, entry) => sum + Number(entry.bridge_weight_kg || 0),
    0,
  )
  const monthlyProcessingWeight = monthProcessing.reduce(
    (sum, entry) => sum + Number(entry.processed_weight_kg || 0),
    0,
  )
  const monthlyMortalityWeight = monthProcessing.reduce(
    (sum, entry) => sum + Number(entry.mortality_weight_kg || 0),
    0,
  )
  const monthlyAverageYield = average(
    monthProcessing.map((entry) => Number(entry.yield_percent || 0)),
  )

  return (
    <div className="mt-8 space-y-6">
      <div>
        <h2 className="mb-3 text-lg font-semibold">Today&apos;s Operations</h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Purchased Weight</CardTitle>
              <Scale className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-blue-700">{formatKg(todayPurchasedWeight)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Processed Weight</CardTitle>
              <PackageCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-green-700">{formatKg(Number(todayProcessing?.processed_weight_kg || 0))}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Mortality Weight</CardTitle>
              <Activity className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-red-600">{formatKg(Number(todayProcessing?.mortality_weight_kg || 0))}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Leftover Weight</CardTitle>
              <Scale className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-amber-700">{formatKg(Number(todayProcessing?.actual_leftover_weight_kg || 0))}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Yield %</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-purple-700">{fmtPercent(todayProcessing?.yield_percent)}%</div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Monthly Operations</h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Purchase Weight</CardTitle>
              <Scale className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-blue-700">{formatKg(monthlyPurchaseWeight)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Processing Weight</CardTitle>
              <PackageCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-green-700">{formatKg(monthlyProcessingWeight)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Mortality Weight</CardTitle>
              <Activity className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-red-600">{formatKg(monthlyMortalityWeight)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Average Yield %</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-purple-700">{fmtPercent(monthlyAverageYield)}%</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
