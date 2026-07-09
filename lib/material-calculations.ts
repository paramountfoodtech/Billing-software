export function toNumber(value: string | number | null | undefined): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

/**
 * Format a percentage for display: up to 2 decimal places,
 * trailing zeros stripped. e.g. 90.000 → "90", 89.57 → "89.57", 89.5 → "89.5"
 */
export function fmtPercent(value: number | string | null | undefined): string {
  return parseFloat(Number(value || 0).toFixed(2)).toString()
}

export function calculateStockVariance(farmWeightKg: number, bridgeWeightKg: number) {
  const differenceKg = bridgeWeightKg - farmWeightKg
  const variancePercent = farmWeightKg === 0 ? 0 : (differenceKg / farmWeightKg) * 100
  return {
    differenceKg: round3(differenceKg),
    variancePercent: round3(variancePercent),
  }
}

export function calculateProcessingSummary(input: {
  purchasedWeightKg: number
  processedWeightKg: number
  mortalityWeightKg: number
  actualLeftoverWeightKg: number
}) {
  const expectedLeftoverWeightKg =
    input.purchasedWeightKg - input.processedWeightKg - input.mortalityWeightKg
  const leftoverVarianceKg = input.actualLeftoverWeightKg - expectedLeftoverWeightKg
  const usedStockKg =
    input.actualLeftoverWeightKg + input.processedWeightKg - input.mortalityWeightKg
  const yieldPercent =
    input.purchasedWeightKg === 0 ? 0 : (usedStockKg / input.purchasedWeightKg) * 100

  return {
    expectedLeftoverWeightKg: round3(expectedLeftoverWeightKg),
    leftoverVarianceKg: round3(leftoverVarianceKg),
    usedStockKg: round3(usedStockKg),
    yieldPercent: round3(yieldPercent),
  }
}

export function calculateExpectedLeftoverBirds(input: {
  purchasedBirds: number
  processedBirds: number
  mortalityBirds: number
}) {
  return Math.max(
    0,
    Math.floor(input.purchasedBirds - input.processedBirds - input.mortalityBirds),
  )
}

export function suggestMaterialStockReference(dateKey: string, existingReferences: string[]) {
  const compactDate = dateKey.replace(/-/g, "")
  const pattern = new RegExp(`^SE-${compactDate}-(\\d+)$`, "i")
  let maxSeq = 0

  for (const reference of existingReferences) {
    const match = reference.match(pattern)
    if (match) {
      maxSeq = Math.max(maxSeq, parseInt(match[1], 10))
    }
  }

  return `SE-${compactDate}-${String(maxSeq + 1).padStart(4, "0")}`
}
