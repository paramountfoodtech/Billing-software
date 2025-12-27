"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Pencil, Trash2, Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState, useMemo } from "react"
import { useToast } from "@/hooks/use-toast"
import { exportToCSV, ExportColumn, getTimestamp } from "@/lib/export-utils"
import { Input } from "@/components/ui/input"

interface Product {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  profiles?: {
    full_name: string
  }
}

interface ProductsTableProps {
  products: Product[]
}

export function ProductsTable({ products }: ProductsTableProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Filter state
  const [filters, setFilters] = useState({
    name: '',
    description: '',
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
  const processedProducts = useMemo(() => {
    let filtered = [...products]

    // Apply filters
    if (filters.name) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(filters.name.toLowerCase())
      )
    }
    if (filters.description) {
      filtered = filtered.filter(p => 
        (p.description || '').toLowerCase().includes(filters.description.toLowerCase())
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
          case 'description':
            aVal = a.description || ''
            bVal = b.description || ''
            break
          case 'is_active':
            aVal = a.is_active ? 1 : 0
            bVal = b.is_active ? 1 : 0
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
  }, [products, filters, sortColumn, sortDirection])

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return <ArrowUpDown className="ml-2 h-4 w-4 inline opacity-40" />
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4 inline" />
      : <ArrowDown className="ml-2 h-4 w-4 inline" />
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    const supabase = createClient()

    const { error } = await supabase.from("products").delete().eq("id", id)

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete product. It may be used in existing invoices.",
      })
    } else {
      toast({
        title: "Product deleted",
        description: "The product has been deleted successfully.",
      })
      router.refresh()
    }

    setIsDeleting(false)
  }

  const handleExport = () => {
    const columns: ExportColumn[] = [
      { key: "name", label: "Product Name" },
      { key: "description", label: "Description" },
      {
        key: "is_active",
        label: "Active",
        formatter: (val) => (val ? "Yes" : "No"),
      },
    ]

    exportToCSV(processedProducts, columns, `products-${getTimestamp()}.csv`)
    toast({
      title: "Exported",
      description: `${processedProducts.length} product(s) exported to CSV successfully.`,
    })
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-white">
        <p className="text-muted-foreground">No products found. Add your first product to get started.</p>
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
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('description')}>
                Description<SortIcon column="description" />
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('is_active')}>
                Status<SortIcon column="is_active" />
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
                  value={filters.description}
                  onChange={(e) => handleFilterChange('description', e.target.value)}
                  className="h-8"
                />
              </TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processedProducts.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell className="max-w-xs truncate">
                  {product.description || <span className="text-muted-foreground">-</span>}
                </TableCell>
                <TableCell>
                  {product.is_active ? (
                    <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/products/${product.id}/edit`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this product?")) {
                          handleDelete(product.id)
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
