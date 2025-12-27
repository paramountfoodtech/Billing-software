"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { ClientSelector } from "@/components/client-selector"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Invoice {
  id: string
  invoice_number: string
  total_amount: string
  amount_paid: string
  status: string
  client_id?: string
  clients?: {
    name: string
  }
}

interface Client {
  id: string
  name: string
}

interface PaymentFormProps {
  invoices: Invoice[]
  clients?: Client[]
  preSelectedInvoiceId?: string
  preSelectedClientId?: string
}

export function PaymentForm({ invoices, clients = [], preSelectedInvoiceId, preSelectedClientId }: PaymentFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(preSelectedClientId || null)
  const [paymentMode, setPaymentMode] = useState<"individual" | "bulk">(preSelectedInvoiceId ? "individual" : "bulk")

  const [formData, setFormData] = useState({
    invoice_id: preSelectedInvoiceId || "",
    amount: "",
    payment_date: new Date().toISOString().split("T")[0],
    payment_method: "bank_transfer",
    reference_number: "",
    status: "completed",
    notes: "",
  })

  // Filter invoices by selected client for bulk mode
  const clientInvoices = selectedClientId
    ? invoices.filter((inv) => inv.client_id === selectedClientId)
    : invoices

  // Calculate client's total pending
  const clientTotalPending = clientInvoices.reduce((total, inv) => {
    const pending = Number(inv.total_amount) - Number(inv.amount_paid)
    return total + pending
  }, 0)

  // Auto-generate reference number for cash payments
  useEffect(() => {
    if (formData.payment_method === "cash") {
      const timestamp = Date.now()
      const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
      const cashRef = `CASH-${timestamp}-${randomNum}`
      setFormData((prev) => ({ ...prev, reference_number: cashRef }))
    } else {
      // Clear reference number when switching away from cash
      setFormData((prev) => ({ ...prev, reference_number: "" }))
    }
  }, [formData.payment_method])

  // Set selected invoice when invoice_id changes
  useEffect(() => {
    if (formData.invoice_id) {
      const invoice = invoices.find((inv) => inv.id === formData.invoice_id)
      setSelectedInvoice(invoice || null)

      // Auto-fill amount with remaining balance if empty
      if (invoice && !formData.amount) {
        const balance = Number(invoice.total_amount) - Number(invoice.amount_paid)
        setFormData((prev) => ({ ...prev, amount: balance.toFixed(2) }))
      }
    }
  }, [formData.invoice_id, invoices, formData.amount])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const supabase = createClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication required",
        description: "You must be logged in to record payments.",
      })
      setIsLoading(false)
      return
    }

    try {
      // Get user's organization
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

      if (!profile?.organization_id) {
        throw new Error("User must belong to an organization")
      }

      const paymentAmount = Number(formData.amount)

      if (paymentMode === "bulk" && selectedClientId) {
        // Bulk payment mode: allocate payment to client's unpaid invoices
        let remainingAmount = paymentAmount
        const unpaidInvoices = clientInvoices
          .filter((inv) => {
            const pending = Number(inv.total_amount) - Number(inv.amount_paid)
            return pending > 0
          })
          .sort((a, b) => new Date(a.issue_date || "").getTime() - new Date(b.issue_date || "").getTime())

        // Create a single payment record for tracking
        const { error: paymentError } = await supabase.from("payments").insert({
          invoice_id: unpaidInvoices[0]?.id || formData.invoice_id, // Link to first unpaid invoice
          amount: formData.amount,
          payment_date: formData.payment_date,
          payment_method: formData.payment_method,
          reference_number: formData.reference_number || null,
          status: formData.status,
          notes: `Bulk payment for client - allocated across ${unpaidInvoices.length} invoices. ${formData.notes || ""}`,
          created_by: user.id,
          organization_id: profile.organization_id,
        })

        if (paymentError) throw paymentError

        // Allocate payment across invoices
        for (const invoice of unpaidInvoices) {
          if (remainingAmount <= 0) break

          const pending = Number(invoice.total_amount) - Number(invoice.amount_paid)
          const allocationAmount = Math.min(remainingAmount, pending)

          const newAmountPaid = Number(invoice.amount_paid) + allocationAmount
          const totalAmount = Number(invoice.total_amount)
          let newStatus = invoice.status
          if (newAmountPaid >= totalAmount) {
            newStatus = "paid"
          } else if (newAmountPaid > 0) {
            newStatus = "sent" // or could use "partially_paid" if that status exists
          }

          const { error: invoiceError } = await supabase
            .from("invoices")
            .update({
              amount_paid: newAmountPaid,
              status: newStatus,
            })
            .eq("id", invoice.id)

          if (invoiceError) throw invoiceError
          remainingAmount -= allocationAmount
        }

        toast({
          title: "Bulk payment recorded",
          description: `₹${paymentAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} allocated across ${unpaidInvoices.length} invoices.`,
        })
      } else {
        // Individual invoice payment mode
        if (!selectedInvoice) throw new Error("Please select an invoice")

        // Insert payment
        const { error: paymentError } = await supabase.from("payments").insert({
          invoice_id: formData.invoice_id,
          amount: formData.amount,
          payment_date: formData.payment_date,
          payment_method: formData.payment_method,
          reference_number: formData.reference_number || null,
          status: formData.status,
          notes: formData.notes || null,
          created_by: user.id,
          organization_id: profile.organization_id,
        })

        if (paymentError) throw paymentError

        // Update invoice amount_paid
        const newAmountPaid = Number(selectedInvoice.amount_paid) + Number(formData.amount)
        const totalAmount = Number(selectedInvoice.total_amount)

        // Determine new status
        let newStatus = "sent"
        if (newAmountPaid >= totalAmount) {
          newStatus = "paid"
        }

        const { error: invoiceError } = await supabase
          .from("invoices")
          .update({
            amount_paid: newAmountPaid,
            status: newStatus,
          })
          .eq("id", formData.invoice_id)

        if (invoiceError) throw invoiceError
      }

      toast({
        title: "Payment recorded",
        description: `₹${Number(formData.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} payment has been recorded successfully.`,
      })

      router.push("/dashboard/payments")
      router.refresh()
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred while recording payment",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const balance = selectedInvoice ? Number(selectedInvoice.total_amount) - Number(selectedInvoice.amount_paid) : 0
  const paymentAmount = Number(formData.amount) || 0
  const remainingBalance = balance - paymentAmount

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Payment Mode Selector */}
          <Tabs value={paymentMode} onValueChange={(value) => setPaymentMode(value as "individual" | "bulk")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="individual">Single Invoice</TabsTrigger>
              <TabsTrigger value="bulk">Bulk Payment</TabsTrigger>
            </TabsList>

            <TabsContent value="bulk" className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="client_id">
                  Select Client <span className="text-red-500">*</span>
                </Label>
                <div className="max-w-xs">
                  <ClientSelector
                    clients={clients}
                    selectedClientId={selectedClientId}
                    onClientChange={setSelectedClientId}
                  />
                </div>
              </div>

              {selectedClientId && (
                <>
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                    <h4 className="font-semibold text-amber-900 mb-2">Client's Outstanding Invoices</h4>
                    <div className="space-y-2">
                      {clientInvoices
                        .filter((inv) => {
                          const pending = Number(inv.total_amount) - Number(inv.amount_paid)
                          return pending > 0
                        })
                        .map((inv) => {
                          const pending = Number(inv.total_amount) - Number(inv.amount_paid)
                          return (
                            <div key={inv.id} className="flex justify-between items-center text-sm pb-2 border-b border-amber-200 last:border-b-0">
                              <span className="font-medium">{inv.invoice_number}</span>
                              <span className="text-amber-700 font-semibold">₹{pending.toFixed(2)} due</span>
                            </div>
                          )
                        })}
                    </div>
                    <div className="border-t border-amber-300 pt-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-amber-900">Total Pending:</span>
                        <span className="text-lg font-bold text-amber-700">
                          ₹{clientTotalPending.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                    <h4 className="font-semibold text-blue-900 mb-2">Payment Summary</h4>
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-700">Total Invoices Amount:</span>
                      <span className="font-medium">₹{clientInvoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-700">Already Paid:</span>
                      <span className="font-medium">₹{clientInvoices.reduce((sum, inv) => sum + Number(inv.amount_paid), 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t border-blue-300 pt-2">
                      <span className="text-blue-900">Current Balance Due:</span>
                      <span className="text-red-600">₹{clientTotalPending.toFixed(2)}</span>
                    </div>

                    {Number(formData.amount) > 0 && (
                      <div className="mt-3 pt-3 border-t border-blue-300">
                        <div className="flex justify-between text-sm">
                          <span className="text-blue-700">Payment Amount:</span>
                          <span className="font-medium text-green-600">₹{Number(formData.amount).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold mt-2">
                          <span className="text-blue-900">Remaining Balance:</span>
                          <span className={clientTotalPending - Number(formData.amount) > 0 ? "text-orange-600" : "text-green-600"}>
                            ₹{(clientTotalPending - Number(formData.amount)).toFixed(2)}
                          </span>
                        </div>
                        {clientTotalPending - Number(formData.amount) === 0 && <p className="text-xs text-green-600 mt-1">✓ All invoices will be fully paid</p>}
                        {clientTotalPending - Number(formData.amount) > 0 && <p className="text-xs text-orange-600 mt-1">⚠ Partial payment - balance remains</p>}
                      </div>
                    )}

                    <div className="pt-3 border-t border-blue-300">
                      <p className="text-sm text-blue-700">
                        The payment amount will be automatically distributed across unpaid invoices, starting with the oldest invoice.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="individual" className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="invoice_id">
                  Invoice <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.invoice_id}
                  onValueChange={(value) => setFormData({ ...formData, invoice_id: value, amount: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an invoice" />
                  </SelectTrigger>
                  <SelectContent>
                    {invoices.map((invoice) => {
                      const invoiceBalance = Number(invoice.total_amount) - Number(invoice.amount_paid)
                      return (
                        <SelectItem key={invoice.id} value={invoice.id}>
                          {invoice.invoice_number} - {invoice.clients?.name} (₹{invoiceBalance.toFixed(2)} due)
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              {selectedInvoice && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                  <h4 className="font-semibold text-blue-900 mb-2">Invoice Summary</h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">Invoice Total:</span>
                    <span className="font-medium">₹{Number(selectedInvoice.total_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">Already Paid:</span>
                    <span className="font-medium">₹{Number(selectedInvoice.amount_paid).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t border-blue-300 pt-2">
                    <span className="text-blue-900">Current Balance Due:</span>
                    <span className="text-red-600">₹{balance.toFixed(2)}</span>
                  </div>

                  {paymentAmount > 0 && (
                    <div className="mt-3 pt-3 border-t border-blue-300">
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-700">Payment Amount:</span>
                        <span className="font-medium text-green-600">₹{paymentAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold mt-2">
                        <span className="text-blue-900">Remaining Balance:</span>
                        <span className={remainingBalance > 0 ? "text-orange-600" : "text-green-600"}>
                          ₹{remainingBalance.toFixed(2)}
                        </span>
                      </div>
                      {remainingBalance === 0 && <p className="text-xs text-green-600 mt-1">✓ Invoice will be fully paid</p>}
                      {remainingBalance > 0 && <p className="text-xs text-orange-600 mt-1">⚠ Partial payment - balance remains</p>}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">
                Payment Amount <span className="text-red-500">*</span>
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={paymentMode === "bulk" ? clientTotalPending : balance > 0 ? balance : undefined}
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="Enter amount"
              />
              <p className="text-xs text-muted-foreground">
                {paymentMode === "bulk" ? (
                  <>
                    Maximum: ₹{clientTotalPending.toFixed(2)} |{" "}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, amount: clientTotalPending.toFixed(2) })}
                      className="ml-1 text-blue-600 hover:underline"
                    >
                      Full Amount
                    </button>
                  </>
                ) : (
                  <>
                    Maximum: ₹{balance.toFixed(2)} |{" "}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, amount: balance.toFixed(2) })}
                      className="ml-1 text-blue-600 hover:underline"
                    >
                      Pay Full Amount
                    </button>
                  </>
                )}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_date">
                Payment Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="payment_date"
                type="date"
                required
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_method">
                Payment Method <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.payment_method}
                onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference_number">Reference Number</Label>
              <Input
                id="reference_number"
                value={formData.reference_number}
                onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                placeholder="Transaction ID, Check #, etc."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">
              Payment Status <span className="text-red-500">*</span>
            </Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes about this payment..."
              rows={3}
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="submit"
              disabled={
                isLoading ||
                !formData.amount ||
                (paymentMode === "individual" && !formData.invoice_id) ||
                (paymentMode === "bulk" && !selectedClientId)
              }
              className="min-w-36"
            >
              {isLoading ? (
                <>
                  <Spinner className="mr-2" />
                  Recording...
                </>
              ) : (
                "Record Payment"
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
