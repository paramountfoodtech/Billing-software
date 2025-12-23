"use client"

import { useState, useCallback } from "react"
import { ClientSelector } from "@/components/client-selector"
import { InvoicesTable } from "@/components/invoices-table"
import { Card, CardContent } from "@/components/ui/card"

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

  // Calculate total pending amount for selected client
  const calculateTotalPending = useCallback(() => {
    return filteredInvoices.reduce((total, invoice) => {
      const pending = Number(invoice.total_amount) - Number(invoice.amount_paid)
      return total + pending
    }, 0)
  }, [filteredInvoices])

  const totalPending = calculateTotalPending()

  // Count invoice statuses
  const invoiceStats = {
    total: filteredInvoices.length,
    paid: filteredInvoices.filter((i) => i.status === "paid").length,
    unpaid: filteredInvoices.filter((i) => i.status === "sent" || i.status === "draft").length,
    overdue: filteredInvoices.filter((i) => i.status === "overdue").length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground">Filter by client:</span>
        <ClientSelector clients={clients} selectedClientId={selectedClientId} onClientChange={setSelectedClientId} />
      </div>

      {selectedClientId && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Invoices</p>
                <p className="text-2xl font-bold">{invoiceStats.total}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Paid</p>
                <p className="text-2xl font-bold text-green-600">{invoiceStats.paid}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unpaid</p>
                <p className="text-2xl font-bold text-yellow-600">{invoiceStats.unpaid}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{invoiceStats.overdue}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-blue-200">
              <p className="text-sm text-muted-foreground">Total Pending Amount</p>
              <p className="text-3xl font-bold text-blue-600">
                ₹{totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <InvoicesTable invoices={filteredInvoices} />
    </div>
  )
}
