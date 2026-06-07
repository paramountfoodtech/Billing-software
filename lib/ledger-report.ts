export type LedgerInvoice = {
  invoice_number: string
  issue_date: string
  total_amount: string | number | null
  status?: string
}

export type LedgerPayment = {
  payment_date: string
  amount: string | number | null
  status: string
  invoices:
    | { invoice_number: string }
    | { invoice_number: string }[]
    | null
}

export type LedgerTxnKind = "sale" | "payment"

export type LedgerTxnRow = {
  kind: LedgerTxnKind
  dateKey: string
  sortOrder: number
  invoiceNumber: string
  sale: number
  payment: number
}

export type DisplayLedgerRow = LedgerTxnRow & {
  outstanding: number
  dayTotal: number | null
  showDate: boolean
  dateRowSpan: number
  showDayTotal: boolean
  dayTotalRowSpan: number
}

export type LedgerSummary = {
  previousBalance: number
  totalSale: number
  totalPayment: number
  closingOutstanding: number
}

function paymentInvoiceNumber(
  invoices: LedgerPayment["invoices"],
): string {
  if (!invoices) return ""
  if (Array.isArray(invoices)) return invoices[0]?.invoice_number || ""
  return invoices.invoice_number || ""
}

/** Build one row per invoice and one row per payment (not grouped by date). */
export function buildLedgerTransactions(
  invoices: LedgerInvoice[],
  payments: LedgerPayment[],
): LedgerTxnRow[] {
  const saleRows: LedgerTxnRow[] = []

  for (const inv of invoices) {
    if (inv.status === "cancelled") continue
    const total = Number(inv.total_amount || 0)
    if (total <= 0) continue
    saleRows.push({
      kind: "sale",
      dateKey: inv.issue_date,
      sortOrder: 0,
      invoiceNumber: inv.invoice_number || "",
      sale: total,
      payment: 0,
    })
  }

  saleRows.sort((a, b) => {
    const byDate = a.dateKey.localeCompare(b.dateKey)
    if (byDate !== 0) return byDate
    return a.invoiceNumber.localeCompare(b.invoiceNumber, undefined, {
      numeric: true,
    })
  })

  const paymentRows: LedgerTxnRow[] = []
  for (const p of payments) {
    if (p.status === "failed" || p.status === "refunded" || !p.payment_date) {
      continue
    }
    const amt = Number(p.amount || 0)
    if (amt <= 0) continue
    paymentRows.push({
      kind: "payment",
      dateKey: p.payment_date,
      sortOrder: 1,
      invoiceNumber: paymentInvoiceNumber(p.invoices),
      sale: 0,
      payment: amt,
    })
  }

  paymentRows.sort((a, b) => {
    const byDate = a.dateKey.localeCompare(b.dateKey)
    if (byDate !== 0) return byDate
    return a.invoiceNumber.localeCompare(b.invoiceNumber, undefined, {
      numeric: true,
    })
  })

  return [...saleRows, ...paymentRows].sort((a, b) => {
    const byDate = a.dateKey.localeCompare(b.dateKey)
    if (byDate !== 0) return byDate
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return a.invoiceNumber.localeCompare(b.invoiceNumber, undefined, {
      numeric: true,
    })
  })
}

export function resolveDisplayRange(
  monthStart: string,
  monthEnd: string,
  fromDate?: string,
  toDate?: string,
): { rangeStart: string; rangeEnd: string } {
  return {
    rangeStart: fromDate?.trim() || monthStart,
    rangeEnd: toDate?.trim() || monthEnd,
  }
}

