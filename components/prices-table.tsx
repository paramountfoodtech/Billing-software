"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2, Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState, useMemo } from "react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { exportToCSV, ExportColumn, getTimestamp } from "@/lib/export-utils"
import { Input } from "@/components/ui/input"

interface PriceCategory {
  id: string
  name: string
  description: string | null
  price: number
  created_at: string
}

interface PriceHistory {
  id: string
  price_category_id: string
  price: number
  effective_date: string
  created_at: string
}

interface PricesTableProps {
  priceCategories: PriceCategory[]
  priceHistory: PriceHistory[]
}

export function PricesTable({ priceCategories, priceHistory }: PricesTableProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)
  const [filter, setFilter] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  // Sorting state for categories
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Filter state for categories
  const [categoryFilters, setCategoryFilters] = useState({
    name: '',
  })

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const handleCategoryFilterChange = (column: string, value: string) => {
    setCategoryFilters(prev => ({ ...prev, [column]: value }))
  }

  // Apply filtering and sorting to categories
  const processedCategories = useMemo(() => {
    let filtered = [...priceCategories]

    // Apply filters
    if (categoryFilters.name) {
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(categoryFilters.name.toLowerCase())
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
          case 'price':
            const aPriceObj = getLatestPrice(a.id)
            const bPriceObj = getLatestPrice(b.id)
            aVal = aPriceObj?.price || 0
            bVal = bPriceObj?.price || 0
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
  }, [priceCategories, categoryFilters, sortColumn, sortDirection])

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return <ArrowUpDown className="ml-2 h-4 w-4 inline opacity-40" />
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4 inline" />
      : <ArrowDown className="ml-2 h-4 w-4 inline" />
  }

  const getLatestPrice = (categoryId: string, asOfDate?: string) => {
    const filterDate = asOfDate || new Date().toISOString().split("T")[0]
    const prices = priceHistory.filter(
      (p) => p.price_category_id === categoryId && p.effective_date <= filterDate,
    )
    if (prices.length === 0) return null
    return prices.sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime())[0]
  }

  const handleDelete = async (id: string, type: "category" | "price") => {
    setIsDeleting(true)
    const supabase = createClient()

    try {
      if (type === "category") {
        const { error } = await supabase.from("price_categories").delete().eq("id", id)
        if (error) throw error
        toast({
          title: "Price category deleted",
          description: "The price category has been deleted successfully.",
        })
      } else {
        const { error } = await supabase.from("price_category_history").delete().eq("id", id)
        if (error) throw error
        toast({
          title: "Price update deleted",
          description: "The price update has been deleted successfully.",
        })
      }
      router.refresh()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete.",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  if (priceCategories.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-white">
        <p className="text-muted-foreground">No price categories found. Create your first category to get started.</p>
      </div>
    )
  }

  const handleExport = () => {
    // Apply the same filters that are applied to the displayed data
    const filteredHistory = priceHistory.filter((p) => {
      const cat = priceCategories.find((c) => c.id === p.price_category_id)
      const matchesName = !filter.trim() || (cat?.name || "").toLowerCase().includes(filter.toLowerCase())
      const withinRange = (!fromDate || p.effective_date >= fromDate) && (!toDate || p.effective_date <= toDate)
      return matchesName && withinRange
    })

    // Enrich filtered data with category names
    const enrichedData = filteredHistory.map(price => {
      const category = priceCategories.find(cat => cat.id === price.price_category_id)
      return {
        ...price,
        name: category?.name || 'Unknown',
      }
    })

    const columns: ExportColumn[] = [
      { key: "name", label: "Category Name" },
      { key: "price", label: "Price", formatter: (price) => Number(price).toFixed(2) },
      {
        key: "effective_date",
        label: "Effective Date",
        formatter: (date) =>
          new Date(date).toLocaleDateString("en-IN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }),
      },
    ]

    exportToCSV(enrichedData, columns, `price-history-${getTimestamp()}.csv`)
    toast({
      title: "Exported",
      description: `${enrichedData.length} price records exported to CSV successfully.`,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-3 justify-between">
        <div className="flex items-end gap-3">
          <div>
            <label className="text-sm font-medium block mb-1">Filter by Category</label>
            <input
              className="px-3 py-2 border rounded-md"
              placeholder="Type category name to filter history"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          {priceHistory.length > 0 && (
            <>
              <div>
                <label className="text-sm font-medium block mb-1">From date</label>
                <input
                  type="date"
                  className="px-3 py-2 border rounded-md"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">To date</label>
                <input
                  type="date"
                  className="px-3 py-2 border rounded-md"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </>
          )}
        </div>
        <Button onClick={handleExport} size="sm" variant="outline" title="Export to CSV">
          <Download className="h-4 w-4" />
        </Button>
      </div>
      {/* Categories Table */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('name')}>
                Category Name<SortIcon column="name" />
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('price')}>
                Current Price<SortIcon column="price" />
              </TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
            <TableRow>
              <TableHead>
                <Input
                  placeholder="Filter..."
                  value={categoryFilters.name}
                  onChange={(e) => handleCategoryFilterChange('name', e.target.value)}
                  className="h-8"
                />
              </TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processedCategories.map((category) => {
              const latestPrice = getLatestPrice(category.id)
                return (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell>
                      <div>
                        <span className="font-semibold text-green-600 text-lg">
                          {latestPrice ? `₹${Number(latestPrice.price).toFixed(2)}` : "No price set"}
                        </span>
                        {latestPrice && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Effective: {new Date(latestPrice.effective_date).toLocaleDateString("en-IN", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {latestPrice
                        ? new Date(latestPrice.created_at).toLocaleString("en-IN", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })
                        : "-"}
                    </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/prices/${category.id}/edit`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this category?")) {
                            handleDelete(category.id, "category")
                          }
                        }}
                        disabled={isDeleting}
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

      {/* Price History Table */}
      {priceHistory.length > 0 && (
        <div>
          <div className="rounded-lg border bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {priceHistory
                  .filter((p) => {
                    const cat = priceCategories.find((c) => c.id === p.price_category_id)
                    const matchesName = !filter.trim() || (cat?.name || "").toLowerCase().includes(filter.toLowerCase())
                    const withinRange = (!fromDate || p.effective_date >= fromDate) && (!toDate || p.effective_date <= toDate)
                    return matchesName && withinRange
                  })
                  .map((price) => {
                  const category = priceCategories.find((c) => c.id === price.price_category_id)
                  return (
                    <TableRow key={price.id}>
                      <TableCell className="font-medium">{category?.name}</TableCell>
                      <TableCell className="font-semibold text-green-600">₹{Number(price.price).toFixed(2)}</TableCell>
                      <TableCell>
                        {new Date(price.effective_date).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(price.created_at).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this price update?")) {
                              handleDelete(price.id, "price")
                            }
                          }}
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
