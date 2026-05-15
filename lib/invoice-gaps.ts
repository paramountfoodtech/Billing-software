/**
 * Extract numeric part from invoice number (e.g., "INV-001" -> 1)
 */
function extractNumeric(invoiceNumber: string): number | null {
  const match = invoiceNumber.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

/**
 * Find gaps in invoice number sequences
 * Returns array of missing numbers with their string representations
 */
export function findMissedInvoiceNumbers(
  invoices: Array<{ invoice_number: string }>,
  maxGapSize: number = 10000
): string[] {
  if (!invoices || invoices.length === 0) {
    return [];
  }

  // Extract numeric parts and sort
  const numbers = invoices
    .map((inv) => extractNumeric(inv.invoice_number))
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);

  if (numbers.length < 2) {
    return [];
  }

  const missed: number[] = [];

  // Find gaps between consecutive numbers
  for (let i = 0; i < numbers.length - 1; i++) {
    const current = numbers[i];
    const next = numbers[i + 1];

    // If gap is larger than 1, there are missing numbers
    if (next - current > 1) {
      // Only report gaps up to reasonable limit (avoid spam for huge gaps)
      const gapSize = next - current - 1;
      if (gapSize <= maxGapSize) {
        for (let j = current + 1; j < next; j++) {
          missed.push(j);
        }
      }
    }
  }

  // Extract prefix from a sample invoice number to format output
  const sampleInvoice = invoices[0]?.invoice_number || "";
  const prefixMatch = sampleInvoice.match(/^(.*?)(\d+)$/);
  const prefix = prefixMatch ? prefixMatch[1] : "";

  // Format missed numbers with the prefix
  return missed.map((num) => {
    const originalPadding = invoices
      .map((inv) => {
        const numMatch = inv.invoice_number.match(/^.*?(\d+)$/);
        return numMatch ? numMatch[1].length : 0;
      })
      .find((len) => len > 0) || 1;

    return prefix + num.toString().padStart(originalPadding, "0");
  });
}

function extractTrailingNumeric(invoiceNumber: string): number | null {
  const match = invoiceNumber.match(/(\d+)$/);
  return match ? Number(match[1]) : null;
}

/**
 * Format a consecutive run of missed numbers (e.g. "2-9", "INV-002-009")
 */
function formatMissedRange(start: string, end: string): string {
  if (start === end) return start;

  const startMatch = start.match(/^(.*?)(\d+)$/);
  const endMatch = end.match(/^(.*?)(\d+)$/);
  if (startMatch && endMatch && startMatch[1] === endMatch[1]) {
    const prefix = startMatch[1];
    return `${prefix}${startMatch[2]}-${endMatch[2]}`;
  }

  return `${start}-${end}`;
}

export type MissedInvoiceRange = {
  label: string;
  numbers: string[];
};

/**
 * Group missed invoice numbers into ranges at each gap break
 * (e.g. existing 1, 10, 15 → [{ label: "2-9", numbers: [...] }, { label: "11-14", ... }])
 */
export function groupMissedInvoices(missedNumbers: string[]): MissedInvoiceRange[] {
  if (missedNumbers.length === 0) return [];

  const ranges: MissedInvoiceRange[] = [];
  let rangeStart = missedNumbers[0];
  let rangeEnd = missedNumbers[0];
  let rangeNumbers = [missedNumbers[0]];

  for (let i = 1; i < missedNumbers.length; i++) {
    const prevNum = extractTrailingNumeric(rangeEnd);
    const currNum = extractTrailingNumeric(missedNumbers[i]);
    const isConsecutive =
      prevNum !== null && currNum !== null && currNum === prevNum + 1;

    if (isConsecutive) {
      rangeEnd = missedNumbers[i];
      rangeNumbers.push(missedNumbers[i]);
    } else {
      ranges.push({
        label: formatMissedRange(rangeStart, rangeEnd),
        numbers: rangeNumbers,
      });
      rangeStart = missedNumbers[i];
      rangeEnd = missedNumbers[i];
      rangeNumbers = [missedNumbers[i]];
    }
  }

  ranges.push({
    label: formatMissedRange(rangeStart, rangeEnd),
    numbers: rangeNumbers,
  });

  return ranges;
}
