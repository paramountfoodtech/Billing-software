"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PricesTable } from "@/components/prices-table"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "lucide-react"
import { PricesPageClient } from "@/app/dashboard/prices/prices-page-client"

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
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Price Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage daily prices for categories (Paper Price, Skinless, With Skin, Eggs)
          </p>
        </div>
        <div className="flex gap-2">
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

      <PricesPageClient 
        priceCategories={priceCategories || []} 
        priceHistory={priceHistory || []} 
      />
    </div>
  )
}
