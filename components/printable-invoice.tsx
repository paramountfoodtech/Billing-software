"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Printer } from "lucide-react"
import { useEffect, useState, Fragment } from "react"

interface InvoiceTemplate {
  company_name: string
  company_address: string
  company_phone: string
  company_email: string
  company_logo_url: string | null
  company_logo_file: string | null
  tax_label: string
  terms_and_conditions: string
}

interface Invoice {
  id: string
  invoice_number: string
  reference_number?: string
  issue_date: string
  due_date: string
  status: string
  subtotal: string
  tax_amount: string
  discount_amount: string
  total_amount: string
  amount_paid: string
  notes: string | null
  clients: {
    name: string
    email: string
    phone: string | null
    address: string | null
    city: string | null
    state: string | null
    zip_code: string | null
  }
  invoice_items: Array<{
    description: string
    quantity: string
    unit_price: string
    tax_rate: string
    discount: string
    line_total: string
    bird_count: number | null
    per_bird_adjustment: string | null
  }>
}

interface PrintableInvoiceProps {
  invoice: Invoice
  template?: InvoiceTemplate
}

export function PrintableInvoice({ invoice, template }: PrintableInvoiceProps) {
  const [isPrinting, setIsPrinting] = useState(false)

  const defaultTemplate: InvoiceTemplate = {
    company_name: "Your Company Name",
    company_address: "123 Business Street, City, State 12345",
    company_phone: "+91 00000 00000",
    company_email: "info@company.com",
    company_logo_url: "/BS%20Logo.jpeg",
    company_logo_file: null,
    tax_label: "GST",
    terms_and_conditions: "Payment is due within 30 days. Late payments may incur additional charges.",
  }

  const activeTemplate = template || defaultTemplate
  const balance = Number(invoice.total_amount) - Number(invoice.amount_paid)
  const logoSrc = activeTemplate.company_logo_file || activeTemplate.company_logo_url

  const handlePrint = () => {
    setIsPrinting(true)
    setTimeout(() => {
      window.print()
      setIsPrinting(false)
    }, 100)
  }

  // Removed PDF generation in favor of print/download flows

  useEffect(() => {
    // Add print-specific styles
    const style = document.createElement("style")
    style.textContent = `
      @media print {
        body * {
          visibility: hidden;
        }
        .print-area, .print-area * {
          visibility: visible;
        }
        .print-area {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }
        .no-print {
          display: none !important;
        }
        @page {
          margin: 1cm;
        }
      }
    `
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  return (
    <>
      <div className="no-print mb-4 flex items-center justify-between gap-2">
        <Button asChild variant="outline">
          <a href="/dashboard/invoices">Back</a>
        </Button>
        <Button onClick={handlePrint} disabled={isPrinting}>
          <Printer className="h-4 w-4 mr-2" />
          Print Invoice
        </Button>
      </div>

      <Card className="print-area">
        <CardContent className="p-8">
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              {logoSrc && (
                <img 
                  src={logoSrc} 
                  alt="Company Logo" 
                  className="h-16 mb-4 object-contain"
                />
              )}
              <h1 className="text-2xl font-bold">{activeTemplate.company_name}</h1>
              <div className="text-sm text-muted-foreground mt-2">
                <p>{activeTemplate.company_address}</p>
                <p>Phone: {activeTemplate.company_phone}</p>
                <p>Email: {activeTemplate.company_email}</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-3xl font-bold mb-2">INVOICE</h2>
              <div className="text-sm">
                <p className="font-semibold">Invoice #: {invoice.invoice_number}</p>
                {invoice.reference_number && (
                  <p className="text-gray-600">Ref: {invoice.reference_number}</p>
                )}
                <p>Date: {new Date(invoice.issue_date).toLocaleDateString('en-IN', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</p>
                <p>Due Date: {new Date(invoice.due_date).toLocaleDateString('en-IN', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</p>
              </div>
            </div>
          </div>

          {/* Bill To */}
          <div className="mb-8">
            <h3 className="font-semibold mb-2">Bill To:</h3>
            <div className="text-sm">
              <p className="font-medium">{invoice.clients.name}</p>
              {invoice.clients.address && <p>{invoice.clients.address}</p>}
              {invoice.clients.city && invoice.clients.state && (
                <p>{invoice.clients.city}, {invoice.clients.state} {invoice.clients.zip_code}</p>
              )}
              {invoice.clients.email && <p>Email: {invoice.clients.email}</p>}
              {invoice.clients.phone && <p>Phone: {invoice.clients.phone}</p>}
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full mb-8">
            <thead className="border-b-2 border-gray-300">
              <tr>
                <th className="text-left py-2">Description</th>
                <th className="text-right py-2">Qty</th>
                <th className="text-right py-2">Rate</th>
                <th className="text-right py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.invoice_items.map((item, index) => {
                const hasPerBird = item.bird_count !== null && item.per_bird_adjustment !== null
                const baseAmount = hasPerBird 
                  ? Number(item.line_total) - Number(item.per_bird_adjustment)
                  : Number(item.line_total)
                const safeBirdCount = Math.max(1, Number(item.bird_count ?? 1))
                
                return (
                  <Fragment key={`item-group-${index}`}>
                    <tr key={`item-${index}`} className="border-b border-gray-200">
                      <td className="py-3">{item.description}</td>
                      <td className="text-right">{Number(item.quantity).toFixed(2)}</td>
                      <td className="text-right">₹{Number(item.unit_price).toFixed(2)}</td>
                      <td className="text-right">₹{baseAmount.toFixed(2)}</td>
                    </tr>
                    {hasPerBird && (
                      <tr key={`perbird-${index}`} className="border-b border-gray-200">
                        <td className="py-2 pl-8 text-sm text-amber-600" colSpan={5}>
                          Per-bird adjustment ({safeBirdCount} birds × ₹{(Number(item.per_bird_adjustment || 0) / safeBirdCount).toFixed(2)}/bird)
                        </td>
                        <td className="text-right text-sm text-amber-600">
                          {Number(item.per_bird_adjustment) > 0 ? '+' : ''}₹{Number(item.per_bird_adjustment).toFixed(2)}
                        </td>
                      </tr>
                    )}
                    {hasPerBird && (
                      <tr key={`total-${index}`} className="border-b border-gray-200 font-semibold">
                        <td className="py-2 pl-8 text-sm" colSpan={5}>
                          Line Total
                        </td>
                        <td className="text-right text-sm">
                          ₹{Number(item.line_total).toFixed(2)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-64">
              <div className="flex justify-between py-1">
                <span>Subtotal:</span>
                <span>₹{Number(invoice.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>{activeTemplate.tax_label}:</span>
                <span>₹{Number(invoice.tax_amount).toFixed(2)}</span>
              </div>
              {Number(invoice.discount_amount) > 0 && (
                <div className="flex justify-between py-1 text-green-600">
                  <span>Discount:</span>
                  <span>-₹{Number(invoice.discount_amount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 font-bold text-lg border-t-2 border-gray-300">
                <span>Total:</span>
                <span>₹{Number(invoice.total_amount).toFixed(2)}</span>
              </div>
              {Number(invoice.amount_paid) > 0 && (
                <>
                  <div className="flex justify-between py-1 text-green-600">
                    <span>Amount Paid:</span>
                    <span>₹{Number(invoice.amount_paid).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-2 font-bold border-t border-gray-300">
                    <span>Balance Due:</span>
                    <span className={balance > 0 ? "text-red-600" : "text-green-600"}>
                      ₹{balance.toFixed(2)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="mb-6">
              <h4 className="font-semibold mb-1">Notes:</h4>
              <p className="text-sm text-muted-foreground">{invoice.notes}</p>
            </div>
          )}

          {/* Terms */}
          <div className="border-t pt-4">
            <h4 className="font-semibold mb-1">Terms & Conditions:</h4>
            <p className="text-xs text-muted-foreground">{activeTemplate.terms_and_conditions}</p>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
