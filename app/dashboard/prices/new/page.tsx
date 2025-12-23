"use server"

import { DailyPriceForm } from "@/components/daily-price-form"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function NewPricePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("organization_id, role").eq("id", user.id).single()

  if (!profile) {
    redirect("/dashboard/clients")
  }

  // Get all price categories
  const { data: priceCategories } = await supabase
    .from("price_categories")
    .select("*")
    .eq("organization_id", profile.organization_id)
    .order("name", { ascending: true })

  // Get price history
  const { data: priceHistory } = await supabase
    .from("price_category_history")
    .select("*")
    .eq("organization_id", profile.organization_id)
    .order("effective_date", { ascending: false })

  return (
    <div className="p-6 lg:p-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Daily Price Update</h1>
          <p className="text-muted-foreground mt-2">
            Update prices for all categories at once. Future dates are not allowed.
          </p>
        </div>

        <DailyPriceForm 
          priceCategories={priceCategories || []} 
          priceHistory={priceHistory || []} 
          userRole={profile.role}
        />
      </div>
    </div>
  )
}
