"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { getPriceForCategoryOnDate } from "@/lib/utils"

interface Client {
  id: string
  name: string
  email: string
  due_days?: number | null
  value_per_bird?: number | null
}

interface Product {
  id: string
  name: string
  description: string | null
  paper_price: string
  unit_price: string
  unit: string | null
  tax_rate: string
}

interface ClientProductPricing {
  price_rule_type: string
  price_rule_value: string
  product_id: string
  client_id: string
  price_category_id?: string | null
}

interface InvoiceFormProps {
  clients: Client[]
  products: Product[]
  clientPricingRules: ClientProductPricing[]
  priceCategories?: Array<{ id: string; name: string }>
  priceHistory?: Array<{ price_category_id: string; price: number; effective_date: string }>
  initialInvoice?: {
    id: string
    client_id: string
    issue_date: string
    due_date: string
    notes: string | null
    subtotal?: number | null
    tax_amount?: number | null
    discount_amount?: number | null
    total_amount?: number | null
  }
  initialItems?: Array<{
    product_id: string | null
    description: string
    quantity: number
    unit_price: number
    tax_rate: number
    discount: number
    line_total?: number
  }>
}

interface InvoiceItem {
  product_id: string | null
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  discount: number
  line_total: number
  bird_count?: number
  enabled?: boolean
  use_per_bird?: boolean
}

