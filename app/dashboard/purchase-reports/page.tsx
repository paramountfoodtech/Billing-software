import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper"
import { PurchaseReportsPageClient } from "@/components/purchase-reports-page-client"
import type {
  PurchaserReportRow,
  ChallanTrackingRow,
} from "@/components/purchase-reports-table"

export const revalidate = 0

export default async function PurchaseReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; tab?: string }>
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

  const monthLabel = new Date(reportYear, reportMonth - 1, 1).toLocaleDateString(
    "en-IN",
    { month: "long", year: "numeric" },
  )

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
      .select("id, purchaser_id, issue_date, total_amount, total_weight_kg")
      .gte("issue_date", monthStart)
      .lte("issue_date", monthEnd),
    supabase
      .from("purchase_invoices")
      .select("purchaser_id, total_amount, amount_paid, issue_date")
      .neq("status", "cancelled")
      .neq("status", "paid")
      .lte("issue_date", monthEnd),
    supabase
      .from("purchase_payments")
      .select("amount, purchase_invoices(purchaser_id)")
      .gte("payment_date", monthStart)
      .lte("payment_date", monthEnd),
    supabase
      .from("challans")
      .select(
        `
        id,
        challan_number,
        challan_date,
        total_weight_kg,
        status,
        purchase_invoice_id,
        purchasers(name)
      `,
      )
      .gte("challan_date", monthStart)
      .lte("challan_date", monthEnd)
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
      payments: 0,
      outstanding: 0,
      oldBal: 0,
    })
  }

  for (const inv of monthInvoices) {
    const row = purchaserMap.get(inv.purchaser_id)
    if (!row) continue
    row.purchase += Number(inv.total_amount)
    row.purchaseKgs += Number(inv.total_weight_kg)
    if (inv.issue_date === todayDate) {
      row.todayPurchaseKg += Number(inv.total_weight_kg)
      row.todayPurchaseValue += Number(inv.total_amount)
    }
  }

  for (const inv of unpaidInvoices) {
    const balance = Number(inv.total_amount) - Number(inv.amount_paid)
    if (balance <= 0) continue
    const row = purchaserMap.get(inv.purchaser_id)
    if (!row) continue
    row.outstanding += balance
    if (inv.issue_date < monthStart) {
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
      purchaser_name: purchaser?.name || "Unknown",
      challan_date: c.challan_date,
      total_weight_kg: Number(c.total_weight_kg),
      status: c.status,
      invoice_number: c.purchase_invoice_id
        ? invoiceNumberById.get(c.purchase_invoice_id) || null
        : null,
    }
  })

  return (
    <DashboardPageWrapper title="Purchase Reports">
      <Suspense
        fallback={
          <div className="w-full p-8 text-sm text-muted-foreground">
            Loading purchase reports…
          </div>
        }
      >
        <PurchaseReportsPageClient
          reportYear={reportYear}
          reportMonth={reportMonth}
          monthLabel={monthLabel}
          purchaserRows={purchaserRows}
          challanRows={challanRows}
        />
      </Suspense>
    </DashboardPageWrapper>
  )
}
