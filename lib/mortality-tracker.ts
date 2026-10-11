// Mortality Tracker types and data-layer helpers

export type MortalityTrackerConfig = {
  id: string
  organization_id: string
  live_paper_category_id: string | null
  updated_at: string
}

export type MortalityVehicleEntry = {
  id?: string
  vehicle_number?: string
  birds: number | string
  kg: number | string
}

export type MortalityTrackerEntry = {
  id: string
  organization_id: string
  entry_date: string
  vehicle_number?: string | null
  vehicle_mortality_birds?: number
  vehicle_mortality_kg?: number | string
  vehicle_entries?: MortalityVehicleEntry[] | null
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
    vehicle_mortality_birds: number
    vehicle_mortality_kg: number
    opening_birds: number
    opening_kg: number
    afternoon_birds: number
    afternoon_kg: number
    closing_birds: number
    closing_kg: number
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
    const vehicle_mortality_birds = dayEntries.reduce((s, e) => s + (Number(e.vehicle_mortality_birds) || 0), 0)
    const vehicle_mortality_kg = dayEntries.reduce((s, e) => s + (Number(e.vehicle_mortality_kg) || 0), 0)
    const opening_birds = dayEntries.reduce((s, e) => s + (Number(e.opening_birds) || 0), 0)
    const opening_kg = dayEntries.reduce((s, e) => s + (Number(e.opening_kg) || 0), 0)
    const afternoon_birds = dayEntries.reduce((s, e) => s + (Number(e.afternoon_birds) || 0), 0)
    const afternoon_kg = dayEntries.reduce((s, e) => s + (Number(e.afternoon_kg) || 0), 0)
    const closing_birds = dayEntries.reduce((s, e) => s + (Number(e.closing_birds) || 0), 0)
    const closing_kg = dayEntries.reduce((s, e) => s + (Number(e.closing_kg) || 0), 0)

    const total_birds = dayEntries.reduce((s, e) => {
      if (e.total_birds != null) return s + Number(e.total_birds)
      const sub = (Number(e.vehicle_mortality_birds) || 0) + (Number(e.opening_birds) || 0) + (Number(e.afternoon_birds) || 0) + (Number(e.closing_birds) || 0)
      return s + sub
    }, 0)

    const total_kg = dayEntries.reduce((s, e) => {
      if (e.total_kg != null) return s + Number(e.total_kg)
      const sub = (Number(e.vehicle_mortality_kg) || 0) + (Number(e.opening_kg) || 0) + (Number(e.afternoon_kg) || 0) + (Number(e.closing_kg) || 0)
      return s + sub
    }, 0)

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
      const rowBirds = e.total_birds != null ? Number(e.total_birds) : (
        (Number(e.vehicle_mortality_birds) || 0) + (Number(e.opening_birds) || 0) + (Number(e.afternoon_birds) || 0) + (Number(e.closing_birds) || 0)
      )
      const rowTotalKg = e.total_kg != null ? Number(e.total_kg) : (
        (Number(e.vehicle_mortality_kg) || 0) + (Number(e.opening_kg) || 0) + (Number(e.afternoon_kg) || 0) + (Number(e.closing_kg) || 0)
      )
      const rowVal = rowRate != null ? +(rowTotalKg * rowRate).toFixed(2) : (e.total_value != null ? Number(e.total_value) : null)
      return {
        ...e,
        total_birds: rowBirds,
        total_kg: rowTotalKg,
        live_paper_rate: rowRate,
        total_value: rowVal,
      }
    })

    groups.push({
      date,
      entries: enrichedEntries,
      consolidated: {
        vehicle_mortality_birds,
        vehicle_mortality_kg,
        opening_birds,
        opening_kg,
        afternoon_birds,
        afternoon_kg,
        closing_birds,
        closing_kg,
        total_birds,
        total_kg,
        live_paper_rate,
        total_value,
        category_name,
      },
    })
  }

  // Sort descending by date
  groups.sort((a, b) => b.date.localeCompare(a.date))
  return groups
}
