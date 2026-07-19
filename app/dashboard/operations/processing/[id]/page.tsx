import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Pencil } from "lucide-react"
import Link from "next/link"
import { Notes } from "@/components/notes"
import { EntryHistoryButton } from "@/components/entry-history-button"
import { formatIndianDate } from "@/lib/date-time"
import { IconTooltip } from "@/components/icon-tooltip"
import { fmtPercent } from "@/lib/material-calculations"
import { getEntryStockBreakdown, type MaterialProcessingEntry } from "@/lib/material-processing"

export const revalidate = 0

export default async function ProcessingEntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  const userRole = profile?.role
  const canEdit = userRole === "super_admin"

  // Fetch entry with creator
  const { data: entry, error } = await supabase
    .from("material_processing_entries")
    .select(
      `
      *,
      profiles!material_processing_entries_created_by_fkey (full_name)
    `,
    )
    .eq("id", id)
    .maybeSingle()

  if (error || !entry) notFound()

  // Fetch notes
  const { data: notesRaw } = await supabase
    .from("material_processing_notes")
    .select(
      `
      id,
      note,
      created_at,
      created_by,
      created_by_profile:profiles!created_by (full_name, role)
    `,
    )
    .eq("processing_entry_id", id)
    .order("created_at", { ascending: false })

  const notes = (notesRaw || [])
    .filter((n: any) => n.created_by_profile !== null)
    .map((n: any) => ({
      id: n.id,
      note: n.note,
      created_at: n.created_at,
      profiles: n.created_by_profile,
    }))

  const fmtKg = (val: unknown) =>
    Number(val || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " KG"

  const yieldPct = Number(entry.yield_percent || 0)
  const breakdown = getEntryStockBreakdown(entry as MaterialProcessingEntry)

  const fmtBirds = (val: unknown) => `${Number(val || 0)} birds`

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <IconTooltip label="Back to Processing">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/operations/processing">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Processing
            </Link>
          </Button>
        </IconTooltip>
        <div className="flex items-center gap-2">
          <EntryHistoryButton
            entityType="material_processing"
            entityId={id}
            createdAt={entry.created_at}
            createdByName={entry.profiles?.full_name}
          />
          {canEdit && (
            <IconTooltip label="Edit processing entry">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/operations/processing/${id}/edit`}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Link>
              </Button>
            </IconTooltip>
          )}
        </div>
      </div>

      {/* Entry Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>
            Processing Entry —{" "}
            {formatIndianDate(entry.processing_date, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Top info row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Recorded By</p>
              <p className="font-medium">{entry.profiles?.full_name || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Recorded At</p>
              <p className="font-medium">
                {formatIndianDate(entry.created_at, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>

          {/* Available Material */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-4">Available Material</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border bg-slate-50 p-4">
                <p className="text-xs text-muted-foreground mb-1">Today&apos;s Stock</p>
                <p className="text-lg font-bold">{fmtKg(breakdown.stockWeightKg)}</p>
                <p className="text-xs text-muted-foreground">{fmtBirds(breakdown.stockBirds)}</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
                <p className="text-xs text-amber-800 mb-1">Previous Day Leftover</p>
                {breakdown.carryoverFromDate && (
                  <p className="text-xs text-amber-700 mb-2">
                    From{" "}
                    {formatIndianDate(breakdown.carryoverFromDate, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Expected</p>
                <p className="text-sm font-medium">
                  {fmtBirds(breakdown.carryoverExpectedBirds)} ·{" "}
                  {fmtKg(breakdown.carryoverExpectedWeightKg)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">Actual (used)</p>
                <p className="text-lg font-bold text-amber-900">
                  {fmtBirds(breakdown.carryoverBirds)} · {fmtKg(breakdown.carryoverWeightKg)}
                </p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4">
                <p className="text-xs text-blue-800 mb-1">Total Available</p>
                <p className="text-lg font-bold text-blue-900">{fmtKg(entry.purchased_weight_kg)}</p>
                <p className="text-xs text-blue-700">{fmtBirds(entry.purchased_birds)}</p>
              </div>
            </div>
          </div>

          {/* Purchase & Processing */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-4">Today&apos;s Processing</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-lg border bg-green-50 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Processed Weight</p>
                <p className="text-lg font-bold text-green-700">{fmtKg(entry.processed_weight_kg)}</p>
                <p className="text-xs text-muted-foreground">{entry.processed_birds} birds</p>
              </div>
              <div className="rounded-lg border bg-red-50 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Mortality</p>
                <p className="text-lg font-bold text-red-600">{fmtKg(entry.mortality_weight_kg)}</p>
                <p className="text-xs text-muted-foreground">{entry.mortality_birds} birds</p>
              </div>
              <div className="rounded-lg border bg-purple-50 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Yield %</p>
                <p className={`text-lg font-bold ${yieldPct < 90 ? "text-amber-600" : "text-purple-700"}`}>
                  {fmtPercent(yieldPct)}%
                </p>
              </div>
              <div className="rounded-lg border bg-slate-50 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Used Stock</p>
                <p className="text-lg font-bold">{fmtKg(entry.used_stock_kg)}</p>
              </div>
            </div>
          </div>

          {/* Leftover */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-4">Today&apos;s Leftover</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="rounded-lg border bg-slate-50 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Expected Leftover</p>
                <p className="text-lg font-bold">{fmtKg(entry.expected_leftover_weight_kg)}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.expected_leftover_birds ?? "—"} birds
                </p>
              </div>
              <div className="rounded-lg border bg-slate-50 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Actual Leftover</p>
                <p className="text-lg font-bold">{fmtKg(entry.actual_leftover_weight_kg)}</p>
                <p className="text-xs text-muted-foreground">{entry.actual_leftover_birds} birds</p>
              </div>
              <div className="rounded-lg border bg-slate-50 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Leftover Variance</p>
                <p className="text-lg font-bold">{fmtKg(entry.leftover_variance_kg)}</p>
              </div>
            </div>
          </div>

          {/* Disposal Reason & Operational Remarks */}
          {(entry.disposal_reason || entry.operational_remarks) && (
            <div className="border-t pt-4 space-y-4">
              {entry.disposal_reason && (
                <div>
                  <h3 className="font-semibold mb-2">Disposal Reason</h3>
                  <p className="text-sm whitespace-pre-wrap bg-muted/40 rounded-lg p-4">
                    {entry.disposal_reason}
                  </p>
                </div>
              )}
              {entry.operational_remarks && (
                <div>
                  <h3 className="font-semibold mb-2">Operational Remarks</h3>
                  <p className="text-sm whitespace-pre-wrap bg-muted/40 rounded-lg p-4">
                    {entry.operational_remarks}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes Section */}
      <Notes
        notes={notes}
        referenceId={id}
        referenceType="material_processing"
        userRole={userRole}
      />
    </div>
  )
}
