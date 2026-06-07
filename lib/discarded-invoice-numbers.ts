export type DiscardedInvoiceNumber = {
  id: string
  invoice_number: string
  note: string
  discarded_at: string
  discarded_by_name: string | null
}

export function excludeDiscardedMissedNumbers(
  missedNumbers: string[],
  discarded: DiscardedInvoiceNumber[],
): string[] {
  if (discarded.length === 0) return missedNumbers
  const discardedSet = new Set(discarded.map((d) => d.invoice_number))
  return missedNumbers.filter((n) => !discardedSet.has(n))
}
