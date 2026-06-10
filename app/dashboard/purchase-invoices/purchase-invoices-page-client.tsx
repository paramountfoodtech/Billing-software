"use client";

import { useState } from "react";
import { PurchaserSelector } from "@/components/purchaser-selector";
import { PurchaseInvoicesTable } from "@/components/purchase-invoices-table";
import {
  FinancialYearSelector,
  getFinancialYear,
  getFinancialYearDateRange,
} from "@/components/financial-year-selector";

interface Purchaser {
  id: string;
  name: string;
}

interface PurchaseInvoice {
  id: string;
  purchaser_id: string | null;
  invoice_number: string;
  issue_date: string;
  total_weight_kg: string;
  price_per_kg: string;
  total_amount: string;
  amount_paid: string;
  status: string;
  created_at: string;
  purchasers: { name: string; purchaser_code: string };
  challans: { challan_number: string };
  profiles?: { full_name: string };
}

interface PurchaseInvoicesPageClientProps {
  purchasers: Purchaser[];
  invoices: PurchaseInvoice[];
  userRole?: string;
}

export function PurchaseInvoicesPageClient({
  purchasers,
  invoices,
  userRole,
}: PurchaseInvoicesPageClientProps) {
  const [selectedPurchaserId, setSelectedPurchaserId] = useState<string | null>(
    null,
  );
  const [selectedFY, setSelectedFY] = useState<string>(getFinancialYear());
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const filteredInvoices = invoices.filter((invoice) => {
    if (
      selectedPurchaserId &&
      invoice.purchaser_id !== selectedPurchaserId
    ) {
      return false;
    }

    const { start, end } = getFinancialYearDateRange(selectedFY);
    const issueDate = invoice.issue_date;
    if (issueDate < start || issueDate > end) return false;

    if (fromDate && issueDate < fromDate) return false;
    if (toDate && issueDate > toDate) return false;

    return true;
  });

  return (
    <div className="space-y-6">
      <PurchaseInvoicesTable
        invoices={filteredInvoices}
        userRole={userRole}
        fromDate={fromDate}
        toDate={toDate}
        toolbarLeft={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">FY:</span>
            <FinancialYearSelector
              selectedYear={selectedFY}
              onYearChange={setSelectedFY}
            />
            <span className="text-sm font-medium text-muted-foreground">
              Purchaser:
            </span>
            <PurchaserSelector
              purchasers={purchasers}
              selectedPurchaserId={selectedPurchaserId}
              onPurchaserChange={setSelectedPurchaserId}
            />
            <span className="text-sm font-medium text-muted-foreground">From:</span>
            <input
              type="date"
              className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <span className="text-sm font-medium text-muted-foreground">To:</span>
            <input
              type="date"
              className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        }
      />
    </div>
  );
}
