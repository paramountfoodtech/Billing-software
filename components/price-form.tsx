"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"

interface PriceFormProps {
  initialData?: {
    id: string
    name: string
    description?: string
  }
  initialPrice?: {
    price: number
    effective_date: string
  }
}

export function PriceForm({ initialData, initialPrice }: PriceFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const today = new Date().toISOString().split("T")[0]

  const [formData, setFormData] = useState({
    categoryName: initialData?.name || "",
    price: initialPrice?.price?.toString() || "",
    effective_date: initialPrice?.effective_date || today,
    name: initialData?.name || "",
    description: initialData?.description || "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (initialData) {
      if (!formData.name.trim()) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Category name is required.",
        })
        return
      }

      setLoading(true)
      const supabase = createClient()

      try {
        const { error } = await supabase
          .from("price_categories")
          .update({
            name: formData.name.trim(),
            description: formData.description,
            updated_at: new Date().toISOString(),
          })
          .eq("id", initialData.id)

        if (error) throw error

        toast({
          title: "Success",
          description: "Category updated successfully.",
        })

        router.push("/dashboard/prices/categories")
        router.refresh()
      } catch (err: any) {
        toast({
          variant: "destructive",
          title: "Error",
          description: err.message || "Failed to update category.",
        })
      } finally {
        setLoading(false)
      }

      return
    }

    // New price update mode (from daily price update)
    if (!formData.categoryName.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a price category name.",
      })
      return
    }

    if (!formData.price || isNaN(Number(formData.price))) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a valid price.",
      })
      return
    }

    if (!formData.effective_date) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select an effective date.",
      })
      return
    }

    const todayDate = new Date().toISOString().split("T")[0]
    if (formData.effective_date > todayDate) {
      toast({
        variant: "destructive",
        title: "Invalid date",
        description: "Future dates are not allowed.",
      })
      return
    }

    setLoading(true)
    const supabase = createClient()

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error("Not authenticated")

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", userData.user.id)
        .single()

      if (!userProfile?.organization_id) throw new Error("Organization not found")

      const { data: existing } = await supabase
        .from("price_categories")
        .select("id")
        .eq("organization_id", userProfile.organization_id)
        .eq("name", formData.categoryName.trim())
        .limit(1)

      let categoryId = existing && existing.length > 0 ? existing[0].id : null

      if (!categoryId) {
        const { data: created, error: catError } = await supabase
          .from("price_categories")
          .insert({
            name: formData.categoryName.trim(),
            description: "",
            created_by: userData.user.id,
            organization_id: userProfile.organization_id,
          })
          .select("id")
          .single()

        if (catError) throw catError
        categoryId = created?.id
      }

      const { error } = await supabase
        .from("price_category_history")
        .upsert(
          {
            price_category_id: categoryId,
            organization_id: userProfile.organization_id,
            price: Number(formData.price),
            effective_date: formData.effective_date,
            created_by: userData.user.id,
          },
          { onConflict: "price_category_id,effective_date" }
        )

      if (error) throw error

      toast({
        title: "Success",
        description: "Price update created successfully.",
      })

      router.push("/dashboard/prices")
      router.refresh()
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to save price.",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6 bg-white p-6 rounded-lg border">
      {initialData ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="name">Category Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Paper Price, Skinless, With Skin, Eggs"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description for this price category"
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading && <Spinner className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/prices/categories")}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="categoryName">Category Name*</Label>
            <Input
              id="categoryName"
              value={formData.categoryName}
              onChange={(e) => setFormData({ ...formData, categoryName: e.target.value })}
              placeholder="e.g., Paper Price, Skinless, With Skin, Eggs"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="effective_date">Effective Date*</Label>
            <Input
              id="effective_date"
              type="date"
              value={formData.effective_date}
              onChange={(e) => {
                const val = e.target.value
                const maxDate = new Date().toISOString().split("T")[0]
                setFormData({ ...formData, effective_date: val > maxDate ? maxDate : val })
              }}
              max={new Date().toISOString().split("T")[0]}
              required
            />
            <p className="text-xs text-muted-foreground">Price will be effective from this date</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">Price (₹)*</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="0.00"
              required
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading && <Spinner className="h-4 w-4 mr-2" />}
              Add Price Update
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/prices")}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </>
      )}
    </form>
  )
}
