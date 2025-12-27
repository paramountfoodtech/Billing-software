"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2, Mail, Phone, Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState, useMemo } from "react"
import { useToast } from "@/hooks/use-toast"
import { exportToCSV, ExportColumn, getTimestamp } from "@/lib/export-utils"
import { Input } from "@/components/ui/input"

interface Client {
  id: string
  name: string
  email: string
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  country: string | null
  created_at: string
  value_per_bird?: number | null
  due_days?: number | null
  profiles?: {
    full_name: string
  }
}

interface ClientsTableProps {
  clients: Client[]
}

export function ClientsTable({ clients }: ClientsTableProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Filter state
  const [filters, setFilters] = useState({
    name: '',
    email: '',
    city: '',
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
  const processedClients = useMemo(() => {
    let filtered = [...clients]

    // Apply filters
    if (filters.name) {
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(filters.name.toLowerCase())
      )
    }
    if (filters.email) {
      filtered = filtered.filter(c => 
        c.email.toLowerCase().includes(filters.email.toLowerCase())
      )
    }
    if (filters.city) {
      filtered = filtered.filter(c => 
        (c.city || '').toLowerCase().includes(filters.city.toLowerCase())
      )
    }

    // Apply sorting
    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal: any
        let bVal: any

        switch (sortColumn) {
          case 'name':
            aVal = a.name
            bVal = b.name
            break
          case 'email':
            aVal = a.email
            bVal = b.email
            break
          case 'city':
            aVal = a.city || ''
            bVal = b.city || ''
            break
          case 'value_per_bird':
            aVal = a.value_per_bird || 0
            bVal = b.value_per_bird || 0
            break
          case 'due_days':
            aVal = a.due_days || 0
            bVal = b.due_days || 0
            break
          case 'created_at':
            aVal = new Date(a.created_at).getTime()
            bVal = new Date(b.created_at).getTime()
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
  }, [clients, filters, sortColumn, sortDirection])

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return <ArrowUpDown className="ml-2 h-4 w-4 inline opacity-40" />
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4 inline" />
      : <ArrowDown className="ml-2 h-4 w-4 inline" />
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    const supabase = createClient()

    const { error } = await supabase.from("clients").delete().eq("id", id)

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete client. They may have associated invoices.",
      })
    } else {
      toast({
        title: "Client deleted",
        description: "The client has been deleted successfully.",
      })
      router.refresh()
    }

    setIsDeleting(false)
  }

  const handleExport = () => {
    const columns: ExportColumn[] = [
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "address", label: "Address" },
      { key: "city", label: "City" },
      { key: "state", label: "State" },
      { key: "zip_code", label: "Zip Code" },
      { key: "country", label: "Country" },
      { key: "value_per_bird", label: "Value Per Bird", formatter: (val) => val != null ? Number(val).toFixed(2) : "" },
      { key: "due_days", label: "Due Days" },
      {
        key: "created_at",
        label: "Created Date",
        formatter: (date) =>
          new Date(date).toLocaleDateString("en-IN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }),
      },
    ]

    exportToCSV(processedClients, columns, `clients-${getTimestamp()}.csv`)
    toast({
      title: "Exported",
      description: `${processedClients.length} client(s) exported to CSV successfully.`,
    })
  }

  if (clients.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-white">
        <p className="text-muted-foreground">No clients found. Add your first client to get started.</p>
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
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('name')}>
                Name<SortIcon column="name" />
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('email')}>
                Contact<SortIcon column="email" />
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('city')}>
                Location<SortIcon column="city" />
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('value_per_bird')}>
                Value/Bird<SortIcon column="value_per_bird" />
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('due_days')}>
                Due Days<SortIcon column="due_days" />
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('created_at')}>
                Created<SortIcon column="created_at" />
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
            <TableRow>
              <TableHead>
                <Input
                  placeholder="Filter..."
                  value={filters.name}
                  onChange={(e) => handleFilterChange('name', e.target.value)}
                  className="h-8"
                />
              </TableHead>
              <TableHead>
                <Input
                  placeholder="Filter..."
                  value={filters.email}
                  onChange={(e) => handleFilterChange('email', e.target.value)}
                  className="h-8"
                />
              </TableHead>
              <TableHead>
                <Input
                  placeholder="Filter..."
                  value={filters.city}
                  onChange={(e) => handleFilterChange('city', e.target.value)}
                  className="h-8"
                />
              </TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processedClients.map((client) => (
              <TableRow key={client.id}>
                <TableCell className="font-medium">{client.name}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1 text-sm">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      {client.email}
                    </div>
                    {client.phone && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {client.phone}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {client.city && client.state ? (
                    <div className="text-sm">
                      {client.city}, {client.state}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {client.value_per_bird !== undefined && client.value_per_bird !== null
                    ? `₹${Number(client.value_per_bird).toFixed(2)}`
                    : "-"}
                </TableCell>
                <TableCell className="text-sm">
                  {client.due_days ?? 0}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(client.created_at).toLocaleDateString('en-IN', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/clients/${client.id}/edit`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this client?")) {
                          handleDelete(client.id)
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

    </>
  )
}
