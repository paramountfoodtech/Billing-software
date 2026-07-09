import { Suspense } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper"
import { LoadingOverlay } from "@/components/loading-overlay"
import { MaterialStockPageClient } from "@/components/material-stock-page-client"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import type { MaterialStockEntry } from "@/components/material-stock-form"
import type { MaterialProcessingEntry } from "@/components/material-processing-form"

export const revalidate = 0

async function StockContent({ userRole }: { userRole: string }) {
  const supabase = await createClient()
  const [stockResult, processingResult] = await Promise.all([
    supabase
      .from("material_stock_entries")
      .select("*, profiles!material_stock_entries_created_by_fkey(full_name)")
      .order("purchase_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("material_processing_entries")
      .select("*")
      .order("processing_date", { ascending: false }),
  ])

  return (
    <MaterialStockPageClient
      entries={(stockResult.data || []) as MaterialStockEntry[]}
      processingEntries={(processingResult.data || []) as MaterialProcessingEntry[]}
      userRole={userRole}
    />
  )
}

export default async function MaterialStockPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const userRole = profile?.role || "accountant"
  const canWrite = userRole === "super_admin" || userRole === "admin"

  return (
    <DashboardPageWrapper title="Material Stock">
      <div className="w-full p-4 sm:p-6 lg:p-8 space-y-4">
        {canWrite && (
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
            <Button asChild className="w-full sm:w-auto">
              <Link href="/dashboard/operations/stock/new">
                <Plus className="h-4 w-4 mr-2" />
                Add Stock Entry
              </Link>
            </Button>
          </div>
        )}
        <Suspense fallback={<LoadingOverlay />}>
          <StockContent userRole={userRole} />
        </Suspense>
      </div>
    </DashboardPageWrapper>
  )
}
