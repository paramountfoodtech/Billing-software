"use client";

import { useState } from "react";
import { ClientSelector } from "@/components/client-selector";
import { InvoicesTable } from "@/components/invoices-table";
import {
  FinancialYearSelector,
  getFinancialYear,
  getFinancialYearDateRange,
} from "@/components/financial-year-selector";

interface Client {
  id: string;
  name: string;
}

interface Invoice {
  id: string;
  client_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  total_amount: string;
  amount_paid: string;
  status: string;
  clients: {
    name: string;
    email: string;
  };
  [key: string]: any;
}

interface InvoicesPageClientProps {
  clients: Client[];
  invoices: Invoice[];
  userRole?: string;
}

export function InvoicesPageClient({
  clients,
  invoices,
  userRole,
}: InvoicesPageClientProps) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedFY, setSelectedFY] = useState<string>(getFinancialYear());

  // Filter by client and financial year
  const filteredInvoices = invoices.filter((invoice) => {
    // Client filter
    if (selectedClientId && invoice.client_id !== selectedClientId) {
      return false;
    }

    // Financial year filter
    const { start, end } = getFinancialYearDateRange(selectedFY);
    const issueDate = invoice.issue_date;

    return issueDate >= start && issueDate <= end;
  });

  return (
    <div className="space-y-6">
      <InvoicesTable
        invoices={filteredInvoices}
        userRole={userRole}
        toolbarLeft={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              Financial Year:
            </span>
            <FinancialYearSelector
              selectedYear={selectedFY}
              onYearChange={setSelectedFY}
            />
            <span className="text-sm font-medium text-muted-foreground">
              Client:
            </span>
            <ClientSelector
              clients={clients}
              selectedClientId={selectedClientId}
              onClientChange={setSelectedClientId}
            />
          </div>
        }
      />
    </div>
  );
}
