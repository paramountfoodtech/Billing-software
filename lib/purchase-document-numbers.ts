/**
 * Generate next document numbers for purchase module (challans & purchase invoices).
 * Format: CH-YYYY-NNN / PI-YYYY-NNN
 */

export function suggestNextNumber(
  prefix: "CH" | "PI",
  existingNumbers: string[],
): string {
  const year = new Date().getFullYear()
  const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`, "i")

  let maxSeq = 0
  for (const num of existingNumbers) {
    const match = num.match(pattern)
    if (match) {
      maxSeq = Math.max(maxSeq, parseInt(match[1], 10))
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(3, "0")
  return `${prefix}-${year}-${nextSeq}`
}

export function suggestPurchaserCode(existingCodes: string[]): string {
  const pattern = /^PUR-(\d+)$/i
  let maxSeq = 0
  for (const code of existingCodes) {
    const match = code.match(pattern)
    if (match) {
      maxSeq = Math.max(maxSeq, parseInt(match[1], 10))
    }
  }
  return `PUR-${String(maxSeq + 1).padStart(3, "0")}`
}
