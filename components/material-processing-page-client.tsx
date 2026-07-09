"use client"

import { MaterialProcessingTable } from "@/components/material-processing-table"
import type { MaterialStockEntry } from "@/components/material-stock-form"
import type { MaterialProcessingEntry } from "@/components/material-processing-form"

interface MaterialProcessingPageClientProps {
  stockEntries: MaterialStockEntry[]
  processingEntries: MaterialProcessingEntry[]
  userRole: string
}

export function MaterialProcessingPageClient({
  stockEntries,
  processingEntries,
  userRole,
}: MaterialProcessingPageClientProps) {
  return (
    <MaterialProcessingTable
      entries={processingEntries}
      userRole={userRole}
    />
  )
}
