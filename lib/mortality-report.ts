/**
 * Transit mortality & loss rows, shared by Purchase Reports and the DAR.
 *
 * A row comes from either:
 *  - a purchase invoice with mortality or a recorded discrepancy, or
 *  - a challan with mortality that has not been invoiced yet ("pending").
 */

export interface MortalityReportRow {
  id: string;
  invoice_id: string | null;
  invoice_number: string | null;
  purchaser_invoice_number?: string | null;
  challan_number: string;
  date: string;
  purchaser_id?: string | null;
  purchaser_name: string;
  gross_birds: number;
  gross_weight_kg: number;
  mortality_birds: number;
  mortality_weight_kg: number;
  rate_per_kg: number;
  is_mortality_accepted: boolean;
  status: "accepted" | "neglected" | "pending";
  billable_birds: number;
  billable_weight_kg: number;
  loss_amount: number;
  deducted_amount: number;
  has_discrepancy?: boolean;
  discrepancy_birds?: number;
  discrepancy_weight_kg?: number;
  discrepancy_notes?: string | null;
}

type Num = string | number | null | undefined;

export type MortalityInvoiceInput = {
  id: string;
  invoice_number: string;
  purchaser_invoice_number?: string | null;
  purchaser_id: string | null;
  issue_date: string;
  total_weight_kg: Num;
  total_birds: Num;
  price_per_kg: Num;
  is_mortality_accepted: boolean | null;
  mortality_birds: Num;
  mortality_weight_kg: Num;
  mortality_loss_amount: Num;
  has_discrepancy: boolean | null;
  discrepancy_birds: Num;
  discrepancy_weight_kg: Num;
  discrepancy_notes: string | null;
  challan_id: string | null;
  purchasers: unknown;
};

export type MortalityChallanInput = {
  id: string;
  challan_number: string;
  challan_date: string;
  total_weight_kg: Num;
  total_birds: Num;
  mortality_birds: Num;
  mortality_weight_kg: Num;
  purchase_invoice_id: string | null;
  purchaser_id: string | null;
  purchasers: unknown;
};

const purchaserName = (value: unknown) => {
  const p = Array.isArray(value) ? value[0] : value;
  return (p as { name: string } | null | undefined)?.name || "Unknown";
};

export function buildMortalityRows({
  invoices,
  challans,
}: {
  invoices: MortalityInvoiceInput[];
  /** Challans in range, plus any linked to `invoices` (used for labels). */
  challans: MortalityChallanInput[];
}): MortalityReportRow[] {
  const challanLabelByInvoice = new Map<string, string>();
  for (const c of challans) {
    if (!c.purchase_invoice_id) continue;
    const existing = challanLabelByInvoice.get(c.purchase_invoice_id);
    challanLabelByInvoice.set(
      c.purchase_invoice_id,
      existing ? `${existing}, ${c.challan_number}` : c.challan_number,
    );
  }

  const challanById = new Map<string, MortalityChallanInput>();
  for (const c of challans) {
    challanById.set(c.id, c);
  }

  const invoicedChallanIds = new Set<string>();
  const rows: MortalityReportRow[] = [];

  for (const inv of invoices) {
    const mortBirds = Number(inv.mortality_birds || 0);
    const mortWeight = Number(inv.mortality_weight_kg || 0);
    const hasDisc = Boolean(inv.has_discrepancy);
    const discBirds = Number(inv.discrepancy_birds || 0);
    const discWeight = Number(inv.discrepancy_weight_kg || 0);

    if (mortBirds > 0 || mortWeight > 0 || hasDisc) {
      const isAccepted = Boolean(inv.is_mortality_accepted);
      const rate = Number(inv.price_per_kg || 0);
      const billableWeight = Number(inv.total_weight_kg || 0);
      const billableBirds = Number(inv.total_birds || 0);
      const grossWeight = isAccepted
        ? billableWeight + mortWeight
        : billableWeight;
      const grossBirds = isAccepted
        ? billableBirds + mortBirds
        : billableBirds;

      const lossAmount = !isAccepted
        ? Number(inv.mortality_loss_amount || mortWeight * rate)
        : 0;
      const deductedAmount = isAccepted
        ? Math.round((mortWeight * rate + Number.EPSILON) * 100) / 100
        : 0;

      const linkedChallanLabel =
        challanLabelByInvoice.get(inv.id) ||
        (inv.challan_id
          ? challanById.get(inv.challan_id)?.challan_number
          : null) ||
        "—";

      if (inv.challan_id) invoicedChallanIds.add(inv.challan_id);

      rows.push({
        id: inv.id,
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        purchaser_invoice_number: inv.purchaser_invoice_number,
        challan_number: linkedChallanLabel,
        date: inv.issue_date,
        purchaser_id: inv.purchaser_id,
        purchaser_name: purchaserName(inv.purchasers),
        gross_birds: grossBirds,
        gross_weight_kg: grossWeight,
        mortality_birds: mortBirds,
        mortality_weight_kg: mortWeight,
        rate_per_kg: rate,
        is_mortality_accepted: isAccepted,
        status: isAccepted ? "accepted" : "neglected",
        billable_birds: billableBirds,
        billable_weight_kg: billableWeight,
        loss_amount: lossAmount,
        deducted_amount: deductedAmount,
        has_discrepancy: hasDisc,
        discrepancy_birds: discBirds,
        discrepancy_weight_kg: discWeight,
        discrepancy_notes: inv.discrepancy_notes,
      });
    }
  }

  for (const c of challans) {
    if (c.purchase_invoice_id || invoicedChallanIds.has(c.id)) continue;
    const mortBirds = Number(c.mortality_birds || 0);
    const mortWeight = Number(c.mortality_weight_kg || 0);
    if (mortBirds > 0 || mortWeight > 0) {
      rows.push({
        id: c.id,
        invoice_id: null,
        invoice_number: null,
        purchaser_invoice_number: null,
        challan_number: c.challan_number,
        date: c.challan_date,
        purchaser_id: c.purchaser_id,
        purchaser_name: purchaserName(c.purchasers),
        gross_birds: Number(c.total_birds || 0),
        gross_weight_kg: Number(c.total_weight_kg || 0),
        mortality_birds: mortBirds,
        mortality_weight_kg: mortWeight,
        rate_per_kg: 0,
        is_mortality_accepted: false,
        status: "pending",
        billable_birds: Number(c.total_birds || 0),
        billable_weight_kg: Number(c.total_weight_kg || 0),
        loss_amount: 0,
        deducted_amount: 0,
      });
    }
  }

  return rows;
}

/** Column list for the purchase_invoices select, matching MortalityInvoiceInput. */
export const MORTALITY_INVOICE_COLUMNS = `
  id,
  invoice_number,
  purchaser_invoice_number,
  purchaser_id,
  issue_date,
  total_amount,
  total_weight_kg,
  total_birds,
  price_per_kg,
  is_mortality_accepted,
  mortality_birds,
  mortality_weight_kg,
  mortality_loss_amount,
  has_discrepancy,
  discrepancy_birds,
  discrepancy_weight_kg,
  discrepancy_notes,
  challan_id,
  purchasers(name)
`;

/** Column list for the challans select, matching MortalityChallanInput. */
export const MORTALITY_CHALLAN_COLUMNS = `
  id,
  challan_number,
  challan_date,
  total_weight_kg,
  total_birds,
  mortality_birds,
  mortality_weight_kg,
  status,
  purchase_invoice_id,
  purchaser_id,
  purchasers(name)
`;
