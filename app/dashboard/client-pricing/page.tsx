import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { ClientPricingPageClient } from "./client-pricing-page-client"

export default async function ClientPricingPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Check role (admin full, manager view-only)
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    redirect("/dashboard")
  }

  // Get all clients
  const { data: clients } = await supabase.from("clients").select("id, name").order("name", { ascending: true })

  // Get all pricing rules with client, product, and category details
  const { data: pricingRules } = await supabase
    .from("client_product_pricing")
    .select(
      `
      *,
      clients(name),
      products(name, paper_price),
      price_categories(name)
    `,
    )
    .order("created_at", { ascending: false })

  // Get price history for calculations
  const { data: priceHistory } = await supabase
    .from("price_category_history")
    .select("price_category_id, price, effective_date")

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Client-Specific Pricing</h1>
          <p className="text-muted-foreground mt-1">Manage custom pricing rules for clients</p>
        </div>
        {profile.role === "admin" && (
          <Button asChild>
            <Link href="/dashboard/client-pricing/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Pricing Rule
            </Link>
          </Button>
        )}
      </div>

      <ClientPricingPageClient
        pricingRules={pricingRules || []}
        priceHistory={priceHistory || []}
        clients={clients || []}
        userRole={profile.role}
      />
    </div>
  )
}
