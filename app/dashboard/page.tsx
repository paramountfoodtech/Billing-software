import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, FileText, DollarSign } from "lucide-react"
import { DashboardCharts } from "@/components/dashboard-charts"
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper"
import { Suspense } from "react"
import { LoadingOverlay } from "@/components/loading-overlay"

// Prevent caching to ensure auth check on every request
export const revalidate = 0

// Get current financial year date range
function getCurrentFinancialYearRange() {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() // 0-indexed
  
  // If month is Jan, Feb, or Mar (0, 1, 2), we're in the previous FY
  const startYear = month < 3 ? year - 1 : year
  const endYear = startYear + 1
  
  return {
    start: `${startYear}-04-01`,
    end: `${endYear}-03-31`,
    fy: `${startYear}-${endYear}`
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()

  // Check authentication and role
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Get user's role
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  // Redirect accountants to prices page (their landing page)
  if (profile?.role === "accountant") {
    redirect("/dashboard/prices")
  }

  // Get current FY range
  const fyRange = getCurrentFinancialYearRange()

  // Fetch summary statistics for current financial year
  const [clientsResult, invoicesResult, paymentsResult, clientsListResult, invoicesListResult] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("invoices").select("id, total_amount, amount_paid, status, issue_date, due_date")
      .gte("issue_date", fyRange.start)
      .lte("issue_date", fyRange.end),
    supabase.from("payments").select("amount, payment_date")
      .gte("payment_date", fyRange.start)
      .lte("payment_date", fyRange.end),
    supabase.from("clients").select("id, name").order("name", { ascending: true }),
    supabase.from("invoices").select(`
      *,
      clients(name, email)
    `).order("created_at", { ascending: false }),
  ])

  const totalClients = clientsResult.count || 0
  const totalInvoices = invoicesResult.data?.length || 0
  // Paid invoices are those where amount_paid equals total_amount
  const paidInvoices = invoicesResult.data?.filter((inv) => Number(inv.amount_paid) >= Number(inv.total_amount)).length || 0
  const totalRevenue =
    paymentsResult.data?.reduce((sum, payment) => sum + Number(payment.amount), 0).toFixed(2) || "0.00"

  return (
    <DashboardPageWrapper title="Dashboard Overview">
      <div className="w-full p-4 sm:p-6 lg:p-8">
        <div className="mb-6 px-0 sm:px-0">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Showing data for Financial Year: <span className="font-semibold text-foreground">{fyRange.fy}</span>
          </p>
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{totalClients}</div>
              <p className="text-xs text-muted-foreground mt-1">Active clients in system</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Invoices</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{totalInvoices}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {paidInvoices} paid, {totalInvoices - paidInvoices} pending
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">₹{totalRevenue}</div>
              <p className="text-xs text-muted-foreground mt-1">FY {fyRange.fy} payments</p>
            </CardContent>
          </Card>
        </div>

        <Suspense fallback={<LoadingOverlay />}>
          <div className="w-full">
            <DashboardCharts 
              invoices={invoicesResult.data || []} 
              payments={paymentsResult.data || []} 
            />
          </div>
        </Suspense>
      </div>
    </DashboardPageWrapper>
  )
}
