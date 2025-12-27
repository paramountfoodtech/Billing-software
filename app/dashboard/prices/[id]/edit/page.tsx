"use server"

import { PriceForm } from "@/components/price-form"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function EditPricePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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

  const { data: priceCategory } = await supabase
    .from("price_categories")
    .select("*")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single()

  if (!priceCategory) {
    redirect("/dashboard/prices")
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <Link href="/dashboard/prices/categories" className="flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Categories
      </Link>

      <div>
        <h1 className="text-3xl font-bold">Edit Price Category</h1>
        <p className="text-muted-foreground mt-2">Update the price category details.</p>
      </div>

      <PriceForm initialData={priceCategory} />
    </div>
  )
}
