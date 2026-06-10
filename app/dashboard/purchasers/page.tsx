import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { PurchasersTable } from "@/components/purchasers-table"
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper"
import { Suspense } from "react"
import { LoadingOverlay } from "@/components/loading-overlay"

async function PurchasersContent() {
  const supabase = await createClient()

  const [{ data: purchasers }, { data: invoices }] = await Promise.all([
    supabase
      .from("purchasers")
      .select("*, profiles!purchasers_created_by_fkey(full_name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("purchase_invoices")
      .select("purchaser_id, total_amount, amount_paid, status")
      .neq("status", "cancelled"),
  ])

  const outstandingByPurchaser: Record<string, number> = {}
  for (const inv of invoices || []) {
    const balance = Number(inv.total_amount) - Number(inv.amount_paid)
    if (balance <= 0) continue
    outstandingByPurchaser[inv.purchaser_id] =
      (outstandingByPurchaser[inv.purchaser_id] || 0) + balance
  }

  const enriched = (purchasers || []).map((p) => ({
    ...p,
    outstanding: outstandingByPurchaser[p.id] || 0,
  }))

  return <PurchasersTable purchasers={enriched} />
}

export default async function PurchasersPage() {
  return (
    <DashboardPageWrapper title="Purchasers">
      <div className="w-full p-4 sm:p-6 lg:p-8 space-y-4">
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashboard/purchasers/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Purchaser
            </Link>
          </Button>
        </div>

        <Suspense fallback={<LoadingOverlay />}>
          <PurchasersContent />
        </Suspense>
      </div>
    </DashboardPageWrapper>
  )
}
