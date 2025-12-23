import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { PrintableInvoice } from "@/components/printable-invoice"

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch invoice with all related data
  const { data: invoice } = await supabase
    .from("invoices")
    .select(`
      *,
      clients (
        name,
        email,
        phone,
        address,
        city,
        state,
        zip_code
      ),
      invoice_items (
        description,
        quantity,
        unit_price,
        tax_rate,
        discount,
        line_total
      )
    `)
    .eq("id", id)
    .single()

  if (!invoice) {
    notFound()
  }

  // Fetch invoice template settings
  const { data: { user } } = await supabase.auth.getUser()
  
  let template = null
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single()

    if (profile?.organization_id) {
      const { data: templateData } = await supabase
        .from("invoice_templates")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .single()
      
      template = templateData
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <PrintableInvoice invoice={invoice} template={template} />
    </div>
  )
}
