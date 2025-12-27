"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "lucide-react"
import { PricesPageClient } from "@/app/dashboard/prices/prices-page-client"
import PricesAccountantSimple from "@/app/dashboard/prices/prices-accountant-simple"
import { Suspense } from "react"
import { LoadingOverlay } from "@/components/loading-overlay"

export default async function PricesPage() {
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Get user's organization
  const { data: profile } = await supabase.from("profiles").select("organization_id, role").eq("id", user.id).single()

  if (!profile) {
    redirect("/dashboard")
  }

  // If accountant, go directly to Update Prices page
  if (profile.role === "accountant") {
    redirect("/dashboard/prices/new")
  }

  // Get all price categories with latest prices
  const { data: priceCategories } = await supabase
    .from("price_categories")
    .select("*")
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false })

  // Get latest price for each category
  const { data: priceHistory } = await supabase
    .from("price_category_history")
    .select("*")
    .eq("organization_id", profile.organization_id)
    .order("effective_date", { ascending: false })

  return (
    <div className="lg:p-8">
      <div className="px-6 pb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Price Management</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/prices/categories">
              Manage Categories
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/prices/new">
              <Plus className="h-4 w-4 mr-2" />
              Update Prices
            </Link>
          </Button>
        </div>
      </div>

      <Suspense fallback={<LoadingOverlay />}>
        <div className="px-6">
          <PricesPageClient 
            priceCategories={priceCategories || []} 
            priceHistory={priceHistory || []} 
          />
        </div>
      </Suspense>
    </div>
  )
}
