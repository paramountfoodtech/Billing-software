import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, FileText } from "lucide-react"
import Link from "next/link"
import { Notes } from "@/components/notes"
import { EntryHistoryButton } from "@/components/entry-history-button"
import { formatIndianDate } from "@/lib/date-time"
import { IconTooltip } from "@/components/icon-tooltip"

const statusConfig = {
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800" },
  completed: { label: "Completed", className: "bg-green-100 text-green-800" },
  failed: { label: "Failed", className: "bg-red-100 text-red-800" },
  refunded: { label: "Refunded", className: "bg-slate-100 text-slate-800" },
}

export default async function PurchasePaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: payment, error: paymentError } = await supabase
    .from("purchase_payments")
    .select(
      `
      *,
      purchase_invoices (
        id,
        invoice_number,
        total_amount,
        amount_paid,
        status,
        purchasers (
          name,
          email
        )
      ),
      profiles!purchase_payments_created_by_fkey (
        full_name
      )
    `,
    )
    .eq("id", id)
    .maybeSingle()

  if (paymentError || !payment) notFound()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let userRole = null
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
    userRole = profile?.role
  }

  const { data: paymentNotesData } = await supabase
    .from("purchase_payment_notes")
    .select(
      `
      id,
      note,
      created_at,
      created_by,
      created_by_profile:profiles!created_by (full_name, role)
    `,
    )
    .eq("purchase_payment_id", id)
    .order("created_at", { ascending: false })

  const paymentNotes =
    (paymentNotesData || [])
      .filter((note: { created_by_profile: unknown }) => note.created_by_profile !== null)
      .map(
        (note: {
          id: string
          note: string
          created_at: string
          created_by_profile: { full_name: string; role: string }
        }) => ({
          id: note.id,
          note: note.note,
          created_at: note.created_at,
          profiles: note.created_by_profile,
        }),
      ) || []

  const config =
    statusConfig[payment.status as keyof typeof statusConfig] ||
    statusConfig.completed

  const purchaseInvoice = payment.purchase_invoices as {
    id: string
    invoice_number: string
    total_amount: string
    amount_paid: string
    purchasers: { name: string; email: string | null }
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <IconTooltip label="Back to Purchase Payments">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/purchase-payments">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Purchase Payments
            </Link>
          </Button>
        </IconTooltip>
        <div className="flex items-center gap-2">
          <EntryHistoryButton
            entityType="purchase_payment"
            entityId={id}
            createdAt={payment.created_at}
            createdByName={payment.profiles?.full_name}
          />
          <IconTooltip label="View Invoice">
            <Button variant="outline" asChild>
              <Link href={`/dashboard/purchase-invoices/${purchaseInvoice.id}`}>
                <FileText className="h-4 w-4 mr-2" />
                View Invoice
              </Link>
            </Button>
          </IconTooltip>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Payment Details</CardTitle>
            <Badge variant="secondary" className={config.className}>
              {config.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Payment Date</p>
                <p className="font-medium">
                  {formatIndianDate(payment.payment_date, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="text-2xl font-bold text-green-600">
                  ₹
                  {Number(payment.amount).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Payment Method</p>
                <p className="font-medium capitalize">
                  {payment.payment_method.replace("_", " ")}
                </p>
              </div>
              {payment.reference_number && (
                <div>
                  <p className="text-sm text-muted-foreground">Reference Number</p>
                  <p className="font-medium">{payment.reference_number}</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Invoice</p>
                <Link
                  href={`/dashboard/purchase-invoices/${purchaseInvoice.id}`}
                  className="font-medium text-blue-600 hover:underline"
                >
                  {purchaseInvoice.invoice_number}
                </Link>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Purchaser</p>
                <p className="font-medium">{purchaseInvoice.purchasers.name}</p>
                {purchaseInvoice.purchasers.email && (
                  <p className="text-sm text-muted-foreground">
                    {purchaseInvoice.purchasers.email}
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Recorded By</p>
                <p className="font-medium">
                  {payment.profiles?.full_name || "Unknown"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Recorded At</p>
                <p className="font-medium">
                  {formatIndianDate(payment.created_at, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Invoice Payment Status</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-muted-foreground">Invoice Total</p>
                <p className="font-bold">
                  ₹
                  {Number(purchaseInvoice.total_amount).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-muted-foreground">Total Paid</p>
                <p className="font-bold text-green-600">
                  ₹
                  {Number(purchaseInvoice.amount_paid).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <p className="text-sm text-muted-foreground">Remaining</p>
                <p className="font-bold text-orange-600">
                  ₹
                  {(
                    Number(purchaseInvoice.total_amount) -
                    Number(purchaseInvoice.amount_paid)
                  ).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Notes
        notes={paymentNotes}
        referenceId={id}
        referenceType="purchase_payment"
        userRole={userRole}
      />
    </div>
  )
}
