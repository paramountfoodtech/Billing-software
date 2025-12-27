import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, DollarSign, FileText, Users, Clock, CheckCircle, AlertCircle } from "lucide-react"

export default async function ReportsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (!profile || (profile.role !== "super_admin" && profile.role !== "admin")) {
    redirect("/dashboard")
  }

  // Fetch all necessary data for reports
  const [invoicesResult, paymentsResult, clientsResult] = await Promise.all([
    supabase.from("invoices").select("*, clients(name)"),
    supabase.from("payments").select("*"),
    supabase.from("clients").select("id, name"),
  ])

  const invoices = invoicesResult.data || []
  const payments = paymentsResult.data || []
  const clients = clientsResult.data || []

  // Calculate financial metrics
  const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0)
  const totalOutstanding = invoices
    .filter((inv) => inv.status !== "paid" && inv.status !== "cancelled")
    .reduce((sum, inv) => sum + (Number(inv.total_amount) - Number(inv.amount_paid)), 0)

  const paidInvoices = invoices.filter((inv) => inv.status === "paid").length
  // Compute overdue dynamically based on due_date and unpaid balance to sync with dashboard/table logic
  const msInDay = 1000 * 60 * 60 * 24
  const today = new Date()
  const overdueInvoices = invoices.filter((inv) => {
    const balance = Number(inv.total_amount) - Number(inv.amount_paid)
    const dueDate = new Date(inv.due_date)
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / msInDay)
    return balance > 0 && daysOverdue > 0
  }).length
  const draftInvoices = invoices.filter((inv) => inv.status === "draft").length

  // Calculate monthly revenue
  const monthlyRevenue = payments.reduce(
    (acc, payment) => {
      const date = new Date(payment.payment_date)
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      acc[monthYear] = (acc[monthYear] || 0) + Number(payment.amount)
      return acc
    },
    {} as Record<string, number>,
  )

  const sortedMonths = Object.keys(monthlyRevenue).sort()
  const recentMonths = sortedMonths.slice(-6)

  // Client revenue analysis
  const clientRevenue = invoices.reduce(
    (acc, invoice) => {
      const clientName = invoice.clients.name
      if (!acc[clientName]) {
        acc[clientName] = { total: 0, paid: 0, outstanding: 0, invoiceCount: 0 }
      }
      acc[clientName].total += Number(invoice.total_amount)
      acc[clientName].paid += Number(invoice.amount_paid)
      acc[clientName].outstanding += Number(invoice.total_amount) - Number(invoice.amount_paid)
      acc[clientName].invoiceCount += 1
      return acc
    },
    {} as Record<string, { total: number; paid: number; outstanding: number; invoiceCount: number }>,
  )

  const topClients = Object.entries(clientRevenue)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 10)

  // Recent activity
  const recentInvoices = [...invoices]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)

  const recentPayments = [...payments]
    .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
    .slice(0, 10)

  return (
    <div className="lg:p-8">
      <div className="px-6 pb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Reports &amp; Analytics</h1>
      </div>
        {/* Key Metrics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8 px-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">All-time payments received</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Invoiced</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalInvoiced.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">{invoices.length} invoices created</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalOutstanding.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Pending payment collection</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clients.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Total clients in system</p>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Status Overview */}
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Paid Invoices</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paidInvoices}</div>
            <p className="text-xs text-muted-foreground mt-1">Successfully completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Overdue Invoices</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overdueInvoices}</div>
            <p className="text-xs text-muted-foreground mt-1">Require immediate attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Draft Invoices</CardTitle>
            <Clock className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{draftInvoices}</div>
            <p className="text-xs text-muted-foreground mt-1">Not yet sent to clients</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Reports */}
      <Tabs defaultValue="revenue" className="space-y-6">
        <TabsList>
          <TabsTrigger value="revenue">Revenue Trends</TabsTrigger>
          <TabsTrigger value="clients">Top Clients</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Revenue (Last 6 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentMonths.map((month) => {
                  const revenue = monthlyRevenue[month]
                  const [year, monthNum] = month.split("-")
                  const monthName = new Date(Number(year), Number(monthNum) - 1).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })

                  // Calculate percentage for progress bar
                  const maxRevenue = Math.max(...Object.values(monthlyRevenue))
                  const percentage = (revenue / maxRevenue) * 100

                  return (
                    <div key={month} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{monthName}</span>
                        <span className="text-muted-foreground">₹{revenue.toFixed(2)}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {recentMonths.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No revenue data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Clients by Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client Name</TableHead>
                    <TableHead className="text-right">Total Invoiced</TableHead>
                    <TableHead className="text-right">Amount Paid</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Invoices</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topClients.map(([clientName, data]) => (
                    <TableRow key={clientName}>
                      <TableCell className="font-medium">{clientName}</TableCell>
                      <TableCell className="text-right">₹{data.total.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-green-600">₹{data.paid.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-orange-600">₹{data.outstanding.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{data.invoiceCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {topClients.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No client data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentInvoices.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{invoice.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">{invoice.clients.name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">₹{Number(invoice.total_amount).toFixed(2)}</span>
                        <Badge
                          variant="secondary"
                          className={
                            invoice.status === "paid"
                              ? "bg-green-100 text-green-800"
                              : invoice.status === "overdue"
                                ? "bg-red-100 text-red-800"
                                : "bg-blue-100 text-blue-800"
                          }
                        >
                          {invoice.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>

                {recentInvoices.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No invoices yet</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Payments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentPayments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                      <div className="space-y-1">
                        <p className="text-sm font-medium capitalize">{payment.payment_method.replace("_", " ")}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(payment.payment_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-green-600">₹{Number(payment.amount).toFixed(2)}</span>
                        <Badge
                          variant="secondary"
                          className={
                            payment.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : payment.status === "failed"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                          }
                        >
                          {payment.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>

                {recentPayments.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No payments yet</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Collection Rate */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Collection Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Collection Rate</p>
                <p className="text-xs text-muted-foreground">Percentage of invoiced amount collected</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">
                  {totalInvoiced > 0 ? ((totalRevenue / totalInvoiced) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>
            <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-600 rounded-full transition-all flex items-center justify-end pr-2"
                style={{ width: `${totalInvoiced > 0 ? (totalRevenue / totalInvoiced) * 100 : 0}%` }}
              >
                {totalInvoiced > 0 && (totalRevenue / totalInvoiced) * 100 > 10 && (
                  <TrendingUp className="h-3 w-3 text-white" />
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-muted-foreground">Collected</p>
                <p className="text-lg font-bold text-green-700">₹{totalRevenue.toFixed(2)}</p>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-lg font-bold text-orange-700">₹{totalOutstanding.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
