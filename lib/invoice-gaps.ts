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

/**
 * Group missed invoice numbers for display (e.g., "INV-001, INV-002...INV-005")
 */
export function groupMissedInvoices(missedNumbers: string[]): string {
  if (missedNumbers.length === 0) return "";
  if (missedNumbers.length === 1) return missedNumbers[0];

  const groups: string[] = [];
  let currentGroup = [missedNumbers[0]];

  for (let i = 1; i < missedNumbers.length; i++) {
    // Check if this is consecutive with previous
    const isConsecutive =
      Number(missedNumbers[i].match(/\d+/)?.[0]) ===
      Number(missedNumbers[i - 1].match(/\d+/)?.[0]) + 1;

    if (isConsecutive && currentGroup.length < 3) {
      currentGroup.push(missedNumbers[i]);
    } else {
      if (currentGroup.length === 1) {
        groups.push(currentGroup[0]);
      } else {
        groups.push(
          `${currentGroup[0]}...${currentGroup[currentGroup.length - 1]}`
        );
      }
      currentGroup = [missedNumbers[i]];
    }
  }

  // Add last group
  if (currentGroup.length === 1) {
    groups.push(currentGroup[0]);
  } else {
    groups.push(
      `${currentGroup[0]}...${currentGroup[currentGroup.length - 1]}`
    );
  }

  return groups.join(", ");
}
