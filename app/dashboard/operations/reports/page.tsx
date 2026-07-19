import { Suspense } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper"
import { LoadingOverlay } from "@/components/loading-overlay"
import { MaterialReportsPageClient } from "@/components/material-reports-page-client"
import type { MaterialProcessingEntry } from "@/components/material-processing-form"
import { canAccessOperationsReports } from "@/lib/permissions"

export const revalidate = 0

async function ReportsContent({
  reportYear,
  reportMonth,
  monthLabel,
  initialFromDate,
  initialToDate,
}: {
  reportYear: number
  reportMonth: number
  monthLabel: string
  initialFromDate: string
  initialToDate: string
}) {
  const supabase = await createClient()

  const monthStart = `${reportYear}-${String(reportMonth).padStart(2, "0")}-01`
  const daysInMonth = new Date(reportYear, reportMonth, 0).getDate()
  const monthEnd = `${reportYear}-${String(reportMonth).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`

  // Fetch entries covering both the selected month AND any custom date range
  const fetchFrom = initialFromDate < monthStart ? initialFromDate : monthStart
  const fetchTo = initialToDate > monthEnd ? initialToDate : monthEnd

  const { data: processingEntries } = await supabase
    .from("material_processing_entries")
    .select("*")
    .gte("processing_date", fetchFrom)
    .lte("processing_date", fetchTo)
    .order("processing_date", { ascending: false })

  return (
    <MaterialReportsPageClient
      processingEntries={(processingEntries || []) as MaterialProcessingEntry[]}
      reportYear={reportYear}
      reportMonth={reportMonth}
      monthLabel={monthLabel}
      initialFromDate={initialFromDate}
      initialToDate={initialToDate}
    />
  )
}

export default async function MaterialReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; tab?: string; from?: string; to?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (!canAccessOperationsReports(profile?.role)) {
    redirect("/dashboard")
  }

  const params = await searchParams
  const today = new Date()
  const reportYear = params.year ? parseInt(params.year) : today.getFullYear()
  const reportMonth = params.month ? parseInt(params.month) : today.getMonth() + 1

  const monthKey = `${reportYear}-${String(reportMonth).padStart(2, "0")}`
  const monthStart = `${monthKey}-01`
  const daysInMonth = new Date(reportYear, reportMonth, 0).getDate()
  const monthEnd = `${monthKey}-${String(daysInMonth).padStart(2, "0")}`

  const { getIndianToday } = await import("@/lib/date-time")
  const todayDate = getIndianToday()
  const initialFromDate = params.from || monthStart
  const initialToDate = params.to || (todayDate < monthEnd ? todayDate : monthEnd)

  const monthLabel = new Date(reportYear, reportMonth - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  })

  return (
    <DashboardPageWrapper title="Operations Reports">
      <Suspense fallback={<LoadingOverlay />}>
        <ReportsContent
          reportYear={reportYear}
          reportMonth={reportMonth}
          monthLabel={monthLabel}
          initialFromDate={initialFromDate}
          initialToDate={initialToDate}
        />
      </Suspense>
    </DashboardPageWrapper>
  )
}
