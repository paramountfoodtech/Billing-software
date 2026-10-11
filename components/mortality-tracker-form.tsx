"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { getIndianToday } from "@/lib/date-time"
import type { MortalityTrackerEntry } from "@/lib/mortality-tracker"

export type { MortalityTrackerEntry } from "@/lib/mortality-tracker"

interface PriceCategory {
  id: string
  name: string
}

interface MortalityTrackerFormProps {
  selectedEntry?: MortalityTrackerEntry | null
  userRole: string
  organizationId: string
  configCategoryId: string | null
  priceCategories: PriceCategory[]
  onCancelEdit?: () => void
}

interface SlotField {
  label: string
  birdsKey: "opening_birds" | "afternoon_birds" | "closing_birds"
  kgKey: "opening_kg" | "afternoon_kg" | "closing_kg"
  color: string
  bgColor: string
}

const SLOTS: SlotField[] = [
  {
    label: "Opening of the Day",
    birdsKey: "opening_birds",
    kgKey: "opening_kg",
    color: "text-sky-700",
    bgColor: "bg-sky-50 border-sky-200",
  },
  {
    label: "Afternoon",
    birdsKey: "afternoon_birds",
    kgKey: "afternoon_kg",
    color: "text-amber-700",
    bgColor: "bg-amber-50 border-amber-200",
  },
  {
    label: "Closing of the Day",
    birdsKey: "closing_birds",
    kgKey: "closing_kg",
    color: "text-rose-700",
    bgColor: "bg-rose-50 border-rose-200",
  },
]

const toNum = (v: string | number | null | undefined) => Number(v ?? 0)

