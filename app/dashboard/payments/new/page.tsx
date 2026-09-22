import { createClient } from "@/lib/supabase/server"
import { PaymentForm } from "@/components/payment-form"

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ invoice_id?: string; client_id?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // Fetch all clients
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .order("name", { ascending: true })

  // Fetch payable invoices (draft/cancelled invoices never consume credit or
  // accept payments). Includes fully-paid invoices too, purely for display
  // context in bulk mode — the payment form itself filters by remaining balance.
  const { data: invoices } = await supabase
    .from("invoices")
    .select(`
      id,
      invoice_number,
      total_amount,
      amount_paid,
      status,
      issue_date,
      client_id,
      clients (
        name
      )
    `)
    .neq("status", "draft")
    .neq("status", "cancelled")
    .order("invoice_number", { ascending: false })

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Record Payment</h1>
        <p className="text-muted-foreground mt-1">Add a new payment record - record individual invoice or bulk client payment</p>
      </div>

      <div className="max-w-2xl">
        {!clients || clients.length === 0 ? (
          <div className="p-6 border rounded-lg bg-yellow-50 text-yellow-800">
            <p className="font-semibold">No clients available</p>
            <p className="text-sm mt-1">
              Create a client first before recording payments.
            </p>
          </div>
        ) : (
          <PaymentForm
            invoices={invoices || []}
            clients={clients || []}
            preSelectedInvoiceId={params.invoice_id}
            preSelectedClientId={params.client_id}
          />
        )}
      </div>
    </div>
  )
}
