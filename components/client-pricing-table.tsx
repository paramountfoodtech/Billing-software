"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Pencil, Trash2 } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { getPriceForCategoryOnDate } from "@/lib/utils"

interface PricingRule {
  id: string
  price_rule_type: string
  price_rule_value: string | null
  price_category_id: string | null
  notes: string | null
  created_at: string
  clients: {
    name: string
  }
  products: {
    name: string
    paper_price: string
  }
  price_categories?: {
    name: string
  } | null
}

interface ClientPricingTableProps {
  pricingRules: PricingRule[]
  priceHistory?: Array<{ price_category_id: string; price: number; effective_date: string }>
  userRole?: string
}

const ruleTypeLabels = {
  discount_percentage: "Discount %",
  discount_flat: "Flat Discount",
  multiplier: "Multiplier",
}

export function ClientPricingTable({ pricingRules, priceHistory = [], userRole }: ClientPricingTableProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)
  const today = new Date().toISOString().split("T")[0]

  const calculateFinalPrice = (rule: PricingRule) => {
    // Get category price as base
    const categoryPrice = rule.price_category_id 
      ? getPriceForCategoryOnDate(rule.price_category_id, today, priceHistory)
      : null
    
    const basePrice = categoryPrice !== null ? categoryPrice : Number(rule.products.paper_price)
    const ruleValue = Number(rule.price_rule_value || 0)

    switch (rule.price_rule_type) {
      case "discount_percentage":
        return basePrice * (1 - ruleValue / 100)
      case "discount_flat":
        return basePrice - ruleValue
      case "multiplier":
        return basePrice * ruleValue
      default:
        return basePrice
    }
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    const supabase = createClient()

    const { error } = await supabase.from("client_product_pricing").delete().eq("id", id)

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete pricing rule.",
      })
    } else {
      toast({
        title: "Pricing rule deleted",
        description: "The pricing rule has been deleted successfully.",
      })
      router.refresh()
    }

    setIsDeleting(false)
  }

  if (pricingRules.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-white">
        <p className="text-muted-foreground">No client-specific pricing rules found. Create one to get started.</p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Base Category</TableHead>
              <TableHead>Category Price (Today)</TableHead>
              <TableHead>Rule Type</TableHead>
              <TableHead>Rule Value</TableHead>
              <TableHead>Final Price</TableHead>
              {userRole !== "manager" && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pricingRules.map((rule) => {
              const finalPrice = calculateFinalPrice(rule)
              const categoryPrice = rule.price_category_id 
                ? getPriceForCategoryOnDate(rule.price_category_id, today, priceHistory)
                : null
              
              return (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.clients.name}</TableCell>
                  <TableCell>{rule.products.name}</TableCell>
                  <TableCell>
                    <span className="font-medium text-blue-600">{rule.price_categories?.name || "—"}</span>
                  </TableCell>
                  <TableCell>
                    {categoryPrice !== null ? (
                      <span className="font-semibold text-green-600">₹{categoryPrice.toFixed(2)}</span>
                    ) : (
                      <span className="text-gray-400">No price</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {ruleTypeLabels[rule.price_rule_type as keyof typeof ruleTypeLabels]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {rule.price_rule_type === "discount_percentage" && `${rule.price_rule_value}%`}
                    {rule.price_rule_type === "discount_flat" && `₹${Number(rule.price_rule_value || 0).toFixed(2)}`}
                    {rule.price_rule_type === "multiplier" && `× ${rule.price_rule_value}`}
                  </TableCell>
                  <TableCell className="font-bold text-green-600">₹{finalPrice.toFixed(2)}</TableCell>
                  {userRole !== "manager" && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/client-pricing/${rule.id}/edit`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this pricing rule?")) {
                              handleDelete(rule.id)
                            }
                          }}
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

    </>
  )
}
