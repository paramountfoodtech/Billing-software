"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState, useMemo, ReactNode } from "react"
import { usePagination } from "@/hooks/use-pagination"
import { TablePagination } from "@/components/table-pagination"
import { useToast } from "@/hooks/use-toast"
import { getPriceForCategoryOnDate } from "@/lib/utils"
import { Input } from "@/components/ui/input"

interface PricingRule {
  id: string
  price_rule_type: string
  price_rule_value: string | null
  price_category_id: string | null
  notes: string | null
  created_at: string
  clients: {
    name: string
  }
  products: {
    name: string
    paper_price: string
  }
  price_categories?: {
    name: string
  } | null
}

interface ClientPricingTableProps {
  pricingRules: PricingRule[]
  priceHistory?: Array<{ price_category_id: string; price: number; effective_date: string }>
  userRole?: string
  toolbarLeft?: ReactNode
}

const ruleTypeLabels = {
  discount_percentage: "Discount %",
  discount_flat: "Flat Discount",
  multiplier: "Multiplier",
}

export function ClientPricingTable({ pricingRules, priceHistory = [], userRole, toolbarLeft }: ClientPricingTableProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null)
  const today = new Date().toISOString().split("T")[0]

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Pagination state
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Filter state
  const [filters, setFilters] = useState({
    client: '',
    product: '',
    category: '',
  })

    const handleExport = () => {
      const exportData = processedRules.map(rule => ({
        'Client': rule.clients.name,
        'Product': rule.products.name,
        'Base Category': rule.price_categories?.name || '—',
        'Category Price (Today)': rule.price_category_id 
          ? getPriceForCategoryOnDate(rule.price_category_id, today, priceHistory)?.toFixed(2) || 'N/A'
          : 'N/A',
        'Rule Type': ruleTypeLabels[rule.price_rule_type as keyof typeof ruleTypeLabels],
        'Rule Value': rule.price_rule_type === "discount_percentage" ? `${rule.price_rule_value}%` : rule.price_rule_type === "discount_flat" ? `₹${Number(rule.price_rule_value || 0).toFixed(2)}` : `× ${rule.price_rule_value}`,
        'Final Price': `₹${calculateFinalPrice(rule).toFixed(2)}`,
        'Notes': rule.notes || '',
        'Created At': new Date(rule.created_at).toLocaleDateString(),
      }))

      const headers = Object.keys(exportData[0])
      const csvContent = [
        headers.join(','),
        ...exportData.map(row =>
          headers.map(header => {
            const value = row[header as keyof typeof row]
            // Escape quotes and wrap in quotes if contains comma
            const stringValue = String(value || '')
            return stringValue.includes(',') || stringValue.includes('"') 
              ? `"${stringValue.replace(/"/g, '""')}"` 
              : stringValue
          }).join(',')
        ),
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `pricing-rules-${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        variant: "success",
        title: 'Exported',
        description: `${exportData.length} pricing rules exported to CSV successfully.`,
      })
    }

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

  const calculateFinalPrice = (rule: PricingRule) => {
    // Get category price as base
    const categoryPrice = rule.price_category_id 
      ? getPriceForCategoryOnDate(rule.price_category_id, today, priceHistory)
      : null
    
    const basePrice = categoryPrice !== null ? categoryPrice : Number(rule.products.paper_price)
    const ruleValue = Number(rule.price_rule_value || 0)

    switch (rule.price_rule_type) {
      case "discount_percentage":
        return basePrice * (1 - ruleValue / 100)
      case "discount_flat":
        return basePrice - ruleValue
      case "multiplier":
        return basePrice * ruleValue
      default:
        return basePrice
    }
  }

  // Apply filtering and sorting
  const processedRules = useMemo(() => {
    let filtered = [...pricingRules]

    // Apply filters
    if (filters.client) {
      filtered = filtered.filter(r => 
        r.clients.name.toLowerCase().includes(filters.client.toLowerCase())
      )
    }
    if (filters.product) {
      filtered = filtered.filter(r => 
        r.products.name.toLowerCase().includes(filters.product.toLowerCase())
      )
    }
    if (filters.category) {
      filtered = filtered.filter(r => 
        (r.price_categories?.name || '').toLowerCase().includes(filters.category.toLowerCase())
      )
    }

    // Apply sorting
    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal: any
        let bVal: any

        switch (sortColumn) {
          case 'client':
            aVal = a.clients.name
            bVal = b.clients.name
            break
          case 'product':
            aVal = a.products.name
            bVal = b.products.name
            break
          case 'category':
            aVal = a.price_categories?.name || ''
            bVal = b.price_categories?.name || ''
            break
          case 'category_price':
            const aCatPrice = a.price_category_id 
              ? getPriceForCategoryOnDate(a.price_category_id, today, priceHistory)
              : null
            const bCatPrice = b.price_category_id 
              ? getPriceForCategoryOnDate(b.price_category_id, today, priceHistory)
              : null
            aVal = aCatPrice !== null ? aCatPrice : 0
            bVal = bCatPrice !== null ? bCatPrice : 0
            break
          case 'rule_type':
            aVal = a.price_rule_type
            bVal = b.price_rule_type
            break
          case 'final_price':
            aVal = calculateFinalPrice(a)
            bVal = calculateFinalPrice(b)
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
  }, [pricingRules, filters, sortColumn, sortDirection, today, priceHistory])

  const pagination = usePagination({
    items: processedRules,
    itemsPerPage,
  })

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return <ArrowUpDown className="ml-2 h-4 w-4 inline opacity-40" />
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4 inline" />
      : <ArrowDown className="ml-2 h-4 w-4 inline" />
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    const supabase = createClient()

    const { error } = await supabase.from("client_product_pricing").delete().eq("id", id)

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete pricing rule.",
      })
    } else {
      toast({
        variant: "success",
        title: "Pricing rule deleted",
        description: "The pricing rule has been deleted successfully.",
      })
      router.refresh()
    }

    setIsDeleting(false)
  }

  if (pricingRules.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-white">
        <p className="text-muted-foreground">No client-specific pricing rules found. Create one to get started.</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-end gap-3 justify-between mb-4">
        <div className="flex items-center gap-3">
          {toolbarLeft}
        </div>
        <Button onClick={handleExport} size="sm" variant="outline" title="Export to CSV">
          <Download className="h-4 w-4" />
        </Button>
      </div>
      <div className="rounded-lg border bg-white overflow-x-auto">
        <Table className="text-xs sm:text-sm">
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3" onClick={() => handleSort('client')}>
                Client<SortIcon column="client" />
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3" onClick={() => handleSort('product')}>
                Product<SortIcon column="product" />
              </TableHead>
              <TableHead className="hidden md:table-cell cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3" onClick={() => handleSort('category')}>
                Base Category<SortIcon column="category" />
              </TableHead>
              <TableHead className="hidden lg:table-cell cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3" onClick={() => handleSort('category_price')}>
                Category Price<SortIcon column="category_price" />
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3" onClick={() => handleSort('rule_type')}>
                Rule<SortIcon column="rule_type" />
              </TableHead>
              <TableHead className="hidden lg:table-cell px-2 sm:px-4 py-2 sm:py-3">Value</TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3" onClick={() => handleSort('final_price')}>
                Final Price<SortIcon column="final_price" />
              </TableHead>
              {userRole !== "admin" && <TableHead className="text-right px-2 sm:px-4 py-2 sm:py-3">Actions</TableHead>}
            </TableRow>
            <TableRow>
              <TableHead className="px-2 sm:px-4 py-2 sm:py-3">
                <Input
                  placeholder="Filter..."
                  value={filters.client}
                  onChange={(e) => handleFilterChange('client', e.target.value)}
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="px-2 sm:px-4 py-2 sm:py-3">
                <Input
                  placeholder="Filter..."
                  value={filters.product}
                  onChange={(e) => handleFilterChange('product', e.target.value)}
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="hidden md:table-cell px-2 sm:px-4 py-2 sm:py-3">
                <Input
                  placeholder="Filter..."
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  className="h-7 text-xs"
                />
              </TableHead>
              <TableHead className="hidden lg:table-cell px-2 sm:px-4 py-2 sm:py-3"></TableHead>
              <TableHead className="px-2 sm:px-4 py-2 sm:py-3"></TableHead>
              <TableHead className="hidden lg:table-cell px-2 sm:px-4 py-2 sm:py-3"></TableHead>
              <TableHead className="px-2 sm:px-4 py-2 sm:py-3"></TableHead>
              {userRole !== "admin" && <TableHead className="px-2 sm:px-4 py-2 sm:py-3"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedItems.map((rule) => {
              const finalPrice = calculateFinalPrice(rule)
              const categoryPrice = rule.price_category_id 
                ? getPriceForCategoryOnDate(rule.price_category_id, today, priceHistory)
                : null
              
              return (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium px-2 sm:px-4 py-2 sm:py-3 max-w-[100px] sm:max-w-none truncate text-xs sm:text-sm">{rule.clients.name}</TableCell>
                  <TableCell className="px-2 sm:px-4 py-2 sm:py-3 text-xs">{rule.products.name}</TableCell>
                  <TableCell className="hidden md:table-cell px-2 sm:px-4 py-2 sm:py-3">
                    <span className="font-medium text-blue-600 text-xs">{rule.price_categories?.name || "—"}</span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell px-2 sm:px-4 py-2 sm:py-3">
                    {categoryPrice !== null ? (
                      <span className="font-semibold text-green-600 text-xs">₹{categoryPrice.toFixed(2)}</span>
                    ) : (
                      <span className="text-gray-400 text-xs">No price</span>
                    )}
                  </TableCell>
                  <TableCell className="px-2 sm:px-4 py-2 sm:py-3">
                    <Badge variant="secondary" className="text-xs">
                      {ruleTypeLabels[rule.price_rule_type as keyof typeof ruleTypeLabels]}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell px-2 sm:px-4 py-2 sm:py-3 text-xs">
                    {rule.price_rule_type === "discount_percentage" && `${rule.price_rule_value}%`}
                    {rule.price_rule_type === "discount_flat" && `₹${Number(rule.price_rule_value || 0).toFixed(2)}`}
                    {rule.price_rule_type === "multiplier" && `× ${rule.price_rule_value}`}
                  </TableCell>
                  <TableCell className="font-bold text-green-600 px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">₹{finalPrice.toFixed(2)}</TableCell>
                  {userRole !== "admin" && (
                    <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3">
                      <div className="flex justify-end gap-1 sm:gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/client-pricing/${rule.id}/edit`}>
                            <Pencil className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setRuleToDelete(rule.id)
                            setDeleteDialogOpen(true)
                          }}
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        totalItems={pagination.totalItems}
        itemsPerPage={itemsPerPage}
        onPageChange={pagination.goToPage}
        onItemsPerPageChange={setItemsPerPage}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete pricing rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this client pricing rule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => ruleToDelete && handleDelete(ruleToDelete)}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
