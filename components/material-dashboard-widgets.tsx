import { Activity, Package, PackageCheck, Scale, TrendingUp } from "lucide-react"
import type { ReactNode } from "react"
import { BiKpi } from "@/components/bi-ui"
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
  accent,
  negative,
  index,
  className,
}: {
  title: string
  icon: ReactNode
  display: string
  accent: string
  negative?: boolean
  index?: number
  className?: string
}) {
  return (
    <BiKpi
      index={index}
      className={className}
      label={title}
      icon={icon}
      display={display}
      accent={accent}
      negative={negative}
    />
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
    <div className="space-y-8">
      <section>
        <h2 className="bi-eyebrow">Today&apos;s operations</h2>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          <OpsKpiCard
            index={0}
            title="Purchased Weight"
            icon={<Scale />}
            display={formatKg(todayPurchasedWeight)}
            accent="var(--bi-blue)"
          />
          <OpsKpiCard
            index={1}
            title="Processed Weight"
            icon={<PackageCheck />}
            display={formatKg(Number(todayProcessing?.processed_weight_kg || 0))}
            accent="var(--bi-teal)"
          />
          <OpsKpiCard
            index={2}
            title="Mortality Weight"
            icon={<Activity />}
            display={formatKg(Number(todayProcessing?.mortality_weight_kg || 0))}
            accent="var(--bi-red)"
          />
          <OpsKpiCard
            index={3}
            title="Leftover Weight"
            icon={<Package />}
            display={formatKg(
              Number(todayProcessing?.actual_leftover_weight_kg || 0),
            )}
            accent="var(--bi-orange)"
          />
          <OpsKpiCard
            index={4}
            className="col-span-2 lg:col-span-1"
            title="Yield %"
            icon={<TrendingUp />}
            display={todayYield}
            accent="var(--bi-green)"
          />
        </div>
      </section>

      <section>
        <h2 className="bi-eyebrow">Monthly operations</h2>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <OpsKpiCard
            index={0}
            title="Purchase Weight"
            icon={<Scale />}
            display={formatKg(monthlyPurchaseWeight)}
            accent="var(--bi-blue)"
          />
          <OpsKpiCard
            index={1}
            title="Processing Weight"
            icon={<PackageCheck />}
            display={formatKg(monthlyProcessingWeight)}
            accent="var(--bi-teal)"
          />
          <OpsKpiCard
            index={2}
            title="Mortality Weight"
            icon={<Activity />}
            display={formatKg(monthlyMortalityWeight)}
            accent="var(--bi-red)"
          />
          <OpsKpiCard
            index={3}
            title="Average Yield %"
            icon={<TrendingUp />}
            display={monthYield}
            accent="var(--bi-green)"
          />
        </div>
      </section>
    </div>
  )
}
