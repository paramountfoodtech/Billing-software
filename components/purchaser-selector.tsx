"use client"

import { SearchableSelect } from "@/components/ui/searchable-select"

interface Purchaser {
  id: string
  name: string
}

interface PurchaserSelectorProps {
  purchasers: Purchaser[]
  selectedPurchaserId: string | null
  onPurchaserChange: (purchaserId: string | null) => void
  showAllOption?: boolean
}

export function PurchaserSelector({
  purchasers,
  selectedPurchaserId,
  onPurchaserChange,
  showAllOption = true,
}: PurchaserSelectorProps) {
  const options = [
    ...(showAllOption ? [{ value: "all", label: "All Purchasers" }] : []),
    ...purchasers.map((p) => ({ value: p.id, label: p.name })),
  ]

  return (
    <div className="w-full md:w-64">
      <SearchableSelect
        value={selectedPurchaserId || (showAllOption ? "all" : "")}
        onValueChange={(value) =>
          onPurchaserChange(value === "all" || value === "" ? null : value)
        }
        options={options}
        placeholder="Select a purchaser..."
        searchPlaceholder="Type purchaser name..."
      />
    </div>
  )
}