/** Apply running balance; filter display to the given date range (inclusive). */
export function buildDisplayLedgerRows(
  transactions: LedgerTxnRow[],
  options?: { rangeStart?: string; rangeEnd?: string },
): { rows: DisplayLedgerRow[]; summary: LedgerSummary } {
  const rangeStart = options?.rangeStart
  const rangeEnd = options?.rangeEnd

  let running = 0
  let previousBalance = 0
  let previousBalanceCaptured = false
  let totalSale = 0
  let totalPayment = 0
  const out: DisplayLedgerRow[] = []

  for (const row of transactions) {
    if (rangeStart && row.dateKey < rangeStart) {
      running += row.kind === "sale" ? row.sale : -row.payment
      continue
    }

    if (rangeEnd && row.dateKey > rangeEnd) {
      break
    }

    if (rangeStart && !previousBalanceCaptured) {
      previousBalance = running
      previousBalanceCaptured = true
    }

    if (row.kind === "sale") {
      totalSale += row.sale
      running += row.sale
      out.push({
        ...row,
        payment: 0,
        outstanding: running,
        dayTotal: null,
        showDate: false,
        dateRowSpan: 1,
        showDayTotal: false,
        dayTotalRowSpan: 0,
      })
    } else {
      totalPayment += row.payment
      running -= row.payment
      out.push({
        ...row,
        sale: 0,
        outstanding: running,
        dayTotal: null,
        showDate: false,
        dateRowSpan: 1,
        showDayTotal: false,
        dayTotalRowSpan: 0,
      })
    }
  }

  if (rangeStart && !previousBalanceCaptured) {
    previousBalance = running
  }

  annotateDateAndDayTotals(out)

  return {
    rows: out,
    summary: {
      previousBalance,
      totalSale,
      totalPayment,
      closingOutstanding: running,
    },
  }
}

export function annotateDateAndDayTotals(rows: DisplayLedgerRow[]): void {
  let i = 0
  while (i < rows.length) {
    const dateKey = rows[i].dateKey
    let j = i
    while (j < rows.length && rows[j].dateKey === dateKey) j++

    const group = rows.slice(i, j)
    const saleRows = group.filter((r) => r.kind === "sale")
    const dayTotal = saleRows.reduce((sum, r) => sum + r.sale, 0)
    const dateRowSpan = group.length
    const dayTotalRowSpan = saleRows.length

    group.forEach((row, gi) => {
      row.showDate = gi === 0
      row.dateRowSpan = dateRowSpan
      if (row.kind === "sale" && dayTotalRowSpan > 0) {
        const saleIdx = saleRows.indexOf(row)
        row.showDayTotal = saleIdx === 0
        row.dayTotalRowSpan = dayTotalRowSpan
        row.dayTotal = dayTotal
      } else {
        row.showDayTotal = false
        row.dayTotalRowSpan = 0
        row.dayTotal = null
      }
    })

    i = j
  }
}

export type StatementTxnRow = {
  date: string
  particulars: "Invoice" | "Payment"
  invoiceNumber: string
  debit: number
  credit: number
  outstanding: number
  showDate: boolean
  dateRowSpan: number
}

export function buildStatementRows(
  invoices: LedgerInvoice[],
  payments: LedgerPayment[],
): StatementTxnRow[] {
  const transactions = buildLedgerTransactions(invoices, payments)
  let running = 0

  const rows: StatementTxnRow[] = transactions.map((row) => {
    if (row.kind === "sale") {
      running += row.sale
      return {
        date: row.dateKey,
        particulars: "Invoice",
        invoiceNumber: row.invoiceNumber,
        debit: row.sale,
        credit: 0,
        outstanding: running,
        showDate: false,
        dateRowSpan: 1,
      }
    }

    running -= row.payment
    return {
      date: row.dateKey,
      particulars: "Payment",
      invoiceNumber: row.invoiceNumber || "-",
      debit: 0,
      credit: row.payment,
      outstanding: running,
      showDate: false,
      dateRowSpan: 1,
    }
  })

  let i = 0
  while (i < rows.length) {
    const date = rows[i].date
    let j = i
    while (j < rows.length && rows[j].date === date) j++
    const span = j - i
    for (let k = i; k < j; k++) {
      rows[k].showDate = k === i
      rows[k].dateRowSpan = span
    }
    i = j
  }

  return rows
}
