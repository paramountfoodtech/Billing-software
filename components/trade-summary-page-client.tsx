"use client"

import { useCallback } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { MonthYearPicker } from "@/components/month-year-picker"
import { FinancialYearSelector } from "@/components/financial-year-selector"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ReportPeriodMode } from "@/lib/report-period"

export type LinkedPartyOption = {
  clientId: string
  purchaserId: string
  name: string
  purchaserCode: string
}

export type SaleInvoiceRow = {
  id: string
  invoiceNumber: string
  issueDate: string
  weightKg: number
  amount: number
  ratePerKg: number | null
}

export type PurchaseInvoiceRow = {
  id: string
  invoiceNumber: string
  issueDate: string
  weightKg: number
  pricePerKg: number
  amount: number
}

type TradeSummaryPageClientProps = {
  reportYear: number
  reportMonth: number
  periodMode: ReportPeriodMode
  periodLabel: string
  periodStart: string
  periodEnd: string
  multiMonths: number
  fy: string
  linkedParties: LinkedPartyOption[]
  selectedClientId: string | null
  selectedPurchaserId: string | null
  partyName: string | null
  salesInvoices: SaleInvoiceRow[]
  purchaseInvoices: PurchaseInvoiceRow[]
  purchaseTotals: { weightKg: number; amount: number; avgRate: number | null }
  salesTotals: { weightKg: number; amount: number; avgRate: number | null }
}

const PERIOD_MODE_OPTIONS = [
  { value: "month", label: "Single month" },
  { value: "multi", label: "Last N months (up to 6)" },
  { value: "range", label: "Date range" },
  { value: "fy", label: "Financial year" },
]

const MULTI_MONTH_OPTIONS = [2, 3, 4, 5, 6].map((n) => ({
  value: String(n),
  label: `Last ${n} months`,
}))

function fmtMoney(n: number) {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function fmtKg(n: number) {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  })
}

