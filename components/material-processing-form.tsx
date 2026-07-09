"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { formatIndianDate, getIndianToday } from "@/lib/date-time"
import {
  calculateExpectedLeftoverBirds,
  calculateProcessingSummary,
  fmtPercent,
  toNumber,
} from "@/lib/material-calculations"
import {
  getPreviousDayExpectedLeftover,
  getProcessingAvailability,
  type MaterialProcessingEntry,
} from "@/lib/material-processing"
import { getProfileDisplayName, logEntryHistory } from "@/lib/entry-history"
import type { MaterialStockEntry } from "@/components/material-stock-form"

export type { MaterialProcessingEntry } from "@/lib/material-processing"

interface MaterialProcessingFormProps {
  stockEntries: MaterialStockEntry[]
  processingEntries: MaterialProcessingEntry[]
  selectedEntry?: MaterialProcessingEntry | null
  userRole: string
  onCancelEdit?: () => void
}

export function MaterialProcessingForm({
  stockEntries,
  processingEntries,
  selectedEntry,
  userRole,
  onCancelEdit,
}: MaterialProcessingFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const canWrite = userRole === "super_admin" || userRole === "admin"
  const isEditing = Boolean(selectedEntry)
  const today = getIndianToday()
  const [isLoading, setIsLoading] = useState(false)
  const [leftoverEdited, setLeftoverEdited] = useState(false)
  const [carryoverActualEdited, setCarryoverActualEdited] = useState(false)

  const [formData, setFormData] = useState({
    processing_date: getIndianToday(),
    carryover_actual_birds: "",
    carryover_actual_weight_kg: "",
    processed_birds: "",
    processed_weight_kg: "",
    mortality_birds: "",
    mortality_weight_kg: "",
    disposal_reason: "",
    actual_leftover_birds: "",
    actual_leftover_weight_kg: "",
    operational_remarks: "",
  })

  useEffect(() => {
    if (selectedEntry) {
      setFormData({
        processing_date: selectedEntry.processing_date,
        carryover_actual_birds: String(selectedEntry.carryover_actual_leftover_birds ?? ""),
        carryover_actual_weight_kg: String(
          selectedEntry.carryover_actual_leftover_weight_kg ?? "",
        ),
        processed_birds: String(selectedEntry.processed_birds || ""),
        processed_weight_kg: String(selectedEntry.processed_weight_kg || ""),
        mortality_birds: String(selectedEntry.mortality_birds || ""),
        mortality_weight_kg: String(selectedEntry.mortality_weight_kg || ""),
        disposal_reason: selectedEntry.disposal_reason || "",
        actual_leftover_birds: String(selectedEntry.actual_leftover_birds || ""),
        actual_leftover_weight_kg: String(selectedEntry.actual_leftover_weight_kg || ""),
        operational_remarks: selectedEntry.operational_remarks || "",
      })
      setLeftoverEdited(true)
      setCarryoverActualEdited(true)
      return
    }

    setFormData({
      processing_date: getIndianToday(),
      carryover_actual_birds: "",
      carryover_actual_weight_kg: "",
      processed_birds: "",
      processed_weight_kg: "",
      mortality_birds: "",
      mortality_weight_kg: "",
      disposal_reason: "",
      actual_leftover_birds: "",
      actual_leftover_weight_kg: "",
      operational_remarks: "",
    })
    setLeftoverEdited(false)
    setCarryoverActualEdited(false)
  }, [selectedEntry])

  const previousExpected = useMemo(
    () =>
      getPreviousDayExpectedLeftover(
        processingEntries,
        formData.processing_date,
        selectedEntry?.id,
      ),
    [processingEntries, formData.processing_date, selectedEntry?.id],
  )

  useEffect(() => {
    if (carryoverActualEdited || isEditing) return
    setFormData((prev) => ({
      ...prev,
      carryover_actual_birds:
        previousExpected.expectedBirds > 0
          ? String(previousExpected.expectedBirds)
          : "0",
      carryover_actual_weight_kg:
        previousExpected.expectedWeightKg > 0
          ? String(previousExpected.expectedWeightKg)
          : "0",
    }))
  }, [
    previousExpected.expectedBirds,
    previousExpected.expectedWeightKg,
    formData.processing_date,
    carryoverActualEdited,
    isEditing,
  ])

  const availability = useMemo(() => {
    const base = getProcessingAvailability({
      stockEntries,
      processingEntries,
      processingDate: formData.processing_date,
      excludeEntryId: selectedEntry?.id,
      carryoverActualBirds: toNumber(formData.carryover_actual_birds),
      carryoverActualWeightKg: toNumber(formData.carryover_actual_weight_kg),
    })

    if (isEditing && selectedEntry) {
      return {
        ...base,
        carryover: {
          ...base.carryover,
          fromDate: selectedEntry.carryover_from_date ?? base.carryover.fromDate,
          expectedBirds: Number(
            selectedEntry.carryover_expected_leftover_birds ?? base.carryover.expectedBirds,
          ),
          expectedWeightKg: toNumber(
            selectedEntry.carryover_expected_leftover_weight_kg ??
              base.carryover.expectedWeightKg,
          ),
          actualBirds: toNumber(formData.carryover_actual_birds),
          actualWeightKg: toNumber(formData.carryover_actual_weight_kg),
        },
        totalBirds: base.currentStock.birds + toNumber(formData.carryover_actual_birds),
        totalWeightKg:
          base.currentStock.weightKg + toNumber(formData.carryover_actual_weight_kg),
      }
    }

    return base
  }, [
    stockEntries,
    processingEntries,
    formData.processing_date,
    formData.carryover_actual_birds,
    formData.carryover_actual_weight_kg,
    selectedEntry,
    isEditing,
  ])

  const { currentStock, carryover, totalBirds, totalWeightKg } = availability

  const summary = useMemo(
    () =>
      calculateProcessingSummary({
        purchasedWeightKg: totalWeightKg,
        processedWeightKg: toNumber(formData.processed_weight_kg),
        mortalityWeightKg: toNumber(formData.mortality_weight_kg),
        actualLeftoverWeightKg: toNumber(formData.actual_leftover_weight_kg),
      }),
    [
      totalWeightKg,
      formData.processed_weight_kg,
      formData.mortality_weight_kg,
      formData.actual_leftover_weight_kg,
    ],
  )

  const expectedLeftoverBirdsToday = useMemo(
    () =>
      calculateExpectedLeftoverBirds({
        purchasedBirds: totalBirds,
        processedBirds: toNumber(formData.processed_birds),
        mortalityBirds: toNumber(formData.mortality_birds),
      }),
    [totalBirds, formData.processed_birds, formData.mortality_birds],
  )

  useEffect(() => {
    if (leftoverEdited) return
    if (isEditing) return

    const expectedWeight = calculateProcessingSummary({
      purchasedWeightKg: totalWeightKg,
      processedWeightKg: toNumber(formData.processed_weight_kg),
      mortalityWeightKg: toNumber(formData.mortality_weight_kg),
      actualLeftoverWeightKg: 0,
    }).expectedLeftoverWeightKg

    setFormData((prev) => ({
      ...prev,
      actual_leftover_weight_kg: expectedWeight > 0 ? String(expectedWeight) : "0",
      actual_leftover_birds:
        expectedLeftoverBirdsToday > 0 ? String(expectedLeftoverBirdsToday) : "0",
    }))
  }, [
    totalWeightKg,
    totalBirds,
    formData.processed_weight_kg,
    formData.processed_birds,
    formData.mortality_weight_kg,
    formData.mortality_birds,
    expectedLeftoverBirdsToday,
    leftoverEdited,
    isEditing,
  ])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canWrite) {
      toast({
        variant: "destructive",
        title: "Read only access",
        description: "Accountants can view operations but cannot make changes.",
      })
      return
    }

    const duplicate = processingEntries.find(
      (entry) =>
        entry.processing_date === formData.processing_date &&
        entry.id !== selectedEntry?.id,
    )
    if (duplicate) {
      toast({
        variant: "destructive",
        title: "Processing entry exists",
        description: "Only one processing entry is allowed for a date.",
      })
      return
    }

    if (!formData.processed_birds || Number(formData.processed_birds) <= 0) {
      toast({
        variant: "destructive",
        title: "Missing processed birds",
        description: "Please enter the number of processed birds.",
      })
      return
    }

    if (!formData.processed_weight_kg || Number(formData.processed_weight_kg) <= 0) {
      toast({
        variant: "destructive",
        title: "Missing processed weight",
        description: "Please enter the processed weight in KG.",
      })
      return
    }

    setIsLoading(true)
    const supabase = createClient()

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Authentication required")

      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id, role")
        .eq("id", user.id)
        .single()

      if (!profile?.organization_id) throw new Error("User must belong to an organization")
      if (!["super_admin", "admin"].includes(profile.role)) {
        throw new Error("You do not have permission to save processing entries")
      }
      if (formData.processing_date > getIndianToday()) {
        throw new Error("Processing date cannot be in the future")
      }
      if (totalWeightKg <= 0) {
        throw new Error("No stock or previous-day leftover found for the selected processing date")
      }

      const carryoverActualBirds = Math.max(
        0,
        Math.floor(toNumber(formData.carryover_actual_birds)),
      )
      const carryoverActualWeightKg = toNumber(formData.carryover_actual_weight_kg)
      const processedWeightKg = toNumber(formData.processed_weight_kg)
      const mortalityWeightKg = toNumber(formData.mortality_weight_kg)
      const actualLeftoverWeightKg = toNumber(formData.actual_leftover_weight_kg)
      const actualLeftoverBirds = Math.max(
        0,
        Math.floor(toNumber(formData.actual_leftover_birds)),
      )

      const finalSummary = calculateProcessingSummary({
        purchasedWeightKg: totalWeightKg,
        processedWeightKg,
        mortalityWeightKg,
        actualLeftoverWeightKg,
      })

      const expectedBirdsToday = calculateExpectedLeftoverBirds({
        purchasedBirds: totalBirds,
        processedBirds: toNumber(formData.processed_birds),
        mortalityBirds: toNumber(formData.mortality_birds),
      })

      const payload = {
        processing_date: formData.processing_date,
        current_stock_birds: currentStock.birds,
        current_stock_weight_kg: currentStock.weightKg,
        carryover_from_date: carryover.fromDate,
        carryover_expected_leftover_birds: carryover.expectedBirds,
        carryover_expected_leftover_weight_kg: carryover.expectedWeightKg,
        carryover_actual_leftover_birds: carryoverActualBirds,
        carryover_actual_leftover_weight_kg: carryoverActualWeightKg,
        purchased_birds: totalBirds,
        purchased_weight_kg: totalWeightKg,
        processed_birds: Math.max(0, Math.floor(toNumber(formData.processed_birds))),
        processed_weight_kg: processedWeightKg,
        mortality_birds: Math.max(0, Math.floor(toNumber(formData.mortality_birds))),
        mortality_weight_kg: mortalityWeightKg,
        expected_leftover_birds: expectedBirdsToday,
        expected_leftover_weight_kg: finalSummary.expectedLeftoverWeightKg,
        actual_leftover_birds: actualLeftoverBirds,
        actual_leftover_weight_kg: actualLeftoverWeightKg,
        leftover_variance_kg: finalSummary.leftoverVarianceKg,
        used_stock_kg: finalSummary.usedStockKg,
        yield_percent: finalSummary.yieldPercent,
        disposal_reason: formData.disposal_reason.trim() || null,
        operational_remarks: formData.operational_remarks.trim() || null,
        updated_at: new Date().toISOString(),
      }

      let entityId = selectedEntry?.id
      if (selectedEntry) {
        const { error } = await supabase
          .from("material_processing_entries")
          .update(payload)
          .eq("id", selectedEntry.id)
        if (error) throw error
      } else {
        const { data: created, error } = await supabase
          .from("material_processing_entries")
          .insert({
            ...payload,
            organization_id: profile.organization_id,
            created_by: user.id,
          })
          .select("id")
          .single()
        if (error) throw error
        entityId = created?.id
      }

      if (carryover.fromDate) {
        const previousEntry = processingEntries.find(
          (entry) => entry.processing_date === carryover.fromDate,
        )
        if (
          previousEntry &&
          (Number(previousEntry.actual_leftover_birds) !== carryoverActualBirds ||
            toNumber(previousEntry.actual_leftover_weight_kg) !== carryoverActualWeightKg)
        ) {
          const { error: syncError } = await supabase
            .from("material_processing_entries")
            .update({
              actual_leftover_birds: carryoverActualBirds,
              actual_leftover_weight_kg: carryoverActualWeightKg,
              updated_at: new Date().toISOString(),
            })
            .eq("id", previousEntry.id)
          if (syncError) throw syncError

          const userName = await getProfileDisplayName(supabase, user.id)
          await logEntryHistory(supabase, {
            organizationId: profile.organization_id,
            entityType: "material_processing",
            entityId: previousEntry.id,
            action: "updated",
            userId: user.id,
            userName,
            summary: `Leftover synced from ${formData.processing_date} processing (${carryoverActualBirds} birds, ${carryoverActualWeightKg.toFixed(2)} KG)`,
          })
        }
      }

      const userName = await getProfileDisplayName(supabase, user.id)
      if (entityId) {
        await logEntryHistory(supabase, {
          organizationId: profile.organization_id,
          entityType: "material_processing",
          entityId,
          action: selectedEntry ? "updated" : "created",
          userId: user.id,
          userName,
          summary: `${selectedEntry ? "Updated" : "Created"} processing entry for ${payload.processing_date}`,
        })
      }

      toast({
        variant: "success",
        title: selectedEntry ? "Processing entry updated" : "Processing entry created",
        description: `Processing entry for ${payload.processing_date} saved successfully.`,
      })
      if (onCancelEdit) {
        onCancelEdit()
        router.refresh()
      } else {
        router.push("/dashboard/operations/processing")
      }
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save processing entry.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!canWrite) return null

  const carryoverDiffers =
    toNumber(formData.carryover_actual_weight_kg) !== carryover.expectedWeightKg ||
    toNumber(formData.carryover_actual_birds) !== carryover.expectedBirds

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {isEditing ? "Edit Processing Entry" : "Processing Entry"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="processing_date">Processing Date</Label>
            <Input
              id="processing_date"
              type="date"
              required
              max={today}
              value={formData.processing_date}
              onChange={(e) => {
                setLeftoverEdited(false)
                setCarryoverActualEdited(false)
                setFormData({ ...formData, processing_date: e.target.value })
              }}
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold">Available Material</p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border bg-slate-50 p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Today&apos;s Stock
                </p>
                <p className="mt-2 text-xl font-bold">{currentStock.birds} birds</p>
                <p className="text-lg font-semibold">{currentStock.weightKg.toFixed(2)} KG</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {currentStock.count} stock {currentStock.count === 1 ? "entry" : "entries"}
                </p>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 space-y-3">
                <div>
                  <p className="text-xs font-medium text-amber-800 uppercase tracking-wide">
                    Previous Day Leftover
                  </p>
                  {carryover.fromDate ? (
                    <p className="text-xs text-amber-700 mt-1">
                      From{" "}
                      {formatIndianDate(carryover.fromDate, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      processing
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">No previous day entry</p>
                  )}
                </div>

                <div className="rounded-md border border-amber-100 bg-white/80 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Expected (read-only)</p>
                  <p className="text-sm font-semibold">
                    {carryover.expectedBirds} birds · {carryover.expectedWeightKg.toFixed(2)} KG
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="carryover_actual_birds" className="text-xs">
                      Actual birds
                    </Label>
                    <Input
                      id="carryover_actual_birds"
                      type="number"
                      min="0"
                      value={formData.carryover_actual_birds}
                      onChange={(e) => {
                        setCarryoverActualEdited(true)
                        setLeftoverEdited(false)
                        setFormData({
                          ...formData,
                          carryover_actual_birds: e.target.value,
                        })
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="carryover_actual_weight_kg" className="text-xs">
                      Actual weight (KG)
                    </Label>
                    <Input
                      id="carryover_actual_weight_kg"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.carryover_actual_weight_kg}
                      onChange={(e) => {
                        setCarryoverActualEdited(true)
                        setLeftoverEdited(false)
                        setFormData({
                          ...formData,
                          carryover_actual_weight_kg: e.target.value,
                        })
                      }}
                    />
                  </div>
                </div>
                {carryoverDiffers && carryover.fromDate && (
                  <p className="text-xs text-amber-700">
                    Actual differs from expected — used in today&apos;s calculations.
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4">
                <p className="text-xs font-medium text-blue-800 uppercase tracking-wide">
                  Total Available Today
                </p>
                <p className="mt-2 text-xl font-bold">{totalBirds} birds</p>
                <p className="text-lg font-semibold text-blue-900">
                  {totalWeightKg.toFixed(2)} KG
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  {currentStock.weightKg.toFixed(2)} stock +{" "}
                  {toNumber(formData.carryover_actual_weight_kg).toFixed(2)} carry-over
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <p className="text-sm font-semibold">Today&apos;s Processing</p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Processed
                </p>
                <div className="space-y-2">
                  <Label htmlFor="processed_birds">
                    Birds <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="processed_birds"
                    type="number"
                    min="0"
                    value={formData.processed_birds}
                    onChange={(e) => {
                      setLeftoverEdited(false)
                      setFormData({ ...formData, processed_birds: e.target.value })
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="processed_weight_kg">
                    Weight (KG) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="processed_weight_kg"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formData.processed_weight_kg}
                    onChange={(e) => {
                      setLeftoverEdited(false)
                      setFormData({ ...formData, processed_weight_kg: e.target.value })
                    }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Mortality
                </p>
                <div className="space-y-2">
                  <Label htmlFor="mortality_birds">Birds</Label>
                  <Input
                    id="mortality_birds"
                    type="number"
                    min="0"
                    value={formData.mortality_birds}
                    onChange={(e) => {
                      setLeftoverEdited(false)
                      setFormData({ ...formData, mortality_birds: e.target.value })
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mortality_weight_kg">Weight (KG)</Label>
                  <Input
                    id="mortality_weight_kg"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.mortality_weight_kg}
                    onChange={(e) => {
                      setLeftoverEdited(false)
                      setFormData({ ...formData, mortality_weight_kg: e.target.value })
                    }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Today&apos;s Leftover
                </p>
                <div className="space-y-2">
                  <Label htmlFor="actual_leftover_birds">Birds</Label>
                  <Input
                    id="actual_leftover_birds"
                    type="number"
                    min="0"
                    value={formData.actual_leftover_birds}
                    onChange={(e) => {
                      setLeftoverEdited(true)
                      setFormData({ ...formData, actual_leftover_birds: e.target.value })
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="actual_leftover_weight_kg">Weight (KG)</Label>
                  <Input
                    id="actual_leftover_weight_kg"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.actual_leftover_weight_kg}
                    onChange={(e) => {
                      setLeftoverEdited(true)
                      setFormData({ ...formData, actual_leftover_weight_kg: e.target.value })
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border bg-slate-50 p-4">
              <p className="text-xs text-muted-foreground">Expected Leftover</p>
              <p className="text-lg font-bold">
                {expectedLeftoverBirdsToday} birds · {summary.expectedLeftoverWeightKg.toFixed(2)}{" "}
                KG
              </p>
            </div>
            <div className="rounded-lg border bg-slate-50 p-4">
              <p className="text-xs text-muted-foreground">Actual Leftover</p>
              <p className="text-lg font-bold">
                {toNumber(formData.actual_leftover_birds)} birds ·{" "}
                {toNumber(formData.actual_leftover_weight_kg).toFixed(2)} KG
              </p>
            </div>
            <div className="rounded-lg border bg-slate-50 p-4">
              <p className="text-xs text-muted-foreground">Variance</p>
              <p className="text-lg font-bold">{summary.leftoverVarianceKg.toFixed(2)} KG</p>
            </div>
            <div className="rounded-lg border bg-slate-50 p-4">
              <p className="text-xs text-muted-foreground">Yield</p>
              <p className="text-lg font-bold">{fmtPercent(summary.yieldPercent)}%</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="disposal_reason">Disposal Reason</Label>
              <Textarea
                id="disposal_reason"
                value={formData.disposal_reason}
                onChange={(e) => setFormData({ ...formData, disposal_reason: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="operational_remarks">Operational Remarks</Label>
              <Textarea
                id="operational_remarks"
                value={formData.operational_remarks}
                onChange={(e) => setFormData({ ...formData, operational_remarks: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {isEditing && onCancelEdit && (
              <Button type="button" variant="outline" onClick={onCancelEdit} disabled={isLoading}>
                Cancel
              </Button>
            )}
            {!onCancelEdit && (
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard/operations/processing")}
                disabled={isLoading}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Spinner className="mr-2 h-4 w-4" />}
              {isEditing ? "Update Processing Entry" : "Save Processing Entry"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
