import { createClient } from "@/lib/supabase/server"
import { PurchaseInvoicesPageClient } from "./purchase-invoices-page-client"
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper"
import { Suspense } from "react"
import { LoadingOverlay } from "@/components/loading-overlay"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"

async function PurchaseInvoicesContent({
  userRole,
}: {
  userRole?: string
}) {
  const supabase = await createClient()

  const [{ data: purchasers }, { data: invoices }] = await Promise.all([
    supabase.from("purchasers").select("id, name").order("name"),
    supabase
      .from("purchase_invoices")
      .select(
        `
        *,
        purchasers(name, purchaser_code),
        profiles!purchase_invoices_created_by_fkey(full_name)
      `,
      )
      .order("created_at", { ascending: false }),
  ])

  const challanIds = [
    ...new Set(
      (invoices || [])
        .map((inv) => inv.challan_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  const challanMap = new Map<string, { challan_number: string }>()

  if (challanIds.length > 0) {
    const { data: challans } = await supabase
      .from("challans")
      .select("id, challan_number")
      .in("id", challanIds)

    for (const challan of challans || []) {
      challanMap.set(challan.id, { challan_number: challan.challan_number })
    }
  }

  const enriched = (invoices || []).map((inv) => ({
    ...inv,
    challans: inv.challan_id
      ? challanMap.get(inv.challan_id) || { challan_number: "—" }
      : { challan_number: "—" },
  }))

  return (
    <PurchaseInvoicesPageClient
      purchasers={purchasers || []}
      invoices={enriched}
      userRole={userRole}
    />
  )
}

export default async function PurchaseInvoicesPage() {
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

  return (
    <DashboardPageWrapper title="Purchase Invoices">
      <div className="w-full p-4 sm:p-6 lg:p-8 space-y-4">
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashboard/purchase-invoices/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Invoice
            </Link>
          </Button>
        </div>
        <Suspense fallback={<LoadingOverlay />}>
          <PurchaseInvoicesContent userRole={userRole} />
        </Suspense>
      </div>
    </DashboardPageWrapper>
  )
}
