/** India Standard Time (IST, UTC+5:30) — used for all user-facing dates/times. */
export const INDIAN_TIMEZONE = "Asia/Kolkata"

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

/** Today's calendar date in IST as YYYY-MM-DD. */
export function getIndianToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: INDIAN_TIMEZONE })
}

/** Parse a date-only string as noon IST (avoids UTC midnight date shifts). */
export function parseIndianDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00+05:30`)
}

/** Format any date input for display in IST. */
export function formatIndianDate(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {},
): string {
  if (!value) return ""

  const date =
    typeof value === "string" && DATE_ONLY_RE.test(value)
      ? parseIndianDateOnly(value)
      : new Date(value)

  if (Number.isNaN(date.getTime())) return ""

  return date.toLocaleDateString("en-IN", {
    timeZone: INDIAN_TIMEZONE,
    ...options,
  })
}

/** Format a timestamp for display in IST (date + time). */
export function formatIndianDateTime(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {},
): string {
  if (!value) return ""

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  return date.toLocaleString("en-IN", {
    timeZone: INDIAN_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  })
}

/** Format time only in IST. */
export function formatIndianTime(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {},
): string {
  if (!value) return ""

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  return date.toLocaleTimeString("en-IN", {
    timeZone: INDIAN_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  })
}

/** Add calendar days to a YYYY-MM-DD date (timezone-neutral business dates). */
export function addCalendarDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  const year = dt.getUTCFullYear()
  const month = String(dt.getUTCMonth() + 1).padStart(2, "0")
  const day = String(dt.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** Last day of month for a YYYY-MM-DD anchor date. */
export function endOfMonthDateKey(dateKey: string, extraMonths = 0): string {
  const [y, m] = dateKey.split("-").map(Number)
  const lastDay = new Date(Date.UTC(y, m + extraMonths, 0))
  const year = lastDay.getUTCFullYear()
  const month = String(lastDay.getUTCMonth() + 1).padStart(2, "0")
  const day = String(lastDay.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** Short statement style: Mon/D/YYYY in IST. */
export function formatIndianStatementDate(dateKey: string): string {
  const d = parseIndianDateOnly(dateKey)
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: INDIAN_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).formatToParts(d)

  const month = parts.find((p) => p.type === "month")?.value ?? ""
  const day = parts.find((p) => p.type === "day")?.value ?? ""
  const year = parts.find((p) => p.type === "year")?.value ?? ""
  return `${month}/${day}/${year}`
}
