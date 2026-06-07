import type { jsPDF } from "jspdf"

/** Wrap comma-separated invoice numbers within a PDF column width. */
export function wrapInvoiceListForPdf(
  pdf: jsPDF,
  text: string,
  maxW: number,
): string[] {
  if (!text) return ["-"]
  const parts = text.split(/,\s*/).map((p) => p.trim()).filter(Boolean)
  if (parts.length <= 1) {
    return pdf.splitTextToSize(text, maxW)
  }
  const lines: string[] = []
  let current = ""
  for (const part of parts) {
    const candidate = current ? `${current}, ${part}` : part
    if (pdf.getTextWidth(candidate) <= maxW) {
      current = candidate
    } else {
      if (current) lines.push(current)
      if (pdf.getTextWidth(part) > maxW) {
        lines.push(...pdf.splitTextToSize(part, maxW))
        current = ""
      } else {
        current = part
      }
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : pdf.splitTextToSize(text, maxW)
}

export function measurePdfTextBlockHeight(
  pdf: jsPDF,
  lines: string[],
  singleLineH: number,
  lineHeightFactor = 1.25,
): number {
  if (lines.length === 0) return singleLineH
  const blockH = pdf.getTextDimensions(lines.join("\n"), { lineHeightFactor }).h
  return Math.max(singleLineH, blockH)
}

export type PdfColumnDef = {
  id: string
  label: string
  widthFrac: number
  align: "left" | "right"
}

/** Draw text centered horizontally and vertically within a PDF table cell. */
export function drawPdfCellCentered(
  pdf: jsPDF,
  text: string,
  cellX: number,
  cellWidth: number,
  cellTop: number,
  cellHeight: number,
) {
  if (!text) return
  const dims = pdf.getTextDimensions(text)
  const x = cellX + cellWidth / 2
  const y = cellTop + cellHeight / 2 - dims.h / 2
  pdf.text(text, x, y, { align: "center", baseline: "top" })
}

export function buildPdfColumnLayout(
  columns: PdfColumnDef[],
  margin: number,
  tableWidth: number,
  cellPad: number,
) {
  return columns.map((col, i) => {
    const width = tableWidth * col.widthFrac
    const x =
      margin +
      columns.slice(0, i).reduce((sum, c) => sum + tableWidth * c.widthFrac, 0)
    return {
      ...col,
      x,
      width,
      textX: col.align === "right" ? x + width - cellPad : x + cellPad,
      textMaxW: width - cellPad * 2,
    }
  })
}
