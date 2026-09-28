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
  const [clientsResult, allInvoicesResult, allPaymentsResult] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, name, credit_balance")
        .order("name", { ascending: true }),

      supabase
        .from("invoices")
        .select(
          "id, client_id, issue_date, total_amount, status, invoice_items(product_id, description, quantity, line_total)",
        )
        .neq("status", "cancelled")
        .lte("issue_date", periodEnd),

      supabase
        .from("payments")
        .select("amount, client_id, payment_date")
        .eq("status", "completed")
        .lte("payment_date", periodEnd),
    ])

  const clients = clientsResult.data || []
  const allInvoices = allInvoicesResult.data || []
  const allPayments = allPaymentsResult.data || []

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

  const periodInvoices: typeof allInvoices = []

  for (const invoice of allInvoices) {
    const row = clientMap.get(invoice.client_id)
    const amt = Number(invoice.total_amount || 0)

    if (invoice.issue_date < periodStart) {
      if (row) row.oldBal += amt
    } else {
      periodInvoices.push(invoice)
      if (row) {
        row.sale += amt
        type ClientInvoiceItem = {
          quantity: string | number | null
        }
        const items = (invoice.invoice_items as ClientInvoiceItem[] | null) ?? []
        const invoiceQty = items.reduce((sum, item) => {
          return sum + Number(item.quantity || 0)
        }, 0)
        row.saleKgs += invoiceQty
        if (invoice.issue_date === todayDate) {
          row.todaySaleQty += invoiceQty
          row.todaySaleValue += amt
        }
      }
    }
  }

  for (const payment of allPayments) {
    const clientId = payment.client_id
    if (!clientId) continue
    const row = clientMap.get(clientId)
    if (!row) continue
    const amt = Number(payment.amount || 0)
    if (payment.payment_date < periodStart) {
      row.oldBal -= amt
    } else {
      row.payments += amt
    }
  }

  for (const row of clientMap.values()) {
    // Statement of Account identity: Old Balance + Period Sale - Period Payments = Total Pending Amount
    row.outstanding = row.oldBal + row.sale - row.payments
  }

  const rows = Array.from(clientMap.values()).filter(
    (r) => r.sale !== 0 || r.payments !== 0 || r.outstanding !== 0 || r.oldBal !== 0,
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
    type ProductInvoiceItem = {
      product_id: string | null
      description: string | null
      quantity: string | number | null
      line_total: string | number | null
    }
    const items = (invoice.invoice_items as ProductInvoiceItem[] | null) ?? []

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

      const qty = Number(item.quantity || 0)
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
