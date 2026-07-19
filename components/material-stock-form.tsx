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
import { getIndianToday } from "@/lib/date-time"
import { calculateStockVariance, fmtPercent, suggestMaterialStockReference, toNumber } from "@/lib/material-calculations"
import { getProfileDisplayName, logEntryHistory } from "@/lib/entry-history"

export type MaterialStockEntry = {
  id: string
  organization_id: string
  reference_number: string
  purchase_date: string
  vehicle_number: string | null
  farm_birds: number
  farm_weight_kg: string | number
  bridge_birds: number
  bridge_weight_kg: string | number
  difference_kg?: string | number | null
  variance_percent?: string | number | null
  remarks: string | null
  created_at: string
  profiles?: { full_name: string } | null
}

interface MaterialStockFormProps {
  entries: MaterialStockEntry[]
  selectedEntry?: MaterialStockEntry | null
  userRole: string
  onCancelEdit?: () => void
}

export function MaterialStockForm({
  entries,
  selectedEntry,
  userRole,
  onCancelEdit,
}: MaterialStockFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const isEditing = Boolean(selectedEntry)
  const canCreate = userRole === "super_admin" || userRole === "admin"
  const canEdit = userRole === "super_admin"
  const canWrite = isEditing ? canEdit : canCreate
  const today = getIndianToday()

  const [formData, setFormData] = useState({
    reference_number: "",
    purchase_date: getIndianToday(),
    vehicle_number: "",
    farm_birds: "",
    farm_weight_kg: "",
    bridge_birds: "",
    bridge_weight_kg: "",
    remarks: "",
  })

  useEffect(() => {
    if (selectedEntry) {
      setFormData({
        reference_number: selectedEntry.reference_number,
        purchase_date: selectedEntry.purchase_date,
        vehicle_number: selectedEntry.vehicle_number || "",
        farm_birds: String(selectedEntry.farm_birds || ""),
        farm_weight_kg: String(selectedEntry.farm_weight_kg || ""),
        bridge_birds: String(selectedEntry.bridge_birds || ""),
        bridge_weight_kg: String(selectedEntry.bridge_weight_kg || ""),
        remarks: selectedEntry.remarks || "",
      })
      return
    }

    const today = getIndianToday()
    setFormData({
      reference_number: suggestMaterialStockReference(
        today,
        entries.map((entry) => entry.reference_number),
      ),
      purchase_date: today,
      vehicle_number: "",
      farm_birds: "",
      farm_weight_kg: "",
      bridge_birds: "",
      bridge_weight_kg: "",
      remarks: "",
    })
  }, [selectedEntry, entries])

  useEffect(() => {
    if (isEditing) return
    setFormData((prev) => ({
      ...prev,
      reference_number: suggestMaterialStockReference(
        prev.purchase_date,
        entries.map((entry) => entry.reference_number),
      ),
    }))
  }, [formData.purchase_date, entries, isEditing])

  const variance = useMemo(
    () =>
      calculateStockVariance(
        toNumber(formData.farm_weight_kg),
        toNumber(formData.bridge_weight_kg),
      ),
    [formData.farm_weight_kg, formData.bridge_weight_kg],
  )

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canWrite) {
      toast({
        variant: "destructive",
        title: "Read only access",
        description: isEditing
          ? "Only Super Admin can edit stock entries."
          : "You do not have permission to create stock entries.",
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
      if (selectedEntry) {
        if (profile.role !== "super_admin") {
          throw new Error("Only Super Admin can edit stock entries")
        }
      } else if (!["super_admin", "admin"].includes(profile.role)) {
        throw new Error("You do not have permission to create stock entries")
      }

      const payload = {
        reference_number: formData.reference_number.trim(),
        purchase_date: formData.purchase_date,
        vehicle_number: formData.vehicle_number.trim() || null,
        farm_birds: Math.max(0, Math.floor(toNumber(formData.farm_birds))),
        farm_weight_kg: toNumber(formData.farm_weight_kg),
        bridge_birds: Math.max(0, Math.floor(toNumber(formData.bridge_birds))),
        bridge_weight_kg: toNumber(formData.bridge_weight_kg),
        remarks: formData.remarks.trim() || null,
        updated_at: new Date().toISOString(),
      }

      if (!payload.reference_number) throw new Error("Reference number is required")
      if (payload.purchase_date > getIndianToday()) {
        throw new Error("Purchase date cannot be in the future")
      }
      if (payload.farm_weight_kg <= 0 || payload.bridge_weight_kg <= 0) {
        throw new Error("Farm and bridge weights must be greater than zero")
      }

      let entityId = selectedEntry?.id
      if (selectedEntry) {
        const { error } = await supabase
          .from("material_stock_entries")
          .update(payload)
          .eq("id", selectedEntry.id)
        if (error) throw error
      } else {
        const { data: created, error } = await supabase
          .from("material_stock_entries")
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

      const userName = await getProfileDisplayName(supabase, user.id)
      if (entityId) {
        await logEntryHistory(supabase, {
          organizationId: profile.organization_id,
          entityType: "material_stock",
          entityId,
          action: selectedEntry ? "updated" : "created",
          userId: user.id,
          userName,
          summary: `${selectedEntry ? "Updated" : "Created"} stock entry ${payload.reference_number}`,
        })
      }

      toast({
        variant: "success",
        title: selectedEntry ? "Stock entry updated" : "Stock entry created",
        description: `${payload.reference_number} saved successfully.`,
      })
      if (onCancelEdit) {
        onCancelEdit()
        router.refresh()
      } else {
        router.push("/dashboard/operations/stock")
      }
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save stock entry.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!canWrite) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{isEditing ? "Edit Stock Entry" : "Stock Entry"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="reference_number">Reference Number</Label>
              <Input id="reference_number" value={formData.reference_number} readOnly tabIndex={-1} className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchase_date">Purchase Date</Label>
              <Input
                id="purchase_date"
                type="date"
                required
                max={today}
                value={formData.purchase_date}
                onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle_number">Vehicle Number</Label>
              <Input
                id="vehicle_number"
                value={formData.vehicle_number}
                onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                placeholder="AP00AA0000"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Farm Weight</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="farm_birds">Farm Birds</Label>
                  <Input id="farm_birds" type="number" min="0" value={formData.farm_birds} onChange={(e) => setFormData({ ...formData, farm_birds: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="farm_weight_kg">Farm Weight KG</Label>
                  <Input id="farm_weight_kg" type="number" min="0" step="0.01" required value={formData.farm_weight_kg} onChange={(e) => setFormData({ ...formData, farm_weight_kg: e.target.value })} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Bridge Weight</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bridge_birds">Bridge Birds</Label>
                  <Input id="bridge_birds" type="number" min="0" value={formData.bridge_birds} onChange={(e) => setFormData({ ...formData, bridge_birds: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bridge_weight_kg">Bridge Weight KG</Label>
                  <Input id="bridge_weight_kg" type="number" min="0" step="0.01" required value={formData.bridge_weight_kg} onChange={(e) => setFormData({ ...formData, bridge_weight_kg: e.target.value })} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-slate-50 p-4">
              <p className="text-xs text-muted-foreground">Difference KG</p>
              <p className="text-xl font-bold">{variance.differenceKg.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border bg-slate-50 p-4">
              <p className="text-xs text-muted-foreground">Variance %</p>
              <p className="text-xl font-bold">{fmtPercent(variance.variancePercent)}%</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea id="remarks" value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} rows={3} />
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {isEditing && onCancelEdit && (
              <Button type="button" variant="outline" onClick={onCancelEdit} disabled={isLoading}>
                Cancel
              </Button>
            )}
            {!onCancelEdit && (
              <Button type="button" variant="outline" onClick={() => router.push("/dashboard/operations/stock")} disabled={isLoading}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Spinner className="mr-2 h-4 w-4" />}
              {isEditing ? "Update Stock Entry" : "Save Stock Entry"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
