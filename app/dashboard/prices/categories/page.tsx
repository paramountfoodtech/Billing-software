"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { CategoriesManagement } from "@/components/categories-management"

export default async function CategoriesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("organization_id, role").eq("id", user.id).single()

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard")
  }

  const { data: priceCategories } = await supabase
    .from("price_categories")
    .select("*")
    .eq("organization_id", profile.organization_id)
    .order("name", { ascending: true })

  return (
    <div className="p-6 lg:p-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Manage Categories</h1>
          <p className="text-muted-foreground mt-2">
            Add, edit, or remove price categories. These are the base categories used for pricing.
          </p>
        </div>

        <CategoriesManagement priceCategories={priceCategories || []} />
      </div>
    </div>
  )
}
