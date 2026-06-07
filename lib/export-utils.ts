/**
 * Utility functions for exporting data to Excel format
 */

import {
  buildPdfColumnLayout,
  measurePdfTextBlockHeight,
} from "@/lib/pdf-invoice-wrap"

export interface ExportColumn {
  key: string
  label: string
  formatter?: (value: any) => string
  widthFrac?: number
  align?: "left" | "right"
}

/**
 * Export data array to CSV format (compatible with Excel)
 */
export function exportToCSV(
  data: any[],
  columns: ExportColumn[],
  filename: string = "export.csv",
) {
  if (data.length === 0) {
    return
  }

  const headers = columns.map((col) => `"${col.label}"`).join(",")

  const rows = data.map((item) =>
    columns
      .map((col) => {
        let value = item[col.key]
        if (col.formatter) {
          value = col.formatter(value)
        }
        const stringValue = String(value ?? "")
        return `"${stringValue.replace(/"/g, '""')}"`
      })
      .join(","),
  )

  const csv = [headers, ...rows].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)

  link.setAttribute("href", url)
  link.setAttribute("download", filename)
  link.style.visibility = "hidden"

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Export data array to JSON format
 */
export function exportToJSON(
  data: any[],
  filename: string = "export.json",
) {
  if (data.length === 0) {
    return
  }

  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: "application/json;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)

  link.setAttribute("href", url)
  link.setAttribute("download", filename)
  link.style.visibility = "hidden"

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Get current timestamp for filename
 */
export function getTimestamp(): string {
  return new Date().toISOString().split("T")[0]
}

function normalizeWidthFracs(columns: ExportColumn[]): number[] {
  const fracs = columns.map((c) => c.widthFrac)
  if (!fracs.some((f) => f !== undefined)) {
    return columns.map(() => 1 / columns.length)
  }

  const fixedSum = fracs.reduce((sum, f) => sum + (f ?? 0), 0)
  const missing = fracs.filter((f) => f === undefined).length
  const remainder = Math.max(0, 1 - fixedSum)
  const fill = missing > 0 ? remainder / missing : 0
  return fracs.map((f) => f ?? fill)
}

/**
 * Export data array to PDF using jsPDF with wrapped text and proportional columns
 */
export async function exportToPDF(
  data: any[],
  columns: ExportColumn[],
  title: string,
  filename: string = "export.pdf",
) {
  if (data.length === 0) return

  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })

  const margin = 10
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const tableWidth = pageWidth - margin * 2
  const rightEdge = pageWidth - margin
  const cellPad = 2
  const rowPadY = 2.5
  const bodyFontSize = 7
  const headerH = 8

  const widthFracs = normalizeWidthFracs(columns)
  const colLayout = buildPdfColumnLayout(
    columns.map((col, i) => ({
      id: String(i),
      label: col.label,
      widthFrac: widthFracs[i],
      align: col.align ?? "left",
    })),
    margin,
    tableWidth,
    cellPad,
  )

  let y = margin

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.text(title, margin, y)
  y += 8

  const drawHeader = () => {
    const headerTop = y
    const headerTextY = headerTop + rowPadY

    doc.setFillColor(220, 220, 220)
    doc.rect(margin, headerTop, tableWidth, headerH, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)

    for (const col of colLayout) {
      if (col.align === "right") {
        doc.text(col.label, col.textX, headerTextY, {
          align: "right",
          baseline: "top",
        })
      } else {
        doc.text(col.label, col.textX, headerTextY, { baseline: "top" })
      }
      if (col.x > margin) {
        doc.setDrawColor(180, 180, 180)
        doc.line(col.x, headerTop, col.x, headerTop + headerH)
      }
    }

    doc.setDrawColor(180, 180, 180)
    doc.rect(margin, headerTop, tableWidth, headerH)
    y = headerTop + headerH
  }

  drawHeader()

  doc.setFont("helvetica", "normal")
  doc.setFontSize(bodyFontSize)
  const singleLineH = doc.getTextDimensions("Xy").h

  data.forEach((item, rowIndex) => {
    const cellLines = columns.map((col, i) => {
      let value = item[col.key]
      if (col.formatter) value = col.formatter(value)
      const str = String(value ?? "")
      return doc.splitTextToSize(str, colLayout[i].textMaxW)
    })

    const contentH = Math.max(
      singleLineH,
      ...cellLines.map((lines) =>
        measurePdfTextBlockHeight(doc, lines, singleLineH),
      ),
    )
    const dynamicRowH = rowPadY + contentH + rowPadY

    if (y + dynamicRowH > pageHeight - margin) {
      doc.addPage()
      y = margin
      drawHeader()
      doc.setFont("helvetica", "normal")
      doc.setFontSize(bodyFontSize)
    }

    const rowTop = y
    const textTop = rowTop + rowPadY

    if (rowIndex % 2 === 0) {
      doc.setFillColor(248, 248, 248)
      doc.rect(margin, rowTop, tableWidth, dynamicRowH, "F")
    }

    cellLines.forEach((lines, i) => {
      const col = colLayout[i]
      const text = lines.join("\n")
      if (col.align === "right") {
        doc.text(text, col.textX, textTop, {
          align: "right",
          baseline: "top",
          lineHeightFactor: 1.25,
        })
      } else {
        doc.text(text, col.textX, textTop, {
          baseline: "top",
          lineHeightFactor: 1.25,
        })
      }
    })

    doc.setDrawColor(230, 230, 230)
    doc.line(margin, rowTop + dynamicRowH, rightEdge, rowTop + dynamicRowH)
    y = rowTop + dynamicRowH
  })

  doc.save(filename)
}
