"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { useToast } from "@/hooks/use-toast"
import { Eye, Pencil, Trash2, Download } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { exportToCSV, ExportColumn, getTimestamp } from "@/lib/export-utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Invoice {
  id: string
  invoice_number: string
  issue_date: string
  due_date: string
  status: string
  total_amount: string
  amount_paid: string
  clients: {
    name: string
    email: string
  }
}

interface InvoicesTableProps {
  invoices: Invoice[]
}

const statusConfig = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-800" },
  sent: { label: "Sent", className: "bg-blue-100 text-blue-800" },
  paid: { label: "Paid", className: "bg-green-100 text-green-800" },
  overdue: { label: "Overdue", className: "bg-red-100 text-red-800" },
  cancelled: { label: "Cancelled", className: "bg-slate-100 text-slate-800" },
}

export function InvoicesTable({ invoices }: InvoicesTableProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!invoiceToDelete) return

    setIsDeleting(true)
    const supabase = createClient()

    const { error } = await supabase.from("invoices").delete().eq("id", invoiceToDelete)

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete invoice.",
      })
    } else {
      toast({
        title: "Invoice deleted",
        description: "The invoice has been deleted successfully.",
      })
      router.refresh()
    }

    setIsDeleting(false)
    setDeleteDialogOpen(false)
    setInvoiceToDelete(null)
  }

  const handleExport = () => {
    // Enrich invoices with due amount calculation
    const enrichedInvoices = invoices.map(invoice => ({
      ...invoice,
      due_amount: (Number(invoice.total_amount) - Number(invoice.amount_paid)).toFixed(2)
    }))

    const columns: ExportColumn[] = [
      { key: "invoice_number", label: "Invoice Number" },
      {
        key: "clients",
        label: "Client Name",
        formatter: (client) => client?.name || "",
      },
      {
        key: "issue_date",
        label: "Issue Date",
        formatter: (date) =>
          new Date(date).toLocaleDateString("en-IN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }),
      },
      {
        key: "due_date",
        label: "Due Date",
        formatter: (date) =>
          new Date(date).toLocaleDateString("en-IN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }),
      },
      {
        key: "total_amount",
        label: "Total Amount",
        formatter: (amount) => Number(amount).toFixed(2),
      },
      {
        key: "amount_paid",
        label: "Amount Paid",
        formatter: (amount) => Number(amount).toFixed(2),
      },
      {
        key: "due_amount",
        label: "Due Amount",
      },
      {
        key: "status",
        label: "Status",
        formatter: (status) =>
          statusConfig[status as keyof typeof statusConfig]?.label || status,
      },
    ]

    exportToCSV(enrichedInvoices, columns, `invoices-${getTimestamp()}.csv`)
    toast({
      title: "Exported",
      description: "Invoices exported to CSV successfully.",
    })
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-white">
        <p className="text-muted-foreground">No invoices found. Create your first invoice to get started.</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Invoices</h3>
        <Button onClick={handleExport} size="sm" variant="outline" title="Export to CSV">
          <Download className="h-4 w-4" />
        </Button>
      </div>
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Issue Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Total Amount</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Due Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => {
              const config = statusConfig[invoice.status as keyof typeof statusConfig]
              const balance = Number(invoice.total_amount) - Number(invoice.amount_paid)

              return (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{invoice.clients.name}</span>
                      <span className="text-xs text-muted-foreground">{invoice.clients.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>{new Date(invoice.issue_date).toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' })}</TableCell>
                  <TableCell>{new Date(invoice.due_date).toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' })}</TableCell>
                  <TableCell className="font-medium">
                    ₹{Number(invoice.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-green-600">
                    ₹{Number(invoice.amount_paid).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className={balance > 0 ? "font-semibold text-orange-600" : "text-green-600"}>
                    ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={config.className}>
                      {config.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/invoices/${invoice.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      {invoice.status === "draft" && (
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/invoices/${invoice.id}/edit`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setInvoiceToDelete(invoice.id)
                          setDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this invoice and all associated items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
