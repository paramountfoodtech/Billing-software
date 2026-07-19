import { formatIndianStatementDate } from "@/lib/date-time"

export type ReportPeriodMode = "month" | "multi" | "range" | "fy"

export type ResolvedReportPeriod = {
  mode: ReportPeriodMode
  periodStart: string
  periodEnd: string
  periodLabel: string
  daysInPeriod: number
  reportYear: number
  reportMonth: number
  multiMonths: number
  fy: string
  monthStart: string
  monthEnd: string
  monthLabel: string
  daysInMonth: number
}

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

function monthBounds(year: number, month: number) {
  const start = `${year}-${pad2(month)}-01`
  const days = new Date(year, month, 0).getDate()
  const end = `${year}-${pad2(month)}-${pad2(days)}`
  return { start, end, days }
}

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

function daysInclusive(start: string, end: string) {
  const a = new Date(`${start}T00:00:00`)
  const b = new Date(`${end}T00:00:00`)
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1)
}

function monthName(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  })
}

function parseMode(value?: string): ReportPeriodMode {
  if (value === "multi" || value === "range" || value === "fy") return value
  return "month"
}

/** Financial year Apr–Mar (same rules as FinancialYearSelector). */
export function getFinancialYearFromDate(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = date.getMonth()
  if (month < 3) return `${year - 1}-${year}`
  return `${year}-${year + 1}`
}

export function getFinancialYearDateRange(fy: string): {
  start: string
  end: string
} {
  const [startYear, endYear] = fy.split("-").map(Number)
  return {
    start: `${startYear}-04-01`,
    end: `${endYear}-03-31`,
  }
}

export function resolveReportPeriod(params: {
  period?: string
  year?: string
  month?: string
  months?: string
  from?: string
  to?: string
  fy?: string
  todayDate: string
}): ResolvedReportPeriod {
  const today = new Date()
  const mode = parseMode(params.period)
  const reportYear = params.year ? parseInt(params.year, 10) : today.getFullYear()
  const reportMonth = params.month
    ? parseInt(params.month, 10)
    : today.getMonth() + 1

  const {
    start: monthStart,
    end: monthEnd,
    days: daysInMonth,
  } = monthBounds(reportYear, reportMonth)
  const monthLabel = monthName(reportYear, reportMonth)

  const multiMonths = Math.min(
    6,
    Math.max(2, params.months ? parseInt(params.months, 10) || 3 : 3),
  )
  const fy = params.fy || getFinancialYearFromDate()

  let periodStart = monthStart
  let periodEnd = monthEnd
  let periodLabel = monthLabel

  if (mode === "multi") {
    const start = shiftMonth(reportYear, reportMonth, -(multiMonths - 1))
    periodStart = monthBounds(start.year, start.month).start
    periodEnd = monthEnd
    periodLabel = `${monthName(start.year, start.month)} – ${monthLabel} (last ${multiMonths} months)`
  } else if (mode === "range") {
    periodStart = params.from || monthStart
    periodEnd =
      params.to ||
      (params.todayDate < monthEnd ? params.todayDate : monthEnd)
    if (periodStart > periodEnd) {
      const swap = periodStart
      periodStart = periodEnd
      periodEnd = swap
    }
    periodLabel = `${formatIndianStatementDate(periodStart)} to ${formatIndianStatementDate(periodEnd)}`
  } else if (mode === "fy") {
    const range = getFinancialYearDateRange(fy)
    periodStart = range.start
    periodEnd = range.end
    periodLabel = `FY ${fy}`
  }

  return {
    mode,
    periodStart,
    periodEnd,
    periodLabel,
    daysInPeriod: daysInclusive(periodStart, periodEnd),
    reportYear,
    reportMonth,
    multiMonths,
    fy,
    monthStart,
    monthEnd,
    monthLabel,
    daysInMonth,
  }
}
