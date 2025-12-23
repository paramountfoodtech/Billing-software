import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { ClientPricingForm } from "@/components/client-pricing-form"

export default async function EditClientPricingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (profile?.role !== "admin") {
    redirect("/dashboard")
  }

  // Get the pricing rule
  const { data: pricingRule, error } = await supabase.from("client_product_pricing").select("*").eq("id", id).single()

  if (error || !pricingRule) {
    notFound()
  }

  // Get clients, products, and pricing data for the form
  const [clientsResult, productsResult, categoriesResult, historyResult] = await Promise.all([
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("products").select("id, name, paper_price").eq("is_active", true).order("name"),
    supabase.from("price_categories").select("id, name").order("name"),
    supabase.from("price_category_history").select("price_category_id, price, effective_date"),
  ])

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Edit Client Pricing Rule</h1>
        <p className="text-muted-foreground mt-1">Update custom pricing for this client-product combination</p>
      </div>

      <div className="max-w-3xl">
        <ClientPricingForm
          clients={clientsResult.data || []}
          products={productsResult.data || []}
          existingRule={pricingRule}
          priceCategories={categoriesResult.data || []}
          priceHistory={historyResult.data || []}
        />
      </div>
    </div>
  )
}
