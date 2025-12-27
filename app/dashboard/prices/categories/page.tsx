"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { CategoriesManagement } from "@/components/categories-management"
import { Suspense } from "react"
import { LoadingOverlay } from "@/components/loading-overlay"

async function CategoriesContent({ organizationId }: { organizationId: string }) {
  const supabase = await createClient()

  const { data: priceCategories } = await supabase
    .from("price_categories")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true })

  return <CategoriesManagement priceCategories={priceCategories || []} />
}

export default async function CategoriesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("organization_id, role").eq("id", user.id).single()

  if (!profile || profile.role !== "super_admin") {
    redirect("/dashboard")
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Manage Categories</h1>
          <p className="text-muted-foreground mt-2">
            Add, edit, or remove price categories. These are the base categories used for pricing.
          </p>
        </div>

        <Suspense fallback={<LoadingOverlay />}>
          <CategoriesContent organizationId={profile.organization_id} />
        </Suspense>
      </div>
    </div>
  )
}
