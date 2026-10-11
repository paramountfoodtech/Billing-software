import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper"
import { MortalityTrackerPageClient } from "@/components/mortality-tracker-page-client"
import { Button } from "@/components/ui/button"
import { Plus, AlertCircle } from "lucide-react"
import Link from "next/link"
import type { MortalityTrackerEntry } from "@/lib/mortality-tracker"

export const revalidate = 0

export default async function MortalityTrackerPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single()

  if (!profile) redirect("/auth/login")

  const userRole = profile.role || "accountant"
  const canWrite = userRole === "super_admin" || userRole === "admin"

  const [entriesResult, configResult, categoriesResult] = await Promise.all([
    supabase
      .from("mortality_tracker_entries")
      .select("*, profiles!mortality_tracker_entries_created_by_fkey(full_name), price_categories!mortality_tracker_entries_live_paper_category_id_fkey(name)")
      .eq("organization_id", profile.organization_id)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false }),

    supabase
      .from("mortality_tracker_config")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .maybeSingle(),

    supabase
      .from("price_categories")
      .select("id, name")
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true)
      .order("name"),
  ])

  const entries = (entriesResult.data ?? []) as MortalityTrackerEntry[]
  const config = configResult.data
  const priceCategories = (categoriesResult.data ?? []) as { id: string; name: string }[]
  const configCategoryId = config?.live_paper_category_id ?? null

  // Fallback to any category with 'live' in the name if super admin hasn't explicitly configured one
  const fallbackLiveCategory = priceCategories.find((c) => c.name?.toLowerCase().includes("live")) ?? null
  const effectiveCategoryId = configCategoryId || fallbackLiveCategory?.id || null
  const effectiveCategoryName = priceCategories.find((c) => c.id === effectiveCategoryId)?.name ?? null

  // Fetch all price history for the effective category so price updates immediately reflect on the mortality report
  const datePriceMap: Record<string, number> = {}
  if (effectiveCategoryId) {
    const { data: priceHistory } = await supabase
      .from("price_category_history")
      .select("effective_date, price")
      .eq("organization_id", profile.organization_id)
      .eq("price_category_id", effectiveCategoryId)

    if (priceHistory) {
      for (const row of priceHistory) {
        if (row.effective_date && row.price != null) {
          datePriceMap[row.effective_date] = Number(row.price)
        }
      }
    }
  }

  return (
    <DashboardPageWrapper title="Mortality Tracker">
      <div className="w-full p-4 sm:p-6 lg:p-8 space-y-4">
        {/* Config warning if no explicit or fallback category */}
        {!configCategoryId && !fallbackLiveCategory && userRole === "super_admin" && (
          <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              Live Paper Rate category is not configured.{" "}
              <Link href="/dashboard/settings" className="underline font-medium">
                Configure it in Settings
              </Link>{" "}
              to enable value calculations.
            </span>
          </div>
        )}

        {/* Action bar */}
        {canWrite && (
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
            <Button asChild className="w-full sm:w-auto">
              <Link href="/dashboard/operations/mortality/new">
                <Plus className="h-4 w-4 mr-2" />
                Add Mortality Entry
              </Link>
            </Button>
          </div>
        )}

        <MortalityTrackerPageClient
          entries={entries}
          userRole={userRole}
          organizationId={profile.organization_id}
          configCategoryId={effectiveCategoryId}
          categoryName={effectiveCategoryName}
          priceCategories={priceCategories}
          datePriceMap={datePriceMap}
        />
      </div>
    </DashboardPageWrapper>
  )
}
