import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper"
import { MortalityTrackerForm } from "@/components/mortality-tracker-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export const revalidate = 0

export default async function NewMortalityEntryPage() {
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
  if (!canWrite) redirect("/dashboard/operations/mortality")

  const [configResult, categoriesResult] = await Promise.all([
    supabase
      .from("mortality_tracker_config")
      .select("live_paper_category_id")
      .eq("organization_id", profile.organization_id)
      .maybeSingle(),

    supabase
      .from("price_categories")
      .select("id, name")
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true)
      .order("name"),
  ])

  const configCategoryId = configResult.data?.live_paper_category_id ?? null
  const priceCategories = (categoriesResult.data ?? []) as { id: string; name: string }[]
  const fallbackLiveCat = priceCategories.find((c) => c.name?.toLowerCase().includes("live")) ?? null
  const effectiveCategoryId = configCategoryId || fallbackLiveCat?.id || null

  return (
    <DashboardPageWrapper title="Add Mortality Entry">
      <div className="w-full p-4 sm:p-6 lg:p-8 max-w-4xl">
        <div className="mb-4">
          <Button asChild variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700 -ml-2">
            <Link href="/dashboard/operations/mortality">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Mortality Tracker
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>New Mortality Entry</CardTitle>
          </CardHeader>
          <CardContent>
            <MortalityTrackerForm
              userRole={userRole}
              organizationId={profile.organization_id}
              configCategoryId={effectiveCategoryId}
              priceCategories={priceCategories}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardPageWrapper>
  )
}