export function InvoiceForm({ clients, products, clientPricingRules, priceCategories = [], priceHistory = [], initialInvoice, initialItems }: InvoiceFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const deriveInvoiceRatesFromInitial = () => {
    if (!initialInvoice || !initialItems || initialItems.length === 0) {
      return { discount_percent: 0, tax_percent: 0 }
    }

    const subtotal = initialItems.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0)

    // Calculate line taxes (on original unit price)
    const line_tax_amount = initialItems.reduce((sum, item) => {
      const itemSubtotal = Number(item.quantity) * Number(item.unit_price)
      return sum + (itemSubtotal * Number(item.tax_rate)) / 100
    }, 0)

    // Subtotal with taxes
    const subtotal_with_taxes = subtotal + line_tax_amount

    // Calculate line discounts
    const line_discount_amount = initialItems.reduce(
      (sum, item) => sum + (Number(item.quantity) * Number(item.unit_price) * Number(item.discount)) / 100,
      0,
    )

    // Invoice-level amounts
    const invoice_discount_amount = Math.max(0, (initialInvoice.discount_amount || 0) - line_discount_amount)
    const invoice_tax_amount = Math.max(0, (initialInvoice.tax_amount || 0) - line_tax_amount)

    const discount_percent = subtotal > 0 ? (invoice_discount_amount / subtotal) * 100 : 0
    const tax_percent = subtotal > 0 ? (invoice_tax_amount / subtotal) * 100 : 0

    return {
      discount_percent: Number.isFinite(discount_percent) ? discount_percent : 0,
      tax_percent: Number.isFinite(tax_percent) ? tax_percent : 0,
    }
  }

  const [invoiceRates, setInvoiceRates] = useState(deriveInvoiceRatesFromInitial)

  const today = new Date().toISOString().split("T")[0]
  const defaultDue = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  const [selectedDueDays, setSelectedDueDays] = useState<number | null>(null)

  const [formData, setFormData] = useState({
    client_id: initialInvoice?.client_id || "",
    invoice_number: initialInvoice?.invoice_number || "",
    issue_date: initialInvoice?.issue_date || today,
    due_date: initialInvoice?.due_date || defaultDue,
    notes: initialInvoice?.notes || "",
  })

  const [items, setItems] = useState<InvoiceItem[]>(() => {
    if (!initialItems || initialItems.length === 0) return []
    return initialItems.map((it) => ({
      product_id: it.product_id,
      description: it.description,
      quantity: Number(it.quantity),
      unit_price: Number(it.unit_price),
      tax_rate: Number(it.tax_rate),
      discount: Number(it.discount),
      bird_count: undefined,
      enabled: true,
      use_per_bird: false,
      line_total: typeof it.line_total === 'number' ? Number(it.line_total) : 0,
    }))
  })

  const getClientAdjustment = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId)
    return client?.value_per_bird ? Number(client.value_per_bird) : 0
  }

  // Function to check if a pricing rule is applied for a product
  const getPricingRuleInfo = (productId: string, clientId: string) => {
    if (!clientId || !productId) return null
    
    const pricingRule = clientPricingRules.find(
      (rule) => rule.product_id === productId && rule.client_id === clientId
    )
    
    if (pricingRule) {
      const ruleValue = Number(pricingRule.price_rule_value)
      switch (pricingRule.price_rule_type) {
        case "discount_percentage":
          return `${ruleValue}% discount applied`
        case "discount_flat":
          return `₹${ruleValue} discount applied`
        case "multiplier":
          return `${ruleValue}x multiplier applied`
        case "category_based":
          return "Category-based pricing applied"
      }
    }
    return null
  }

  // Function to calculate price based on client-specific pricing rules
  const calculateClientPrice = (
    productId: string,
    clientId: string,
    issueDate?: string,
    applyPerBird: boolean = false,
    birdCount: number = 1,
  ): number => {
    const product = products.find((p) => p.id === productId)
    if (!product) return 0

    // Check if there's a client-specific pricing rule
    if (clientId) {
      const pricingRule = clientPricingRules.find(
        (rule) => rule.product_id === productId && rule.client_id === clientId
      )

      if (pricingRule && pricingRule.price_category_id) {
        // Get category price as base
        const effectiveDate = issueDate || formData.issue_date
        const categoryPrice = getPriceForCategoryOnDate(pricingRule.price_category_id, effectiveDate, priceHistory)
        const basePrice = categoryPrice !== null ? categoryPrice : Number(product.paper_price)

        // Apply rule on top of category price
        const ruleValue = Number(pricingRule.price_rule_value || 0)
        let priced = basePrice
        
        switch (pricingRule.price_rule_type) {
          case "discount_percentage":
            priced = basePrice * (1 - ruleValue / 100)
            break
          case "discount_flat":
            priced = Math.max(0, basePrice - ruleValue)
            break
          case "multiplier":
            priced = basePrice * ruleValue
            break
          default:
            priced = basePrice
        }

        // Eggs category pricing is entered per 100; for egg products, unit price is per egg
        const selectedCategory = priceCategories.find((c) => c.id === pricingRule.price_category_id)
        const isEggCategory = selectedCategory ? /egg/i.test(selectedCategory.name) : false
        const isEggProduct = /egg/i.test(product.name)
        const adjusted = isEggCategory && isEggProduct ? priced / 100 : priced

        return Math.max(0, adjusted)
      }
    }

    // No client-specific rule, use default unit_price
    return Math.max(0, Number(product.unit_price))
  }

  // Build a human-friendly breakdown of pricing steps (unit price only, per-bird applied to line total)
  const getPriceBreakdown = (
    productId: string,
    clientId: string,
    issueDate?: string,
    applyPerBird: boolean = false,
    birdCount: number = 1,
  ) => {
    const product = products.find((p) => p.id === productId)
    if (!product) return null

    const clientAdjustment = getClientAdjustment(clientId)
    const perBirdValue = clientAdjustment
    const safeBirds = Math.max(1, birdCount)

    let basePrice = Number(product.unit_price)
    let afterRule = basePrice
    let ruleLabel: string | null = null
    let ruleValueDisplay: string | null = null

    const pricingRule = clientId
      ? clientPricingRules.find((rule) => rule.product_id === productId && rule.client_id === clientId)
      : null

    if (pricingRule && pricingRule.price_category_id) {
      const effectiveDate = issueDate || formData.issue_date
      const categoryPrice = getPriceForCategoryOnDate(pricingRule.price_category_id, effectiveDate, priceHistory)
      basePrice = categoryPrice !== null ? categoryPrice : Number(product.paper_price)

      const ruleValue = Number(pricingRule.price_rule_value || 0)
      switch (pricingRule.price_rule_type) {
        case "discount_percentage":
          ruleLabel = "Discount %"
          ruleValueDisplay = `${ruleValue}%`
          afterRule = basePrice * (1 - ruleValue / 100)
          break
        case "discount_flat":
          ruleLabel = "Discount ₹"
          ruleValueDisplay = `₹${ruleValue.toFixed(2)}`
          afterRule = Math.max(0, basePrice - ruleValue)
          break
        case "multiplier":
          ruleLabel = "Multiplier"
          ruleValueDisplay = `${ruleValue}x`
          afterRule = basePrice * ruleValue
          break
        default:
          ruleLabel = "Category base"
          ruleValueDisplay = null
          afterRule = basePrice
      }

      // For Eggs category, price is per 100; show unit price after dividing by 100 for egg products
      const selectedCategory = priceCategories.find((c) => c.id === pricingRule.price_category_id)
      const isEggCategory = selectedCategory ? /egg/i.test(selectedCategory.name) : false
      const isEggProduct = /egg/i.test(product.name)
      if (isEggCategory && isEggProduct) {
        // Keep basePrice as category price (per 100) but unit price should reflect per-egg
        afterRule = afterRule / 100
      }
    }

    // Per-bird adjustment is now applied to line total, not unit price
    const birdAdj = applyPerBird ? perBirdValue * safeBirds : 0
    const finalPrice = afterRule

    return {
      basePrice,
      ruleLabel,
      ruleValueDisplay,
      afterRule,
      perBirdValue,
      birdCount: applyPerBird ? safeBirds : 0,
      birdAdj,
      finalPrice,
    }
  }

  const computeDueDate = (issueDate: string, days: number | null) => {
    const base = issueDate ? new Date(issueDate) : new Date()
    const increment = Number.isFinite(days ?? null) ? Number(days ?? 0) : 0
    base.setDate(base.getDate() + increment)
    return base.toISOString().split("T")[0]
  }

  // Recalculate all item prices when client changes; leave selection untouched
  const handleClientChange = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId)
    const days = client?.due_days ?? 30
    const newDue = computeDueDate(formData.issue_date, days)
    setSelectedDueDays(days)
    setFormData({ ...formData, client_id: clientId, due_date: newDue })

    setItems((prev) =>
      prev.map((item) => {
        if (!item.product_id) return item
        const applyPerBird = !!item.use_per_bird
        const birdCount = applyPerBird ? Math.max(1, item.bird_count || 1) : 1
        const recalculated = calculateClientPrice(
          item.product_id,
          clientId,
          formData.issue_date,
          applyPerBird,
          birdCount,
        )
        const updated = {
          ...item,
          unit_price: recalculated,
          bird_count: applyPerBird ? birdCount : undefined,
        }
        updated.line_total = calculateLineTotal(updated)
        return updated
      }),
    )
  }

  const [totals, setTotals] = useState({
    subtotal: 0,
    tax_amount: 0,
    discount_amount: 0,
    total_amount: 0,
  })

  // Calculate line total for each item
  // Order: Subtotal → Add Tax → Apply Discount → Add Per-bird
  const calculateLineTotal = (item: InvoiceItem) => {
    const subtotal = item.quantity * item.unit_price
    const taxAmount = (subtotal * item.tax_rate) / 100
    const afterTax = subtotal + taxAmount
    const discountAmount = (subtotal * item.discount) / 100
    const afterDiscount = afterTax - discountAmount
    
    // Apply per-bird adjustment to the overall price (after quantity, tax, and discount)
    if (item.use_per_bird) {
      const clientAdjustment = formData.client_id ? getClientAdjustment(formData.client_id) : 0
      const birdCount = Math.max(1, item.bird_count || 1)
      const perBirdTotal = clientAdjustment * birdCount
      return Math.max(0, afterDiscount + perBirdTotal)
    }
    
    return Math.max(0, afterDiscount)
  }

  // Recalculate totals whenever items or invoice-level rates change
  // Order: Sum line totals → Add invoice-level Tax → Apply invoice-level Discount
  useEffect(() => {
    // Use line_total which includes per-bird adjustments
    const subtotalFromLineTotals = items.reduce((sum, item) => sum + item.line_total, 0)
    
    // For invoice-level rates, we still need the base subtotal (before line taxes/discounts/per-bird)
    const baseSubtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)

    // Calculate line-item taxes (already included in line_total)
    const line_tax_amount = items.reduce((sum, item) => {
      const itemSubtotal = item.quantity * item.unit_price
      return sum + (itemSubtotal * item.tax_rate) / 100
    }, 0)

    // Calculate line-item discounts (already included in line_total)
    const line_discount_amount = items.reduce(
      (sum, item) => sum + (item.quantity * item.unit_price * item.discount) / 100,
      0,
    )

    // Invoice-level tax on base subtotal
    const invoice_tax_amount = (baseSubtotal * (invoiceRates.tax_percent || 0)) / 100
    
    // Invoice-level discount on base subtotal
    const invoice_discount_amount = (baseSubtotal * (invoiceRates.discount_percent || 0)) / 100

    // Total starts with line totals (which include per-bird), then add/subtract invoice-level rates
    const total_amount = subtotalFromLineTotals + invoice_tax_amount - invoice_discount_amount
    const tax_amount = line_tax_amount + invoice_tax_amount
    const discount_amount = line_discount_amount + invoice_discount_amount

    setTotals({
      subtotal: baseSubtotal,
      tax_amount,
      discount_amount,
      total_amount,
    })
  }, [items, invoiceRates])

  // No global per-bird toggle; per-item controls handle repricing

  const updateItem = (productId: string, updater: (item: InvoiceItem) => InvoiceItem) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.product_id !== productId) return item
        const next = updater(item)
        next.line_total = calculateLineTotal(next)
        return next
      }),
    )
  }

  // Check if product is in Live category and named Whole bird
  const isLiveWholeBird = (productId: string, clientId: string) => {
    if (!clientId) return false
    
    const product = products.find((p) => p.id === productId)
    if (!product) return false
    
    // Check if product name contains "Whole bird" (case insensitive)
    const nameLower = product.name.toLowerCase()
    if (!nameLower.includes('whole bird')) return false
    
    // Check if pricing rule uses "Live" category
    const pricingRule = clientPricingRules.find(
      (rule) => rule.product_id === productId && rule.client_id === clientId
    )
    
    if (!pricingRule?.price_category_id) return false
    
    const category = priceCategories.find((c) => c.id === pricingRule.price_category_id)
    return category?.name.toLowerCase() === 'live'
  }

  const handleProductToggle = (productId: string, enabled: boolean) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.product_id === productId)

      if (enabled) {
        // Prevent enabling selection if no pricing rule exists for the selected client
        if (formData.client_id) {
          const hasRule = clientPricingRules.some(
            (rule) => rule.product_id === productId && rule.client_id === formData.client_id
          )
          if (!hasRule) {
            return prev
          }
        }
        const product = products.find((p) => p.id === productId)
        if (!product) return prev

        const existing = existingIndex >= 0 ? prev[existingIndex] : undefined
        // Enable per-bird by default for Live category Whole bird products
        const shouldEnablePerBird = isLiveWholeBird(productId, formData.client_id)
        const applyPerBird = existing?.use_per_bird !== undefined ? !!existing.use_per_bird : shouldEnablePerBird
        const birdCount = applyPerBird ? Math.max(1, existing?.bird_count || 1) : 1
        const unitPrice = calculateClientPrice(
          productId,
          formData.client_id,
          formData.issue_date,
          applyPerBird,
          birdCount,
        )

        const baseItem: InvoiceItem = {
          product_id: productId,
          description: existing?.description || product.name,
          quantity: existing?.quantity || 1,
          unit_price: unitPrice,
          tax_rate: Number(product.tax_rate),
          discount: existing?.discount || 0,
          bird_count: applyPerBird ? birdCount : undefined,
          enabled: true,
          use_per_bird: applyPerBird,
          line_total: 0,
        }
        baseItem.line_total = calculateLineTotal(baseItem)

        if (existingIndex >= 0) {
          const updated = [...prev]
          updated[existingIndex] = { ...baseItem }
          return updated
        }

        return [...prev, baseItem]
      }

      if (existingIndex >= 0) {
        const updated = [...prev]
        updated.splice(existingIndex, 1)
        return updated
      }

      return prev
    })
  }

  const handleQuantityChange = (productId: string, value: number) => {
    updateItem(productId, (item) => ({ ...item, quantity: value }))
  }

  const handleUnitPriceChange = (productId: string, value: number) => {
    updateItem(productId, (item) => ({ ...item, unit_price: value }))
  }

  const handleTaxChange = (productId: string, value: number) => {
    updateItem(productId, (item) => ({ ...item, tax_rate: value }))
  }

  const handleDiscountChange = (productId: string, value: number) => {
    updateItem(productId, (item) => ({ ...item, discount: value }))
  }

  const handleDescriptionChange = (productId: string, value: string) => {
    updateItem(productId, (item) => ({ ...item, description: value }))
  }

  const handleBirdCountChange = (productId: string, value: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.product_id !== productId) return item
        const birdCount = Math.max(1, value)
        const unitPrice = calculateClientPrice(
          productId,
          formData.client_id,
          formData.issue_date,
          !!item.use_per_bird,
          birdCount,
        )
        const next = { ...item, bird_count: birdCount, unit_price: unitPrice }
        next.line_total = calculateLineTotal(next)
        return next
      }),
    )
  }

  const handlePerBirdToggle = (productId: string, enabled: boolean) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.product_id !== productId) return item
        const birdCount = enabled ? Math.max(1, item.bird_count || 1) : 1
        const unitPrice = calculateClientPrice(
          productId,
          formData.client_id,
          formData.issue_date,
          enabled,
          birdCount,
        )
        const next = {
          ...item,
          use_per_bird: enabled,
          bird_count: enabled ? birdCount : undefined,
          unit_price: unitPrice,
        }
        next.line_total = calculateLineTotal(next)
        return next
      }),
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError("You must be logged in")
      setIsLoading(false)
      return
    }

    try {
      // Get user's organization
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

      if (!profile?.organization_id) {
        throw new Error("User must belong to an organization")
      }

      let invoiceId = initialInvoice?.id
      
      if (!invoiceId) {
        // Use manual invoice number from form
        const invoiceNumber = formData.invoice_number
        // Generate reference number with REF. prefix
        const referenceNumber = `REF-${Date.now()}`

          // Check for duplicate invoice number
          const { data: existingInvoice } = await supabase
            .from("invoices")
            .select("id")
            .eq("invoice_number", invoiceNumber)
            .single()

          if (existingInvoice) {
            setError(`Invoice number "${invoiceNumber}" already exists. Please use a different invoice number.`)
            setIsLoading(false)
            return
          }

        // Insert invoice (create mode)
        const { data: invoice, error: invoiceError } = await supabase
          .from("invoices")
          .insert({
            invoice_number: invoiceNumber,
            reference_number: referenceNumber,
            client_id: formData.client_id,
            issue_date: formData.issue_date,
            due_date: formData.due_date,
            status: "draft",
            subtotal: totals.subtotal,
            tax_amount: totals.tax_amount,
            discount_amount: totals.discount_amount,
            total_amount: totals.total_amount,
            amount_paid: 0,
            notes: formData.notes,
            created_by: user.id,
            organization_id: profile.organization_id,
          })
          .select()
          .single()

        if (invoiceError) throw invoiceError
        invoiceId = invoice.id
      } else {
        // Update invoice (edit mode)
        const { error: updateError } = await supabase
          .from("invoices")
          .update({
            client_id: formData.client_id,
            issue_date: formData.issue_date,
            due_date: formData.due_date,
            subtotal: totals.subtotal,
            tax_amount: totals.tax_amount,
            discount_amount: totals.discount_amount,
            total_amount: totals.total_amount,
            notes: formData.notes,
          })
          .eq("id", invoiceId)

        if (updateError) throw updateError
        // Replace items: delete existing items and re-insert
        await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId)
      }

      // Insert invoice items
      const itemsToInsert = items
        .filter((item) => item.product_id)
        .map((item) => {
          // Calculate per-bird adjustment if applicable
          const perBirdAdj = item.use_per_bird && formData.client_id 
            ? getClientAdjustment(formData.client_id) * Math.max(1, item.bird_count || 1)
            : null
          
          return {
            invoice_id: invoiceId,
            product_id: item.product_id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            tax_rate: item.tax_rate,
            discount: item.discount,
            line_total: item.line_total,
            bird_count: item.use_per_bird ? item.bird_count : null,
            per_bird_adjustment: perBirdAdj,
          }
        })

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase.from("invoice_items").insert(itemsToInsert)
        if (itemsError) throw itemsError
      }

      router.push(`/dashboard/invoices/${invoiceId}`)
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="client_id">
                Client <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.client_id}
                onValueChange={(value) => handleClientChange(value)}
                disabled={!!initialInvoice?.id}
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
            </div>

              <div className="space-y-2 md:col-span-1">
              <Label htmlFor="invoice_number">
                Invoice Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="invoice_number"
                required
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                placeholder="e.g., INV-001, INV-002"
                disabled={!!initialInvoice?.id}
              />
              <p className="text-xs text-muted-foreground">
                {initialInvoice?.id ? "Invoice number cannot be changed" : "Enter a unique invoice number"}
              </p>
            </div>

          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="issue_date">
                Issue Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="issue_date"
                type="date"
                required
                value={formData.issue_date}
                onChange={(e) => {
                  const nextIssue = e.target.value
                  const days = selectedDueDays ?? 30
                  setFormData({
                    ...formData,
                    issue_date: nextIssue,
                    due_date: computeDueDate(nextIssue, days),
                  })
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">
                Due Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="due_date"
                type="date"
                required
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
          </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes for this invoice..."
              rows={2}
            />
              </div>
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Line Items</CardTitle>
          <p className="text-sm text-muted-foreground">Add products to this invoice.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Add Product Dropdown */}
          {formData.client_id && (
            <div className="space-y-2 pb-4 border-b">
              <Label htmlFor="add-product">Add Product</Label>
              <Select
                value=""
                onValueChange={(productId) => {
                  if (productId) {
                    handleProductToggle(productId, true)
                  }
                }}
              >
                <SelectTrigger id="add-product">
                  <SelectValue placeholder="Select a product to add..." />
                </SelectTrigger>
                <SelectContent>
                  {products
                    .filter((p) => {
                      // Show only products that aren't already added
                      const alreadyAdded = items.some((item) => item.product_id === p.id)
                      if (alreadyAdded) return false
                      
                      // Show only products with pricing rules for this client
                      const hasRule = clientPricingRules.some(
                        (rule) => rule.product_id === p.id && rule.client_id === formData.client_id
                      )
                      return hasRule
                    })
                    .map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  {products.filter((p) => {
                    const alreadyAdded = items.some((item) => item.product_id === p.id)
                    if (alreadyAdded) return false
                    const hasRule = clientPricingRules.some(
                      (rule) => rule.product_id === p.id && rule.client_id === formData.client_id
                    )
                    return hasRule
                  }).length === 0 && (
                    <SelectItem value="_no_products" disabled>
                      All available products added
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {items.length === 0 ? "Select products to add to this invoice" : `${items.length} product(s) added`}
              </p>
            </div>
          )}

          {!formData.client_id && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
              Please select a client first to add products.
            </div>
          )}

          {/* Existing Line Items */}
          <div className="space-y-4">
            {items.length === 0 && formData.client_id && (
              <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg bg-slate-50">
                No products added yet. Use the dropdown above to add products.
              </div>
            )}
            {items.map((item) => {
              if (!item.product_id) return null
              const product = products.find((p) => p.id === item.product_id)
              if (!product) return null

              const enabled = true
              const applyPerBirdPreview = !!item?.use_per_bird
              const birdCountPreview = applyPerBirdPreview ? Math.max(1, item?.bird_count || 1) : 1
              const previewPrice = calculateClientPrice(
                product.id,
                formData.client_id,
                formData.issue_date,
                applyPerBirdPreview,
                birdCountPreview,
              )
              const ruleInfo = formData.client_id ? getPricingRuleInfo(product.id, formData.client_id) : null
              const showMissingRuleWarning = formData.client_id && !ruleInfo
              const clientAdj = formData.client_id ? getClientAdjustment(formData.client_id) : 0
              const breakdown = formData.client_id
                ? getPriceBreakdown(
                    product.id,
                    formData.client_id,
                    formData.issue_date,
                    applyPerBirdPreview,
                    birdCountPreview,
                  )
                : null

              return (
                <div key={product.id} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-start gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleProductToggle(product.id, false)}
                      className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <div className="flex-1 space-y-1">
                      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{product.name}</p>
                            {ruleInfo && (
                              <Badge className="text-xs px-2 py-0.5 border rounded bg-green-100 text-green-800 border-green-200">
                                {ruleInfo}
                              </Badge>
                            )}
                            {showMissingRuleWarning && (
                              <Badge className="text-xs px-2 py-0.5 border rounded bg-red-100 text-red-800 border-red-200">Set pricing rule first</Badge>
                            )}
                          </div>
                          {product.description && (
                            <p className="text-xs text-muted-foreground">{product.description}</p>
                          )}
                        </div>
                        <div className="text-sm font-medium">₹{previewPrice.toFixed(2)}</div>
                      </div>
                      {formData.client_id && item?.use_per_bird && clientAdj !== 0 && isLiveWholeBird(product.id, formData.client_id) && (
                        <p className="text-xs text-green-600">
                          {`client adj ${clientAdj > 0 ? "+" : "-"}₹${Math.abs(clientAdj).toFixed(2)}/bird`}
                        </p>
                      )}
                      {breakdown && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          <div>
                            <span className="font-medium">Base:</span> ₹{breakdown.basePrice.toFixed(2)}
                          </div>
                          {breakdown.ruleLabel && (
                            <div>
                              <span className="font-medium">{breakdown.ruleLabel}:</span>
                              {" "}
                              {breakdown.ruleValueDisplay ? breakdown.ruleValueDisplay : "Applied"}
                              {" "}→ ₹{breakdown.afterRule.toFixed(2)}
                            </div>
                          )}
                          {item?.use_per_bird && (
                            <div className="text-amber-600 font-medium">
                              Per-bird applied to sub total: +₹{breakdown.birdAdj.toFixed(2)}
                              {" "}({`₹${breakdown.perBirdValue.toFixed(2)}`} × {breakdown.birdCount})
                            </div>
                          )}
                          <div>
                            <span className="font-medium">Unit Price:</span> ₹{breakdown.finalPrice.toFixed(2)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {enabled && item && (
                    <div className={`grid gap-4 ${item.use_per_bird ? "md:grid-cols-8" : "md:grid-cols-7"}`}>
                      {isLiveWholeBird(product.id, formData.client_id) && (
                        <div className="space-y-2">
                          <Label>Per-bird</Label>
                          <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                            <Switch
                              checked={!!item.use_per_bird}
                              onCheckedChange={(checked) => handlePerBirdToggle(product.id, Boolean(checked))}
                              disabled={!formData.client_id}
                            />
                          </div>
                        </div>
                      )}

                      {item.use_per_bird && (
                        <div className="space-y-2">
                          <Label>Birds</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.bird_count || 1}
                            onChange={(e) => handleBirdCountChange(product.id, Number(e.target.value) || 0)}
                          />
                        </div>
                      )}

                      <div className="space-y-2 md:col-span-2">
                        <Label>Description</Label>
                        <Input
                          required
                          value={item.description}
                          onChange={(e) => handleDescriptionChange(product.id, e.target.value)}
                          placeholder="Item description"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(product.id, Number(e.target.value) || 0)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Unit Price</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={item.unit_price}
                          onChange={(e) => handleUnitPriceChange(product.id, Number(e.target.value) || 0)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Tax Rate (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={item.tax_rate}
                          onChange={(e) => handleTaxChange(product.id, Number(e.target.value) || 0)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Discount (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={item.discount}
                          onChange={(e) => handleDiscountChange(product.id, Number(e.target.value) || 0)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Line Total</Label>
                        <Input value={`₹${item.line_total.toFixed(2)}`} disabled />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Invoice Discount (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={invoiceRates.discount_percent}
                onChange={(e) => setInvoiceRates((r) => ({ ...r, discount_percent: Number(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Invoice Tax (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={invoiceRates.tax_percent}
                onChange={(e) => setInvoiceRates((r) => ({ ...r, tax_percent: Number(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium">₹{totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax:</span>
              <span className="font-medium">₹{totals.tax_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount:</span>
              <span className="font-medium text-red-600">-₹{totals.discount_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total:</span>
              <span>₹{totals.total_amount.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>}

      <div className="flex gap-4">
        <Button type="submit" disabled={isLoading || !formData.client_id || !formData.invoice_number}>
          {isLoading ? "Creating..." : "Create Invoice"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
