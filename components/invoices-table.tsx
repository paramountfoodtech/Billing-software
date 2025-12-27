"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { useToast } from "@/hooks/use-toast"
import { Eye, Pencil, Trash2, Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState, useMemo } from "react"
import { exportToCSV, ExportColumn, getTimestamp } from "@/lib/export-utils"
import { Input } from "@/components/ui/input"
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

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Filter state
  const [filters, setFilters] = useState({
    invoice_number: '',
    client: '',
    status: '',
  })

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const handleFilterChange = (column: string, value: string) => {
    setFilters(prev => ({ ...prev, [column]: value }))
  }

  // Apply filtering and sorting
  const processedInvoices = useMemo(() => {
    let filtered = [...invoices]

    // Apply filters
    if (filters.invoice_number) {
      filtered = filtered.filter(inv => 
        inv.invoice_number.toLowerCase().includes(filters.invoice_number.toLowerCase())
      )
    }
    if (filters.client) {
      filtered = filtered.filter(inv => 
        inv.clients.name.toLowerCase().includes(filters.client.toLowerCase())
      )
    }
    if (filters.status) {
      filtered = filtered.filter(inv => 
        inv.status.toLowerCase().includes(filters.status.toLowerCase())
      )
    }

    // Apply sorting
    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal: any
        let bVal: any

        switch (sortColumn) {
          case 'invoice_number':
            aVal = a.invoice_number
            bVal = b.invoice_number
            break
          case 'client':
            aVal = a.clients.name
            bVal = b.clients.name
            break
          case 'issue_date':
            aVal = new Date(a.issue_date).getTime()
            bVal = new Date(b.issue_date).getTime()
            break
          case 'due_date':
            aVal = new Date(a.due_date).getTime()
            bVal = new Date(b.due_date).getTime()
            break
          case 'total_amount':
            aVal = Number(a.total_amount)
            bVal = Number(b.total_amount)
            break
          case 'amount_paid':
            aVal = Number(a.amount_paid)
            bVal = Number(b.amount_paid)
            break
          case 'due_amount':
            aVal = Number(a.total_amount) - Number(a.amount_paid)
            bVal = Number(b.total_amount) - Number(b.amount_paid)
            break
          case 'status':
            aVal = a.status
            bVal = b.status
            break
          default:
            return 0
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
    }

    return filtered
  }, [invoices, filters, sortColumn, sortDirection])

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return <ArrowUpDown className="ml-2 h-4 w-4 inline opacity-40" />
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4 inline" />
      : <ArrowDown className="ml-2 h-4 w-4 inline" />
  }

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
    const enrichedInvoices = processedInvoices.map(invoice => ({
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
      description: `${enrichedInvoices.length} invoice(s) exported to CSV successfully.`,
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
      <div className="flex justify-end items-center mb-4">
        <Button onClick={handleExport} size="sm" variant="outline" title="Export to CSV">
          <Download className="h-4 w-4" />
        </Button>
      </div>
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('invoice_number')}>
                Invoice #<SortIcon column="invoice_number" />
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('client')}>
                Client<SortIcon column="client" />
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('issue_date')}>
                Issue Date<SortIcon column="issue_date" />
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('due_date')}>
                Due Date<SortIcon column="due_date" />
              </TableHead>
              <TableHead>Overdue</TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('total_amount')}>
                Total Amount<SortIcon column="total_amount" />
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('amount_paid')}>
                Paid<SortIcon column="amount_paid" />
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('due_amount')}>
                Due Amount<SortIcon column="due_amount" />
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('status')}>
                Status<SortIcon column="status" />
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
            <TableRow>
              <TableHead>
                <Input
                  placeholder="Filter..."
                  value={filters.invoice_number}
                  onChange={(e) => handleFilterChange('invoice_number', e.target.value)}
                  className="h-8"
                />
              </TableHead>
              <TableHead>
                <Input
                  placeholder="Filter..."
                  value={filters.client}
                  onChange={(e) => handleFilterChange('client', e.target.value)}
                  className="h-8"
                />
              </TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
              <TableHead>
                <Input
                  placeholder="Filter..."
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="h-8"
                />
              </TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processedInvoices.map((invoice) => {
              const config = statusConfig[invoice.status as keyof typeof statusConfig]
              const balance = Number(invoice.total_amount) - Number(invoice.amount_paid)

              // Overdue categorization
              const dueDate = new Date(invoice.due_date)
              const today = new Date()
              const msInDay = 1000 * 60 * 60 * 24
              const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / msInDay)
              const isOverdue = balance > 0 && daysOverdue > 0
              let overdueLabel = "On time"
              let overdueClass = "bg-emerald-100 text-emerald-800"

              if (isOverdue) {
                if (daysOverdue <= 7) {
                  overdueLabel = "1 week"
                  overdueClass = "bg-amber-100 text-amber-800"
                } else if (daysOverdue <= 14) {
                  overdueLabel = "2 weeks"
                  overdueClass = "bg-orange-100 text-orange-800"
                } else if (daysOverdue <= 21) {
                  overdueLabel = "3 weeks"
                  overdueClass = "bg-red-100 text-red-800"
                } else {
                  overdueLabel = "3+ weeks"
                  overdueClass = "bg-red-200 text-red-900"
                }
              }

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
                  <TableCell>
                    <Badge variant="secondary" className={overdueClass}>{overdueLabel}</Badge>
                  </TableCell>
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
