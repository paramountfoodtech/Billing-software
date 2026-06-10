"use client";

import { useState, useCallback } from "react";
import { PurchaserSelector } from "@/components/purchaser-selector";
import { PurchasePaymentsTable } from "@/components/purchase-payments-table";
import { Card, CardContent } from "@/components/ui/card";
import {
  FinancialYearSelector,
  getFinancialYear,
  getFinancialYearDateRange,
} from "@/components/financial-year-selector";

interface Purchaser {
  id: string;
  name: string;
}

interface PurchasePayment {
  id: string;
  purchase_invoice_id: string;
  amount: string;
  payment_date: string;
  payment_method: string;
  reference_number: string | null;
  status: string;
  purchase_invoices: {
    id: string;
    invoice_number: string;
    total_amount: string;
    amount_paid: string;
    purchaser_id: string;
    status: string;
    purchasers: { name: string };
  };
}

interface PurchaseInvoice {
  id: string;
  invoice_number: string;
  total_amount: string;
  amount_paid: string;
  status: string;
}

interface PurchasePaymentsPageClientProps {
  purchasers: Purchaser[];
  payments: PurchasePayment[];
  purchaserInvoices?: Record<string, PurchaseInvoice[]>;
  userRole?: string;
}

export function PurchasePaymentsPageClient({
  purchasers,
  payments,
  purchaserInvoices = {},
  userRole,
}: PurchasePaymentsPageClientProps) {
  const [selectedPurchaserId, setSelectedPurchaserId] = useState<string | null>(
    null,
  );
  const [selectedFY, setSelectedFY] = useState<string>(getFinancialYear());
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const filteredPayments = payments.filter((payment) => {
    if (
      selectedPurchaserId &&
      payment.purchase_invoices?.purchaser_id !== selectedPurchaserId
    ) {
      return false;
    }

    const { start, end } = getFinancialYearDateRange(selectedFY);
    const paymentDate = payment.payment_date;
    if (paymentDate < start || paymentDate > end) return false;

    if (fromDate && paymentDate < fromDate) return false;
    if (toDate && paymentDate > toDate) return false;

    return true;
  });

  const selectedPurchaserInvoices = selectedPurchaserId
    ? purchaserInvoices[selectedPurchaserId] || []
    : [];

  const calculateTotalPending = useCallback(() => {
    return selectedPurchaserInvoices.reduce((total, invoice) => {
      const pending =
        Number(invoice.total_amount) - Number(invoice.amount_paid);
      return total + pending;
    }, 0);
  }, [selectedPurchaserInvoices]);

  const calculateInvoiceStats = useCallback(() => {
    return {
      total: selectedPurchaserInvoices.length,
      paid: selectedPurchaserInvoices.filter((i) => i.status === "paid").length,
      partiallyPaid: selectedPurchaserInvoices.filter(
        (i) =>
          i.status === "partially_paid" ||
          (i.status === "recorded" && Number(i.amount_paid) > 0),
      ).length,
      unpaid: selectedPurchaserInvoices.filter(
        (i) => i.status === "recorded" && Number(i.amount_paid) === 0,
      ).length,
    };
  }, [selectedPurchaserInvoices]);

  const totalPending = calculateTotalPending();
  const invoiceStats = calculateInvoiceStats();

  return (
    <div className="space-y-6">
      {selectedPurchaserId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Total Invoices
                  </span>
                  <span className="font-semibold">{invoiceStats.total}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Paid</span>
                  <span className="font-semibold text-green-600">
                    {invoiceStats.paid}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Partially Paid
                  </span>
                  <span className="font-semibold text-blue-600">
                    {invoiceStats.partiallyPaid}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Unpaid</span>
                  <span className="font-semibold text-yellow-600">
                    {invoiceStats.unpaid}
                  </span>
                </div>
                <div className="border-t border-amber-200 pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-muted-foreground">
                      Total Pending
                    </span>
                    <span className="text-lg font-bold text-amber-700">
                      ₹
                      {totalPending.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="space-y-2">
                {filteredPayments.slice(0, 5).map((payment) => (
                  <div
                    key={payment.id}
                    className="flex justify-between items-center text-sm pb-2 border-b border-blue-100 last:border-b-0"
                  >
                    <div>
                      <p className="font-medium">
                        {payment.purchase_invoices?.invoice_number}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {payment.payment_date}
                      </p>
                    </div>
                    <p className="font-semibold text-green-600">
                      ₹
                      {Number(payment.amount).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                ))}
                {filteredPayments.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No payments recorded yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <PurchasePaymentsTable
        payments={filteredPayments}
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
