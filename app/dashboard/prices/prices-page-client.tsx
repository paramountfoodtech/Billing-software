"use client"

import { PricesTable } from "@/components/prices-table"

interface PriceCategory {
  id: string
  name: string
  description: string | null
  price: number
  created_at: string
}

interface PriceHistory {
  id: string
  price_category_id: string
  price: number
  effective_date: string
  created_at: string
}

interface PricesPageClientProps {
  priceCategories: PriceCategory[]
  priceHistory: PriceHistory[]
}

export function PricesPageClient({ priceCategories, priceHistory }: PricesPageClientProps) {
  return (
    <div className="space-y-6">
      <PricesTable priceCategories={priceCategories} priceHistory={priceHistory} />
    </div>
  )
}