export function TradeSummaryPageClient({
  reportYear,
  reportMonth,
  periodMode,
  periodLabel,
  periodStart,
  periodEnd,
  multiMonths,
  fy,
  linkedParties,
  selectedClientId,
  selectedPurchaserId,
  partyName,
  salesInvoices,
  purchaseInvoices,
  purchaseTotals,
  salesTotals,
}: TradeSummaryPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const pushParams = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString())
      mutate(next)
      const qs = next.toString()
      router.push(qs ? `/dashboard/trade-summary?${qs}` : "/dashboard/trade-summary")
    },
    [router, searchParams],
  )

  const setPeriodMode = (mode: string) => {
    pushParams((next) => {
      if (mode === "month") {
        next.delete("period")
        next.delete("months")
        next.delete("fy")
        next.delete("from")
        next.delete("to")
      } else {
        next.set("period", mode)
        if (mode === "multi") {
          if (!next.get("months")) next.set("months", String(multiMonths))
          next.delete("fy")
          next.delete("from")
          next.delete("to")
        } else if (mode === "range") {
          next.delete("months")
          next.delete("fy")
          if (!next.get("from")) next.set("from", periodStart)
          if (!next.get("to")) next.set("to", periodEnd)
        } else if (mode === "fy") {
          next.delete("months")
          next.set("fy", fy)
          next.delete("from")
          next.delete("to")
        }
      }
    })
  }

  const selectedValue = selectedClientId
    ? `c:${selectedClientId}`
    : selectedPurchaserId
      ? linkedParties.find((p) => p.purchaserId === selectedPurchaserId)
        ? `c:${linkedParties.find((p) => p.purchaserId === selectedPurchaserId)!.clientId}`
        : ""
      : ""

  const netWeight = salesTotals.weightKg - purchaseTotals.weightKg
  const netAmount = salesTotals.amount - purchaseTotals.amount

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Period:{" "}
            <span className="font-semibold text-foreground">{periodLabel}</span>
          </p>
          {partyName && (
            <p className="text-sm text-muted-foreground mt-1">
              Party:{" "}
              <span className="font-semibold text-foreground">{partyName}</span>
            </p>
          )}
        </div>
        {(periodMode === "month" || periodMode === "multi") && (
          <MonthYearPicker
            currentYear={reportYear}
            currentMonth={reportMonth}
            basePath="/dashboard/trade-summary"
          />
        )}
      </div>

      <div className="rounded-lg border bg-white p-4 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="space-y-1.5 min-w-[220px]">
            <Label className="text-xs text-muted-foreground">Linked party</Label>
            <SearchableSelect
              value={selectedValue}
              onValueChange={(value) => {
                const clientId = value.replace(/^c:/, "")
                pushParams((next) => {
                  next.set("clientId", clientId)
                  next.delete("purchaserId")
                })
              }}
              options={linkedParties.map((p) => ({
                value: `c:${p.clientId}`,
                label: `${p.name} (${p.purchaserCode})`,
              }))}
              placeholder={
                linkedParties.length
                  ? "Select linked party..."
                  : "No linked parties yet"
              }
              searchPlaceholder="Search parties..."
              triggerClassName="w-full lg:w-[320px]"
            />
          </div>

          <div className="space-y-1.5 min-w-[200px]">
            <Label className="text-xs text-muted-foreground">Report period</Label>
            <SearchableSelect
              value={periodMode}
              onValueChange={setPeriodMode}
              options={PERIOD_MODE_OPTIONS}
              placeholder="Select period"
              searchPlaceholder="Type period..."
              triggerClassName="w-full lg:w-[240px]"
            />
          </div>

          {periodMode === "multi" && (
            <div className="space-y-1.5 min-w-[160px]">
              <Label className="text-xs text-muted-foreground">
                Number of months
              </Label>
              <SearchableSelect
                value={String(multiMonths)}
                onValueChange={(value) =>
                  pushParams((next) => {
                    next.set("period", "multi")
                    next.set("months", value)
                  })
                }
                options={MULTI_MONTH_OPTIONS}
                placeholder="Months"
                searchPlaceholder="Type months..."
                triggerClassName="w-full lg:w-[180px]"
              />
            </div>
          )}

          {periodMode === "fy" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Financial year
              </Label>
              <FinancialYearSelector
                selectedYear={fy}
                onYearChange={(value) =>
                  pushParams((next) => {
                    next.set("period", "fy")
                    next.set("fy", value)
                  })
                }
              />
            </div>
          )}

          {periodMode === "range" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input
                  type="date"
                  value={periodStart}
                  max={periodEnd}
                  onChange={(e) =>
                    pushParams((next) => {
                      next.set("period", "range")
                      next.set("from", e.target.value)
                      if (!next.get("to")) next.set("to", periodEnd)
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input
                  type="date"
                  value={periodEnd}
                  min={periodStart}
                  onChange={(e) =>
                    pushParams((next) => {
                      next.set("period", "range")
                      next.set("to", e.target.value)
                      if (!next.get("from")) next.set("from", periodStart)
                    })
                  }
                />
              </div>
            </>
          )}
        </div>
      </div>

      {linkedParties.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center text-muted-foreground">
          No linked client–purchaser pairs yet. Open a client or purchaser and
          turn on “Also a purchaser / Also a client”.
        </div>
      ) : !selectedClientId && !selectedPurchaserId ? (
        <div className="rounded-lg border bg-white p-8 text-center text-muted-foreground">
          Select a linked party to view purchase vs sales for this period.
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-white p-4 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Purchased
              </p>
              <p className="text-2xl font-semibold">
                {fmtKg(purchaseTotals.weightKg)} kg
              </p>
              <p className="text-sm text-muted-foreground">
                ₹{fmtMoney(purchaseTotals.amount)}
                {purchaseTotals.avgRate != null && (
                  <> · avg ₹{fmtMoney(purchaseTotals.avgRate)}/kg</>
                )}
              </p>
            </div>
            <div className="rounded-lg border bg-white p-4 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Sold
              </p>
              <p className="text-2xl font-semibold">
                {fmtKg(salesTotals.weightKg)} kg
              </p>
              <p className="text-sm text-muted-foreground">
                ₹{fmtMoney(salesTotals.amount)}
                {salesTotals.avgRate != null && (
                  <> · avg ₹{fmtMoney(salesTotals.avgRate)}/kg</>
                )}
              </p>
            </div>
            <div className="rounded-lg border bg-white p-4 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Net (sold − purchased)
              </p>
              <p className="text-2xl font-semibold">
                {fmtKg(netWeight)} kg
              </p>
              <p className="text-sm text-muted-foreground">
                ₹{fmtMoney(netAmount)}
              </p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-3">
              <h3 className="font-semibold">Purchase invoices</h3>
              <div className="rounded-lg border bg-white overflow-x-auto">
                <Table className="text-xs sm:text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Weight (kg)</TableHead>
                      <TableHead className="text-right">₹/kg</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseInvoices.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-muted-foreground py-8"
                        >
                          No purchase invoices in this period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      purchaseInvoices.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Button asChild variant="link" className="h-auto p-0">
                              <Link
                                href={`/dashboard/purchase-invoices/${row.id}`}
                              >
                                {row.invoiceNumber}
                              </Link>
                            </Button>
                          </TableCell>
                          <TableCell>{row.issueDate}</TableCell>
                          <TableCell className="text-right">
                            {fmtKg(row.weightKg)}
                          </TableCell>
                          <TableCell className="text-right">
                            ₹{fmtMoney(row.pricePerKg)}
                          </TableCell>
                          <TableCell className="text-right">
                            ₹{fmtMoney(row.amount)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold">Sales invoices</h3>
              <div className="rounded-lg border bg-white overflow-x-auto">
                <Table className="text-xs sm:text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Weight (kg)</TableHead>
                      <TableHead className="text-right">₹/kg</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesInvoices.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-muted-foreground py-8"
                        >
                          No sales invoices in this period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      salesInvoices.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Button asChild variant="link" className="h-auto p-0">
                              <Link href={`/dashboard/invoices/${row.id}`}>
                                {row.invoiceNumber}
                              </Link>
                            </Button>
                          </TableCell>
                          <TableCell>{row.issueDate}</TableCell>
                          <TableCell className="text-right">
                            {fmtKg(row.weightKg)}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.ratePerKg != null
                              ? `₹${fmtMoney(row.ratePerKg)}`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            ₹{fmtMoney(row.amount)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
