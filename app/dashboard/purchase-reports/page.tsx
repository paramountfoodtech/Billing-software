import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper"
import { PurchaseReportsPageClient } from "@/components/purchase-reports-page-client"
import type {
  PurchaserReportRow,
  ChallanTrackingRow,
  MortalityReportRow,
} from "@/components/purchase-reports-table"

export const revalidate = 0

export default async function PurchaseReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string
    year?: string
    tab?: string
    from?: string
    to?: string
    purchaser?: string
  }>
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || (profile.role !== "super_admin" && profile.role !== "admin")) {
    redirect("/dashboard")
  }

  const params = await searchParams
  const today = new Date()
  const todayDate = today.toISOString().split("T")[0]
  const reportYear = params.year ? parseInt(params.year) : today.getFullYear()
  const reportMonth = params.month ? parseInt(params.month) : today.getMonth() + 1

  const monthStart = `${reportYear}-${String(reportMonth).padStart(2, "0")}-01`
  const daysInMonth = new Date(reportYear, reportMonth, 0).getDate()
  const monthEnd = `${reportYear}-${String(reportMonth).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`

  const rangeStart = params.from || monthStart
  const rangeEnd = params.to || monthEnd

  const monthLabel = new Date(reportYear, reportMonth - 1, 1).toLocaleDateString(
    "en-IN",
    { month: "long", year: "numeric" },
  )

  const rangeLabel =
    params.from || params.to
      ? `${rangeStart} to ${rangeEnd}`
      : monthLabel

  const [
    purchasersResult,
    monthInvoicesResult,
    unpaidInvoicesResult,
    monthPaymentsResult,
    challansResult,
  ] = await Promise.all([
    supabase.from("purchasers").select("id, name").order("name"),
    supabase
      .from("purchase_invoices")
      .select(
        `
        id,
        invoice_number,
        purchaser_invoice_number,
        purchaser_id,
        issue_date,
        total_amount,
        total_weight_kg,
        total_birds,
        price_per_kg,
        is_mortality_accepted,
        mortality_birds,
        mortality_weight_kg,
        mortality_loss_amount,
        has_discrepancy,
        discrepancy_birds,
        discrepancy_weight_kg,
        discrepancy_notes,
        challan_id,
        purchasers(name)
      `,
      )
      .or("invoice_type.eq.challan,invoice_type.is.null")
      .gte("issue_date", rangeStart)
      .lte("issue_date", rangeEnd),
    supabase
      .from("purchase_invoices")
      .select("purchaser_id, total_amount, amount_paid, issue_date")
      .or("invoice_type.eq.challan,invoice_type.is.null")
      .neq("status", "cancelled")
      .neq("status", "paid")
      .lte("issue_date", rangeEnd),
    supabase
      .from("purchase_payments")
      .select("amount, purchase_invoices(purchaser_id)")
      .gte("payment_date", rangeStart)
      .lte("payment_date", rangeEnd),
    supabase
      .from("challans")
      .select(
        `
        id,
        challan_number,
        challan_date,
        total_weight_kg,
        total_birds,
        mortality_birds,
        mortality_weight_kg,
        status,
        purchase_invoice_id,
        purchaser_id,
        purchasers(name)
      `,
      )
      .gte("challan_date", rangeStart)
      .lte("challan_date", rangeEnd)
      .order("challan_date", { ascending: false }),
  ])

  const purchasers = purchasersResult.data || []
  const monthInvoices = monthInvoicesResult.data || []
  const unpaidInvoices = unpaidInvoicesResult.data || []
  const monthPayments = monthPaymentsResult.data || []
  const challans = challansResult.data || []

  const invoiceIds = [
    ...new Set(
      challans
        .map((c) => c.purchase_invoice_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  const invoiceNumberById = new Map<string, string>()
  if (invoiceIds.length > 0) {
    const { data: linkedInvoices } = await supabase
      .from("purchase_invoices")
      .select("id, invoice_number")
      .in("id", invoiceIds)

    for (const invoice of linkedInvoices || []) {
      invoiceNumberById.set(invoice.id, invoice.invoice_number)
    }
  }

  const purchaserMap = new Map<string, PurchaserReportRow>()
  for (const p of purchasers) {
    purchaserMap.set(p.id, {
      id: p.id,
      name: p.name,
      purchase: 0,
      todayPurchaseKg: 0,
      todayPurchaseValue: 0,
      purchaseKgs: 0,
      purchaseBirds: 0,
      payments: 0,
      outstanding: 0,
      oldBal: 0,
    })
  }

  for (const inv of monthInvoices) {
    if (!inv.purchaser_id) continue
    const row = purchaserMap.get(inv.purchaser_id)
    if (!row) continue
    row.purchase += Number(inv.total_amount)
    row.purchaseKgs += Number(inv.total_weight_kg)
    row.purchaseBirds += Number(inv.total_birds || 0)
    if (inv.issue_date === todayDate) {
      row.todayPurchaseKg += Number(inv.total_weight_kg)
      row.todayPurchaseValue += Number(inv.total_amount)
    }
  }

  for (const inv of unpaidInvoices) {
    if (!inv.purchaser_id) continue
    const balance = Number(inv.total_amount) - Number(inv.amount_paid)
    if (balance <= 0) continue
    const row = purchaserMap.get(inv.purchaser_id)
    if (!row) continue
    row.outstanding += balance
    if (inv.issue_date < rangeStart) {
      row.oldBal += balance
    }
  }

  for (const payment of monthPayments) {
    const purchaserId = (
      payment.purchase_invoices as unknown as { purchaser_id: string } | null
    )?.purchaser_id
    if (!purchaserId) continue
    const row = purchaserMap.get(purchaserId)
    if (!row) continue
    row.payments += Number(payment.amount)
  }

  const purchaserRows = Array.from(purchaserMap.values()).filter(
    (r) =>
      r.purchase > 0 || r.payments > 0 || r.outstanding > 0 || r.oldBal > 0,
  )

  const challanRows: ChallanTrackingRow[] = challans.map((c) => {
    const purchaser = c.purchasers as unknown as { name: string } | null
    return {
      id: c.id,
      challan_number: c.challan_number,
      purchaser_id: c.purchaser_id,
      purchaser_name: purchaser?.name || "Unknown",
      challan_date: c.challan_date,
      total_weight_kg: Number(c.total_weight_kg),
      total_birds: Number(c.total_birds || 0),
      status: c.status,
      invoice_number: c.purchase_invoice_id
        ? invoiceNumberById.get(c.purchase_invoice_id) || null
        : null,
    }
  })

  const challanLabelByInvoice = new Map<string, string>()
  for (const c of challans) {
    if (!c.purchase_invoice_id) continue
    const existing = challanLabelByInvoice.get(c.purchase_invoice_id)
    challanLabelByInvoice.set(
      c.purchase_invoice_id,
      existing ? `${existing}, ${c.challan_number}` : c.challan_number,
    )
  }

  const challanById = new Map<string, (typeof challans)[number]>()
  for (const c of challans) {
    challanById.set(c.id, c)
  }

  const invoicedChallanIds = new Set<string>()
  const mortalityRows: MortalityReportRow[] = []

  for (const inv of monthInvoices) {
    const mortBirds = Number(inv.mortality_birds || 0)
    const mortWeight = Number(inv.mortality_weight_kg || 0)
    const hasDisc = Boolean(inv.has_discrepancy)
    const discBirds = Number(inv.discrepancy_birds || 0)
    const discWeight = Number(inv.discrepancy_weight_kg || 0)

    if (mortBirds > 0 || mortWeight > 0 || hasDisc) {
      const isAccepted = Boolean(inv.is_mortality_accepted)
      const rate = Number(inv.price_per_kg || 0)
      const billableWeight = Number(inv.total_weight_kg || 0)
      const billableBirds = Number(inv.total_birds || 0)
      const grossWeight = isAccepted
        ? billableWeight + mortWeight
        : billableWeight
      const grossBirds = isAccepted
        ? billableBirds + mortBirds
        : billableBirds

      const lossAmount = !isAccepted
        ? Number(inv.mortality_loss_amount || mortWeight * rate)
        : 0
      const deductedAmount = isAccepted
        ? Math.round((mortWeight * rate + Number.EPSILON) * 100) / 100
        : 0

      const linkedChallanLabel =
        challanLabelByInvoice.get(inv.id) ||
        (inv.challan_id
          ? challanById.get(inv.challan_id)?.challan_number
          : null) ||
        "—"

      if (inv.challan_id) invoicedChallanIds.add(inv.challan_id)

      const purchaserObj = inv.purchasers as unknown as { name: string } | null

      mortalityRows.push({
        id: inv.id,
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        purchaser_invoice_number: inv.purchaser_invoice_number,
        challan_number: linkedChallanLabel,
        date: inv.issue_date,
        purchaser_id: inv.purchaser_id,
        purchaser_name: purchaserObj?.name || "Unknown",
        gross_birds: grossBirds,
        gross_weight_kg: grossWeight,
        mortality_birds: mortBirds,
        mortality_weight_kg: mortWeight,
        rate_per_kg: rate,
        is_mortality_accepted: isAccepted,
        status: isAccepted ? "accepted" : "neglected",
        billable_birds: billableBirds,
        billable_weight_kg: billableWeight,
        loss_amount: lossAmount,
        deducted_amount: deductedAmount,
        has_discrepancy: hasDisc,
        discrepancy_birds: discBirds,
        discrepancy_weight_kg: discWeight,
        discrepancy_notes: inv.discrepancy_notes,
      })
    }
  }

  for (const c of challans) {
    if (c.purchase_invoice_id || invoicedChallanIds.has(c.id)) continue
    const mortBirds = Number(c.mortality_birds || 0)
    const mortWeight = Number(c.mortality_weight_kg || 0)
    if (mortBirds > 0 || mortWeight > 0) {
      const purchaserObj = c.purchasers as unknown as { name: string } | null
      mortalityRows.push({
        id: c.id,
        invoice_id: null,
        invoice_number: null,
        purchaser_invoice_number: null,
        challan_number: c.challan_number,
        date: c.challan_date,
        purchaser_id: c.purchaser_id,
        purchaser_name: purchaserObj?.name || "Unknown",
        gross_birds: Number(c.total_birds || 0),
        gross_weight_kg: Number(c.total_weight_kg || 0),
        mortality_birds: mortBirds,
        mortality_weight_kg: mortWeight,
        rate_per_kg: 0,
        is_mortality_accepted: false,
        status: "pending",
        billable_birds: Number(c.total_birds || 0),
        billable_weight_kg: Number(c.total_weight_kg || 0),
        loss_amount: 0,
        deducted_amount: 0,
      })
    }
  }

  return (
    <DashboardPageWrapper title="Purchase Reports">
      <PurchaseReportsPageClient
        reportYear={reportYear}
        reportMonth={reportMonth}
        rangeLabel={rangeLabel}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        purchaserRows={purchaserRows}
        challanRows={challanRows}
        mortalityRows={mortalityRows}
        purchasers={purchasers}
        initialPurchaserId={params.purchaser || null}
      />
    </DashboardPageWrapper>
  )
}
