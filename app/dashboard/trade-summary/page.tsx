import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper"
import {
  TradeSummaryPageClient,
  type LinkedPartyOption,
  type PurchaseInvoiceRow,
  type SaleInvoiceRow,
} from "@/components/trade-summary-page-client"
import { getIndianToday } from "@/lib/date-time"
import { resolveReportPeriod } from "@/lib/report-period"
import { fetchAllPages } from "@/lib/supabase/fetch-all"

export const revalidate = 0

export default async function TradeSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string
    year?: string
    from?: string
    to?: string
    period?: string
    months?: string
    fy?: string
    clientId?: string
    purchaserId?: string
  }>
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single()

  if (!profile || (profile.role !== "super_admin" && profile.role !== "admin")) {
    redirect("/dashboard")
  }

  const params = await searchParams
  const todayDate = getIndianToday()
  const period = resolveReportPeriod({
    period: params.period,
    year: params.year,
    month: params.month,
    months: params.months,
    from: params.from,
    to: params.to,
    fy: params.fy,
    todayDate,
  })

  const linkedClients = await fetchAllPages<{
    id: string
    name: string
    linked_purchaser_id: string
  }>(async (from, to) => {
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, linked_purchaser_id")
      .not("linked_purchaser_id", "is", null)
      .order("name")
      .range(from, to)
    return { data, error }
  })

  const purchaserIds = linkedClients.map((c) => c.linked_purchaser_id)
  const purchasers =
    purchaserIds.length > 0
      ? (
          await supabase
            .from("purchasers")
            .select("id, name, purchaser_code")
            .in("id", purchaserIds)
        ).data || []
      : []

  const purchaserMap = new Map(purchasers.map((p) => [p.id, p]))

  const linkedParties: LinkedPartyOption[] = linkedClients
    .map((c) => {
      const p = purchaserMap.get(c.linked_purchaser_id)
      if (!p) return null
      return {
        clientId: c.id,
        purchaserId: p.id,
        name: c.name,
        purchaserCode: p.purchaser_code,
      }
    })
    .filter((x): x is LinkedPartyOption => Boolean(x))

  let selectedClientId = params.clientId || null
  let selectedPurchaserId = params.purchaserId || null

  if (selectedPurchaserId && !selectedClientId) {
    const match = linkedParties.find((p) => p.purchaserId === selectedPurchaserId)
    selectedClientId = match?.clientId || null
  }
  if (selectedClientId && !selectedPurchaserId) {
    const match = linkedParties.find((p) => p.clientId === selectedClientId)
    selectedPurchaserId = match?.purchaserId || null
  }

  // Auto-select when only one linked pair
  if (!selectedClientId && linkedParties.length === 1) {
    selectedClientId = linkedParties[0].clientId
    selectedPurchaserId = linkedParties[0].purchaserId
  }

  const selectedParty = linkedParties.find(
    (p) =>
      p.clientId === selectedClientId || p.purchaserId === selectedPurchaserId,
  )

  let salesInvoices: SaleInvoiceRow[] = []
  let purchaseInvoices: PurchaseInvoiceRow[] = []

  if (selectedClientId && selectedPurchaserId) {
    const [salesRaw, purchaseRaw] = await Promise.all([
      fetchAllPages<{
        id: string
        invoice_number: string
        issue_date: string
        total_amount: number | string
        invoice_items:
          | { quantity: number | string | null }[]
          | null
      }>(async (from, to) => {
        const { data, error } = await supabase
          .from("invoices")
          .select(
            "id, invoice_number, issue_date, total_amount, invoice_items(quantity)",
          )
          .eq("client_id", selectedClientId)
          .neq("status", "cancelled")
          .gte("issue_date", period.periodStart)
          .lte("issue_date", period.periodEnd)
          .order("issue_date", { ascending: true })
          .range(from, to)
        return { data, error }
      }),
      fetchAllPages<{
        id: string
        invoice_number: string
        issue_date: string
        total_weight_kg: number | string
        price_per_kg: number | string
        total_amount: number | string
      }>(async (from, to) => {
        const { data, error } = await supabase
          .from("purchase_invoices")
          .select(
            "id, invoice_number, issue_date, total_weight_kg, price_per_kg, total_amount",
          )
          .eq("purchaser_id", selectedPurchaserId)
          .neq("status", "cancelled")
          .gte("issue_date", period.periodStart)
          .lte("issue_date", period.periodEnd)
          .order("issue_date", { ascending: true })
          .range(from, to)
        return { data, error }
      }),
    ])

    salesInvoices = salesRaw.map((inv) => {
      const items = inv.invoice_items || []
      const weightKg = items.reduce((sum, item) => {
        const qty = Number(item.quantity || 0)
        return sum + qty
      }, 0)
      const amount = Number(inv.total_amount || 0)
      return {
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        issueDate: inv.issue_date,
        weightKg,
        amount,
        ratePerKg: weightKg > 0 ? amount / weightKg : null,
      }
    })

    purchaseInvoices = purchaseRaw.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      issueDate: inv.issue_date,
      weightKg: Number(inv.total_weight_kg || 0),
      pricePerKg: Number(inv.price_per_kg || 0),
      amount: Number(inv.total_amount || 0),
    }))
  }

  const purchaseTotals = purchaseInvoices.reduce(
    (acc, row) => ({
      weightKg: acc.weightKg + row.weightKg,
      amount: acc.amount + row.amount,
    }),
    { weightKg: 0, amount: 0 },
  )
  const salesTotals = salesInvoices.reduce(
    (acc, row) => ({
      weightKg: acc.weightKg + row.weightKg,
      amount: acc.amount + row.amount,
    }),
    { weightKg: 0, amount: 0 },
  )

  return (
    <DashboardPageWrapper title="Buy & Sell">
      <TradeSummaryPageClient
        reportYear={period.reportYear}
        reportMonth={period.reportMonth}
        periodMode={period.mode}
        periodLabel={period.periodLabel}
        periodStart={period.periodStart}
        periodEnd={period.periodEnd}
        multiMonths={period.multiMonths}
        fy={period.fy}
        linkedParties={linkedParties}
        selectedClientId={selectedClientId}
        selectedPurchaserId={selectedPurchaserId}
        partyName={selectedParty?.name || null}
        salesInvoices={salesInvoices}
        purchaseInvoices={purchaseInvoices}
        purchaseTotals={{
          ...purchaseTotals,
          avgRate:
            purchaseTotals.weightKg > 0
              ? purchaseTotals.amount / purchaseTotals.weightKg
              : null,
        }}
        salesTotals={{
          ...salesTotals,
          avgRate:
            salesTotals.weightKg > 0
              ? salesTotals.amount / salesTotals.weightKg
              : null,
        }}
      />
    </DashboardPageWrapper>
  )
}
