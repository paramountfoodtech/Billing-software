import { createClient } from "@/lib/supabase/server"
import { fetchAllPages } from "@/lib/supabase/fetch-all"
import { PurchaseInvoicesPageClient } from "./purchase-invoices-page-client"
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"

export default async function PurchaseInvoicesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const profilePromise = user
    ? supabase.from("profiles").select("role, organization_id").eq("id", user.id).maybeSingle()
    : Promise.resolve({ data: null })

  const [{ data: profile }, { data: purchasers }] = await Promise.all([
    profilePromise,
    supabase.from("purchasers").select("id, name").order("name"),
  ])

  const organizationId = profile?.organization_id
  const [categoriesResult, priceHistoryResult] = organizationId
    ? await Promise.all([
        supabase
          .from("price_categories")
          .select("id, name")
          .eq("organization_id", organizationId)
          .eq("is_active", true),
        supabase
          .from("price_category_history")
          .select("price_category_id, price, effective_date")
          .eq("organization_id", organizationId),
      ])
    : [{ data: [] }, { data: [] }]

  const liveCategoryId =
    (categoriesResult.data || []).find((c) => c.name?.toLowerCase() === "live")
      ?.id ?? null
  const priceHistory = priceHistoryResult.data || []

  const invoices = await fetchAllPages(async (from, to) => {
    const { data, error } = await supabase
      .from("purchase_invoices")
      .select(
        `
        *,
        purchasers(name, purchaser_code),
        profiles!purchase_invoices_created_by_fkey(full_name)
      `,
      )
      .or("invoice_type.eq.challan,invoice_type.is.null")
      .order("created_at", { ascending: false })
      .range(from, to)
    return { data, error }
  })

  const userRole = profile?.role

  const challanIds = [
    ...new Set(
      invoices
        .map((inv) => inv.challan_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  const challanMap = new Map<string, { challan_number: string }>()

  if (challanIds.length > 0) {
    const challans = await fetchAllPages(async (from, to) => {
      const { data, error } = await supabase
        .from("challans")
        .select("id, challan_number")
        .in("id", challanIds)
        .range(from, to)
      return { data, error }
    })

    for (const challan of challans) {
      challanMap.set(challan.id, { challan_number: challan.challan_number })
    }
  }

  const enriched = invoices.map((inv) => ({
    ...inv,
    challans: inv.challan_id
      ? challanMap.get(inv.challan_id as string) || { challan_number: "—" }
      : { challan_number: "—" },
  }))

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

        <PurchaseInvoicesPageClient
          purchasers={purchasers || []}
          invoices={enriched}
          userRole={userRole}
          liveCategoryId={liveCategoryId}
          priceHistory={priceHistory}
        />
      </div>
    </DashboardPageWrapper>
  )
}
