"use client"

import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, Download, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TablePagination } from "@/components/table-pagination"
import { usePagination } from "@/hooks/use-pagination"
import { useToast } from "@/hooks/use-toast"
import { exportToCSV, exportToPDF, ExportColumn, getTimestamp } from "@/lib/export-utils"

type ProductRow = {
  id: string
  name: string
  currentMonthSaleValue: number
  todaySaleQty: number
  todaySaleValue: number
  totalSaleKgs: number
  avgQtyPerDay: number
}

interface ProductReportsTableProps {
  rows: ProductRow[]
  daysInMonth: number
  monthLabel: string
}

export function ProductReportsTable({ rows, daysInMonth, monthLabel }: ProductReportsTableProps) {
  const { toast } = useToast()
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [productFilter, setProductFilter] = useState("")

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-2 inline h-4 w-4 opacity-40" />
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-2 inline h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 inline h-4 w-4" />
    )
  }

  const processedRows = useMemo(() => {
    let filtered = [...rows]
    if (productFilter) {
      filtered = filtered.filter((r) =>
        r.name.toLowerCase().includes(productFilter.toLowerCase()),
      )
    }

    if (!sortColumn) return filtered

    filtered.sort((a, b) => {
      let aVal: string | number = 0
      let bVal: string | number = 0

      switch (sortColumn) {
        case "product":
          aVal = a.name.toLowerCase()
          bVal = b.name.toLowerCase()
          break
        case "currentMonthSaleValue":
          aVal = a.currentMonthSaleValue
          bVal = b.currentMonthSaleValue
          break
        case "todaySaleQty":
          aVal = a.todaySaleQty
          bVal = b.todaySaleQty
          break
        case "todaySaleValue":
          aVal = a.todaySaleValue
          bVal = b.todaySaleValue
          break
        case "totalSaleKgs":
          aVal = a.totalSaleKgs
          bVal = b.totalSaleKgs
          break
        case "avgQtyPerDay":
          aVal = a.avgQtyPerDay
          bVal = b.avgQtyPerDay
          break
        default:
          return 0
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1
      return 0
    })

    return filtered
  }, [rows, productFilter, sortColumn, sortDirection])

  const pagination = usePagination({ items: processedRows, itemsPerPage })

  const totals = useMemo(
    () =>
      processedRows.reduce(
        (acc, row) => ({
          currentMonthSaleValue: acc.currentMonthSaleValue + row.currentMonthSaleValue,
          todaySaleQty: acc.todaySaleQty + row.todaySaleQty,
          todaySaleValue: acc.todaySaleValue + row.todaySaleValue,
          totalSaleKgs: acc.totalSaleKgs + row.totalSaleKgs,
        }),
        {
          currentMonthSaleValue: 0,
          todaySaleQty: 0,
          todaySaleValue: 0,
          totalSaleKgs: 0,
        },
      ),
    [processedRows],
  )

  const fmt = (n: number) =>
    n.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

  const handleExportCSV = () => {
    const columns: ExportColumn[] = [
      { key: "name", label: "Product" },
      {
        key: "currentMonthSaleValue",
        label: "Current Month Sale - Value",
        formatter: (value) => Number(value || 0).toFixed(2),
      },
      {
        key: "todaySaleQty",
        label: "Today's Sale - Qty",
        formatter: (value) => Number(value || 0).toFixed(2),
      },
      {
        key: "todaySaleValue",
        label: "Today's Sale - Value",
        formatter: (value) => Number(value || 0).toFixed(2),
      },
      {
        key: "totalSaleKgs",
        label: "Total Sale in KGs",
        formatter: (value) => Number(value || 0).toFixed(2),
      },
      {
        key: "avgQtyPerDay",
        label: "Average Quantity per Day",
        formatter: (value) => Number(value || 0).toFixed(2),
      },
    ]

    exportToCSV(processedRows, columns, `reports-products-${getTimestamp()}.csv`)
    toast({
      variant: "success",
      title: "Exported",
      description: `${processedRows.length} product report row(s) exported to CSV successfully.`,
    })
  }

  const handleExportPDF = async () => {
    const exportRows = processedRows.map((row) => ({
      ...row,
      currentMonthSaleValueFmt: `Rs.${fmt(row.currentMonthSaleValue)}`,
      todaySaleQtyFmt: row.todaySaleQty.toFixed(2),
      todaySaleValueFmt: `Rs.${fmt(row.todaySaleValue)}`,
      totalSaleKgsFmt: row.totalSaleKgs.toFixed(2),
      avgQtyPerDayFmt: row.avgQtyPerDay.toFixed(2),
    }))

    const columns: ExportColumn[] = [
      { key: "name", label: "Product" },
      { key: "currentMonthSaleValueFmt", label: "Current Month Sale - Value" },
      { key: "todaySaleQtyFmt", label: "Today's Sale - Qty" },
      { key: "todaySaleValueFmt", label: "Today's Sale - Value" },
      { key: "totalSaleKgsFmt", label: "Total Sale in KGs" },
      { key: "avgQtyPerDayFmt", label: "Average Quantity per Day" },
    ]

    await exportToPDF(
      exportRows,
      columns,
      `Product Report (${monthLabel})`,
      `reports-products-${getTimestamp()}.pdf`,
    )
    toast({
      variant: "success",
      title: "Exported",
      description: `${processedRows.length} product report row(s) exported to PDF successfully.`,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button
          onClick={handleExportCSV}
          size="sm"
          variant="outline"
          disabled={processedRows.length === 0}
        >
          <Download className="h-4 w-4" />
          <span className="ml-2 hidden sm:inline">CSV</span>
        </Button>
        <Button
          onClick={handleExportPDF}
          size="sm"
          variant="outline"
          disabled={processedRows.length === 0}
        >
          <FileText className="h-4 w-4" />
          <span className="ml-2 hidden sm:inline">PDF</span>
        </Button>
      </div>

      <div className="rounded-lg border bg-white overflow-x-auto">
        <Table className="min-w-[980px] text-xs sm:text-sm">
          <TableHeader>
            <TableRow>
              <TableHead
                className="sticky left-0 z-20 min-w-[220px] border-r bg-white px-2 py-2 hover:bg-muted/50 sm:px-4 sm:py-3"
                onClick={() => handleSort("product")}
              >
                <span className="cursor-pointer">
                  Product <SortIcon column="product" />
                </span>
              </TableHead>
              <TableHead
                className="cursor-pointer px-2 py-2 text-right hover:bg-muted/50 sm:px-4 sm:py-3"
                onClick={() => handleSort("currentMonthSaleValue")}
              >
                Current Month Sale - Value <SortIcon column="currentMonthSaleValue" />
              </TableHead>
              <TableHead
                className="cursor-pointer px-2 py-2 text-right hover:bg-muted/50 sm:px-4 sm:py-3"
                onClick={() => handleSort("todaySaleQty")}
              >
                Today's Sale - Qty <SortIcon column="todaySaleQty" />
              </TableHead>
              <TableHead
                className="cursor-pointer px-2 py-2 text-right hover:bg-muted/50 sm:px-4 sm:py-3"
                onClick={() => handleSort("todaySaleValue")}
              >
                Today's Sale - Value <SortIcon column="todaySaleValue" />
              </TableHead>
              <TableHead
                className="cursor-pointer px-2 py-2 text-right hover:bg-muted/50 sm:px-4 sm:py-3"
                onClick={() => handleSort("totalSaleKgs")}
              >
                Total Sale in KGs <SortIcon column="totalSaleKgs" />
              </TableHead>
              <TableHead
                className="cursor-pointer px-2 py-2 text-right hover:bg-muted/50 sm:px-4 sm:py-3"
                onClick={() => handleSort("avgQtyPerDay")}
              >
                Average Quantity per Day <SortIcon column="avgQtyPerDay" />
              </TableHead>
            </TableRow>
            <TableRow>
              <TableHead className="sticky left-0 z-20 min-w-[220px] border-r bg-white px-2 py-1.5 sm:px-4">
                <Input
                  placeholder="Filter products..."
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                  className="h-7 text-xs font-normal"
                />
              </TableHead>
              <TableHead className="px-2 py-1.5 text-right text-xs font-normal text-muted-foreground sm:px-4">
                Monthly product sales value
              </TableHead>
              <TableHead className="px-2 py-1.5 text-right text-xs font-normal text-muted-foreground sm:px-4">
                Current day quantity
              </TableHead>
              <TableHead className="px-2 py-1.5 text-right text-xs font-normal text-muted-foreground sm:px-4">
                Current day sale value
              </TableHead>
              <TableHead className="px-2 py-1.5 text-right text-xs font-normal text-muted-foreground sm:px-4">
                Total purchased quantity
              </TableHead>
              <TableHead className="px-2 py-1.5 text-right text-xs font-normal text-muted-foreground sm:px-4">
                Total / {daysInMonth} days
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-2 py-14 text-center text-muted-foreground sm:px-4">
                  {productFilter
                    ? `No products matching "${productFilter}".`
                    : `No product activity found for ${monthLabel}.`}
                </TableCell>
              </TableRow>
            ) : (
              pagination.paginatedItems.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="sticky left-0 z-10 min-w-[220px] border-r bg-white px-2 py-2 font-medium sm:px-4 sm:py-3">
                    {row.name}
                  </TableCell>
                  <TableCell className="px-2 py-2 text-right sm:px-4 sm:py-3">
                    {row.currentMonthSaleValue > 0
                      ? `₹${fmt(row.currentMonthSaleValue)}`
                      : "—"}
                  </TableCell>
                  <TableCell className="px-2 py-2 text-right sm:px-4 sm:py-3">
                    {row.todaySaleQty > 0 ? row.todaySaleQty.toFixed(2) : "—"}
                  </TableCell>
                  <TableCell className="px-2 py-2 text-right sm:px-4 sm:py-3">
                    {row.todaySaleValue > 0 ? `₹${fmt(row.todaySaleValue)}` : "—"}
                  </TableCell>
                  <TableCell className="px-2 py-2 text-right sm:px-4 sm:py-3">
                    {row.totalSaleKgs > 0 ? row.totalSaleKgs.toFixed(2) : "—"}
                  </TableCell>
                  <TableCell className="px-2 py-2 text-right sm:px-4 sm:py-3">
                    {row.totalSaleKgs > 0 ? row.avgQtyPerDay.toFixed(2) : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}

            {processedRows.length > 0 && (
              <TableRow className="border-t-2 bg-muted font-bold">
                <TableCell className="sticky left-0 z-30 min-w-[220px] border-r bg-muted px-2 py-2 sm:px-4 sm:py-3">
                  Total
                </TableCell>
                <TableCell className="px-2 py-2 text-right sm:px-4 sm:py-3">
                  ₹{fmt(totals.currentMonthSaleValue)}
                </TableCell>
                <TableCell className="px-2 py-2 text-right sm:px-4 sm:py-3">
                  {totals.todaySaleQty.toFixed(2)}
                </TableCell>
                <TableCell className="px-2 py-2 text-right sm:px-4 sm:py-3">
                  ₹{fmt(totals.todaySaleValue)}
                </TableCell>
                <TableCell className="px-2 py-2 text-right sm:px-4 sm:py-3">
                  {totals.totalSaleKgs.toFixed(2)}
                </TableCell>
                <TableCell className="px-2 py-2 text-right text-muted-foreground sm:px-4 sm:py-3">
                  {(totals.totalSaleKgs / daysInMonth).toFixed(2)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        totalItems={pagination.totalItems}
        itemsPerPage={itemsPerPage}
        onPageChange={pagination.goToPage}
        onItemsPerPageChange={setItemsPerPage}
      />
    </div>
  )
}
