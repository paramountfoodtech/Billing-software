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

export const revalidate = 0

export default async function StockEntryDetailPage({
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
    .from("material_stock_entries")
    .select(
      `
      *,
      profiles!material_stock_entries_created_by_fkey (full_name)
    `,
    )
    .eq("id", id)
    .maybeSingle()

  if (error || !entry) notFound()

  // Fetch notes
  const { data: notesRaw } = await supabase
    .from("material_stock_notes")
    .select(
      `
      id,
      note,
      created_at,
      created_by,
      created_by_profile:profiles!created_by (full_name, role)
    `,
    )
    .eq("stock_entry_id", id)
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

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <IconTooltip label="Back to Stock">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/operations/stock">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Stock
            </Link>
          </Button>
        </IconTooltip>
        <div className="flex items-center gap-2">
          <EntryHistoryButton
            entityType="material_stock"
            entityId={id}
            createdAt={entry.created_at}
            createdByName={entry.profiles?.full_name}
          />
          {canEdit && (
            <IconTooltip label="Edit stock entry">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/operations/stock/${id}/edit`}>
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
            Stock Entry — {entry.reference_number}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Top info row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Purchase Date</p>
              <p className="font-medium">
                {formatIndianDate(entry.purchase_date, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            {entry.vehicle_number && (
              <div>
                <p className="text-sm text-muted-foreground">Vehicle Number</p>
                <p className="font-medium">{entry.vehicle_number}</p>
              </div>
            )}
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

          {/* Weight & birds grid */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-4">Weight & Bird Counts</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-lg border bg-blue-50 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Farm Weight</p>
                <p className="text-lg font-bold text-blue-700">{fmtKg(entry.farm_weight_kg)}</p>
                <p className="text-xs text-muted-foreground">{entry.farm_birds} birds</p>
              </div>
              <div className="rounded-lg border bg-green-50 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Bridge Weight</p>
                <p className="text-lg font-bold text-green-700">{fmtKg(entry.bridge_weight_kg)}</p>
                <p className="text-xs text-muted-foreground">{entry.bridge_birds} birds</p>
              </div>
              <div className="rounded-lg border bg-slate-50 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Difference</p>
                <p className="text-lg font-bold">{fmtKg(entry.difference_kg)}</p>
              </div>
              <div className="rounded-lg border bg-amber-50 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Variance %</p>
                <p className={`text-lg font-bold ${Number(entry.variance_percent || 0) > 1 ? "text-amber-600" : ""}`}>
                  {fmtPercent(entry.variance_percent)}%
                </p>
              </div>
            </div>
          </div>

          {/* Remarks */}
          {entry.remarks && (
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">Remarks</h3>
              <p className="text-sm whitespace-pre-wrap bg-muted/40 rounded-lg p-4">
                {entry.remarks}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes Section */}
      <Notes
        notes={notes}
        referenceId={id}
        referenceType="material_stock"
        userRole={userRole}
      />
    </div>
  )
}
