"use client"

import { MortalityTrackerForm } from "@/components/mortality-tracker-form"
import { MortalityTrackerTable } from "@/components/mortality-tracker-table"
import type { MortalityTrackerEntry } from "@/lib/mortality-tracker"

interface MortalityTrackerPageClientProps {
  entries: MortalityTrackerEntry[]
  userRole: string
  organizationId: string
  configCategoryId: string | null
  categoryName?: string | null
  priceCategories: { id: string; name: string }[]
  datePriceMap?: Record<string, number>
}

export function MortalityTrackerPageClient({
  entries,
  userRole,
  organizationId,
  configCategoryId,
  categoryName,
  priceCategories,
  datePriceMap,
}: MortalityTrackerPageClientProps) {
  return (
    <MortalityTrackerTable
      entries={entries}
      userRole={userRole}
      organizationId={organizationId}
      configCategoryId={configCategoryId}
      categoryName={categoryName}
      priceCategories={priceCategories}
      datePriceMap={datePriceMap}
    />
  )
}
