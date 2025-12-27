import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { InvoiceForm } from "@/components/invoice-form"

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch invoice and its items (include product_id)
  const { data: invoice } = await supabase
    .from("invoices")
    .select(`
      *,
      invoice_items (product_id, description, quantity, unit_price, tax_rate, discount, line_total, bird_count, per_bird_adjustment)
    `)
    .eq("id", id)
    .single()

  if (!invoice) {
    notFound()
  }

  // Load clients, products, pricing rules, categories, history
  const [clientsResult, productsResult, pricingRulesResult, categoriesResult, historyResult] = await Promise.all([
    supabase.from("clients").select("id, name, email, due_days, value_per_bird").order("name"),
    supabase.from("products").select("*").eq("is_active", true).order("name"),
    supabase.from("client_product_pricing").select("product_id, price_rule_type, price_rule_value, price_category_id, client_id"),
    supabase.from("price_categories").select("id, name").order("name"),
    supabase.from("price_category_history").select("price_category_id, price, effective_date"),
  ])

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Edit Invoice</h1>
        <p className="text-muted-foreground mt-1">Update invoice details and line items</p>
      </div>

      <InvoiceForm
        clients={clientsResult.data || []}
        products={productsResult.data || []}
        clientPricingRules={pricingRulesResult.data || []}
        priceCategories={categoriesResult.data || []}
        priceHistory={historyResult.data || []}
        initialInvoice={{
          id: invoice.id,
          client_id: invoice.client_id,
          invoice_number: invoice.invoice_number,
          reference_number: invoice.reference_number,
          issue_date: invoice.issue_date,
          due_date: invoice.due_date,
          notes: invoice.notes,
          subtotal: Number(invoice.subtotal),
          tax_amount: Number(invoice.tax_amount),
          discount_amount: Number(invoice.discount_amount),
          total_amount: Number(invoice.total_amount),
        }}
        initialItems={(invoice.invoice_items || []).map((it: any) => ({
          product_id: it.product_id,
          description: it.description,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
          tax_rate: Number(it.tax_rate),
          discount: Number(it.discount),
          line_total: Number(it.line_total),
        }))}
      />
    </div>
  )
}
