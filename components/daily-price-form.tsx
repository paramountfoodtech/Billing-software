"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Spinner } from "@/components/ui/spinner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"

interface PriceCategory {
  id: string
  name: string
  description?: string | null
}

interface PriceHistory {
  id: string
  price_category_id: string
  price: number
  effective_date: string
}

interface DailyPriceFormProps {
  priceCategories: PriceCategory[]
  priceHistory: PriceHistory[]
  userRole?: string
}

export function DailyPriceForm({ priceCategories, priceHistory, userRole }: DailyPriceFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [checkingInvoices, setCheckingInvoices] = useState(false)
  const [existingInvoicesCount, setExistingInvoicesCount] = useState(0)
  const [updateExistingInvoices, setUpdateExistingInvoices] = useState(false)
  const [existingPricesCount, setExistingPricesCount] = useState(0)
  const today = new Date().toISOString().split("T")[0]
  
  const [formData, setFormData] = useState({
    effective_date: today,
    prices: priceCategories.reduce((acc, cat) => {
      // Get latest price for this category
      const latest = priceHistory
        .filter(h => h.price_category_id === cat.id)
        .sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime())[0]
      
      acc[cat.id] = latest?.price?.toString() || ""
      return acc
    }, {} as Record<string, string>),
  })

  // Check if invoices exist for the selected date
  useEffect(() => {
    const checkInvoices = async () => {
      if (!formData.effective_date) return

      setCheckingInvoices(true)
      const supabase = createClient()

      const { count, error } = await supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("issue_date", formData.effective_date)

      if (!error && count !== null) {
        setExistingInvoicesCount(count)
      } else {
        setExistingInvoicesCount(0)
      }

      setCheckingInvoices(false)
    }

    checkInvoices()
  }, [formData.effective_date])

  // Update prices when date changes
  useEffect(() => {
    // Count existing prices for this date to surface overwrite warning
    const existingForDate = priceHistory.filter(
      (h) => h.effective_date === formData.effective_date,
    )
    setExistingPricesCount(existingForDate.length)

    const updatedPrices = priceCategories.reduce((acc, cat) => {
      // Get price for the selected date or latest before that date
      const priceForDate = priceHistory
        .filter(h => h.price_category_id === cat.id && h.effective_date <= formData.effective_date)
        .sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime())[0]
      
      acc[cat.id] = priceForDate?.price?.toString() || ""
      return acc
    }, {} as Record<string, string>)

    setFormData(prev => ({
      ...prev,
      prices: updatedPrices
    }))
  }, [formData.effective_date, priceCategories, priceHistory])

  const getLatestPrice = (categoryId: string) => {
    const latest = priceHistory
      .filter(h => h.price_category_id === categoryId)
      .sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime())[0]
    return latest
  }

  const handlePriceChange = (categoryId: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      prices: {
        ...prev.prices,
        [categoryId]: value,
      },
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate that at least one price is entered
    const hasAnyPrice = Object.values(formData.prices).some(p => p && !isNaN(Number(p)))
    if (!hasAnyPrice) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter at least one price.",
      })
      return
    }

    // Prevent future dates
    if (formData.effective_date > today) {
      toast({
        variant: "destructive",
        title: "Invalid date",
        description: "Future dates are not allowed.",
      })
      return
    }

    // Warn if updating prices for a date with existing invoices and user hasn't acknowledged
    if (existingInvoicesCount > 0 && formData.effective_date !== today && !updateExistingInvoices) {
      toast({
        variant: "destructive",
        title: "Invoices exist for this date",
        description: `${existingInvoicesCount} invoice(s) already exist for ${formData.effective_date}. Please check the option to update existing invoices or choose a different date.`,
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
        .select("organization_id, role")
        .eq("id", userData.user.id)
        .single()

      if (!userProfile?.organization_id) throw new Error("Organization not found")

      // Check if accountant is trying to overwrite existing prices
      if (userProfile.role === "accountant" && existingPricesCount > 0) {
        toast({
          variant: "destructive",
          title: "Cannot Update Existing Prices",
          description: "Prices have already been set for this date. Please contact your administrator to make changes to existing prices.",
          duration: 5000,
        })
        setLoading(false)
        return
      }

      // Prepare price updates
      const priceUpdates = Object.entries(formData.prices)
        .filter(([_, price]) => price && !isNaN(Number(price)))
        .map(([categoryId, price]) => ({
          price_category_id: categoryId,
          organization_id: userProfile.organization_id,
          price: Number(price),
          effective_date: formData.effective_date,
          created_by: userData.user.id,
        }))

      // Upsert all prices at once
      const { error } = await supabase
        .from("price_category_history")
        .upsert(priceUpdates, { onConflict: "price_category_id,effective_date" })

      if (error) throw error

      // Show warning toast if invoices exist for the updated date
      if (existingInvoicesCount > 0) {
        toast({
          variant: "destructive",
          title: "Category Prices Updated - Action Required",
          description: `${priceUpdates.length} category price(s) updated for ${formData.effective_date}. ⚠️ Action required: Review ${existingInvoicesCount} invoice(s), regenerate if needed, and re-share with clients.`,
          duration: 120000,
        })
      } else {
        toast({
          title: "Success",
          description: `${priceUpdates.length} category price(s) updated successfully.`,
        })
      }

      router.push("/dashboard/prices")
      router.refresh()
    } catch (error: any) {
      const fallbackMessage = "Failed to save prices. If invoices already exist for this date, check \"Update existing invoices\" or choose a different date."
      const message = typeof error?.message === "string" && error.message.trim().length > 0
        ? error.message
        : fallbackMessage

      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Daily Price Update</CardTitle>
          <p className="text-sm text-muted-foreground">
            Update prices for all categories at once. Leave blank to skip a category.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="effective_date">Effective Date*</Label>
            <Input
              id="effective_date"
              type="date"
              value={formData.effective_date}
              onChange={(e) => {
                const val = e.target.value
                setFormData({ ...formData, effective_date: val > today ? today : val })
                setUpdateExistingInvoices(false) // Reset checkbox when date changes
              }}
              max={today}
              required
            />
            <p className="text-xs text-muted-foreground">
              Prices will be effective from this date (future dates not allowed)
            </p>
          </div>

          {/* Warning for existing invoices */}
          {checkingInvoices && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Spinner className="h-4 w-4" />
              <p className="text-sm text-blue-700">Checking for existing invoices...</p>
            </div>
          )}

{!checkingInvoices && existingPricesCount > 0 && existingInvoicesCount === 0 && (
            <div className={`space-y-1 p-4 rounded-lg ${userRole === "accountant" ? "bg-red-50 border border-red-300" : "bg-amber-50 border border-amber-300"}`}>
              <div className="flex items-start gap-2">
                <AlertTriangle className={`h-5 w-5 mt-0.5 ${userRole === "accountant" ? "text-red-600" : "text-amber-600"}`} />
                <div className="flex-1 text-sm">
                  <p className={`font-semibold ${userRole === "accountant" ? "text-red-900" : "text-amber-900"}`}>
                    {userRole === "accountant" ? "Cannot Overwrite Existing Prices" : "Prices already exist for this date."}
                  </p>
                  <p className={`mt-1 ${userRole === "accountant" ? "text-red-800" : "text-amber-800"}`}>
                    {userRole === "accountant" 
                      ? `Prices have already been set for ${formData.effective_date === today ? "today" : formData.effective_date}. Contact your administrator to make changes to the ${existingPricesCount} existing price entr${existingPricesCount === 1 ? "y" : "ies"}.`
                      : `Saving will overwrite ${existingPricesCount} existing price entr${existingPricesCount === 1 ? "y" : "ies"} for ${formData.effective_date}.`
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {!checkingInvoices && existingInvoicesCount > 0 && (
            <div className="space-y-3 p-4 bg-red-50 border border-red-300 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-red-900">
                    {userRole === "accountant" ? "Cannot Update Prices" : "Warning"}: {existingInvoicesCount} invoice(s) exist for {formData.effective_date}
                  </p>
                  <p className="text-sm text-red-800 mt-1">
                    {userRole === "accountant" 
                      ? `Prices cannot be ${existingPricesCount > 0 ? "updated" : "set"} for this date because ${existingInvoicesCount} invoice(s) already exist. Contact your administrator to make changes.`
                      : `Updating prices for this date will affect pricing calculations. Existing invoices will NOT be automatically recalculated.${existingPricesCount > 0 ? " You will also overwrite existing price entries." : ""}`
                    }
                  </p>
                  {userRole !== "accountant" && (
                    <p className="text-sm font-semibold text-red-900 mt-2">
                      Action required: After updating, review invoices, regenerate if needed, and re-share with clients.
                    </p>
                  )}
                </div>
              </div>
              
              {formData.effective_date !== today && userRole !== "accountant" && (
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="updateExisting"
                    checked={updateExistingInvoices}
                    onCheckedChange={(checked) => setUpdateExistingInvoices(checked as boolean)}
                  />
                  <label
                    htmlFor="updateExisting"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    I understand and will review the {existingInvoicesCount} existing invoice(s) if needed
                  </label>
                </div>
              )}
            </div>
          )}



          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Category Prices</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {priceCategories.map((category) => {
                const latestPrice = getLatestPrice(category.id)
                const hasChanged = latestPrice && formData.prices[category.id] !== latestPrice.price.toString()
                
                return (
                  <Card key={category.id} className={hasChanged ? "border-blue-400 ring-1 ring-blue-200" : ""}>
                    <CardContent className="pt-6 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">{category.name}</h4>
                        {hasChanged && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            Changed
                          </span>
                        )}
                      </div>
                      
                      {latestPrice && (
                        <div className="text-sm text-muted-foreground">
                          Current: ₹{latestPrice.price.toFixed(2)}
                          {latestPrice.effective_date !== today && (
                            <span className="ml-2 text-xs">
                              (as of {new Date(latestPrice.effective_date).toLocaleDateString("en-IN")})
                            </span>
                          )}
                        </div>
                      )}

                      <div className="space-y-1">
                        <Label htmlFor={`price-${category.id}`}>New Price (₹)</Label>
                        <Input
                          id={`price-${category.id}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.prices[category.id] || ""}
                          onChange={(e) => handlePriceChange(category.id, e.target.value)}
                          placeholder={latestPrice ? latestPrice.price.toFixed(2) : "0.00"}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {priceCategories.length === 0 && (
              <div className="text-center py-8 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">
                  No categories found. Please create categories first.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={loading || priceCategories.length === 0}>
          {loading && <Spinner className="h-4 w-4 mr-2" />}
          Save Price Updates
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
    </form>
  )
}
