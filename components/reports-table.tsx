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
import { ArrowUp, ArrowDown, ArrowUpDown, Search } from "lucide-react"

type ClientRow = {
  id: string
  name: string
  sale: number
  saleKgs: number
  payments: number
  outstanding: number
  oldBal: number
}

type SortKey = "name" | "oldBal" | "sale" | "saleKgs" | "avgQty" | "payments" | "outstanding"

interface ReportsTableProps {
  rows: ClientRow[]
  daysInMonth: number
  monthLabel: string
}

export function ReportsTable({ rows, daysInMonth, monthLabel }: ReportsTableProps) {
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const fmt = (n: number) =>
    n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir(key === "name" ? "asc" : "desc")
    }
  }

  const filtered = useMemo(() => {
    let result = rows
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((r) => r.name.toLowerCase().includes(q))
    }
    if (sortKey) {
      result = [...result].sort((a, b) => {
        let av: number | string
        let bv: number | string
        if (sortKey === "name") {
          av = a.name.toLowerCase()
          bv = b.name.toLowerCase()
        } else if (sortKey === "avgQty") {
          av = a.saleKgs / daysInMonth
          bv = b.saleKgs / daysInMonth
        } else {
          av = a[sortKey]
          bv = b[sortKey]
        }
        if (av < bv) return sortDir === "asc" ? -1 : 1
        if (av > bv) return sortDir === "asc" ? 1 : -1
        return 0
      })
    }
    return result
  }, [rows, search, sortKey, sortDir, daysInMonth])

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, r) => ({
          oldBal: acc.oldBal + r.oldBal,
          sale: acc.sale + r.sale,
          saleKgs: acc.saleKgs + r.saleKgs,
          payments: acc.payments + r.payments,
          outstanding: acc.outstanding + r.outstanding,
        }),
        { oldBal: 0, sale: 0, saleKgs: 0, payments: 0, outstanding: 0 },
      ),
    [filtered],
  )

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40 inline" />
    return sortDir === "asc"
      ? <ArrowUp className="ml-1 h-3 w-3 inline" />
      : <ArrowDown className="ml-1 h-3 w-3 inline" />
  }

  const thClass = (col: SortKey, right = true) =>
    `cursor-pointer select-none hover:bg-muted/50 transition-colors px-2 sm:px-4 py-2 sm:py-3${right ? " text-right" : ""}`

  return (
    <div className="space-y-3">
      {/* Search / filter */}
      <div className="relative w-full sm:w-64">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search hotel…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white overflow-x-auto">
        <Table className="text-xs sm:text-sm">
          <TableHeader>
            <TableRow>
              <TableHead className={thClass("name", false)} onClick={() => handleSort("name")}>
                Hotel <SortIcon col="name" />
              </TableHead>
              <TableHead className={thClass("oldBal")} onClick={() => handleSort("oldBal")}>
                Old Bal <SortIcon col="oldBal" />
              </TableHead>
              <TableHead className={thClass("sale")} onClick={() => handleSort("sale")}>
                Sale <SortIcon col="sale" />
              </TableHead>
              <TableHead className={thClass("saleKgs")} onClick={() => handleSort("saleKgs")}>
                Sale KGS <SortIcon col="saleKgs" />
              </TableHead>
              <TableHead className={thClass("avgQty")} onClick={() => handleSort("avgQty")}>
                Avg Qty <SortIcon col="avgQty" />
              </TableHead>
              <TableHead className={thClass("payments")} onClick={() => handleSort("payments")}>
                Payments <SortIcon col="payments" />
              </TableHead>
              <TableHead className={thClass("outstanding")} onClick={() => handleSort("outstanding")}>
                Outstanding <SortIcon col="outstanding" />
              </TableHead>
            </TableRow>
            <TableRow>
              <TableHead className="px-2 sm:px-4 py-1.5 font-normal text-muted-foreground" />
              <TableHead className="text-right px-2 sm:px-4 py-1.5 font-normal text-muted-foreground">
                Outstanding − Current month Sale
              </TableHead>
              <TableHead className="text-right px-2 sm:px-4 py-1.5 font-normal text-muted-foreground">
                Current Month Sale
              </TableHead>
              <TableHead className="text-right px-2 sm:px-4 py-1.5 font-normal text-muted-foreground">
                Total Purchased Qty
              </TableHead>
              <TableHead className="text-right px-2 sm:px-4 py-1.5 font-normal text-muted-foreground leading-tight">
                Avg Qty per Day
                <br />
                Total / {daysInMonth} days
              </TableHead>
              <TableHead className="text-right px-2 sm:px-4 py-1.5 font-normal text-muted-foreground">
                Current Month Payments
              </TableHead>
              <TableHead className="text-right px-2 sm:px-4 py-1.5 font-normal text-muted-foreground">
                Total Outstanding
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-16 px-2 sm:px-4">
                  {search ? `No hotels matching "${search}".` : `No activity found for ${monthLabel}.`}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium px-2 sm:px-4 py-2 sm:py-3">{row.name}</TableCell>
                  <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3">
                    {row.oldBal > 0 ? `₹${fmt(row.oldBal)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3">
                    {row.sale > 0 ? `₹${fmt(row.sale)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3">
                    {row.saleKgs > 0 ? row.saleKgs.toFixed(2) : "—"}
                  </TableCell>
                  <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3">
                    {row.saleKgs > 0 ? (
                      <>
                        {(row.saleKgs / daysInMonth).toFixed(2)}
                        <span className="text-muted-foreground ml-1">/ {daysInMonth}d</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3 text-green-700">
                    {row.payments > 0 ? `₹${fmt(row.payments)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3 font-semibold text-orange-700">
                    {row.outstanding > 0 ? `₹${fmt(row.outstanding)}` : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}

            {/* Totals row — always based on filtered rows */}
            {filtered.length > 0 && (
              <TableRow className="border-t-2 font-bold bg-muted/30">
                <TableCell className="px-2 sm:px-4 py-2 sm:py-3">
                  Total Sale {search && <span className="font-normal text-muted-foreground text-xs ml-1">({filtered.length} hotels)</span>}
                </TableCell>
                <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3">₹{fmt(totals.oldBal)}</TableCell>
                <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3">₹{fmt(totals.sale)}</TableCell>
                <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3">
                  {totals.saleKgs > 0 ? totals.saleKgs.toFixed(2) : "0"}
                </TableCell>
                <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3 font-normal text-muted-foreground">—</TableCell>
                <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3 text-green-700">₹{fmt(totals.payments)}</TableCell>
                <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3 text-orange-700">₹{fmt(totals.outstanding)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
