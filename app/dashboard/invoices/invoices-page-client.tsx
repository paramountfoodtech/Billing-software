"use client"

import { useState } from "react"
import { ClientSelector } from "@/components/client-selector"
import { InvoicesTable } from "@/components/invoices-table"

interface Client {
  id: string
  name: string
}

interface Invoice {
  id: string
  client_id: string
  invoice_number: string
  issue_date: string
  total_amount: string
  amount_paid: string
  status: string
  clients: {
    name: string
    email: string
  }
  [key: string]: any
}

interface InvoicesPageClientProps {
  clients: Client[]
  invoices: Invoice[]
}

export function InvoicesPageClient({ clients, invoices }: InvoicesPageClientProps) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  const filteredInvoices = selectedClientId
    ? invoices.filter((invoice) => invoice.client_id === selectedClientId)
    : invoices

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground">Filter by client:</span>
        <ClientSelector clients={clients} selectedClientId={selectedClientId} onClientChange={setSelectedClientId} />
      </div>

      <InvoicesTable invoices={filteredInvoices} />
    </div>
  )
}
