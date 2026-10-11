// Mortality Tracker types and data-layer helpers

export type MortalityTrackerConfig = {
  id: string
  organization_id: string
  live_paper_category_id: string | null
  updated_at: string
}

export type MortalityTrackerEntry = {
  id: string
  organization_id: string
  entry_date: string
  vehicle_number: string
  opening_birds: number
  opening_kg: number | string
  afternoon_birds: number
  afternoon_kg: number | string
  closing_birds: number
  closing_kg: number | string
  total_birds: number
  total_kg: number | string
  live_paper_category_id: string | null
  live_paper_rate: number | string | null
  total_value: number | string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  profiles?: { full_name: string } | null
  price_categories?: { name: string } | null
}

export type MortalityDailyGroup = {
  date: string
  entries: MortalityTrackerEntry[]
  consolidated: {
    total_birds: number
    total_kg: number
    live_paper_rate: number | null
    total_value: number | null
    category_name: string | null
  }
}

/** Groups flat entry list by date, computing consolidated EOD totals.
 * Accepts an optional datePriceMap (effective_date -> price) from price_category_history
 * so that any price updates for the day immediately reflect in mortality calculations.
 */
export function groupEntriesByDate(
  entries: MortalityTrackerEntry[],
  datePriceMap?: Record<string, number>,
  fallbackCategoryName?: string | null
): MortalityDailyGroup[] {
  const byDate = new Map<string, MortalityTrackerEntry[]>()
  for (const e of entries) {
    const list = byDate.get(e.entry_date) ?? []
    list.push(e)
    byDate.set(e.entry_date, list)
  }

  const groups: MortalityDailyGroup[] = []
  for (const [date, dayEntries] of byDate.entries()) {
    const total_birds = dayEntries.reduce((s, e) => s + (Number(e.total_birds) || 0), 0)
    const total_kg = dayEntries.reduce((s, e) => s + (Number(e.total_kg) || 0), 0)

    // Rate priority:
    // 1. Live rate from price_category_history for this date
    // 2. Snapshot rate stored on any entry for this day
    const dynamicRate = datePriceMap && date in datePriceMap ? datePriceMap[date] : null
    const storedRateEntry = dayEntries.find((e) => e.live_paper_rate != null)
    const storedRate = storedRateEntry ? Number(storedRateEntry.live_paper_rate) : null

    const live_paper_rate = dynamicRate != null ? dynamicRate : storedRate
    const total_value = live_paper_rate != null ? +(total_kg * live_paper_rate).toFixed(2) : null
    const category_name =
      fallbackCategoryName ??
      storedRateEntry?.price_categories?.name ??
      null

    // Enrich rows with active rate so each row can display its rate and value
    const enrichedEntries = dayEntries.map((e) => {
      const rowRate = dynamicRate != null ? dynamicRate : (e.live_paper_rate != null ? Number(e.live_paper_rate) : null)
      const rowTotalKg = Number(e.total_kg || 0)
      const rowVal = rowRate != null ? +(rowTotalKg * rowRate).toFixed(2) : (e.total_value != null ? Number(e.total_value) : null)
      return {
        ...e,
        live_paper_rate: rowRate,
        total_value: rowVal,
      }
    })

    groups.push({
      date,
      entries: enrichedEntries,
      consolidated: { total_birds, total_kg, live_paper_rate, total_value, category_name },
    })
  }

  // Sort descending by date
  groups.sort((a, b) => b.date.localeCompare(a.date))
  return groups
}
