import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { PurchasePaymentsPageClient } from "./purchase-payments-page-client"
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper"
import { Suspense } from "react"
import { LoadingOverlay } from "@/components/loading-overlay"

export default async function PurchasePaymentsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let userRole: string | undefined
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
    userRole = profile?.role
  }

  const [{ data: purchasers }, { data: payments }, { data: invoices }] =
    await Promise.all([
      supabase.from("purchasers").select("id, name").order("name"),
      supabase
        .from("purchase_payments")
        .select(
          `
          *,
          purchase_invoices(id, invoice_number, total_amount, amount_paid, status, purchaser_id, purchasers(name)),
          profiles!purchase_payments_created_by_fkey(full_name)
        `,
        )
        .order("payment_date", { ascending: false }),
      supabase
        .from("purchase_invoices")
        .select("id, invoice_number, total_amount, amount_paid, status, purchaser_id")
        .order("purchaser_id"),
    ])

  const purchaserInvoices: Record<string, typeof invoices> = {}
  for (const invoice of invoices || []) {
    if (!purchaserInvoices[invoice.purchaser_id]) {
      purchaserInvoices[invoice.purchaser_id] = []
    }
    purchaserInvoices[invoice.purchaser_id].push(invoice)
  }

  return (
    <DashboardPageWrapper title="Purchase Payments">
      <div className="w-full p-4 sm:p-6 lg:p-8 space-y-4">
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashboard/purchase-payments/new">
              <Plus className="h-4 w-4 mr-2" />
              Record Payment
            </Link>
          </Button>
        </div>

        <Suspense fallback={<LoadingOverlay />}>
          <PurchasePaymentsPageClient
            purchasers={purchasers || []}
            payments={payments || []}
            purchaserInvoices={purchaserInvoices}
            userRole={userRole}
          />
        </Suspense>
      </div>
    </DashboardPageWrapper>
  )
}
