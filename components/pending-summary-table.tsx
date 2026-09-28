"use client"

import { useState, useMemo } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, ArrowUp, ArrowDown, Download, FileText } from "lucide-react"
import { IconTooltip } from "@/components/icon-tooltip"
import { useToast } from "@/hooks/use-toast"
import {
  exportToCSV,
  exportToPDF,
  type ExportColumn,
  getTimestamp,
} from "@/lib/export-utils"

type ClientRow = {
  id: string
  name: string
  sale: number
  payments: number
  outstanding: number
  oldBal: number
}

interface PendingSummaryTableProps {
  rows: ClientRow[]
  periodLabel: string
}

export function PendingSummaryTable({
  rows,
  periodLabel,
}: PendingSummaryTableProps) {
  const { toast } = useToast()
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [filter, setFilter] = useState("")

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column)
      return <ArrowUpDown className="ml-2 h-4 w-4 inline opacity-40" />
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4 inline" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4 inline" />
    )
  }

  const processedRows = useMemo(() => {
    let filtered = [...rows]

    if (filter) {
      filtered = filtered.filter((r) =>
        r.name.toLowerCase().includes(filter.toLowerCase()),
      )
    }

    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal: number | string
        let bVal: number | string

        switch (sortColumn) {
          case "name":
            aVal = a.name.toLowerCase()
            bVal = b.name.toLowerCase()
            break
          case "oldBal":
            aVal = a.oldBal
            bVal = b.oldBal
            break
          case "sale":
            aVal = a.sale
            bVal = b.sale
            break
          case "payments":
            aVal = a.payments
            bVal = b.payments
            break
          case "outstanding":
            aVal = a.outstanding
            bVal = b.outstanding
            break
          default:
            return 0
        }

        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1
        return 0
      })
    }

    return filtered
  }, [rows, filter, sortColumn, sortDirection])

  const totals = useMemo(
    () =>
      processedRows.reduce(
        (acc, r) => ({
          oldBal: acc.oldBal + r.oldBal,
          sale: acc.sale + r.sale,
          payments: acc.payments + r.payments,
          outstanding: acc.outstanding + r.outstanding,
        }),
        { oldBal: 0, sale: 0, payments: 0, outstanding: 0 },
      ),
    [processedRows],
  )

  const fmt = (n: number) =>
    n.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

  const fmtCurrency = (n: number) => {
    if (Math.abs(n) < 0.005) return "—"
    if (n < 0) return `-₹${fmt(Math.abs(n))}`
    return `₹${fmt(n)}`
  }

  const fmtTotalCurrency = (n: number) => {
    if (n < 0) return `-₹${fmt(Math.abs(n))}`
    return `₹${fmt(n)}`
  }

  const handleExportCSV = () => {
    const columns: ExportColumn[] = [
      { key: "name", label: "Client" },
      {
        key: "oldBal",
        label: "Old Balance",
        formatter: (v) => Number(v || 0).toFixed(2),
      },
      {
        key: "sale",
        label: "Sale",
        formatter: (v) => Number(v || 0).toFixed(2),
      },
      {
        key: "payments",
        label: "Payments",
        formatter: (v) => Number(v || 0).toFixed(2),
      },
      {
        key: "outstanding",
        label: "Pending Amount",
        formatter: (v) => Number(v || 0).toFixed(2),
      },
    ]
    exportToCSV(
      processedRows,
      columns,
      `pending-summary-${getTimestamp()}.csv`,
    )
    toast({
      variant: "success",
      title: "Exported",
      description: `${processedRows.length} row(s) exported to CSV.`,
    })
  }

  const handleExportPDF = async () => {
    const exportRows = processedRows.map((row) => ({
      ...row,
      oldBalFmt: `Rs.${fmt(row.oldBal)}`,
      saleFmt: `Rs.${fmt(row.sale)}`,
      paymentsFmt: `Rs.${fmt(row.payments)}`,
      outstandingFmt: `Rs.${fmt(row.outstanding)}`,
    }))

    const columns: ExportColumn[] = [
      { key: "name", label: "Client", widthFrac: 0.34 },
      { key: "oldBalFmt", label: "Old Balance", widthFrac: 0.165, align: "right" },
      { key: "saleFmt", label: "Sale", widthFrac: 0.165, align: "right" },
      { key: "paymentsFmt", label: "Payments", widthFrac: 0.165, align: "right" },
      { key: "outstandingFmt", label: "Pending Amount", widthFrac: 0.165, align: "right" },
    ]

    await exportToPDF(
      exportRows,
      columns,
      `Pending Summary — ${periodLabel}`,
      `pending-summary-${getTimestamp()}.pdf`,
    )
    toast({
      variant: "success",
      title: "Exported",
      description: `${processedRows.length} row(s) exported to PDF.`,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <IconTooltip label="Export to CSV">
          <Button
            onClick={handleExportCSV}
            size="sm"
            variant="outline"
            disabled={processedRows.length === 0}
          >
            <Download className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">CSV</span>
          </Button>
        </IconTooltip>
        <IconTooltip label="Export to PDF">
          <Button
            onClick={handleExportPDF}
            size="sm"
            variant="outline"
            disabled={processedRows.length === 0}
          >
            <FileText className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">PDF</span>
          </Button>
        </IconTooltip>
      </div>

      <div className="rounded-lg border bg-white overflow-x-auto">
        <Table className="text-xs sm:text-sm min-w-[700px]">
          <TableHeader>
            {/* Sortable column headers */}
            <TableRow>
              <TableHead
                className="sticky left-0 z-20 bg-white border-r px-2 sm:px-4 py-2 sm:py-3 cursor-pointer hover:bg-muted/50 min-w-[200px] w-[200px]"
                onClick={() => handleSort("name")}
              >
                Client <SortIcon column="name" />
              </TableHead>
              <TableHead
                className="text-right px-2 sm:px-4 py-2 sm:py-3 cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("oldBal")}
              >
                Old Balance <SortIcon column="oldBal" />
              </TableHead>
              <TableHead
                className="text-right px-2 sm:px-4 py-2 sm:py-3 cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("sale")}
              >
                Sale <SortIcon column="sale" />
              </TableHead>
              <TableHead
                className="text-right px-2 sm:px-4 py-2 sm:py-3 cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("payments")}
              >
                Payments <SortIcon column="payments" />
              </TableHead>
              <TableHead
                className="text-right px-2 sm:px-4 py-2 sm:py-3 cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("outstanding")}
              >
                Pending Amount <SortIcon column="outstanding" />
              </TableHead>
            </TableRow>

            {/* Sub-header / filter row */}
            <TableRow>
              <TableHead className="sticky left-0 z-20 bg-white border-r px-2 sm:px-4 py-1.5 min-w-[200px] w-[200px]">
                <Input
                  placeholder="Filter clients…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="h-7 text-xs font-normal"
                />
              </TableHead>
              <TableHead className="text-right px-2 sm:px-4 py-1.5 font-normal text-muted-foreground text-xs">
                Unpaid before period
              </TableHead>
              <TableHead className="text-right px-2 sm:px-4 py-1.5 font-normal text-muted-foreground text-xs">
                Period sales
              </TableHead>
              <TableHead className="text-right px-2 sm:px-4 py-1.5 font-normal text-muted-foreground text-xs">
                Period payments
              </TableHead>
              <TableHead className="text-right px-2 sm:px-4 py-1.5 font-normal text-muted-foreground text-xs">
                Total due as of end date
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {processedRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground py-16 px-2 sm:px-4"
                >
                  {filter
                    ? `No clients matching "${filter}".`
                    : `No activity found for ${periodLabel}.`}
                </TableCell>
              </TableRow>
            ) : (
              processedRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="sticky left-0 z-10 bg-white border-r font-medium px-2 sm:px-4 py-2 sm:py-3 min-w-[200px] w-[200px] whitespace-nowrap">
                    {row.name}
                  </TableCell>
                  <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3">
                    {fmtCurrency(row.oldBal)}
                  </TableCell>
                  <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3">
                    {row.sale > 0 ? `₹${fmt(row.sale)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3 text-green-700">
                    {row.payments > 0 ? `₹${fmt(row.payments)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3 font-bold text-orange-700">
                    {fmtCurrency(row.outstanding)}
                  </TableCell>
                </TableRow>
              ))
            )}

            {processedRows.length > 0 && (
              <TableRow className="border-t-2 font-bold bg-muted">
                <TableCell className="sticky left-0 z-30 bg-muted border-r px-2 sm:px-4 py-2 sm:py-3 min-w-[200px] w-[200px] whitespace-nowrap">
                  Total
                </TableCell>
                <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3">
                  {fmtTotalCurrency(totals.oldBal)}
                </TableCell>
                <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3">
                  ₹{fmt(totals.sale)}
                </TableCell>
                <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3 text-green-700">
                  ₹{fmt(totals.payments)}
                </TableCell>
                <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3 text-orange-700">
                  {fmtTotalCurrency(totals.outstanding)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
