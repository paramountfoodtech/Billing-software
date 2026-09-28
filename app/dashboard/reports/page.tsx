import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper"
import { ReportsPageClient } from "@/components/reports-page-client"
import { getIndianToday } from "@/lib/date-time"
import { resolveReportPeriod } from "@/lib/report-period"
import { fetchAllPages } from "@/lib/supabase/fetch-all"

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

  // Fetch all required data in parallel with pagination to avoid Supabase 1,000-row limit.
  // Historical data is fetched with lightweight column projections (no joins) to avoid memory bloat.
  const [
    clients,
    historicalInvoices,
    periodInvoices,
    historicalPayments,
    periodPayments,
  ] = await Promise.all([
    fetchAllPages<{ id: string; name: string; credit_balance: string | number | null }>(
      async (from, to) =>
        supabase
          .from("clients")
          .select("id, name, credit_balance")
          .order("name", { ascending: true })
          .range(from, to),
    ),

    // Historical invoices before periodStart: lightweight (client_id, total_amount)
    fetchAllPages<{ client_id: string; total_amount: string | number | null }>(
      async (from, to) =>
        supabase
          .from("invoices")
          .select("client_id, total_amount")
          .neq("status", "cancelled")
          .lt("issue_date", periodStart)
          .range(from, to),
    ),

    // Active period invoices: with invoice_items for product analytics & kg calculations
    fetchAllPages<{
      id: string
      client_id: string
      issue_date: string
      total_amount: string | number | null
      status: string
      invoice_items: Array<{
        product_id: string | null
        description: string | null
        quantity: string | number | null
        line_total: string | number | null
      }> | null
    }>(
      async (from, to) =>
        supabase
          .from("invoices")
          .select(
            "id, client_id, issue_date, total_amount, status, invoice_items(product_id, description, quantity, line_total)",
          )
          .neq("status", "cancelled")
          .gte("issue_date", periodStart)
          .lte("issue_date", periodEnd)
          .range(from, to),
    ),

    // Historical payments before periodStart: lightweight (client_id, amount)
    fetchAllPages<{ client_id: string | null; amount: string | number | null }>(
      async (from, to) =>
        supabase
          .from("payments")
          .select("amount, client_id")
          .eq("status", "completed")
          .lt("payment_date", periodStart)
          .range(from, to),
    ),

    // Active period payments: amount, client_id, payment_date
    fetchAllPages<{
      client_id: string | null
      amount: string | number | null
      payment_date: string
    }>(
      async (from, to) =>
        supabase
          .from("payments")
          .select("amount, client_id, payment_date")
          .eq("status", "completed")
          .gte("payment_date", periodStart)
          .lte("payment_date", periodEnd)
          .range(from, to),
    ),
  ])

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

  // 1. Historical invoices before periodStart -> Old Balance (+)
  for (const inv of historicalInvoices) {
    const row = clientMap.get(inv.client_id)
    if (row) {
      row.oldBal += Number(inv.total_amount || 0)
    }
  }

  // 2. Historical payments before periodStart -> Old Balance (-)
  for (const payment of historicalPayments) {
    if (!payment.client_id) continue
    const row = clientMap.get(payment.client_id)
    if (row) {
      row.oldBal -= Number(payment.amount || 0)
    }
  }

  // 3. Active period invoices -> Sales (+), saleKgs, todaySale
  for (const invoice of periodInvoices) {
    const row = clientMap.get(invoice.client_id)
    const amt = Number(invoice.total_amount || 0)
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

  // 4. Active period payments -> Period Payments (+)
  for (const payment of periodPayments) {
    if (!payment.client_id) continue
    const row = clientMap.get(payment.client_id)
    if (row) {
      row.payments += Number(payment.amount || 0)
    }
  }

  // 5. Total Pending Amount calculation matching Statement of Account identity:
  // Outstanding = Old Balance + Period Sale - Period Payments
  for (const row of clientMap.values()) {
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
