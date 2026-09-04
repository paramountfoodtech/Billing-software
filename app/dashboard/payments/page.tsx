import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { PaymentsPageClient } from "./payments-page-client"
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper"

export default async function PaymentsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const profilePromise = user
    ? supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : Promise.resolve({ data: null })

  const [{ data: profile }, { data: clients }, { data: payments }, { data: invoices }] =
    await Promise.all([
      profilePromise,
      supabase.from("clients").select("id, name").order("name", { ascending: true }),
      supabase
        .from("payments")
        .select(
          `
          *,
          invoices(id, invoice_number, total_amount, amount_paid, status, client_id, clients(name)),
          profiles!payments_created_by_fkey(full_name)
        `,
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("invoices")
        .select("id, invoice_number, total_amount, amount_paid, status, client_id")
        .order("client_id", { ascending: true }),
    ])

  const userRole = profile?.role

  const clientInvoices: Record<string, NonNullable<typeof invoices>> = {}
  if (invoices) {
    for (const invoice of invoices) {
      if (!clientInvoices[invoice.client_id]) {
        clientInvoices[invoice.client_id] = []
      }
      clientInvoices[invoice.client_id]!.push(invoice)
    }
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

        <PaymentsPageClient
          clients={clients || []}
          payments={payments || []}
          clientInvoices={clientInvoices}
          userRole={userRole}
        />
      </div>
    </DashboardPageWrapper>
  )
}
