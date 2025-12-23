import { createClient } from "@/lib/supabase/server"
import { InvoiceForm } from "@/components/invoice-form"
import { AlertTriangle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function NewInvoicePage() {
  const supabase = await createClient()

  const today = new Date().toISOString().split("T")[0]

  // Fetch clients, products and client-specific pricing rules
  const [clientsResult, productsResult, pricingRulesResult, categoriesResult, historyResult] = await Promise.all([
    supabase.from("clients").select("id, name, email, due_days, value_per_bird").order("name"),
    supabase.from("products").select("*").eq("is_active", true).order("name"),
    supabase.from("client_product_pricing").select("product_id, price_rule_type, price_rule_value, price_category_id, client_id"),
    supabase.from("price_categories").select("id, name").order("name"),
    supabase.from("price_category_history").select("price_category_id, price, effective_date"),
  ])

  // Check if today's prices are set
  const todayPrices = (historyResult.data || []).filter(p => p.effective_date === today)
  const hasTodayPrices = todayPrices.length > 0
  const priceCategories = categoriesResult.data || []
  const allCategoriesHavePrices = priceCategories.every(cat => 
    todayPrices.some(p => p.price_category_id === cat.id)
  )

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Create Invoice</h1>
        <p className="text-muted-foreground mt-1">Generate a new invoice for a client</p>
      </div>

      {/* Warning if today's prices are not set */}
      {(!hasTodayPrices || !allCategoriesHavePrices) && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900">Today's Prices Not Updated</h3>
              <p className="text-sm text-yellow-800 mt-1">
                Prices for {today} haven't been set yet. The invoice will use the most recent historical prices, 
                which may not be current. It's recommended to update today's prices before creating invoices.
              </p>
              <div className="mt-3">
                <Button asChild size="sm" variant="outline" className="bg-white">
                  <Link href="/dashboard/prices/new">
                    Update Today's Prices
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <InvoiceForm 
        clients={clientsResult.data || []} 
        products={productsResult.data || []}
        clientPricingRules={pricingRulesResult.data || []}
        priceCategories={categoriesResult.data || []}
        priceHistory={historyResult.data || []}
      />
    </div>
  )
}
