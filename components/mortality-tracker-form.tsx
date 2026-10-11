"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, Lock } from "lucide-react"
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
import type { MortalityTrackerEntry, MortalityVehicleEntry } from "@/lib/mortality-tracker"

export type { MortalityTrackerEntry, MortalityVehicleEntry } from "@/lib/mortality-tracker"

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

interface FormVehicleRow {
  id: string
  vehicle_number: string
  birds: string
  kg: string
}

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
  // EOD (Closing of the Day) is completed when both closing birds and closing kg are entered
  const selectedHasEOD =
    selectedEntry != null &&
    Number(selectedEntry.closing_birds || 0) > 0 &&
    Number(selectedEntry.closing_kg || 0) > 0

  // Until EOD data is entered, it is editable for all roles. After EOD, only super_admin can edit.
  const canEdit = userRole === "super_admin" || !selectedHasEOD
  const canWrite = isEditing ? canEdit : true
  const [isLoading, setIsLoading] = useState(false)
  const [liveRate, setLiveRate] = useState<number | null>(null)
  const [liveCategoryName, setLiveCategoryName] = useState<string | null>(null)
  const [isFetchingRate, setIsFetchingRate] = useState(false)

  // Top header state (date only)
  const [formData, setFormData] = useState({
    entry_date: selectedEntry?.entry_date ?? getIndianToday(),
    opening_birds: String(selectedEntry?.opening_birds ?? ""),
    opening_kg: String(selectedEntry?.opening_kg ?? ""),
    afternoon_birds: String(selectedEntry?.afternoon_birds ?? ""),
    afternoon_kg: String(selectedEntry?.afternoon_kg ?? ""),
    closing_birds: String(selectedEntry?.closing_birds ?? ""),
    closing_kg: String(selectedEntry?.closing_kg ?? ""),
    notes: selectedEntry?.notes ?? "",
  })

  // Multiple vehicle rows for 'Mortality from the Vehicle'
  const [vehicles, setVehicles] = useState<FormVehicleRow[]>(() => {
    if (selectedEntry?.vehicle_entries && selectedEntry.vehicle_entries.length > 0) {
      return selectedEntry.vehicle_entries.map((v, idx) => ({
        id: v.id || String(idx + 1),
        vehicle_number: v.vehicle_number || "",
        birds: v.birds != null ? String(v.birds) : "",
        kg: v.kg != null ? String(v.kg) : "",
      }))
    }
    if (selectedEntry && (Number(selectedEntry.vehicle_mortality_birds) > 0 || Number(selectedEntry.vehicle_mortality_kg) > 0 || selectedEntry.vehicle_number)) {
      return [
        {
          id: "1",
          vehicle_number: selectedEntry.vehicle_number || "",
          birds: String(selectedEntry.vehicle_mortality_birds ?? ""),
          kg: String(selectedEntry.vehicle_mortality_kg ?? ""),
        },
      ]
    }
    return [{ id: "1", vehicle_number: "", birds: "", kg: "" }]
  })

  const fallbackLiveCat = priceCategories.find((c) => c.name?.toLowerCase().includes("live"))
  const effectiveCategoryId = configCategoryId || fallbackLiveCat?.id || null

  // ── Derived totals ───────────────────────────────────────────────────────
  const vehicleTotalBirds = vehicles.reduce((s, v) => s + toNum(v.birds), 0)
  const vehicleTotalKg = vehicles.reduce((s, v) => s + toNum(v.kg), 0)

  const totalBirds =
    vehicleTotalBirds +
    toNum(formData.opening_birds) +
    toNum(formData.afternoon_birds) +
    toNum(formData.closing_birds)

  const totalKg =
    vehicleTotalKg +
    toNum(formData.opening_kg) +
    toNum(formData.afternoon_kg) +
    toNum(formData.closing_kg)

  const estimatedValue = liveRate != null ? +(totalKg * liveRate).toFixed(2) : null

  // ── Multi-vehicle helpers ────────────────────────────────────────────────
  const handleAddVehicle = () => {
    setVehicles((prev) => [
      ...prev,
      { id: String(Date.now() + Math.random()), vehicle_number: "", birds: "", kg: "" },
    ])
  }

  const handleRemoveVehicle = (id: string) => {
    setVehicles((prev) => {
      if (prev.length <= 1) {
        return [{ id: "1", vehicle_number: "", birds: "", kg: "" }]
      }
      return prev.filter((v) => v.id !== id)
    })
  }

  const handleUpdateVehicle = (
    id: string,
    field: keyof Omit<FormVehicleRow, "id">,
    value: string
  ) => {
    setVehicles((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [field]: value } : v))
    )
  }

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
    if (!canWrite) {
      toast({
        variant: "destructive",
        title: "Permission denied",
        description: "EOD data has already been recorded for this date. Only Super Admin can edit this entry.",
      })
      return
    }

    const today = getIndianToday()
    if (formData.entry_date > today) {
      toast({
        variant: "destructive",
        title: "Future dates not allowed",
        description: "Mortality entry date cannot be in the future.",
      })
      return
    }

    // 1. Validate individual vehicle rows: each non-empty row must have both birds and kg
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i]
      const vBirds = toNum(v.birds)
      const vKg = toNum(v.kg)
      const vNum = v.vehicle_number.trim()
      const label = vNum ? `Vehicle ${vNum}` : `Vehicle row #${i + 1}`

      if (vBirds > 0 && vKg <= 0) {
        toast({
          variant: "destructive",
          title: "Incomplete vehicle entry",
          description: `Please enter weight (kg) for ${label}.`,
        })
        return
      }
      if (vKg > 0 && vBirds <= 0) {
        toast({
          variant: "destructive",
          title: "Incomplete vehicle entry",
          description: `Please enter number of birds for ${label}.`,
        })
        return
      }
    }

    // 2. Validate Opening of the Day: must have both birds and kg if partially filled
    const openingBirds = toNum(formData.opening_birds)
    const openingKg = toNum(formData.opening_kg)
    if (openingBirds > 0 && openingKg <= 0) {
      toast({
        variant: "destructive",
        title: "Incomplete Opening entry",
        description: "Please enter weight (kg) for Opening of the Day.",
      })
      return
    }
    if (openingKg > 0 && openingBirds <= 0) {
      toast({
        variant: "destructive",
        title: "Incomplete Opening entry",
        description: "Please enter number of birds for Opening of the Day.",
      })
      return
    }

    // 3. Validate Afternoon: must have both birds and kg if partially filled
    const afternoonBirds = toNum(formData.afternoon_birds)
    const afternoonKg = toNum(formData.afternoon_kg)
    if (afternoonBirds > 0 && afternoonKg <= 0) {
      toast({
        variant: "destructive",
        title: "Incomplete Afternoon entry",
        description: "Please enter weight (kg) for Afternoon.",
      })
      return
    }
    if (afternoonKg > 0 && afternoonBirds <= 0) {
      toast({
        variant: "destructive",
        title: "Incomplete Afternoon entry",
        description: "Please enter number of birds for Afternoon.",
      })
      return
    }

    // 4. Validate Closing of the Day (EOD): must have both birds and kg if partially filled
    const closingBirds = toNum(formData.closing_birds)
    const closingKg = toNum(formData.closing_kg)
    if (closingBirds > 0 && closingKg <= 0) {
      toast({
        variant: "destructive",
        title: "Incomplete Closing (EOD) entry",
        description: "Please enter weight (kg) for Closing of the Day (EOD).",
      })
      return
    }
    if (closingKg > 0 && closingBirds <= 0) {
      toast({
        variant: "destructive",
        title: "Incomplete Closing (EOD) entry",
        description: "Please enter number of birds for Closing of the Day (EOD).",
      })
      return
    }

    // 5. Must have at least one valid entry with both birds and kg
    const hasValidVehicle = vehicles.some((v) => toNum(v.birds) > 0 && toNum(v.kg) > 0)
    const hasValidOpening = openingBirds > 0 && openingKg > 0
    const hasValidAfternoon = afternoonBirds > 0 && afternoonKg > 0
    const hasValidClosing = closingBirds > 0 && closingKg > 0

    if (!hasValidVehicle && !hasValidOpening && !hasValidAfternoon && !hasValidClosing) {
      toast({
        variant: "destructive",
        title: "Mortality entry required",
        description: "Cannot save empty data. Please enter at least one mortality entry with both birds and weight (kg).",
      })
      return
    }

    // 6. EOD lock check when editing an existing entry that already has EOD data
    if (isEditing && selectedHasEOD && userRole !== "super_admin") {
      toast({
        variant: "destructive",
        title: "Permission denied",
        description: "EOD data has already been recorded for this date. Only Super Admin can edit this entry.",
      })
      return
    }

    // Vehicle details come directly from 'Mortality from the Vehicle'
    const cleanVehicles = vehicles
      .filter((v) => v.vehicle_number.trim() || toNum(v.birds) > 0 || toNum(v.kg) > 0)
      .map((v) => ({
        vehicle_number: v.vehicle_number.trim().toUpperCase(),
        birds: toNum(v.birds),
        kg: toNum(v.kg),
      }))

    const finalVehicleNum = cleanVehicles
      .map((v) => v.vehicle_number)
      .filter(Boolean)
      .join(", ") || null

    setIsLoading(true)
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const payload = {
      organization_id: organizationId,
      entry_date: formData.entry_date,
      vehicle_number: finalVehicleNum,
      vehicle_mortality_birds: vehicleTotalBirds,
      vehicle_mortality_kg: vehicleTotalKg,
      vehicle_entries: cleanVehicles,
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
        description: `Mortality entry for ${payload.entry_date} has been ${isEditing ? "updated" : "saved"}.`,
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
      {/* EOD Lock Notice */}
      {isEditing && selectedHasEOD && userRole !== "super_admin" && (
        <div className="flex items-center gap-3 p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
          <Lock className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-semibold">Locked Entry (EOD Completed)</p>
            <p className="text-xs text-amber-700 mt-0.5">
              End-of-day (EOD) data has already been recorded for this date. Only Super Admin can edit this entry.
            </p>
          </div>
        </div>
      )}

      {/* Header info - Date only */}
      <div className="space-y-1.5 max-w-xs">
        <Label htmlFor="entry_date">
          Date <span className="text-red-500">*</span>
        </Label>
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

      {/* 1st Option: Mortality from the Vehicle (Allows multiple vehicles) */}
      <Card className="border border-purple-200 bg-purple-50/40 shadow-xs">
        <CardHeader className="pb-3 pt-4 px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold text-purple-900 flex items-center gap-2">
              <span>Mortality from the Vehicle</span>
              <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-100 border-0">
                1st Entry
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs text-purple-600 mt-0.5">
              Add mortality data from one or multiple vehicles (Vehicle number is optional)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-white border-purple-300 text-purple-800 text-xs font-mono py-1">
              Subtotal: {vehicleTotalBirds.toLocaleString("en-IN")} birds | {vehicleTotalKg.toFixed(3)} KGs
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="space-y-2">
            {vehicles.map((v, index) => (
              <div
                key={v.id}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-2.5 bg-white rounded-lg border border-purple-100 shadow-xs items-end"
              >
                <div className="sm:col-span-5 space-y-1">
                  <Label className="text-xs text-slate-500">
                    Vehicle No <span className="text-[10px] text-muted-foreground font-normal">(Optional)</span>
                  </Label>
                  <Input
                    placeholder={`e.g. Vehicle ${index + 1}`}
                    value={v.vehicle_number}
                    onChange={(e) => handleUpdateVehicle(v.id, "vehicle_number", e.target.value)}
                    disabled={!canWrite}
                    className="h-8 text-xs uppercase font-mono"
                  />
                </div>
                <div className="sm:col-span-3 space-y-1">
                  <Label className="text-xs text-slate-500">Birds</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="0"
                    value={v.birds}
                    onChange={(e) => handleUpdateVehicle(v.id, "birds", e.target.value)}
                    disabled={!canWrite}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="sm:col-span-3 space-y-1">
                  <Label className="text-xs text-slate-500">Weight (KGs)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.001}
                    placeholder="0.000"
                    value={v.kg}
                    onChange={(e) => handleUpdateVehicle(v.id, "kg", e.target.value)}
                    disabled={!canWrite}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="sm:col-span-1 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => handleRemoveVehicle(v.id)}
                    disabled={!canWrite || (vehicles.length === 1 && !v.vehicle_number && !v.birds && !v.kg)}
                    title="Remove vehicle"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddVehicle}
              disabled={!canWrite}
              className="text-xs border-purple-200 text-purple-700 hover:bg-purple-100 hover:text-purple-800"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Another Vehicle
            </Button>
            <p className="text-xs text-slate-500">
              {vehicles.length} vehicle entr{vehicles.length === 1 ? "y" : "ies"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Remaining Time-slot cards: Opening, Afternoon, Closing */}
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
          <CardTitle className="text-sm font-semibold text-slate-700">EOD Consolidated Summary Preview</CardTitle>
          <CardDescription className="text-xs">
            Calculated in real-time across Vehicles + Opening + Afternoon + Closing
          </CardDescription>
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
                <p className="text-xl font-bold text-slate-400">—</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          rows={2}
          placeholder="Any observations, weather, vehicle delays, etc..."
          value={formData.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          disabled={!canWrite}
        />
      </div>

      {/* Actions */}
      {canWrite ? (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Spinner className="h-4 w-4 mr-2" /> : null}
            {isEditing ? "Update Entry" : "Save Entry"}
          </Button>
          {onCancelEdit && (
            <Button type="button" variant="outline" onClick={onCancelEdit} disabled={isLoading}>
              Cancel
            </Button>
          )}
          {!isEditing && (
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/operations/mortality")}
              disabled={isLoading}
            >
              Cancel
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-500 italic">Read-only mode (EOD locked)</span>
          {onCancelEdit && (
            <Button type="button" variant="outline" onClick={onCancelEdit}>
              Close
            </Button>
          )}
        </div>
      )}
    </form>
  )
}
