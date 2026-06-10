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
import {
  buildPdfColumnLayout,
  drawPdfCellCentered,
  measurePdfTextBlockHeight,
  wrapInvoiceListForPdf,
  type PdfColumnDef,
} from "@/lib/pdf-invoice-wrap"
import {
  buildDisplayLedgerRows,
  buildLedgerTransactions,
  resolveDisplayRange,
  type DisplayLedgerRow,
} from "@/lib/ledger-report"
import { FileDown, FileText } from "lucide-react"
import { formatIndianStatementDate } from "@/lib/date-time"
import { IconTooltip } from "@/components/icon-tooltip"

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
  return formatIndianStatementDate(isoDate)
}

const fmtMoney = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function formatPeriodLabel(
  monthLabel: string,
  rangeStart: string,
  rangeEnd: string,
  fromDate: string,
  toDate: string,
): string {
  if (!fromDate && !toDate) return monthLabel
  return `${formatStatementDate(rangeStart)} to ${formatStatementDate(rangeEnd)}`
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
  const [displayRows, setDisplayRows] = useState<DisplayLedgerRow[]>([])
  const [clientName, setClientName] = useState("")
  const [summary, setSummary] = useState({
    previousBalance: 0,
    totalSale: 0,
    totalPayment: 0,
    closingOutstanding: 0,
  })
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  const { rangeStart, rangeEnd } = resolveDisplayRange(
    monthStart,
    monthEnd,
    fromDate,
    toDate,
  )
  const periodLabel = formatPeriodLabel(
    monthLabel,
    rangeStart,
    rangeEnd,
    fromDate,
    toDate,
  )

  const clientOptions = useMemo(
    () => clients.map((c) => ({ value: c.id, label: c.name })),
    [clients],
  )

  const clientsRef = useRef(clients)
  clientsRef.current = clients

  useEffect(() => {
    setFromDate("")
    setToDate("")
  }, [monthStart, monthEnd])

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

    if (fromDate && toDate && fromDate > toDate) {
      toast({
        variant: "destructive",
        title: "Invalid date range",
        description: "From date must be on or before To date.",
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

      const { data: invoicesRaw, error: invErr } = await supabase
        .from("invoices")
        .select("id, invoice_number, issue_date, total_amount, status")
        .eq("client_id", clientId)
        .neq("status", "cancelled")
        .order("issue_date", { ascending: true })
        .order("invoice_number", { ascending: true })

      if (invErr) throw invErr

      const payments: Array<{
        payment_date: string
        amount: string | number | null
        status: string
        invoices: { invoice_number: string } | { invoice_number: string }[] | null
      }> = []
      const paymentPageSize = 1000
      let paymentFrom = 0

      while (true) {
        const { data: paymentBatch, error: payErr } = await supabase
          .from("payments")
          .select(
            "payment_date, amount, status, invoice_id, invoices!inner(invoice_number, client_id)",
          )
          .eq("invoices.client_id", clientId)
          .order("payment_date", { ascending: true })
          .range(paymentFrom, paymentFrom + paymentPageSize - 1)

        if (payErr) throw payErr

        const batch = paymentBatch || []
        payments.push(...batch)
        if (batch.length < paymentPageSize) break
        paymentFrom += paymentPageSize
      }

      const transactions = buildLedgerTransactions(
        invoicesRaw || [],
        payments,
      )
      const { rangeStart: effectiveStart, rangeEnd: effectiveEnd } =
        resolveDisplayRange(monthStart, monthEnd, fromDate, toDate)

      const { rows, summary } = buildDisplayLedgerRows(transactions, {
        rangeStart: effectiveStart,
        rangeEnd: effectiveEnd,
      })

      const name =
        clientsRef.current.find((c) => c.id === clientId)?.name || ""
      setClientName(name)
      setDisplayRows(rows)
      setSummary(summary)
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
  }, [clientId, monthStart, monthEnd, fromDate, toDate, toast])

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
      date: r.showDate ? formatStatementDate(r.dateKey) : "",
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
    const rangeSuffix =
      fromDate || toDate
        ? `${rangeStart}_to_${rangeEnd}`
        : `${reportYear}-${String(reportMonth).padStart(2, "0")}`
    exportToCSV(
      data,
      columns,
      `monthly-report-${safeName}-${rangeSuffix}.csv`,
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
      const margin = 10
      const tableWidth = pageWidth - margin * 2
      const rightEdge = pageWidth - margin
      const cellPad = 2
      const rowPadY = 2.5
      const bodyFontSize = 7
      const headerH = 8

      const columns: PdfColumnDef[] = [
        { id: "date", label: "Date", widthFrac: 0.11, align: "left" },
        { id: "invoice", label: "INV Num", widthFrac: 0.30, align: "left" },
        { id: "sale", label: "Sale", widthFrac: 0.12, align: "right" },
        { id: "dayTotal", label: "Day Total", widthFrac: 0.12, align: "right" },
        { id: "payment", label: "Payment", widthFrac: 0.12, align: "right" },
        { id: "outstanding", label: "Outstanding", widthFrac: 0.23, align: "right" },
      ]

      const colLayout = buildPdfColumnLayout(columns, margin, tableWidth, cellPad)
      const colById = Object.fromEntries(colLayout.map((c) => [c.id, c]))
      const invoiceCol = colById.invoice

      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(bodyFontSize)
      const singleLineH = pdf.getTextDimensions("Xy").h

      const drawRight = (text: string, colId: string, yPos: number) => {
        pdf.text(text, colById[colId].textX, yPos, {
          align: "right",
          baseline: "top",
        })
      }

      const drawLeft = (text: string, colId: string, yPos: number) => {
        pdf.text(text, colById[colId].textX, yPos, { baseline: "top" })
      }

      let y = margin
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(14)
      pdf.text("Monthly Sales Statement", margin, y)
      y += 6
      pdf.setFontSize(10)
      const clientNameLines = pdf.splitTextToSize(clientName, tableWidth)
      pdf.text(clientNameLines, margin, y)
      y += clientNameLines.length * 4 + 1
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(8)
      pdf.text(`Period: ${periodLabel}`, margin, y)
      y += 7

      const drawHeader = () => {
        const headerTop = y
        const headerTextY = headerTop + rowPadY
        pdf.setDrawColor(180, 180, 180)
        pdf.setLineWidth(0.25)
        pdf.setFillColor(246, 248, 250)
        pdf.rect(margin, headerTop, tableWidth, headerH, "F")
        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(8)

        for (const col of colLayout) {
          if (col.id === "dayTotal") {
            pdf.text(col.label, col.x + col.width / 2, headerTextY, {
              align: "center",
              baseline: "top",
            })
          } else if (col.align === "right") {
            pdf.text(col.label, col.textX, headerTextY, {
              align: "right",
              baseline: "top",
            })
          } else {
            pdf.text(col.label, col.textX, headerTextY, { baseline: "top" })
          }
          if (col.x > margin) {
            pdf.line(col.x, headerTop, col.x, headerTop + headerH)
          }
        }

        pdf.rect(margin, headerTop, tableWidth, headerH)
        y = headerTop + headerH
      }

      drawHeader()

      const rowHeights: number[] = []
      for (const r of displayRows) {
        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(bodyFontSize)
        const invoiceLines = wrapInvoiceListForPdf(
          pdf,
          r.invoiceNumber,
          invoiceCol.textMaxW,
        )
        const invoiceBlockH = measurePdfTextBlockHeight(
          pdf,
          invoiceLines,
          singleLineH,
        )
        const contentH = Math.max(singleLineH, invoiceBlockH)
        rowHeights.push(rowPadY + contentH + rowPadY)
      }

      for (let idx = 0; idx < displayRows.length; idx++) {
        const r = displayRows[idx]
        const dynamicRowH = rowHeights[idx]

        if (y + dynamicRowH > pageHeight - margin - 14) {
          pdf.addPage()
          y = margin + 4
          drawHeader()
          pdf.setFont("helvetica", "normal")
          pdf.setFontSize(bodyFontSize)
        }

        const rowTop = y
        const textTop = rowTop + rowPadY

        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(bodyFontSize)

        const invoiceLines = wrapInvoiceListForPdf(
          pdf,
          r.invoiceNumber,
          invoiceCol.textMaxW,
        )

        if (r.showDate) {
          drawLeft(formatStatementDate(r.dateKey), "date", textTop)
        }

        pdf.text(invoiceLines.join("\n"), invoiceCol.textX, textTop, {
          baseline: "top",
          lineHeightFactor: 1.25,
        })
        drawRight(r.sale > 0 ? fmtMoney(r.sale) : "", "sale", textTop)

        if (r.showDayTotal && r.dayTotal != null) {
          let saleBlockH = 0
          for (let k = idx; k < idx + r.dayTotalRowSpan; k++) {
            saleBlockH += rowHeights[k]
          }
          const dayCol = colById.dayTotal
          drawPdfCellCentered(
            pdf,
            fmtMoney(r.dayTotal),
            dayCol.x,
            dayCol.width,
            rowTop,
            saleBlockH,
          )
        }

        drawRight(r.payment > 0 ? fmtMoney(r.payment) : "", "payment", textTop)
        drawRight(fmtMoney(r.outstanding), "outstanding", textTop)

        const rowBottom = rowTop + dynamicRowH
        pdf.setDrawColor(235, 235, 235)
        pdf.line(margin, rowBottom, rightEdge, rowBottom)
        y = rowBottom
      }

      if (y > pageHeight - margin - 28) {
        pdf.addPage()
        y = margin + 4
        drawHeader()
      }

      y += rowPadY
      pdf.setDrawColor(80, 80, 80)
      pdf.setLineWidth(0.4)
      pdf.line(margin, y, rightEdge, y)
      y += rowPadY + 1

      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(8)
      const summaryLines: [string, string][] = [
        ["Previous Month Balance", fmtMoney(summary.previousBalance)],
        ["Total Sale", fmtMoney(summary.totalSale)],
        ["Total Payment", fmtMoney(summary.totalPayment)],
        [
          "Outstanding on date of Statement",
          fmtMoney(summary.closingOutstanding),
        ],
      ]
      for (const [lab, val] of summaryLines) {
        pdf.text(lab, margin, y)
        pdf.text(val, rightEdge, y, { align: "right" })
        y += 5
      }

      const safeName = clientName.replace(/\s+/g, "-").toLowerCase()
      const rangeSuffix =
        fromDate || toDate
          ? `${rangeStart}_to_${rangeEnd}`
          : `${reportYear}-${String(reportMonth).padStart(2, "0")}`
      pdf.save(`monthly-report-${safeName}-${rangeSuffix}.pdf`)
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
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="space-y-2 max-w-md w-full sm:w-64">
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
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                From
              </label>
              <input
                type="date"
                className="flex h-9 w-full min-w-[140px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                value={fromDate}
                min={monthStart}
                max={toDate || monthEnd}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                To
              </label>
              <input
                type="date"
                className="flex h-9 w-full min-w-[140px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                value={toDate}
                min={fromDate || monthStart}
                max={monthEnd}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>
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
          <IconTooltip label={exporting ? "Exporting PDF…" : "Export PDF"}>
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
          </IconTooltip>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Period: <span className="font-medium text-foreground">{periodLabel}</span>.
        Same ledger as the statement of account (invoices add, payments reduce).
        Opening balance is before the period start; rows are sorted by date then
        invoice number. Use From/To to narrow within the selected month.
      </p>

      <div className="rounded-lg border bg-white overflow-x-auto">
        <Table className="w-full min-w-[720px] table-fixed text-xs sm:text-sm">
          <colgroup>
            <col className="w-[11%]" />
            <col className="w-[30%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[23%]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead className="px-3 py-2.5 whitespace-nowrap align-bottom">
                Date
              </TableHead>
              <TableHead className="px-3 py-2.5 align-bottom">INV Num</TableHead>
              <TableHead className="px-3 py-2.5 text-right whitespace-nowrap align-bottom">
                Sale
              </TableHead>
              <TableHead className="px-3 py-2.5 text-right whitespace-nowrap align-bottom">
                Day Total
              </TableHead>
              <TableHead className="px-3 py-2.5 text-right whitespace-nowrap align-bottom">
                Payment
              </TableHead>
              <TableHead className="px-3 py-2.5 text-right whitespace-nowrap align-bottom">
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
                  No invoices or payments for {periodLabel}.
                </TableCell>
              </TableRow>
            ) : (
              displayRows.map((r, idx) => (
                <TableRow key={`${r.kind}-${r.dateKey}-${r.invoiceNumber}-${idx}`}>
                  {r.showDate && (
                    <TableCell
                      rowSpan={r.dateRowSpan}
                      className="px-3 py-2.5 whitespace-nowrap align-top text-muted-foreground bg-muted/30 border-r"
                    >
                      {formatStatementDate(r.dateKey)}
                    </TableCell>
                  )}
                  <TableCell className="px-3 py-2.5 min-w-0 align-top font-mono text-[11px] sm:text-xs leading-relaxed break-words [overflow-wrap:anywhere]">
                    {r.invoiceNumber || "—"}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-right align-top tabular-nums">
                    {r.sale > 0 ? `₹${fmtMoney(r.sale)}` : ""}
                  </TableCell>
                  {r.showDayTotal && (
                    <TableCell
                      rowSpan={r.dayTotalRowSpan}
                      className="px-3 py-2.5 text-right align-middle font-medium tabular-nums bg-amber-50/60 border-l border-r"
                    >
                      {r.dayTotal != null ? `₹${fmtMoney(r.dayTotal)}` : ""}
                    </TableCell>
                  )}
                  {!r.showDayTotal &&
                    (r.kind === "payment" || r.dayTotalRowSpan === 0) && (
                      <TableCell className="px-3 py-2.5 text-right align-top bg-amber-50/60 border-l border-r" />
                    )}
                  <TableCell className="px-3 py-2.5 text-right align-top text-green-700 tabular-nums">
                    {r.payment > 0 ? `₹${fmtMoney(r.payment)}` : ""}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-right align-top font-semibold text-orange-800 tabular-nums">
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
