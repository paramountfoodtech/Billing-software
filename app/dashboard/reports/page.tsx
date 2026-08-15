import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper"
import { ReportsPageClient } from "@/components/reports-page-client"
import { getIndianToday } from "@/lib/date-time"
import { resolveReportPeriod } from "@/lib/report-period"

export const revalidate = 0

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string
    year?: string
    tab?: string
    from?: string
    to?: string
    period?: string
    months?: string
    fy?: string
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

  const {
    periodStart,
    periodEnd,
    periodLabel,
    daysInPeriod,
    reportYear,
    reportMonth,
    multiMonths,
    fy,
    monthStart,
    monthEnd,
    monthLabel,
    daysInMonth,
    mode: periodMode,
  } = period

  const initialFromDate = params.from || monthStart
  const initialToDate =
    params.to || (todayDate < monthEnd ? todayDate : monthEnd)

  // Fetch all required data in parallel for the selected period
  const [
    clientsResult,
    periodInvoicesResult,
    allUnpaidInvoicesResult,
    periodPaymentsResult,
  ] = await Promise.all([
    supabase.from("clients").select("id, name, credit_balance").order("name", { ascending: true }),

    supabase
      .from("invoices")
      .select(
        "id, client_id, issue_date, total_amount, status, invoice_items(product_id, description, quantity, skinless_weight, line_total)",
      )
      .neq("status", "cancelled")
      .gte("issue_date", periodStart)
      .lte("issue_date", periodEnd),

    supabase
      .from("invoices")
      .select("client_id, total_amount, amount_paid, issue_date")
      .neq("status", "cancelled")
      .neq("status", "paid")
      .lte("issue_date", periodEnd),

    supabase
      .from("payments")
      .select("amount, invoices(client_id)")
      .gte("payment_date", periodStart)
      .lte("payment_date", periodEnd),
  ])

  const clients = clientsResult.data || []
  const periodInvoices = periodInvoicesResult.data || []
  const allUnpaidInvoices = allUnpaidInvoicesResult.data || []
  const periodPayments = periodPaymentsResult.data || []

  type ClientRow = {
    id: string
    name: string
    sale: number
    todaySaleQty: number
    todaySaleValue: number
    saleKgs: number
    payments: number
    outstanding: number
    oldBal: number
    creditBalance: number
  }

  const clientMap = new Map<string, ClientRow>()
  for (const client of clients) {
    clientMap.set(client.id, {
      id: client.id,
      name: client.name,
      sale: 0,
      todaySaleQty: 0,
      todaySaleValue: 0,
      saleKgs: 0,
      payments: 0,
      outstanding: 0,
      oldBal: 0,
      creditBalance: Number(client.credit_balance || 0),
    })
  }

  for (const invoice of periodInvoices) {
    const row = clientMap.get(invoice.client_id)
    if (!row) continue
    row.sale += Number(invoice.total_amount)
    const items =
      (invoice.invoice_items as
        | {
            quantity: string | number | null
            skinless_weight: string | number | null
          }[]
        | null) ?? []
    const invoiceQty = items.reduce((sum, item) => {
      const weight =
        item.skinless_weight && Number(item.skinless_weight) > 0
          ? Number(item.skinless_weight)
          : Number(item.quantity || 0)
      return sum + weight
    }, 0)
    row.saleKgs += invoiceQty
    if (invoice.issue_date === todayDate) {
      row.todaySaleQty += invoiceQty
      row.todaySaleValue += Number(invoice.total_amount || 0)
    }
  }

  for (const invoice of allUnpaidInvoices) {
    const balance = Number(invoice.total_amount) - Number(invoice.amount_paid)
    if (balance <= 0) continue
    const row = clientMap.get(invoice.client_id)
    if (!row) continue
    row.outstanding += balance
    if (invoice.issue_date < periodStart) {
      row.oldBal += balance
    }
  }

  for (const payment of periodPayments) {
    const clientId = (payment.invoices as unknown as { client_id: string } | null)
      ?.client_id
    if (!clientId) continue
    const row = clientMap.get(clientId)
    if (!row) continue
    row.payments += Number(payment.amount)
  }

  const rows = Array.from(clientMap.values()).filter(
    (r) => r.sale > 0 || r.payments > 0 || r.outstanding > 0 || r.oldBal > 0,
  )

  type ProductRow = {
    id: string
    name: string
    currentMonthSaleValue: number
    todaySaleQty: number
    todaySaleValue: number
    totalSaleKgs: number
    avgQtyPerDay: number
  }

  const productMap = new Map<string, ProductRow>()
  for (const invoice of periodInvoices) {
    const items =
      (invoice.invoice_items as
        | {
            product_id: string | null
            description: string | null
            quantity: string | number | null
            skinless_weight: string | number | null
            line_total: string | number | null
          }[]
        | null) ?? []

    for (const item of items) {
      const name = (item.description || "Unnamed Product").trim()
      const productKey = item.product_id || name
      const current = productMap.get(productKey) || {
        id: productKey,
        name,
        currentMonthSaleValue: 0,
        todaySaleQty: 0,
        todaySaleValue: 0,
        totalSaleKgs: 0,
        avgQtyPerDay: 0,
      }

      const qty =
        item.skinless_weight && Number(item.skinless_weight) > 0
          ? Number(item.skinless_weight)
          : Number(item.quantity || 0)
      const lineValue = Number(item.line_total || 0)

      current.currentMonthSaleValue += lineValue
      current.totalSaleKgs += qty
      if (invoice.issue_date === todayDate) {
        current.todaySaleQty += qty
        current.todaySaleValue += lineValue
      }

      productMap.set(productKey, current)
    }
  }

  const productRows = Array.from(productMap.values())
    .map((row) => ({
      ...row,
      avgQtyPerDay: row.totalSaleKgs / daysInPeriod,
    }))
    .filter(
      (r) =>
        r.currentMonthSaleValue > 0 ||
        r.todaySaleQty > 0 ||
        r.todaySaleValue > 0 ||
        r.totalSaleKgs > 0,
    )

  return (
    <DashboardPageWrapper title="Reports">
      <ReportsPageClient
          reportYear={reportYear}
          reportMonth={reportMonth}
          monthLabel={monthLabel}
          monthStart={monthStart}
          monthEnd={monthEnd}
          daysInMonth={daysInMonth}
          periodMode={periodMode}
          periodLabel={periodLabel}
          periodStart={periodStart}
          periodEnd={periodEnd}
          daysInPeriod={daysInPeriod}
          multiMonths={multiMonths}
          fy={fy}
          rows={rows}
          productRows={productRows}
          clients={clients.map((c) => ({ id: c.id, name: c.name }))}
          initialFromDate={initialFromDate}
          initialToDate={initialToDate}
      />
    </DashboardPageWrapper>
  )
}
