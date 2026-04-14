import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
/**
 * Calculate the final price based on pricing rule type and value
 * @param basePrice The base product price
 * @param ruleType Type of pricing rule (discount_percentage, discount_flat, multiplier)
 * @param ruleValue The value to apply
 * @returns The calculated final price
 */
export function calculatePriceFromRule(
  basePrice: number,
  ruleType: string,
  ruleValue: number | null | undefined
): number {
  if (!ruleValue) return basePrice

  const value = Number(ruleValue)

  switch (ruleType) {
    case 'discount_percentage':
      return basePrice * (1 - value / 100)
    case 'discount_flat':
      return basePrice - value
    case 'multiplier':
      return basePrice * value
    default:
      return basePrice
  }
}

/**
 * Get the price for a category on a specific date
 * @param categoryId The price category ID
 * @param onDate The date to get the price for (YYYY-MM-DD format)
 * @param priceHistory Array of price history entries
 * @returns The price effective on that date, or null if not found
 */
export function getPriceForCategoryOnDate(
  categoryId: string,
  onDate: string,
  priceHistory: Array<{ price_category_id: string; price: number; effective_date: string }>
): number | null {
  const price = priceHistory.find(
    (p) => p.price_category_id === categoryId && p.effective_date === onDate
  )
  return price ? Number(price.price) : null
}