"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "lucide-react"
import { PricesPageClient } from "@/app/dashboard/prices/prices-page-client"
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper"

export default async function PricesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  if (!profile) {
    redirect("/dashboard")
  }

  if (profile.role === "accountant") {
    redirect("/dashboard/prices/new")
  }

  const [{ data: priceCategories }, { data: priceHistory }] = await Promise.all([
    supabase
      .from("price_categories")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("price_category_history")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .order("effective_date", { ascending: false }),
  ])

  return (
    <DashboardPageWrapper title="Price Management">
      <div className="w-full p-4 sm:p-6 lg:p-8 space-y-4">
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link href="/dashboard/prices/categories">
              Manage Categories
            </Link>
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashboard/prices/new">
              <Plus className="h-4 w-4 mr-2" />
              Update Prices
            </Link>
          </Button>
        </div>

        <PricesPageClient
          priceCategories={priceCategories || []}
          priceHistory={priceHistory || []}
          userRole={profile.role}
        />
      </div>
    </DashboardPageWrapper>
  )
}
