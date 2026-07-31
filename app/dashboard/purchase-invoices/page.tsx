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

  const invoiceIds = invoices.map((inv) => inv.id as string)
  const challansByInvoiceId = new Map<string, string[]>()

  if (invoiceIds.length > 0) {
    const linkedChallans = await fetchAllPages(async (from, to) => {
      const { data, error } = await supabase
        .from("challans")
        .select("id, challan_number, purchase_invoice_id")
        .in("purchase_invoice_id", invoiceIds)
        .order("challan_number", { ascending: true })
        .range(from, to)
      return { data, error }
    })

    for (const challan of linkedChallans) {
      const invoiceId = challan.purchase_invoice_id as string
      if (!invoiceId) continue
      const list = challansByInvoiceId.get(invoiceId) || []
      list.push(challan.challan_number)
      challansByInvoiceId.set(invoiceId, list)
    }

    // Legacy fallback: invoices that only have challan_id set
    const legacyIds = [
      ...new Set(
        invoices
          .filter(
            (inv) =>
              inv.challan_id &&
              !(challansByInvoiceId.get(inv.id as string)?.length),
          )
          .map((inv) => inv.challan_id as string),
      ),
    ]

    if (legacyIds.length > 0) {
      const legacyChallans = await fetchAllPages(async (from, to) => {
        const { data, error } = await supabase
          .from("challans")
          .select("id, challan_number")
          .in("id", legacyIds)
          .range(from, to)
        return { data, error }
      })
      const byId = new Map(
        legacyChallans.map((c) => [c.id, c.challan_number]),
      )
      for (const inv of invoices) {
        if (
          inv.challan_id &&
          !(challansByInvoiceId.get(inv.id as string)?.length)
        ) {
          const number = byId.get(inv.challan_id as string)
          if (number) challansByInvoiceId.set(inv.id as string, [number])
        }
      }
    }
  }

  const enriched = invoices.map((inv) => {
    const numbers = challansByInvoiceId.get(inv.id as string) || []
    return {
      ...inv,
      challans: {
        challan_number:
          numbers.length > 0 ? numbers.join(", ") : "—",
      },
    }
  })

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
