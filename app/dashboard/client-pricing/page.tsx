import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { ClientPricingPageClient } from "./client-pricing-page-client"
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper"

export default async function ClientPricingPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || (profile.role !== "super_admin" && profile.role !== "admin")) {
    redirect("/dashboard")
  }

  const [{ data: clients }, { data: pricingRules }, { data: priceHistory }] =
    await Promise.all([
      supabase.from("clients").select("id, name").order("name", { ascending: true }),
      supabase
        .from("client_product_pricing")
        .select(
          `
          *,
          clients(name),
          products(name, paper_price),
          price_categories(name)
        `,
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("price_category_history")
        .select("price_category_id, price, effective_date"),
    ])

  return (
    <DashboardPageWrapper title="Client-Specific Pricing">
      <div className="w-full p-4 sm:p-6 lg:p-8 space-y-4">
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
          {profile.role === "super_admin" && (
            <Button asChild className="w-full sm:w-auto">
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
    </DashboardPageWrapper>
  )
}