export function MortalityTrackerForm({
  selectedEntry,
  userRole,
  organizationId,
  configCategoryId,
  priceCategories,
  onCancelEdit,
}: MortalityTrackerFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const isEditing = Boolean(selectedEntry)
  const canCreate = userRole === "super_admin" || userRole === "admin"
  const canEdit = userRole === "super_admin" || userRole === "admin"
  const canWrite = isEditing ? canEdit : canCreate
  const [isLoading, setIsLoading] = useState(false)
  const [liveRate, setLiveRate] = useState<number | null>(null)
  const [liveCategoryName, setLiveCategoryName] = useState<string | null>(null)
  const [isFetchingRate, setIsFetchingRate] = useState(false)

  const [formData, setFormData] = useState({
    entry_date: selectedEntry?.entry_date ?? getIndianToday(),
    vehicle_number: selectedEntry?.vehicle_number ?? "",
    opening_birds: String(selectedEntry?.opening_birds ?? ""),
    opening_kg: String(selectedEntry?.opening_kg ?? ""),
    afternoon_birds: String(selectedEntry?.afternoon_birds ?? ""),
    afternoon_kg: String(selectedEntry?.afternoon_kg ?? ""),
    closing_birds: String(selectedEntry?.closing_birds ?? ""),
    closing_kg: String(selectedEntry?.closing_kg ?? ""),
    notes: selectedEntry?.notes ?? "",
  })

  const fallbackLiveCat = priceCategories.find((c) => c.name?.toLowerCase().includes("live"))
  const effectiveCategoryId = configCategoryId || fallbackLiveCat?.id || null

  // ── Derived totals ───────────────────────────────────────────────────────
  const totalBirds =
    toNum(formData.opening_birds) + toNum(formData.afternoon_birds) + toNum(formData.closing_birds)
  const totalKg =
    toNum(formData.opening_kg) + toNum(formData.afternoon_kg) + toNum(formData.closing_kg)
  const estimatedValue = liveRate != null ? +(totalKg * liveRate).toFixed(2) : null

  // ── Fetch today's rate for the configured / fallback category ────────────
  useEffect(() => {
    if (!effectiveCategoryId || !formData.entry_date) {
      setLiveRate(null)
      setLiveCategoryName(null)
      return
    }
    let cancelled = false
    setIsFetchingRate(true)

    async function fetchRate() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("price_category_history")
          .select("price")
          .eq("organization_id", organizationId)
          .eq("price_category_id", effectiveCategoryId)
          .eq("effective_date", formData.entry_date)
          .order("created_at", { ascending: false })
          .limit(1)

        if (cancelled) return
        if (!error && data && data.length > 0 && data[0].price != null) {
          setLiveRate(Number(data[0].price))
          setLiveCategoryName(
            priceCategories.find((c) => c.id === effectiveCategoryId)?.name ?? null
          )
        } else {
          setLiveRate(null)
          setLiveCategoryName(
            priceCategories.find((c) => c.id === effectiveCategoryId)?.name ?? null
          )
        }
      } catch {
        if (!cancelled) {
          setLiveRate(null)
        }
      } finally {
        if (!cancelled) {
          setIsFetchingRate(false)
        }
      }
    }

    fetchRate()

    return () => {
      cancelled = true
    }
  }, [effectiveCategoryId, formData.entry_date, organizationId, priceCategories])

  const handleChange = (key: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canWrite) return
    const today = getIndianToday()
    if (formData.entry_date > today) {
      toast({
        variant: "destructive",
        title: "Future dates not allowed",
        description: "Mortality entry date cannot be in the future.",
      })
      return
    }

    const vehicleNum = formData.vehicle_number.trim().toUpperCase()
    if (!vehicleNum) {
      toast({ variant: "destructive", title: "Vehicle number is required", description: "Please enter a valid vehicle number." })
      return
    }

    setIsLoading(true)
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const payload = {
      organization_id: organizationId,
      entry_date: formData.entry_date,
      vehicle_number: vehicleNum,
      opening_birds: toNum(formData.opening_birds),
      opening_kg: toNum(formData.opening_kg),
      afternoon_birds: toNum(formData.afternoon_birds),
      afternoon_kg: toNum(formData.afternoon_kg),
      closing_birds: toNum(formData.closing_birds),
      closing_kg: toNum(formData.closing_kg),
      notes: formData.notes?.trim() || null,
      live_paper_category_id: effectiveCategoryId || null,
      live_paper_rate: liveRate != null ? Number(liveRate) : null,
      total_value: estimatedValue != null ? Number(estimatedValue) : null,
      created_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    }

    try {
      let error: any
      if (isEditing && selectedEntry) {
        ;({ error } = await supabase
          .from("mortality_tracker_entries")
          .update(payload)
          .eq("id", selectedEntry.id))
      } else {
        ;({ error } = await supabase.from("mortality_tracker_entries").insert(payload))
      }

      if (error) throw error

      toast({
        variant: "success",
        title: isEditing ? "Entry updated" : "Entry saved",
        description: `Mortality entry for ${payload.vehicle_number} on ${payload.entry_date} has been ${isEditing ? "updated" : "saved"}.`,
      })

      if (isEditing) {
        router.refresh()
        if (onCancelEdit) onCancelEdit()
      } else {
        router.push("/dashboard/operations/mortality")
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err?.message ?? "Failed to save entry.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const categoryName =
    liveCategoryName ?? priceCategories.find((c) => c.id === effectiveCategoryId)?.name

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="entry_date">Date</Label>
          <Input
            id="entry_date"
            type="date"
            value={formData.entry_date}
            onChange={(e) => handleChange("entry_date", e.target.value)}
            required
            disabled={!canWrite}
            max={getIndianToday()}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vehicle_number">
            Vehicle Number <span className="text-red-500">*</span>
          </Label>
          <Input
            id="vehicle_number"
            placeholder="e.g. TN 01 AB 1234"
            value={formData.vehicle_number}
            onChange={(e) => handleChange("vehicle_number", e.target.value)}
            required
            disabled={!canWrite}
            className="uppercase font-mono"
          />
        </div>
      </div>

      {/* Time-slot cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SLOTS.map((slot) => (
          <Card key={slot.label} className={`border ${slot.bgColor}`}>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className={`text-sm font-semibold ${slot.color}`}>{slot.label}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="space-y-1">
                <Label htmlFor={slot.birdsKey} className="text-xs text-slate-600">
                  Birds
                </Label>
                <Input
                  id={slot.birdsKey}
                  type="number"
                  min={0}
                  step={1}
                  placeholder="0"
                  value={formData[slot.birdsKey]}
                  onChange={(e) => handleChange(slot.birdsKey, e.target.value)}
                  disabled={!canWrite}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={slot.kgKey} className="text-xs text-slate-600">
                  Weight (KGs)
                </Label>
                <Input
                  id={slot.kgKey}
                  type="number"
                  min={0}
                  step={0.001}
                  placeholder="0.000"
                  value={formData[slot.kgKey]}
                  onChange={(e) => handleChange(slot.kgKey, e.target.value)}
                  disabled={!canWrite}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* EOD Summary preview */}
      <Card className="border border-slate-200 bg-slate-50">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-slate-700">EOD Summary Preview</CardTitle>
          <CardDescription className="text-xs">Calculated in real-time</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-white border border-slate-200 p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">Total Birds</p>
              <p className="text-xl font-bold text-slate-800">{totalBirds.toLocaleString("en-IN")}</p>
            </div>
            <div className="rounded-lg bg-white border border-slate-200 p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">Total KGs</p>
              <p className="text-xl font-bold text-slate-800">{totalKg.toFixed(3)}</p>
            </div>
            <div className="rounded-lg bg-white border border-slate-200 p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">
                Rate / KG
                {categoryName && (
                  <span className="ml-1 text-slate-400">({categoryName})</span>
                )}
              </p>
              {isFetchingRate ? (
                <Spinner className="h-4 w-4 mx-auto mt-1" />
              ) : liveRate != null ? (
                <p className="text-xl font-bold text-emerald-600">₹{liveRate.toFixed(2)}</p>
              ) : effectiveCategoryId ? (
                <p className="text-xs text-slate-400 mt-1">No price for this date</p>
              ) : (
                <p className="text-xs text-slate-400 mt-1">Not configured</p>
              )}
            </div>
            <div className="rounded-lg bg-white border border-slate-200 p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">Est. Value</p>
              {estimatedValue != null ? (
                <p className="text-xl font-bold text-indigo-600">
                  ₹{estimatedValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              ) : (
                <p className="text-xs text-slate-400 mt-1">—</p>
              )}
            </div>
          </div>
          {!effectiveCategoryId && (
            <p className="mt-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              ⚠ Live Paper Rate category not configured. Ask your super admin to set it in Settings.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="mortality_notes">Notes (optional)</Label>
        <Textarea
          id="mortality_notes"
          placeholder="Any remarks or observations..."
          value={formData.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          rows={2}
          disabled={!canWrite}
        />
      </div>

      {/* Actions */}
      {canWrite && (
        <div className="flex gap-3 justify-end">
          {isEditing || onCancelEdit ? (
            <Button type="button" variant="outline" onClick={onCancelEdit} disabled={isLoading}>
              Cancel
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/operations/mortality")}
              disabled={isLoading}
            >
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isLoading} className="min-w-[120px]">
            {isLoading ? <Spinner className="h-4 w-4" /> : isEditing ? "Update Entry" : "Save Entry"}
          </Button>
        </div>
      )}
    </form>
  )
}
