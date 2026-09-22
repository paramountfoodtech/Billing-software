"use client";

import { useState, useCallback } from "react";
import { ClientSelector } from "@/components/client-selector";
import { PaymentsTable } from "@/components/payments-table";
import {
  getPaymentLinkedInvoices,
  type PaymentWithAllocations,
} from "@/components/payment-invoice-links";
import { Card, CardContent } from "@/components/ui/card";
import {
  FinancialYearSelector,
  getFinancialYear,
  getFinancialYearDateRange,
} from "@/components/financial-year-selector";

interface Client {
  id: string;
  name: string;
}

interface Payment {
  id: string;
  invoice_id: string | null;
  client_id?: string;
  amount: string;
  payment_date: string;
  payment_method: string;
  reference_number: string | null;
  status: string;
  invoices: {
    id: string;
    invoice_number: string;
    total_amount: string;
    amount_paid: string;
    client_id: string;
    status: string;
    clients: {
      name: string;
    };
  } | null;
  client?: {
    name: string;
  } | null;
  payment_allocations?: PaymentWithAllocations["payment_allocations"];
}

interface Invoice {
  id: string;
  invoice_number: string;
  total_amount: string;
  amount_paid: string;
  status: string;
}

interface PaymentsPageClientProps {
  clients: Client[];
  payments: Payment[];
  clientInvoices?: Record<string, Invoice[]>;
  userRole?: string;
}

export function PaymentsPageClient({
  clients,
  payments,
  clientInvoices = {},
  userRole,
}: PaymentsPageClientProps) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedFY, setSelectedFY] = useState<string>(getFinancialYear());

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Filter payments by client, financial year, and custom date range
  const filteredPayments = payments.filter((payment) => {
    const paymentClientId = payment.client_id || payment.invoices?.client_id;
    if (selectedClientId && paymentClientId !== selectedClientId) return false;

    const { start, end } = getFinancialYearDateRange(selectedFY);
    const paymentDate = payment.payment_date;
    if (paymentDate < start || paymentDate > end) return false;

    if (fromDate && paymentDate < fromDate) return false;
    if (toDate && paymentDate > toDate) return false;

    return true;
  });

  // Get invoices for selected client
  const selectedClientInvoices = selectedClientId
    ? clientInvoices[selectedClientId] || []
    : [];

  // Calculate total pending amount for selected client
  const calculateTotalPending = useCallback(() => {
    return selectedClientInvoices.reduce((total, invoice) => {
      const pending =
        Number(invoice.total_amount) - Number(invoice.amount_paid);
      return total + pending;
    }, 0);
  }, [selectedClientInvoices]);

  // Count invoice statuses
  const calculateInvoiceStats = useCallback(() => {
    return {
      total: selectedClientInvoices.length,
      paid: selectedClientInvoices.filter((i) => i.status === "paid").length,
      partiallyPaid: selectedClientInvoices.filter(
        (i) =>
          i.status === "partially_paid" ||
          (i.status === "recorded" && Number(i.amount_paid) > 0),
      ).length,
      unpaid: selectedClientInvoices.filter(
        (i) => i.status === "recorded" && Number(i.amount_paid) === 0,
      ).length,
      overdue: selectedClientInvoices.filter((i) => i.status === "overdue")
        .length,
    };
  }, [selectedClientInvoices]);

  const totalPending = calculateTotalPending();
  const invoiceStats = calculateInvoiceStats();

  return (
    <div className="space-y-6">
      {selectedClientId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Client Invoices Summary */}
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
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Overdue</span>
                  <span className="font-semibold text-red-600">
                    {invoiceStats.overdue}
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

          {/* Recent Payments */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="space-y-2">
                {filteredPayments.slice(0, 5).map((payment) => {
                  const linked = getPaymentLinkedInvoices(payment);
                  return (
                  <div
                    key={payment.id}
                    className="flex justify-between items-center text-sm pb-2 border-b border-blue-100 last:border-b-0"
                  >
                    <div>
                      <p className="font-medium">
                        {linked[0]?.invoice_number || "-"}
                        {linked.length > 1 && (
                          <span className="ml-1 text-xs font-semibold text-blue-700">
                            +{linked.length - 1}
                          </span>
                        )}
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
                  );
                })}
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

      <PaymentsTable
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
            <span className="text-sm font-medium text-muted-foreground">Client:</span>
            <ClientSelector
              clients={clients}
              selectedClientId={selectedClientId}
              onClientChange={setSelectedClientId}
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
