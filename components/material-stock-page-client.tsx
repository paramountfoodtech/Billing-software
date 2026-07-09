"use client"

import { MaterialStockTable } from "@/components/material-stock-table"
import type { MaterialStockEntry } from "@/components/material-stock-form"
import type { MaterialProcessingEntry } from "@/components/material-processing-form"

interface MaterialStockPageClientProps {
  entries: MaterialStockEntry[]
  processingEntries: MaterialProcessingEntry[]
  userRole: string
}

export function MaterialStockPageClient({
  entries,
  processingEntries,
  userRole,
}: MaterialStockPageClientProps) {
  return (
    <MaterialStockTable
      entries={entries}
      processingEntries={processingEntries}
      userRole={userRole}
    />
  )
}
