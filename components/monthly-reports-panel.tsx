"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { exportToCSV, type ExportColumn } from "@/lib/export-utils"
import { FileDown, FileText } from "lucide-react"

type ClientOption = { id: string; name: string }

export type MonthlyReportsPanelProps = {
  clients: ClientOption[]
  reportYear: number
  reportMonth: number
  monthStart: string
  monthEnd: string
  monthLabel: string
}

function formatStatementDate(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00")
  const mon = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ][d.getMonth()]
  return `${mon}/${d.getDate()}/${d.getFullYear()}`
}

const fmtMoney = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type DisplayRow = {
  kind: "sale" | "payment"
  dateKey: string
  sortOrder: number
  invoiceNumber: string
  sale: number
  payment: number
  dayTotal: number | null
  showDayTotal: boolean
  outstanding: number
}

export function MonthlyReportsPanel({
  clients,
  reportYear,
  reportMonth,
  monthStart,
  monthEnd,
  monthLabel,
}: MonthlyReportsPanelProps) {
  const { toast } = useToast()
  const [clientId, setClientId] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [displayRows, setDisplayRows] = useState<DisplayRow[]>([])
  const [clientName, setClientName] = useState("")
  const [summary, setSummary] = useState({
    previousBalance: 0,
    totalSale: 0,
    totalPayment: 0,
    closingOutstanding: 0,
  })

  const clientOptions = useMemo(
    () => clients.map((c) => ({ value: c.id, label: c.name })),
    [clients],
  )

  const clientsRef = useRef(clients)
  clientsRef.current = clients

  const loadReport = useCallback(async () => {
    if (!clientId) {
      setDisplayRows([])
      setSummary({
        previousBalance: 0,
        totalSale: 0,
        totalPayment: 0,
        closingOutstanding: 0,
      })
      return
    }

    setLoading(true)
    const supabase = createClient()

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const [
        { data: priorInvoices, error: priorErr },
        { data: invoicesRaw, error: invErr },
        { data: clientInvoiceRows, error: idErr },
      ] = await Promise.all([
        supabase
          .from("invoices")
          .select("total_amount, amount_paid, issue_date, status")
          .eq("client_id", clientId)
          .lt("issue_date", monthStart)
          .neq("status", "cancelled"),
        supabase
          .from("invoices")
          .select(
            "id, invoice_number, issue_date, total_amount, status, invoice_items(line_total)",
          )
          .eq("client_id", clientId)
          .gte("issue_date", monthStart)
          .lte("issue_date", monthEnd)
          .neq("status", "cancelled")
          .order("issue_date", { ascending: true })
          .order("invoice_number", { ascending: true }),
        supabase.from("invoices").select("id").eq("client_id", clientId),
      ])

      if (priorErr) throw priorErr
      if (invErr) throw invErr
      if (idErr) throw idErr

      let previousBalance = 0
      for (const inv of priorInvoices || []) {
        const bal =
          Number(inv.total_amount || 0) - Number(inv.amount_paid || 0)
        if (bal > 0) previousBalance += bal
      }

      const invoiceIdList = (clientInvoiceRows || []).map((i) => i.id)

      let paymentsRaw: {
        payment_date: string
        amount: string | number | null
        status: string
        invoice_id: string
      }[] = []

      if (invoiceIdList.length > 0) {
        const { data: payData, error: payErr } = await supabase
          .from("payments")
          .select("payment_date, amount, status, invoice_id")
          .in("invoice_id", invoiceIdList)
          .gte("payment_date", monthStart)
          .lte("payment_date", monthEnd)

        if (payErr) throw payErr
        paymentsRaw = payData || []
      }

      const payments = paymentsRaw.filter(
        (p) => p.status !== "failed" && p.status !== "refunded",
      )

      type SaleAcc = {
        dateKey: string
        sortOrder: number
        invoiceNumber: string
        sale: number
      }

      const saleAccs: SaleAcc[] = []
      let order = 0

      const invoices = invoicesRaw || []
      for (const inv of invoices) {
        const items =
          (inv.invoice_items as {
            line_total: string | number | null
          }[]) || []

        if (items.length === 0) {
          const total = Number(inv.total_amount || 0)
          if (total > 0) {
            saleAccs.push({
              dateKey: inv.issue_date,
              sortOrder: order++,
              invoiceNumber: inv.invoice_number || "",
              sale: total,
            })
          }
          continue
        }

        for (const item of items) {
          saleAccs.push({
            dateKey: inv.issue_date,
            sortOrder: order++,
            invoiceNumber: inv.invoice_number || "",
            sale: Number(item.line_total || 0),
          })
        }
      }

      const paymentAccs = payments.map((p, idx) => ({
        dateKey: p.payment_date,
        sortOrder: 100000 + idx,
        payment: Number(p.amount || 0),
      }))

      const saleByDate = new Map<string, number>()
      for (const s of saleAccs) {
        saleByDate.set(s.dateKey, (saleByDate.get(s.dateKey) || 0) + s.sale)
      }

      type Merged =
        | ({ kind: "sale" } & SaleAcc)
        | {
            kind: "payment"
            dateKey: string
            sortOrder: number
            payment: number
          }

      const merged: Merged[] = [
        ...saleAccs.map((s) => ({ kind: "sale" as const, ...s })),
        ...paymentAccs.map((p) => ({ kind: "payment" as const, ...p })),
      ].sort((a, b) => {
        const c = a.dateKey.localeCompare(b.dateKey)
        if (c !== 0) return c
        return a.sortOrder - b.sortOrder
      })

      const lastSaleIndexByDate = new Map<string, number>()
      for (let i = merged.length - 1; i >= 0; i--) {
        const row = merged[i]
        if (row.kind === "sale" && !lastSaleIndexByDate.has(row.dateKey)) {
          lastSaleIndexByDate.set(row.dateKey, i)
        }
      }

      let running = previousBalance
      let totalSale = 0
      let totalPayment = 0

      const out: DisplayRow[] = []

      for (let i = 0; i < merged.length; i++) {
        const row = merged[i]
        if (row.kind === "sale") {
          totalSale += row.sale
          running += row.sale
          const showDayTotal = lastSaleIndexByDate.get(row.dateKey) === i
          const dayTot = showDayTotal ? saleByDate.get(row.dateKey) ?? null : null
          out.push({
            kind: "sale",
            dateKey: row.dateKey,
            sortOrder: row.sortOrder,
            invoiceNumber: row.invoiceNumber,
            sale: row.sale,
            payment: 0,
            dayTotal: dayTot,
            showDayTotal,
            outstanding: running,
          })
        } else {
          totalPayment += row.payment
          running -= row.payment
          out.push({
            kind: "payment",
            dateKey: row.dateKey,
            sortOrder: row.sortOrder,
            invoiceNumber: "",
            sale: 0,
            payment: row.payment,
            dayTotal: null,
            showDayTotal: false,
            outstanding: running,
          })
        }
      }

      const name =
        clientsRef.current.find((c) => c.id === clientId)?.name || ""
      setClientName(name)
      setDisplayRows(out)
      setSummary({
        previousBalance,
        totalSale,
        totalPayment,
        closingOutstanding: previousBalance + totalSale - totalPayment,
      })
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Failed to load report",
        description: e instanceof Error ? e.message : "Unknown error",
      })
      setDisplayRows([])
    } finally {
      setLoading(false)
    }
  }, [clientId, monthStart, monthEnd, toast])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  const handleExportCsv = () => {
    if (!clientId || displayRows.length === 0) {
      toast({
        variant: "destructive",
        title: "Nothing to export",
        description: "Select a client and ensure the report has rows.",
      })
      return
    }

    const columns: ExportColumn[] = [
      { key: "date", label: "Date" },
      { key: "invNum", label: "INV Num" },
      { key: "sale", label: "Sale" },
      { key: "dayTotal", label: "Day Total" },
      { key: "payment", label: "Payment" },
      { key: "outstanding", label: "Outstanding" },
    ]

    const data = displayRows.map((r) => ({
      date: formatStatementDate(r.dateKey),
      invNum: r.invoiceNumber,
      sale: r.sale > 0 ? fmtMoney(r.sale) : "",
      dayTotal:
        r.showDayTotal && r.dayTotal != null ? fmtMoney(r.dayTotal) : "",
      payment: r.payment > 0 ? fmtMoney(r.payment) : "",
      outstanding: fmtMoney(r.outstanding),
    }))

    data.push({
      date: "",
      invNum: "",
      sale: "",
      dayTotal: "",
      payment: "",
      outstanding: "",
    })
    data.push({
      date: "Previous Month Balance",
      invNum: "",
      sale: "",
      dayTotal: "",
      payment: "",
      outstanding: fmtMoney(summary.previousBalance),
    })
    data.push({
      date: "Total Sale",
      invNum: "",
      sale: fmtMoney(summary.totalSale),
      dayTotal: "",
      payment: "",
      outstanding: "",
    })
    data.push({
      date: "Total Payment",
      invNum: "",
      sale: "",
      dayTotal: "",
      payment: fmtMoney(summary.totalPayment),
      outstanding: "",
    })
    data.push({
      date: "Outstanding on date of Statement",
      invNum: "",
      sale: "",
      dayTotal: "",
      payment: "",
      outstanding: fmtMoney(summary.closingOutstanding),
    })

    const safeName = clientName.replace(/\s+/g, "-").toLowerCase()
    exportToCSV(
      data,
      columns,
      `monthly-report-${safeName}-${reportYear}-${String(reportMonth).padStart(2, "0")}.csv`,
    )
    toast({ variant: "success", title: "Exported", description: "CSV downloaded." })
  }

  const handleExportPdf = async () => {
    if (!clientId || displayRows.length === 0) {
      toast({
        variant: "destructive",
        title: "Nothing to export",
        description: "Select a client and ensure the report has rows.",
      })
      return
    }

    setExporting(true)
    try {
      const { jsPDF } = await import("jspdf")
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      })

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 8
      const tableWidth = pageWidth - margin * 2
      const right = pageWidth - margin

      const cols = [
        tableWidth * 0.14,
        tableWidth * 0.16,
        tableWidth * 0.14,
        tableWidth * 0.14,
        tableWidth * 0.14,
        tableWidth * 0.14,
      ]

      let x0 = margin
      const colX = cols.map((w) => {
        const start = x0
        x0 += w
        return start
      })

      let y = margin
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(12)
      pdf.text("Monthly Sales Statement", margin, y)
      y += 5
      pdf.setFontSize(10)
      pdf.text(clientName, margin, y)
      y += 4
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(8)
      pdf.text(`Period: ${monthLabel}`, margin, y)
      y += 6

      const headerH = 6
      const rowH = 4.8

      const drawHeader = () => {
        pdf.setFillColor(246, 248, 250)
        pdf.rect(margin, y - 4, tableWidth, headerH, "F")
        pdf.setDrawColor(180, 180, 180)
        pdf.rect(margin, y - 4, tableWidth, headerH)
        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(7)
        const labels = [
          "Date",
          "INV Num",
          "Sale",
          "Day Total",
          "Payment",
          "Outstanding",
        ]
        labels.forEach((lab, i) => {
          const align =
            i >= 2 ? ("right" as const) : ("left" as const)
          const textX =
            align === "right" ? colX[i] + cols[i] - 1 : colX[i] + 1
          pdf.text(lab, textX, y, { align })
        })
        y += headerH - 1
      }

      drawHeader()
      pdf.setFont("helvetica", "normal")

      for (const r of displayRows) {
        if (y > pageHeight - margin - 18) {
          pdf.addPage()
          y = margin + 6
          drawHeader()
          pdf.setFont("helvetica", "normal")
        }

        pdf.setFontSize(7)
        pdf.text(formatStatementDate(r.dateKey), colX[0] + 1, y)
        pdf.text(r.invoiceNumber, colX[1] + 1, y)
        pdf.text(
          r.sale > 0 ? fmtMoney(r.sale) : "",
          colX[2] + cols[2] - 1,
          y,
          { align: "right" },
        )
        pdf.text(
          r.showDayTotal && r.dayTotal != null ? fmtMoney(r.dayTotal) : "",
          colX[3] + cols[3] - 1,
          y,
          { align: "right" },
        )
        pdf.text(
          r.payment > 0 ? fmtMoney(r.payment) : "",
          colX[4] + cols[4] - 1,
          y,
          { align: "right" },
        )
        pdf.text(fmtMoney(r.outstanding), colX[5] + cols[5] - 1, y, {
          align: "right",
        })

        pdf.setDrawColor(235, 235, 235)
        pdf.line(margin, y + 1.5, right, y + 1.5)
        y += rowH
      }

      y += 4
      if (y > pageHeight - margin - 28) {
        pdf.addPage()
        y = margin + 6
      }

      pdf.setDrawColor(80, 80, 80)
      pdf.setLineWidth(0.35)
      pdf.line(margin, y, right, y)
      y += 6

      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(8)
      const summaryLines: [string, string][] = [
        ["Previous Month Balance", fmtMoney(summary.previousBalance)],
        ["Total Sale", fmtMoney(summary.totalSale)],
        ["Total Payment", fmtMoney(summary.totalPayment)],
        ["Outstanding on date of Statement", fmtMoney(summary.closingOutstanding)],
      ]
      for (const [lab, val] of summaryLines) {
        pdf.text(lab, margin, y)
        pdf.text(val, right, y, { align: "right" })
        y += 5
      }

      const safeName = clientName.replace(/\s+/g, "-").toLowerCase()
      pdf.save(
        `monthly-report-${safeName}-${reportYear}-${String(reportMonth).padStart(2, "0")}.pdf`,
      )
      toast({
        variant: "success",
        title: "Exported",
        description: "PDF downloaded.",
      })
    } catch (e) {
      toast({
        variant: "destructive",
        title: "PDF failed",
        description: e instanceof Error ? e.message : "Could not generate PDF.",
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="space-y-2 max-w-md w-full">
          <label className="text-sm font-medium">Client</label>
          <SearchableSelect
            value={clientId}
            onValueChange={setClientId}
            options={clientOptions}
            placeholder="Select client…"
            searchPlaceholder="Search clients…"
            triggerClassName="w-full"
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!clientId || displayRows.length === 0 || loading}
            onClick={handleExportCsv}
          >
            <FileDown className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">CSV</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={
              !clientId || displayRows.length === 0 || loading || exporting
            }
            onClick={handleExportPdf}
          >
            <FileText className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">
              {exporting ? "PDF…" : "PDF"}
            </span>
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Amounts follow invoice line totals; outstanding runs from the previous
        month closing balance.
      </p>

      <div className="rounded-lg border bg-white overflow-x-auto">
        <Table className="text-xs sm:text-sm min-w-[640px]">
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Date</TableHead>
              <TableHead className="whitespace-nowrap">INV Num</TableHead>
              <TableHead className="text-right whitespace-nowrap">Sale</TableHead>
              <TableHead className="text-right whitespace-nowrap">
                Day Total
              </TableHead>
              <TableHead className="text-right whitespace-nowrap">
                Payment
              </TableHead>
              <TableHead className="text-right whitespace-nowrap">
                Outstanding
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-12"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : !clientId ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-12"
                >
                  Select a client to view the monthly report.
                </TableCell>
              </TableRow>
            ) : displayRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-12"
                >
                  No invoice lines or payments for {monthLabel}.
                </TableCell>
              </TableRow>
            ) : (
              displayRows.map((r, idx) => (
                <TableRow key={`${r.kind}-${r.dateKey}-${r.sortOrder}-${idx}`}>
                  <TableCell className="whitespace-nowrap">
                    {formatStatementDate(r.dateKey)}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] sm:text-xs">
                    {r.invoiceNumber}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.sale > 0 ? `₹${fmtMoney(r.sale)}` : ""}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {r.showDayTotal && r.dayTotal != null
                      ? `₹${fmtMoney(r.dayTotal)}`
                      : ""}
                  </TableCell>
                  <TableCell className="text-right text-green-700">
                    {r.payment > 0 ? `₹${fmtMoney(r.payment)}` : ""}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-orange-800">
                    ₹{fmtMoney(r.outstanding)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {clientId && displayRows.length > 0 && (
        <div className="rounded-lg border bg-muted/40 p-4 max-w-md space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Previous Month Balance</span>
            <span className="font-medium">₹{fmtMoney(summary.previousBalance)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Total Sale</span>
            <span className="font-medium">₹{fmtMoney(summary.totalSale)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Total Payment</span>
            <span className="font-medium text-green-700">
              ₹{fmtMoney(summary.totalPayment)}
            </span>
          </div>
          <div className="flex justify-between gap-4 border-t pt-2 mt-2 font-semibold">
            <span>Outstanding on date of Statement</span>
            <span className="text-orange-800">
              ₹{fmtMoney(summary.closingOutstanding)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
