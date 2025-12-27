import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { PaymentsPageClient } from "./payments-page-client"
import { Suspense } from "react"
import { LoadingOverlay } from "@/components/loading-overlay"

export default async function PaymentsPage() {
  const supabase = await createClient()

  // Get all clients for selector
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .order("name", { ascending: true })

  // Get all payments
  const { data: payments } = await supabase
    .from("payments")
    .select(
      `
      *,
      invoices(id, invoice_number, total_amount, amount_paid, status, client_id, clients(name)),
      profiles!payments_created_by_fkey(full_name)
    `,
    )
    .order("payment_date", { ascending: false })

  // Get all invoices grouped by client for summary calculations
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, total_amount, amount_paid, status, client_id")
    .order("client_id", { ascending: true })

  // Create a map of invoices by client
  const clientInvoices: Record<string, any[]> = {}
  if (invoices) {
    invoices.forEach((invoice) => {
      if (!clientInvoices[invoice.client_id]) {
        clientInvoices[invoice.client_id] = []
      }
      clientInvoices[invoice.client_id].push(invoice)
    })
  }

  return (
    <div className="lg:p-8">
      <div className="px-6 pb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Payments</h1>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href="/dashboard/payments/new">
              <Plus className="h-4 w-4 mr-2" />
              Record Payment
            </Link>
          </Button>
        </div>
      </div>

        <Suspense fallback={<LoadingOverlay />}>
          <div className="px-6">
            <PaymentsPageClient clients={clients || []} payments={payments || []} clientInvoices={clientInvoices} />
          </div>
        </Suspense>
    </div>
  )
}
