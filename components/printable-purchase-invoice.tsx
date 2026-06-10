"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Banknote, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatIndianDate } from "@/lib/date-time";
import { IconTooltip } from "@/components/icon-tooltip";

interface InvoiceTemplate {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_logo_url: string | null;
  company_logo_file: string | null;
}

interface PurchaseInvoice {
  id: string;
  invoice_number: string;
  purchaser_id?: string | null;
  issue_date: string;
  total_weight_kg: string;
  price_per_kg: string;
  total_amount: string;
  discount_amount?: string;
  amount_paid: string;
  status: string;
  notes: string | null;
  invoice_type?: string;
  description?: string | null;
  purchasers?: {
    name: string;
    purchaser_code: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
  } | null;
  challans?: {
    challan_number: string;
    challan_date: string;
    num_boxes: number;
    challan_boxes?: { box_number: number; weight_kg: string; num_birds?: number }[];
  } | null;
}

interface PrintablePurchaseInvoiceProps {
  invoice: PurchaseInvoice;
  template?: InvoiceTemplate;
}

export function PrintablePurchaseInvoice({
  invoice,
  template,
}: PrintablePurchaseInvoiceProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const balance = Number(invoice.total_amount) - Number(invoice.amount_paid);
  const discountAmount = Number(invoice.discount_amount || 0);
  const subtotal =
    Number(invoice.total_weight_kg) * Number(invoice.price_per_kg) ||
    Number(invoice.total_amount) + discountAmount;
  const hasChallan = Boolean(invoice.challans?.challan_number);
  const invoiceType = invoice.invoice_type || (hasChallan ? "challan" : "expense");
  const typeLabels: Record<string, string> = {
    challan: "Challan Purchase",
    salary: "Salary",
    expense: "Expense",
  };
  const lineDescription =
    invoice.description?.trim() ||
    (hasChallan
      ? `Purchase weight (Challan ${invoice.challans!.challan_number})`
      : typeLabels[invoiceType] || "Purchase");
  const boxes = invoice.challans?.challan_boxes || [];
  const totalBirds = boxes.reduce(
    (sum, box) => sum + Number(box.num_birds || 0),
    0,
  );
  const showWeightColumns = Number(invoice.total_weight_kg) > 0;

  const defaultTemplate: InvoiceTemplate = {
    company_name: "Your Company Name",
    company_address: "123 Business Street, City, State 12345",
    company_phone: "+91 00000 00000",
    company_email: "info@company.com",
    company_logo_url: "/PFT logo.png",
    company_logo_file: null,
  };

  const activeTemplate = template || defaultTemplate;
  const logoSrc =
    activeTemplate.company_logo_file || activeTemplate.company_logo_url;

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  useEffect(() => {
    const style = document.createElement("style");
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
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const showRecordPayment =
    balance > 0.01 && invoice.status !== "cancelled";

  return (
    <>
      <div className="no-print mb-3 flex items-center justify-between gap-2">
        <Button asChild variant="outline">
          <Link href="/dashboard/purchase-invoices">Back</Link>
        </Button>
        <IconTooltip label="Print Invoice">
          <Button onClick={handlePrint} disabled={isPrinting}>
            <Printer className="h-4 w-4 mr-2" />
            Print Invoice
          </Button>
        </IconTooltip>
      </div>

      <Card className="print-area">
        <CardContent className="p-5 md:p-6 text-sm">
          <div className="flex justify-between items-start mb-5">
            <div>
              {logoSrc && (
                <img
                  src={logoSrc}
                  alt="Company Logo"
                  className="h-14 mb-3 object-contain"
                />
              )}
              <h1 className="text-xl font-bold">{activeTemplate.company_name}</h1>
              <div className="text-xs text-muted-foreground mt-1.5">
                <p>{activeTemplate.company_address}</p>
                <p>Phone: {activeTemplate.company_phone}</p>
                <p>Email: {activeTemplate.company_email}</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold mb-1.5">PURCHASE INVOICE</h2>
              <div className="text-xs">
                <p className="font-semibold">
                  Invoice #: {invoice.invoice_number}
                </p>
                <p>
                  Date:{" "}
                  {formatIndianDate(invoice.issue_date, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <p className="text-gray-600">
                  Type: {typeLabels[invoiceType] || invoiceType}
                </p>
                {hasChallan && (
                  <>
                    <p className="text-gray-600">
                      Challan: {invoice.challans!.challan_number}
                    </p>
                    <p className="text-gray-600">
                      Challan Date:{" "}
                      {formatIndianDate(invoice.challans!.challan_date, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mb-5">
            <h3 className="font-semibold mb-1.5">Purchased From:</h3>
            <div className="text-xs">
              {invoice.purchasers ? (
                <>
                  <p className="font-medium">{invoice.purchasers.name}</p>
                  <p className="text-muted-foreground">
                    ID: {invoice.purchasers.purchaser_code}
                  </p>
                  {invoice.purchasers.address && (
                    <p>{invoice.purchasers.address}</p>
                  )}
                  {invoice.purchasers.city && invoice.purchasers.state && (
                    <p>
                      {invoice.purchasers.city}, {invoice.purchasers.state}{" "}
                      {invoice.purchasers.zip_code}
                    </p>
                  )}
                  {invoice.purchasers.email && (
                    <p>Email: {invoice.purchasers.email}</p>
                  )}
                  {invoice.purchasers.phone && (
                    <p>Phone: {invoice.purchasers.phone}</p>
                  )}
                </>
              ) : (
                <p className="font-medium">N/A</p>
              )}
            </div>
          </div>

          <table className="w-full mb-5">
            <thead className="border-b-2 border-gray-300">
              <tr>
                <th className="text-left py-2">Description</th>
                <th className="text-right py-2">Qty (KG)</th>
                <th className="text-right py-2">Rate</th>
                <th className="text-right py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="py-2">{lineDescription}</td>
                <td className="text-right">
                  {showWeightColumns
                    ? Number(invoice.total_weight_kg).toFixed(3)
                    : "—"}
                </td>
                <td className="text-right">
                  {showWeightColumns
                    ? `₹${Number(invoice.price_per_kg).toFixed(2)}`
                    : "—"}
                </td>
                <td className="text-right">₹{subtotal.toFixed(2)}</td>
              </tr>
            </tbody>
            <tfoot>
              {showWeightColumns && (
                <tr className="border-t border-gray-300">
                  <td className="py-2 font-semibold">Total weight (kgs):</td>
                  <td className="text-right font-semibold">
                    {Number(invoice.total_weight_kg).toFixed(3)}
                  </td>
                  <td></td>
                  <td></td>
                </tr>
              )}
              {hasChallan && (invoice.challans?.num_boxes ?? 0) > 0 && (
                <tr>
                  <td className="py-2 font-semibold">Boxes:</td>
                  <td className="text-right font-semibold">
                    {invoice.challans!.num_boxes}
                  </td>
                  <td></td>
                  <td></td>
                </tr>
              )}
            </tfoot>
          </table>

          {hasChallan && boxes.length > 0 && (
            <div className="mb-5">
              <h4 className="font-semibold mb-2 text-xs">Box-wise Details</h4>
              <table className="w-full text-xs">
                <thead className="border-b border-gray-300">
                  <tr>
                    <th className="text-left py-1.5">Box #</th>
                    <th className="text-right py-1.5">Weight (KG)</th>
                    <th className="text-right py-1.5">Birds</th>
                  </tr>
                </thead>
                <tbody>
                  {boxes.map((box) => (
                    <tr key={box.box_number} className="border-b border-gray-100">
                      <td className="py-1.5">{box.box_number}</td>
                      <td className="text-right py-1.5">
                        {Number(box.weight_kg).toFixed(3)}
                      </td>
                      <td className="text-right py-1.5">
                        {Number(box.num_birds || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 font-semibold">
                    <td className="py-1.5">Total</td>
                    <td className="text-right py-1.5">
                      {Number(invoice.total_weight_kg).toFixed(3)}
                    </td>
                    <td className="text-right py-1.5">{totalBirds}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div className="flex justify-end mb-5">
            <div className="w-64">
              <div className="flex justify-between py-1">
                <span>Subtotal:</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between py-1 text-green-600">
                  <span>Discount:</span>
                  <span>-₹{discountAmount.toFixed(2)}</span>
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
                    <span
                      className={
                        balance > 0 ? "text-red-600" : "text-green-600"
                      }
                    >
                      ₹{balance.toFixed(2)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {invoice.notes && (
            <div className="mb-4">
              <h4 className="font-semibold mb-1">Notes:</h4>
              <p className="text-xs text-muted-foreground">{invoice.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {showRecordPayment && (
        <div className="no-print mt-4 flex justify-end">
          <IconTooltip label="Record Payment">
            <Button asChild>
              <Link
                href={`/dashboard/purchase-payments/new?invoice_id=${invoice.id}${invoice.purchaser_id ? `&purchaser_id=${invoice.purchaser_id}` : ""}`}
              >
                <Banknote className="h-4 w-4 mr-2" />
                Record Payment
              </Link>
            </Button>
          </IconTooltip>
        </div>
      )}
    </>
  );
}
