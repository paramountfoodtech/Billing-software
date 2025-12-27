"use client"

import { useState, useCallback } from "react"
import { ClientSelector } from "@/components/client-selector"
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
  due_date: string
  total_amount: string
  amount_paid: string
  status: string
  clients: {
    name: string
    email: string
  }
  [key: string]: any
}

interface DashboardClientProps {
  clients: Client[]
  invoices: Invoice[]
}

export function DashboardClient({ clients, invoices }: DashboardClientProps) {
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
    // Overdue computed dynamically using full days overdue (consistency with chips and table)
    overdue: filteredInvoices.filter((i) => {
      const balance = Number(i.total_amount) - Number(i.amount_paid)
      const dueDate = new Date(i.due_date)
      const msInDayLocal = 1000 * 60 * 60 * 24
      const todayLocal = new Date()
      const daysOverdueLocal = Math.floor((todayLocal.getTime() - dueDate.getTime()) / msInDayLocal)
      return balance > 0 && daysOverdueLocal > 0
    }).length,
  }

  const msInDay = 1000 * 60 * 60 * 24
  const today = new Date()
  const overdueBuckets = {
    week1: 0,
    week2: 0,
    week3: 0,
    week3plus: 0,
  }
  const overdueAmounts = {
    week1: 0,
    week2: 0,
    week3: 0,
    week3plus: 0,
  }

  filteredInvoices.forEach((invoice) => {
    const dueDate = new Date(invoice.due_date)
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / msInDay)
    const balance = Number(invoice.total_amount) - Number(invoice.amount_paid)
    if (balance > 0 && daysOverdue > 0) {
      if (daysOverdue <= 7) {
        overdueBuckets.week1 += 1
        overdueAmounts.week1 += balance
      } else if (daysOverdue <= 14) {
        overdueBuckets.week2 += 1
        overdueAmounts.week2 += balance
      } else if (daysOverdue <= 21) {
        overdueBuckets.week3 += 1
        overdueAmounts.week3 += balance
      } else {
        overdueBuckets.week3plus += 1
        overdueAmounts.week3plus += balance
      }
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground">Select client:</span>
        <ClientSelector clients={clients} selectedClientId={selectedClientId} onClientChange={setSelectedClientId} />
      </div>

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
          <div className="mt-4">
            <p className="text-sm font-medium">Overdues</p>
            <p className="text-xs text-muted-foreground">Counts and amounts by weeks</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border bg-white p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <p className="text-xs text-muted-foreground">1 week</p>
              </div>
              <p className="text-xl font-semibold">{overdueBuckets.week1}</p>
            </div>
            <p className="text-xs text-muted-foreground col-span-1">₹{overdueAmounts.week1.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <div className="rounded-lg border bg-white p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-orange-500" />
                <p className="text-xs text-muted-foreground">2 weeks</p>
              </div>
              <p className="text-xl font-semibold">{overdueBuckets.week2}</p>
            </div>
            <p className="text-xs text-muted-foreground col-span-1">₹{overdueAmounts.week2.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <div className="rounded-lg border bg-white p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <p className="text-xs text-muted-foreground">3 weeks</p>
              </div>
              <p className="text-xl font-semibold">{overdueBuckets.week3}</p>
            </div>
            <p className="text-xs text-muted-foreground col-span-1">₹{overdueAmounts.week3.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <div className="rounded-lg border bg-white p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-700" />
                <p className="text-xs text-muted-foreground">3+ weeks</p>
              </div>
              <p className="text-xl font-semibold">{overdueBuckets.week3plus}</p>
            </div>
            <p className="text-xs text-muted-foreground col-span-1">₹{overdueAmounts.week3plus.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="mt-4 pt-4 border-t border-blue-200">
            <p className="text-sm text-muted-foreground">Total Pending Amount</p>
            <p className="text-3xl font-bold text-blue-600">
              ₹{totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
