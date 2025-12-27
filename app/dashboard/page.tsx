import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, FileText, DollarSign, TrendingUp } from "lucide-react"
import { DashboardClient } from "./dashboard-client"
import { Suspense } from "react"
import { LoadingOverlay } from "@/components/loading-overlay"

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

  // Fetch summary statistics
  const [clientsResult, invoicesResult, paymentsResult, clientsListResult, invoicesListResult] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("invoices").select("id, total_amount, status", { count: "exact" }),
    supabase.from("payments").select("amount"),
    supabase.from("clients").select("id, name").order("name", { ascending: true }),
    supabase.from("invoices").select(`
      *,
      clients(name, email)
    `).order("created_at", { ascending: false }),
  ])

  const totalClients = clientsResult.count || 0
  const totalInvoices = invoicesResult.count || 0
  const paidInvoices = invoicesResult.data?.filter((inv) => inv.status === "paid").length || 0
  const totalRevenue =
    paymentsResult.data?.reduce((sum, payment) => sum + Number(payment.amount), 0).toFixed(2) || "0.00"
  const pendingAmount =
    invoicesResult.data
      ?.filter((inv) => inv.status !== "paid" && inv.status !== "cancelled")
      .reduce((sum, inv) => sum + Number(inv.total_amount), 0)
      .toFixed(2) || "0.00"

  return (
    <div className="lg:p-8">
      <div className="px-6 pb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard Overview</h1>
      </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 px-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalClients}</div>
              <p className="text-xs text-muted-foreground mt-1">Active clients in system</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalInvoices}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {paidInvoices} paid, {totalInvoices - paidInvoices} pending
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{totalRevenue}</div>
              <p className="text-xs text-muted-foreground mt-1">All-time payments received</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Amount</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{pendingAmount}</div>
              <p className="text-xs text-muted-foreground mt-1">Outstanding invoices</p>
            </CardContent>
          </Card>
        </div>

        <Suspense fallback={<LoadingOverlay />}>
          <div className="px-6">
            <DashboardClient clients={clientsListResult.data || []} invoices={invoicesListResult.data || []} />
          </div>
        </Suspense>
    </div>
  )
}
