"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Spinner } from "@/components/ui/spinner"
import { useToast } from "@/hooks/use-toast"
import { getPriceForCategoryOnDate } from "@/lib/utils"

interface Client {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  description?: string
  paper_price: string
}

interface PriceCategory {
  id: string
  name: string
  currentPrice?: number | null
}

interface PricingRule {
  id?: string
  client_id: string
  product_id: string
  price_rule_type: string
  price_rule_value: string | null
  price_category_id?: string | null
  notes: string
}

interface ProductPricingRule {
  product_id: string
  price_category_id: string
  price_rule_type: string
  price_rule_value: string
  notes: string
  enabled: boolean
}

interface ClientPricingFormProps {
  clients: Client[]
  products: Product[]
  existingRule?: PricingRule
  priceCategories?: PriceCategory[]
  priceHistory?: Array<{ price_category_id: string; price: number; effective_date: string }>
}

export function ClientPricingForm({ clients, products, existingRule, priceCategories = [], priceHistory = [] }: ClientPricingFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<PriceCategory[]>([])
  const [history, setHistory] = useState<Array<{ price_category_id: string; price: number; effective_date: string }>>(priceHistory)
  const today = new Date().toISOString().split("T")[0]

  const [selectedClient, setSelectedClient] = useState(existingRule?.client_id || "")
  const [productRules, setProductRules] = useState<Record<string, ProductPricingRule>>(() => {
    if (existingRule) {
      return {
        [existingRule.product_id]: {
          product_id: existingRule.product_id,
          price_category_id: existingRule.price_category_id || "",
          price_rule_type: existingRule.price_rule_type,
          price_rule_value: existingRule.price_rule_value?.toString() || "",
          notes: existingRule.notes || "",
          enabled: true,
        },
      }
    }
    return {}
  })

  // Fetch price categories and history if not provided
  useEffect(() => {
    const load = async () => {
      if (priceCategories.length > 0) {
        setCategories(priceCategories)
      }
      if (priceHistory.length > 0) {
        setHistory(priceHistory)
      }

      if (priceCategories.length === 0 || priceHistory.length === 0) {
        const supabase = createClient()
        const [catResult, historyResult] = await Promise.all([
          supabase.from("price_categories").select("id, name").order("name"),
          supabase.from("price_category_history").select("price_category_id, price, effective_date"),
        ])

        if (catResult.data) setCategories(catResult.data)
        if (historyResult.data) setHistory(historyResult.data)
      }
    }

    load()
  }, [priceCategories, priceHistory])

  const categoriesWithPrice = categories.map((cat) => ({
    ...cat,
    currentPrice: getPriceForCategoryOnDate(cat.id, today, history),
  }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const enabledRules = Object.values(productRules).filter(rule => rule.enabled)
    
    if (enabledRules.length === 0) {
      setError("Please enable and configure at least one product")
      setIsLoading(false)
      return
    }

    for (const rule of enabledRules) {
      if (!rule.price_category_id) {
        setError("Please select a category for all enabled products")
        setIsLoading(false)
        return
      }
      if (!rule.price_rule_value) {
        setError("Please enter a rule value for all enabled products")
        setIsLoading(false)
        return
      }
    }

    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError("You must be logged in")
      setIsLoading(false)
      return
    }

    // Get user's organization
    const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).single()

    if (!profile?.organization_id) {
      setError("Organization not found")
      setIsLoading(false)
      return
    }

    try {
      if (existingRule?.id) {
        // Update existing rule (single product mode)
        const rule = productRules[existingRule.product_id]
        const { error } = await supabase
          .from("client_product_pricing")
          .update({
            price_rule_type: rule.price_rule_type,
            price_rule_value: Number(rule.price_rule_value),
            price_category_id: rule.price_category_id,
            notes: rule.notes,
          })
          .eq("id", existingRule.id)

        if (error) throw error
        toast({
          title: "Success",
          description: "Pricing rule updated successfully.",
        })
      } else {
        // Bulk create new rules
        const rulesToInsert = Object.values(productRules)
          .filter(rule => rule.enabled)
          .map(rule => ({
            client_id: selectedClient,
            product_id: rule.product_id,
            price_rule_type: rule.price_rule_type,
            price_rule_value: Number(rule.price_rule_value),
            price_category_id: rule.price_category_id,
            notes: rule.notes,
            organization_id: profile.organization_id,
            created_by: user.id,
          }))

        const { error } = await supabase
          .from("client_product_pricing")
          .insert(rulesToInsert)

        if (error) {
          if (error.code === '23505') {
            throw new Error("One or more pricing rules already exist for this client. Please check existing rules.")
          }
          throw error
        }
        
        toast({
          title: "Success",
          description: `${rulesToInsert.length} pricing rule(s) created successfully.`,
        })
      }

      router.push("/dashboard/client-pricing")
      router.refresh()
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "An error occurred"
      setError(errorMsg)
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMsg,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const enabledCount = Object.values(productRules).filter(r => r.enabled).length

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="client_id">
              Client <span className="text-red-500">*</span>
            </Label>
            <Select
              value={selectedClient}
              onValueChange={setSelectedClient}
              disabled={!!existingRule}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!existingRule && selectedClient && (
              <p className="text-sm text-muted-foreground mt-2">
                Configure pricing rules for products below. Enable products by checking the box.
              </p>
            )}
          </div>

          {!selectedClient && !existingRule && (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground">Select a client to configure product pricing</p>
            </div>
          )}

          {(selectedClient || existingRule) && products.map((product) => {
            const rule = productRules[product.id] || {
              product_id: product.id,
              price_category_id: "",
              price_rule_type: "discount_percentage",
              price_rule_value: "",
              notes: "",
              enabled: !!existingRule,
            }
            
            if (existingRule && existingRule.product_id !== product.id) return null
            
            const updateProductRule = (updates: Partial<ProductPricingRule>) => {
              setProductRules(prev => ({
                ...prev,
                [product.id]: { ...rule, ...updates },
              }))
            }

            return (
              <div key={product.id} className="border rounded-lg p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {!existingRule && (
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={(e) => updateProductRule({ enabled: e.target.checked })}
                        className="h-5 w-5 rounded border-gray-300 mt-1 cursor-pointer"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">{product.name}</h3>
                      {product.description && (
                        <p className="text-sm text-muted-foreground">{product.description}</p>
                      )}
                    </div>
                  </div>
                </div>

                {(rule.enabled || existingRule) && (
                  <div className="space-y-4 pl-0 md:pl-8">
                    <div className="space-y-2">
                      <Label>
                        Select Base Price Category <span className="text-red-500">*</span>
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Click on a category to use its daily price as the base for this product
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-3">
                        {(() => {
                          const isEggProduct = /egg/i.test(product.name)
                          const filtered = categoriesWithPrice.filter((category) => {
                            const isEggCategory = /egg/i.test(category.name)
                            return isEggProduct ? isEggCategory : !isEggCategory
                          })
                          return filtered.map((category) => (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() => updateProductRule({ price_category_id: category.id })}
                            className={`rounded-lg border p-3 text-center transition-all hover:shadow-md ${
                              category.id === rule.price_category_id
                                ? "bg-blue-50 border-blue-400 ring-2 ring-blue-300 shadow-sm"
                                : "bg-white border-gray-200 hover:border-blue-200"
                            }`}
                          >
                            <p className={`text-base font-semibold ${
                              category.id === rule.price_category_id ? "text-blue-900" : "text-gray-700"
                            }`}>
                              {category.name}
                            </p>
                            <p className={`text-xs mt-1 ${
                              category.id === rule.price_category_id ? "text-blue-600 font-medium" : "text-gray-500"
                            }`}>
                              {category.id === rule.price_category_id ? "✓ Selected" : "Click to select"}
                            </p>
                          </button>
                          ))
                        })()}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>
                          Apply Rule <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={rule.price_rule_type}
                          onValueChange={(value) => updateProductRule({ price_rule_type: value, price_rule_value: "" })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select pricing rule" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="discount_percentage">Discount Percentage (%)</SelectItem>
                            <SelectItem value="discount_flat">Discount Flat Amount (₹)</SelectItem>
                            <SelectItem value="multiplier">Multiplier (e.g., 1.25)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {rule.price_rule_type === "discount_percentage" && "Enter percentage off category price (e.g., 10 for 10% off)"}
                          {rule.price_rule_type === "discount_flat" && "Enter flat amount off category price (e.g., 5 for ₹5 off)"}
                          {rule.price_rule_type === "multiplier" && "Enter multiplier on category price (e.g., 1.25 for 25% markup)"}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>
                          Rule Value <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          type="number"
                          step="0.0001"
                          min="0"
                          required={rule.enabled}
                          value={rule.price_rule_value}
                          onChange={(e) => updateProductRule({ price_rule_value: e.target.value })}
                          placeholder={
                            rule.price_rule_type === "discount_percentage"
                              ? "10"
                              : rule.price_rule_type === "discount_flat"
                                ? "5.00"
                                : "1.25"
                          }
                        />
                      </div>
                    </div>

                    {rule.price_category_id && rule.price_rule_value && rule.price_rule_type && (() => {
                      const selectedCategory = categoriesWithPrice.find(c => c.id === rule.price_category_id)
                      const categoryPrice = selectedCategory?.currentPrice || 0
                      const ruleValue = Number(rule.price_rule_value)
                      let finalPrice = categoryPrice
                      
                      switch (rule.price_rule_type) {
                        case "discount_percentage":
                          finalPrice = categoryPrice * (1 - ruleValue / 100)
                          break
                        case "discount_flat":
                          finalPrice = Math.max(0, categoryPrice - ruleValue)
                          break
                        case "multiplier":
                          finalPrice = categoryPrice * ruleValue
                          break
                      }
                      
                      return (
                        <div className="rounded-lg border bg-green-50 p-4">
                          <p className="text-sm font-medium text-green-900 mb-2">Final Price Preview (Today)</p>
                          <p className="text-2xl font-bold text-green-700">₹{finalPrice.toFixed(2)}</p>
                          <p className="text-xs text-green-600 mt-1">
                            {selectedCategory?.name} Base: ₹{categoryPrice.toFixed(2)} →{" "}
                            {rule.price_rule_type === "discount_percentage" && `${rule.price_rule_value}% off`}
                            {rule.price_rule_type === "discount_flat" && `₹${rule.price_rule_value} off`}
                            {rule.price_rule_type === "multiplier" && `× ${rule.price_rule_value}`}
                          </p>
                          <p className="text-xs text-blue-600 mt-1">
                            Note: On invoices, the category price from the invoice date will be used
                          </p>
                        </div>
                      )
                    })()}

                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={rule.notes}
                        onChange={(e) => updateProductRule({ notes: e.target.value })}
                        placeholder="Additional notes about this pricing rule..."
                        rows={2}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>}

          <div className="flex gap-4">
            <Button 
              type="submit" 
              disabled={isLoading || !selectedClient || enabledCount === 0}
            >
              {isLoading && <Spinner className="h-4 w-4 mr-2" />}
              {isLoading ? "Saving..." : existingRule ? "Update Pricing Rule" : `Create ${enabledCount} Rule${enabledCount !== 1 ? 's' : ''}`}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
