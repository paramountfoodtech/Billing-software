"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Trash2, Download, ArrowUpDown, ArrowUp, ArrowDown, Eye } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState, useMemo } from "react"
import { useToast } from "@/hooks/use-toast"
import { exportToCSV, ExportColumn, getTimestamp } from "@/lib/export-utils"
import { Input } from "@/components/ui/input"

interface Payment {
  id: string
  invoice_id: string
  amount: string
  payment_date: string
  payment_method: string
  reference_number: string | null
  status: string
  invoices: {
    id: string
    invoice_number: string
    total_amount: string
    amount_paid: string
    clients: {
      name: string
    }
  }
}

interface PaymentsTableProps {
  payments: Payment[]
}

const statusConfig = {
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800" },
  completed: { label: "Completed", className: "bg-green-100 text-green-800" },
  failed: { label: "Failed", className: "bg-red-100 text-red-800" },
  refunded: { label: "Refunded", className: "bg-slate-100 text-slate-800" },
}

export function PaymentsTable({ payments }: PaymentsTableProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Filter state
  const [filters, setFilters] = useState({
    invoice: '',
    client: '',
    method: '',
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
  const processedPayments = useMemo(() => {
    let filtered = [...payments]

    // Apply filters
    if (filters.invoice) {
      filtered = filtered.filter(p => 
        p.invoices.invoice_number.toLowerCase().includes(filters.invoice.toLowerCase())
      )
    }
    if (filters.client) {
      filtered = filtered.filter(p => 
        p.invoices.clients.name.toLowerCase().includes(filters.client.toLowerCase())
      )
    }
    if (filters.method) {
      filtered = filtered.filter(p => 
        p.payment_method.toLowerCase().includes(filters.method.toLowerCase())
      )
    }

    // Apply sorting
    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal: any
        let bVal: any

        switch (sortColumn) {
          case 'date':
            aVal = new Date(a.payment_date).getTime()
            bVal = new Date(b.payment_date).getTime()
            break
          case 'invoice':
            aVal = a.invoices.invoice_number
            bVal = b.invoices.invoice_number
            break
          case 'client':
            aVal = a.invoices.clients.name
            bVal = b.invoices.clients.name
            break
          case 'amount':
            aVal = Number(a.amount)
            bVal = Number(b.amount)
            break
          case 'method':
            aVal = a.payment_method
            bVal = b.payment_method
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
  }, [payments, filters, sortColumn, sortDirection])

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return <ArrowUpDown className="ml-2 h-4 w-4 inline opacity-40" />
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4 inline" />
      : <ArrowDown className="ml-2 h-4 w-4 inline" />
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    const supabase = createClient()

    const { error } = await supabase.from("payments").delete().eq("id", id)

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete payment.",
      })
    } else {
      toast({
        title: "Payment deleted",
        description: "The payment has been deleted successfully.",
      })
      router.refresh()
    }

    setIsDeleting(false)
  }

  const handleExport = () => {
    const columns: ExportColumn[] = [
      { key: "invoices", label: "Invoice Number", formatter: (inv) => inv?.invoice_number || "" },
      { key: "invoices", label: "Client", formatter: (inv) => inv?.clients?.name || "" },
      {
        key: "amount",
        label: "Amount",
        formatter: (amount) => Number(amount).toFixed(2),
      },
      {
        key: "payment_date",
        label: "Payment Date",
        formatter: (date) =>
          new Date(date).toLocaleDateString("en-IN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }),
      },
      { key: "payment_method", label: "Payment Method" },
      { key: "reference_number", label: "Reference Number" },
      { key: "status", label: "Status", formatter: (status) => statusConfig[status as keyof typeof statusConfig]?.label || status },
    ]

    exportToCSV(processedPayments, columns, `payments-${getTimestamp()}.csv`)
    toast({
      title: "Exported",
      description: `${processedPayments.length} payment(s) exported to CSV successfully.`,
    })
  }

  if (payments.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-white">
        <p className="text-muted-foreground">No payments recorded yet.</p>
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
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('date')}>
                Date<SortIcon column="date" />
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('invoice')}>
                Invoice<SortIcon column="invoice" />
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('client')}>
                Client<SortIcon column="client" />
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('amount')}>
                Payment<SortIcon column="amount" />
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('method')}>
                Method<SortIcon column="method" />
              </TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('status')}>
                Status<SortIcon column="status" />
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>
                <Input
                  placeholder="Filter..."
                  value={filters.invoice}
                  onChange={(e) => handleFilterChange('invoice', e.target.value)}
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
              <TableHead>
                <Input
                  placeholder="Filter..."
                  value={filters.method}
                  onChange={(e) => handleFilterChange('method', e.target.value)}
                  className="h-8"
                />
              </TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processedPayments.map((payment) => {
              const config = statusConfig[payment.status as keyof typeof statusConfig]

              return (
                <TableRow key={payment.id}>
                  <TableCell>
                    {new Date(payment.payment_date).toLocaleDateString('en-IN', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/invoices/${payment.invoice_id}`}
                      className="font-medium hover:underline text-blue-600"
                    >
                      {payment.invoices.invoice_number}
                    </Link>
                  </TableCell>
                  <TableCell>{payment.invoices.clients.name}</TableCell>
                  <TableCell className="font-semibold text-green-600">
                    ₹{Number(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="capitalize">{payment.payment_method.replace("_", " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{payment.reference_number || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={config.className}>
                      {config.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/payments/${payment.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this payment?")) {
                            handleDelete(payment.id)
                          }
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

    </>
  )
}
