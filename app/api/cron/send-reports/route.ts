import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// This endpoint will be called by a cron job (Vercel Cron or external service)
// Protect it with an authorization token
export async function GET(request: Request) {
  try {
    // Verify authorization
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.NEXT_PUBLIC_CRON_SECRET || "your-secret-key"
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get("type") // weekly, monthly, semi-annual, annual

    // Get all organizations with automated reports enabled
    const { data: organizations } = await supabase
      .from("organizations")
      .select("*")
      .eq("automated_reports_enabled", true)

    if (!organizations || organizations.length === 0) {
      return NextResponse.json({ message: "No organizations with automated reports enabled" })
    }

    const results = []

    for (const org of organizations) {
      // Check if this report type is enabled for this organization
      const reportSettings = org.automated_report_settings || {}
      
      if (!reportSettings[reportType || "weekly"]) {
        continue
      }

      // Generate and send report
      const result = await generateAndSendReport(org.id, reportType || "weekly", org.email)
      results.push({ organization: org.name, result })
    }

    return NextResponse.json({ 
      message: "Reports processed", 
      results,
      count: results.length 
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send reports" },
      { status: 500 }
    )
  }
}

async function generateAndSendReport(
  organizationId: string,
  reportType: string,
  email: string
) {
  const supabase = await createClient()
  
  // Calculate date range based on report type
  const dateRange = getDateRangeForReportType(reportType)
  
  // Fetch data for the period
  const [invoicesResult, paymentsResult] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, clients(name)")
      .eq("organization_id", organizationId)
      .gte("issue_date", dateRange.start)
      .lte("issue_date", dateRange.end),
    supabase
      .from("payments")
      .select("*")
      .eq("organization_id", organizationId)
      .gte("payment_date", dateRange.start)
      .lte("payment_date", dateRange.end),
  ])

  const invoices = invoicesResult.data || []
  const payments = paymentsResult.data || []

  // Calculate metrics
  const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0)
  const totalOutstanding = invoices.reduce(
    (sum, inv) => sum + (Number(inv.total_amount) - Number(inv.amount_paid)),
    0
  )
  const paidInvoices = invoices.filter((inv) => inv.status === "paid").length
  const pendingInvoices = invoices.length - paidInvoices

  // Send email with report
  const reportHtml = generateReportHtml({
    reportType,
    period: dateRange.label,
    metrics: {
      totalInvoices: invoices.length,
      paidInvoices,
      pendingInvoices,
      totalInvoiced,
      totalRevenue,
      totalOutstanding,
    },
  })

  // Send via email service
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/email/send-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: email,
      subject: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report - ${dateRange.label}`,
      html: reportHtml,
    }),
  })

  return response.ok ? "sent" : "failed"
}

function getDateRangeForReportType(reportType: string) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  
  switch (reportType) {
    case "weekly": {
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)
      return {
        start: weekAgo.toISOString().split("T")[0],
        end: today.toISOString().split("T")[0],
        label: `Last 7 days`,
      }
    }
    case "monthly": {
      const monthAgo = new Date(today)
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      return {
        start: monthAgo.toISOString().split("T")[0],
        end: today.toISOString().split("T")[0],
        label: `Last 30 days`,
      }
    }
    case "semi-annual": {
      const sixMonthsAgo = new Date(today)
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
      return {
        start: sixMonthsAgo.toISOString().split("T")[0],
        end: today.toISOString().split("T")[0],
        label: `Last 6 months`,
      }
    }
    case "annual": {
      // Financial year
      const startYear = month < 3 ? year - 1 : year
      return {
        start: `${startYear}-04-01`,
        end: `${startYear + 1}-03-31`,
        label: `FY ${startYear}-${startYear + 1}`,
      }
    }
    default:
      return {
        start: today.toISOString().split("T")[0],
        end: today.toISOString().split("T")[0],
        label: "Today",
      }
  }
}

function generateReportHtml(data: {
  reportType: string
  period: string
  metrics: {
    totalInvoices: number
    paidInvoices: number
    pendingInvoices: number
    totalInvoiced: number
    totalRevenue: number
    totalOutstanding: number
  }
}) {
  const { period, metrics } = data
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1e40af; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .metric-card { background: white; padding: 20px; margin-bottom: 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .metric-label { color: #6b7280; font-size: 14px; margin-bottom: 5px; }
        .metric-value { font-size: 28px; font-weight: bold; color: #1e40af; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Automated Business Report</h1>
          <p>${period}</p>
        </div>
        <div class="content">
          <h2 style="margin-top: 0;">Financial Summary</h2>
          
          <div class="metric-card">
            <div class="metric-label">Total Revenue</div>
            <div class="metric-value">₹${metrics.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          
          <div class="grid">
            <div class="metric-card">
              <div class="metric-label">Total Invoiced</div>
              <div class="metric-value" style="font-size: 20px;">₹${metrics.totalInvoiced.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            
            <div class="metric-card">
              <div class="metric-label">Outstanding</div>
              <div class="metric-value" style="font-size: 20px; color: #dc2626;">₹${metrics.totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>
          
          <h3>Invoice Statistics</h3>
          <div class="grid">
            <div class="metric-card">
              <div class="metric-label">Total Invoices</div>
              <div class="metric-value" style="font-size: 20px;">${metrics.totalInvoices}</div>
            </div>
            
            <div class="metric-card">
              <div class="metric-label">Paid Invoices</div>
              <div class="metric-value" style="font-size: 20px; color: #16a34a;">${metrics.paidInvoices}</div>
            </div>
            
            <div class="metric-card">
              <div class="metric-label">Pending Invoices</div>
              <div class="metric-value" style="font-size: 20px; color: #ea580c;">${metrics.pendingInvoices}</div>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated report from your Billing Management System.</p>
            <p>Generated on ${new Date().toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `
}
