"use client"

import { useState } from "react"
import { ClientSelector } from "@/components/client-selector"
import { ClientPricingTable } from "@/components/client-pricing-table"

interface PricingRule {
  id: string
  client_id: string
  product_id: string
  price_category_id: string
  markup_percentage: number
  discount_percentage: number
  created_at: string
  clients: { name: string }
  products: { name: string; paper_price: number }
  price_categories: { name: string }
}

interface Client {
  id: string
  name: string
}

interface ClientPricingPageClientProps {
  pricingRules: PricingRule[]
  priceHistory: any[]
  clients: Client[]
  userRole?: string
}

export function ClientPricingPageClient({ pricingRules, priceHistory, clients, userRole }: ClientPricingPageClientProps) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  const filteredRules =
    selectedClientId === null ? pricingRules : pricingRules.filter((rule) => rule.client_id === selectedClientId)

  return (
    <div className="space-y-4">
      <ClientSelector clients={clients} selectedClientId={selectedClientId} onClientChange={setSelectedClientId} />
      <ClientPricingTable pricingRules={filteredRules} priceHistory={priceHistory} userRole={userRole} />
    </div>
  )
}
