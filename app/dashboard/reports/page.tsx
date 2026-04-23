import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper"
import { MonthYearPicker } from "@/components/month-year-picker"
import { ReportsTable } from "@/components/reports-table"

export const revalidate = 0

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>
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

  const monthLabel = new Date(reportYear, reportMonth - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  })

  // Fetch all required data in parallel
  const [clientsResult, currentMonthInvoicesResult, allUnpaidInvoicesResult, currentMonthPaymentsResult] =
    await Promise.all([
      supabase.from("clients").select("id, name").order("name", { ascending: true }),

      supabase
        .from("invoices")
        .select("id, client_id, issue_date, total_amount, invoice_items(quantity, skinless_weight)")
        .gte("issue_date", monthStart)
        .lte("issue_date", monthEnd),

      supabase
        .from("invoices")
        .select("client_id, total_amount, amount_paid, issue_date")
        .neq("status", "cancelled")
        .neq("status", "paid")
        .lte("issue_date", monthEnd),

      supabase
        .from("payments")
        .select("amount, invoices(client_id)")
        .gte("payment_date", monthStart)
        .lte("payment_date", monthEnd),
    ])

  const clients = clientsResult.data || []
  const currentMonthInvoices = currentMonthInvoicesResult.data || []
  const allUnpaidInvoices = allUnpaidInvoicesResult.data || []
  const currentMonthPayments = currentMonthPaymentsResult.data || []

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
    })
  }

  for (const invoice of currentMonthInvoices) {
    const row = clientMap.get(invoice.client_id)
    if (!row) continue
    row.sale += Number(invoice.total_amount)
    const items = (invoice.invoice_items as { quantity: string | number | null; skinless_weight: string | number | null }[] | null) ?? []
    const invoiceQty = items.reduce((sum, item) => {
      // Use skinless_weight if present and > 0, otherwise use quantity
      const weight = item.skinless_weight && Number(item.skinless_weight) > 0 
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
    if (invoice.issue_date < monthStart) {
      row.oldBal += balance
    }
  }

  for (const payment of currentMonthPayments) {
    const clientId = (payment.invoices as unknown as { client_id: string } | null)?.client_id
    if (!clientId) continue
    const row = clientMap.get(clientId)
    if (!row) continue
    row.payments += Number(payment.amount)
  }

  const rows = Array.from(clientMap.values()).filter(
    (r) => r.sale > 0 || r.payments > 0 || r.outstanding > 0 || r.oldBal > 0,
  )

  return (
    <DashboardPageWrapper title="Reports">
      <div className="w-full p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Monthly Report:{" "}
              <span className="font-semibold text-foreground">{monthLabel}</span>
            </p>
          </div>
          <MonthYearPicker currentYear={reportYear} currentMonth={reportMonth} />
        </div>

        <ReportsTable rows={rows} daysInMonth={daysInMonth} monthLabel={monthLabel} />
      </div>
    </DashboardPageWrapper>
  )
}
