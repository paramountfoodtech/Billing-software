import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { PaymentsPageClient } from "./payments-page-client"

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
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground mt-1">Track and manage payment records</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/payments/new">
            <Plus className="h-4 w-4 mr-2" />
            Record Payment
          </Link>
        </Button>
      </div>

      <PaymentsPageClient clients={clients || []} payments={payments || []} clientInvoices={clientInvoices} />
    </div>
  )
}
