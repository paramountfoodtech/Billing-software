"use client"

import { useState } from "react"
import { Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { createClient } from "@/lib/supabase/client"
import {
  actionLabel,
  fetchEntryHistory,
  formatHistoryTimestamp,
  type EntryEntityType,
  type EntryHistoryRow,
} from "@/lib/entry-history"

type EntryHistoryButtonProps = {
  entityType: EntryEntityType
  entityId: string
  createdAt?: string | null
  createdByName?: string | null
  className?: string
}

function buildDisplayRows(
  rows: EntryHistoryRow[],
  createdAt?: string | null,
  createdByName?: string | null,
): EntryHistoryRow[] {
  const hasCreated = rows.some((r) => r.action === "created")
  const fallback: EntryHistoryRow[] = []

  if (!hasCreated && createdAt) {
    fallback.push({
      id: "fallback-created",
      action: "created",
      user_name: createdByName || null,
      occurred_at: createdAt,
      summary: null,
    })
  }

  return [...rows, ...fallback].sort(
    (a, b) =>
      new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  )
}

export function EntryHistoryButton({
  entityType,
  entityId,
  createdAt,
  createdByName,
  className,
}: EntryHistoryButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<EntryHistoryRow[] | null>(null)

  const handleOpenChange = async (next: boolean) => {
    setOpen(next)
    if (!next || rows !== null) return

    setLoading(true)
    try {
      const supabase = createClient()
      const fetched = await fetchEntryHistory(supabase, entityType, entityId)
      setRows(
        buildDisplayRows(fetched, createdAt, createdByName),
      )
    } finally {
      setLoading(false)
    }
  }

  const displayRows =
    rows ??
    buildDisplayRows([], createdAt, createdByName)

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={className}
          title="Entry history"
          aria-label="View entry history"
        >
          <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2">
          <p className="text-sm font-semibold">Entry history</p>
          <p className="text-xs text-muted-foreground">
            Who created or last edited this record
          </p>
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          {loading ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : displayRows.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">
              No history recorded yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {displayRows.map((row) => (
                <li
                  key={row.id}
                  className="rounded-md border bg-muted/30 px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">
                      {actionLabel(row.action)}
                    </span>
                    <span className="text-muted-foreground whitespace-nowrap">
                      {formatHistoryTimestamp(row.occurred_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {row.user_name || "Unknown user"}
                  </p>
                  {row.summary && (
                    <p className="mt-1 text-[11px] text-muted-foreground/90">
                      {row.summary}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
