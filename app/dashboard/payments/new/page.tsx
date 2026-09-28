import { createClient } from "@/lib/supabase/server"
import { PaymentForm } from "@/components/payment-form"
import { fetchAllPages } from "@/lib/supabase/fetch-all"

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

  // Fetch invoices that can still take a payment. Paid invoices are excluded
  // and results are paginated: the unfiltered list exceeds Supabase's
  // 1000-row cap, which silently dropped older unpaid invoices. Bulk mode
  // loads the selected client's full invoice set itself (see PaymentForm).
  const invoices = await fetchAllPages(async (from, to) => {
    const { data, error } = await supabase
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
      .not("status", "in", "(draft,cancelled,paid)")
      .order("issue_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to)
    return { data, error }
  })

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
            invoices={invoices}
            clients={clients || []}
            preSelectedInvoiceId={params.invoice_id}
            preSelectedClientId={params.client_id}
          />
        )}
      </div>
    </div>
  )
}
