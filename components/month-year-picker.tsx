"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { SearchableSelect } from "@/components/ui/searchable-select"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

interface MonthYearPickerProps {
  currentYear: number
  currentMonth: number // 1-indexed
  basePath?: string
}

export function MonthYearPicker({
  currentYear,
  currentMonth,
  basePath = "/dashboard/reports",
}: MonthYearPickerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const today = new Date()

  // Generate years: 3 years back up to current year
  const years = Array.from(
    { length: today.getFullYear() - (today.getFullYear() - 3) + 1 },
    (_, i) => today.getFullYear() - 3 + i,
  )

  const navigate = (year: number, month: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("year", String(year))
    params.set("month", String(month))
    router.push(`${basePath}?${params.toString()}`)
  }

  const handleMonthChange = (value: string) => {
    navigate(currentYear, parseInt(value))
  }

  const handleYearChange = (value: string) => {
    const newYear = parseInt(value)
    // If selected year is current year and month is in the future, clamp to current month
    const clampedMonth =
      newYear === today.getFullYear() && currentMonth > today.getMonth() + 1
        ? today.getMonth() + 1
        : currentMonth
    navigate(newYear, clampedMonth)
  }

  // Months available for the selected year
  const availableMonths = MONTHS.map((name, i) => {
    const monthNum = i + 1
    const isFuture =
      currentYear === today.getFullYear() && monthNum > today.getMonth() + 1
    return { name, monthNum, disabled: isFuture }
  })

  const monthOptions = availableMonths.map(({ name, monthNum, disabled }) => ({
    value: String(monthNum),
    label: name,
    disabled,
  }))

  const yearOptions = years.map((y) => ({
    value: String(y),
    label: String(y),
  }))

  return (
    <div className="flex items-center gap-2">
      <SearchableSelect
        value={String(currentMonth)}
        onValueChange={handleMonthChange}
        options={monthOptions}
        placeholder="Month"
        searchPlaceholder="Type month..."
        triggerClassName="w-[130px] h-8 text-sm"
      />

      <SearchableSelect
        value={String(currentYear)}
        onValueChange={handleYearChange}
        options={yearOptions}
        placeholder="Year"
        searchPlaceholder="Type year..."
        triggerClassName="w-[90px] h-8 text-sm"
      />
    </div>
  )
}
