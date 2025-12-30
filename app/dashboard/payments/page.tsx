import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { PaymentsPageClient } from "./payments-page-client"
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper"
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
    <DashboardPageWrapper title="Payments">
      <div className="w-full p-4 sm:p-6 lg:p-8 space-y-4">
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashboard/payments/new">
              <Plus className="h-4 w-4 mr-2" />
              Record Payment
            </Link>
          </Button>
        </div>

        <Suspense fallback={<LoadingOverlay />}>
          <PaymentsPageClient clients={clients || []} payments={payments || []} clientInvoices={clientInvoices} />
        </Suspense>
      </div>
    </DashboardPageWrapper>
  )
}
