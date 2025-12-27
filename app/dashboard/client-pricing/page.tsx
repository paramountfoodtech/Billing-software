import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { ClientPricingPageClient } from "./client-pricing-page-client"
import { Suspense } from "react"
import { LoadingOverlay } from "@/components/loading-overlay"

export default async function ClientPricingPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Check role (super_admin full, admin view-only)
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (!profile || (profile.role !== "super_admin" && profile.role !== "admin")) {
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
    <div className="lg:p-8">
      <div className="px-6 pb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Client-Specific Pricing</h1>
        <div className="flex items-center gap-2">
          {profile.role === "super_admin" && (
            <Button asChild>
              <Link href="/dashboard/client-pricing/new">
                <Plus className="h-4 w-4 mr-2" />
                Add Pricing Rule
              </Link>
            </Button>
          )}
        </div>
      </div>

        <Suspense fallback={<LoadingOverlay />}>
          <div className="px-6">
            <ClientPricingPageClient
              pricingRules={pricingRules || []}
              priceHistory={priceHistory || []}
              clients={clients || []}
              userRole={profile.role}
            />
          </div>
        </Suspense>
    </div>
  )
}
