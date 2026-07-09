import { addCalendarDays } from "@/lib/date-time"
import { calculateExpectedLeftoverBirds, toNumber } from "@/lib/material-calculations"
import type { MaterialStockEntry } from "@/components/material-stock-form"

export type MaterialProcessingEntry = {
  id: string
  organization_id: string
  processing_date: string
  purchased_birds: number
  purchased_weight_kg: string | number
  processed_birds: number
  processed_weight_kg: string | number
  mortality_birds: number
  mortality_weight_kg: string | number
  expected_leftover_birds?: number
  expected_leftover_weight_kg: string | number
  actual_leftover_birds: number
  actual_leftover_weight_kg: string | number
  leftover_variance_kg: string | number
  used_stock_kg: string | number
  yield_percent: string | number
  current_stock_birds?: number
  current_stock_weight_kg?: string | number
  carryover_from_date?: string | null
  carryover_expected_leftover_birds?: number
  carryover_expected_leftover_weight_kg?: string | number
  carryover_actual_leftover_birds?: number
  carryover_actual_leftover_weight_kg?: string | number
  disposal_reason: string | null
  operational_remarks: string | null
  created_at: string
}

export type StockTotals = {
  birds: number
  weightKg: number
  count: number
}

export type CarryoverLeftover = {
  fromDate: string | null
  expectedBirds: number
  expectedWeightKg: number
  actualBirds: number
  actualWeightKg: number
}

export type ProcessingAvailability = {
  currentStock: StockTotals
  carryover: CarryoverLeftover
  totalBirds: number
  totalWeightKg: number
}

export function getStockTotalsForDate(
  stockEntries: MaterialStockEntry[],
  date: string,
): StockTotals {
  const entriesForDate = stockEntries.filter((entry) => entry.purchase_date === date)
  return {
    birds: entriesForDate.reduce((sum, entry) => sum + Number(entry.bridge_birds || 0), 0),
    weightKg: entriesForDate.reduce(
      (sum, entry) => sum + Number(entry.bridge_weight_kg || 0),
      0,
    ),
    count: entriesForDate.length,
  }
}

export function getPreviousDayExpectedLeftover(
  processingEntries: MaterialProcessingEntry[],
  processingDate: string,
  excludeEntryId?: string,
): CarryoverLeftover {
  const previousDate = addCalendarDays(processingDate, -1)
  const previousEntry = processingEntries.find(
    (entry) =>
      entry.processing_date === previousDate && entry.id !== excludeEntryId,
  )

  if (!previousEntry) {
    return {
      fromDate: null,
      expectedBirds: 0,
      expectedWeightKg: 0,
      actualBirds: 0,
      actualWeightKg: 0,
    }
  }

  const expectedBirds =
    previousEntry.expected_leftover_birds != null
      ? Number(previousEntry.expected_leftover_birds)
      : calculateExpectedLeftoverBirds({
          purchasedBirds: Number(previousEntry.purchased_birds || 0),
          processedBirds: Number(previousEntry.processed_birds || 0),
          mortalityBirds: Number(previousEntry.mortality_birds || 0),
        })

  return {
    fromDate: previousEntry.processing_date,
    expectedBirds,
    expectedWeightKg: toNumber(previousEntry.expected_leftover_weight_kg),
    actualBirds: Number(previousEntry.actual_leftover_birds || 0),
    actualWeightKg: toNumber(previousEntry.actual_leftover_weight_kg),
  }
}

export function getProcessingAvailability(input: {
  stockEntries: MaterialStockEntry[]
  processingEntries: MaterialProcessingEntry[]
  processingDate: string
  excludeEntryId?: string
  carryoverActualBirds?: number
  carryoverActualWeightKg?: number
  savedEntry?: MaterialProcessingEntry | null
}): ProcessingAvailability {
  const currentStock = getStockTotalsForDate(input.stockEntries, input.processingDate)

  if (input.savedEntry) {
    const carryover: CarryoverLeftover = {
      fromDate: input.savedEntry.carryover_from_date || null,
      expectedBirds: Number(input.savedEntry.carryover_expected_leftover_birds || 0),
      expectedWeightKg: toNumber(input.savedEntry.carryover_expected_leftover_weight_kg),
      actualBirds: Number(input.savedEntry.carryover_actual_leftover_birds || 0),
      actualWeightKg: toNumber(input.savedEntry.carryover_actual_leftover_weight_kg),
    }

    const stockBirds =
      input.savedEntry.current_stock_birds != null
        ? Number(input.savedEntry.current_stock_birds)
        : currentStock.birds
    const stockWeightKg =
      input.savedEntry.current_stock_weight_kg != null
        ? toNumber(input.savedEntry.current_stock_weight_kg)
        : currentStock.weightKg

    return {
      currentStock: {
        birds: stockBirds,
        weightKg: stockWeightKg,
        count: currentStock.count,
      },
      carryover,
      totalBirds: stockBirds + carryover.actualBirds,
      totalWeightKg: stockWeightKg + carryover.actualWeightKg,
    }
  }

  const previousExpected = getPreviousDayExpectedLeftover(
    input.processingEntries,
    input.processingDate,
    input.excludeEntryId,
  )

  const carryoverActualBirds =
    input.carryoverActualBirds ?? previousExpected.expectedBirds
  const carryoverActualWeightKg =
    input.carryoverActualWeightKg ?? previousExpected.expectedWeightKg

  const carryover: CarryoverLeftover = {
    fromDate: previousExpected.fromDate,
    expectedBirds: previousExpected.expectedBirds,
    expectedWeightKg: previousExpected.expectedWeightKg,
    actualBirds: carryoverActualBirds,
    actualWeightKg: carryoverActualWeightKg,
  }

  return {
    currentStock,
    carryover,
    totalBirds: currentStock.birds + carryover.actualBirds,
    totalWeightKg: currentStock.weightKg + carryover.actualWeightKg,
  }
}

export function getEntryStockBreakdown(entry: MaterialProcessingEntry) {
  const stockBirds = Number(entry.current_stock_birds ?? 0)
  const stockWeightKg = toNumber(entry.current_stock_weight_kg)
  const carryoverBirds = Number(entry.carryover_actual_leftover_birds ?? 0)
  const carryoverWeightKg = toNumber(entry.carryover_actual_leftover_weight_kg)
  const carryoverExpectedWeightKg = toNumber(entry.carryover_expected_leftover_weight_kg)
  const carryoverExpectedBirds = Number(entry.carryover_expected_leftover_birds ?? 0)

  const hasBreakdown = stockWeightKg > 0 || carryoverWeightKg > 0

  return {
    stockBirds: hasBreakdown ? stockBirds : Number(entry.purchased_birds || 0),
    stockWeightKg: hasBreakdown ? stockWeightKg : toNumber(entry.purchased_weight_kg),
    carryoverBirds: hasBreakdown ? carryoverBirds : 0,
    carryoverWeightKg: hasBreakdown ? carryoverWeightKg : 0,
    carryoverExpectedBirds,
    carryoverExpectedWeightKg,
    carryoverFromDate: entry.carryover_from_date || null,
    carryoverDiffersFromExpected:
      carryoverWeightKg !== carryoverExpectedWeightKg ||
      carryoverBirds !== carryoverExpectedBirds,
  }
}
