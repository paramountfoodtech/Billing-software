"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Pencil, Trash2, Download, ArrowUpDown, ArrowUp, ArrowDown, GripVertical } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState, useMemo } from "react"
import { usePagination } from "@/hooks/use-pagination"
import { TablePagination } from "@/components/table-pagination"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
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
  is_active?: boolean
  position?: number
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

function SortableCategoryRow({
  category,
  latestPrice,
  onDelete,
  isDeleting,
}: {
  category: PriceCategory
  latestPrice: PriceHistory | null
  onDelete: (id: string) => void
  isDeleting: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={`text-xs sm:text-sm ${!category.is_active ? "opacity-60" : ""}`}
    >
      <TableCell className="w-[40px] sm:w-[50px] px-2 sm:px-4 py-2 sm:py-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing hover:bg-muted rounded p-1 inline-flex"
        >
          <GripVertical className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
        </div>
      </TableCell>
      <TableCell className="font-medium px-2 sm:px-4 py-2 sm:py-3 max-w-[100px] sm:max-w-none truncate">{category.name}</TableCell>
      <TableCell className="px-2 sm:px-4 py-2 sm:py-3">
        <Badge variant={category.is_active ? "default" : "secondary"} className="text-xs">
          {category.is_active ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
      <TableCell className="px-2 sm:px-4 py-2 sm:py-3">
        <div>
          <span className="font-semibold text-green-600 text-base sm:text-lg">
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
      <TableCell className="hidden md:table-cell text-muted-foreground px-2 sm:px-4 py-2 sm:py-3 text-xs">
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
      <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3">
        <div className="flex justify-end gap-1 sm:gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/prices/${category.id}/edit`}>
              <Pencil className="h-3 w-3 sm:h-4 sm:w-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(category.id)}
            disabled={isDeleting}
          >
            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 text-red-600" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

export function PricesTable({ priceCategories, priceHistory }: PricesTableProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<null | { id: string; type: 'category' | 'price' }>(null)
  const [filter, setFilter] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  // Drag and drop setup
  const [orderedCategories, setOrderedCategories] = useState(priceCategories)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Sorting state for categories
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Pagination state for categories
  const [itemsPerPage, setItemsPerPage] = useState(10)

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

  const getLatestPrice = (categoryId: string, asOfDate?: string) => {
    const filterDate = asOfDate || new Date().toISOString().split("T")[0]
    const prices = priceHistory.filter(
      (p) => p.price_category_id === categoryId && p.effective_date <= filterDate,
    )
    if (prices.length === 0) return null
    return prices.sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime())[0]
  }

  // Apply filtering and sorting to categories
  const processedCategories = useMemo(() => {
    let filtered = [...orderedCategories]

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
  }, [orderedCategories, categoryFilters, sortColumn, sortDirection])

  const paginationCategories = usePagination({
    items: processedCategories,
    itemsPerPage,
  })

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return <ArrowUpDown className="ml-2 h-4 w-4 inline opacity-40" />
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4 inline" />
      : <ArrowDown className="ml-2 h-4 w-4 inline" />
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = orderedCategories.findIndex((cat) => cat.id === active.id)
      const newIndex = orderedCategories.findIndex((cat) => cat.id === over.id)

      const newOrder = arrayMove(orderedCategories, oldIndex, newIndex)
      setOrderedCategories(newOrder)

      // Persist the new order to the database
      const supabase = createClient()
      const updates = newOrder.map((cat, index) => ({
        id: cat.id,
        position: index,
      }))

      try {
        for (const update of updates) {
          await supabase
            .from("price_categories")
            .update({ position: update.position })
            .eq("id", update.id)
        }
        toast({
          variant: "success",
          title: "Order updated",
          description: "Category order has been saved.",
        })
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to save category order.",
        })
      }
    }
  }

  const handleDelete = async (id: string, type: "category" | "price") => {
    setIsDeleting(true)
    const supabase = createClient()

    try {
      if (type === "category") {
        const { error } = await supabase.from("price_categories").delete().eq("id", id)
        if (error) throw error
        toast({
          variant: "success",
          title: "Price category deleted",
          description: "The price category has been deleted successfully.",
        })
      } else {
        const { error } = await supabase.from("price_category_history").delete().eq("id", id)
        if (error) throw error
        toast({
          variant: "success",
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
      variant: "success",
      title: "Exported",
      description: `${enrichedData.length} price records exported to CSV successfully.`,
    })
  }

  return (
    <div className="space-y-6">
      {/* Categories Table */}
      <div className="rounded-lg border bg-white overflow-hidden overflow-x-auto">
        <DndContext
          id="price-categories-dnd"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <Table className="text-xs sm:text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px] sm:w-[50px] px-2 sm:px-4 py-2 sm:py-3"></TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3" onClick={() => handleSort('name')}>
                  Category Name<SortIcon column="name" />
                </TableHead>
                <TableHead className="px-2 sm:px-4 py-2 sm:py-3">Status</TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3" onClick={() => handleSort('price')}>
                  Current Price<SortIcon column="price" />
                </TableHead>
                <TableHead className="hidden md:table-cell px-2 sm:px-4 py-2 sm:py-3">Last Updated</TableHead>
                <TableHead className="text-right px-2 sm:px-4 py-2 sm:py-3">Actions</TableHead>
              </TableRow>
              <TableRow>
                <TableHead className="px-2 sm:px-4 py-2 sm:py-3"></TableHead>
                <TableHead className="px-2 sm:px-4 py-2 sm:py-3">
                  <Input
                    placeholder="Filter..."
                    value={categoryFilters.name}
                    onChange={(e) => handleCategoryFilterChange('name', e.target.value)}
                    className="h-7 text-xs"
                  />
                </TableHead>
                <TableHead className="px-2 sm:px-4 py-2 sm:py-3"></TableHead>
                <TableHead className="px-2 sm:px-4 py-2 sm:py-3"></TableHead>
                <TableHead className="hidden md:table-cell px-2 sm:px-4 py-2 sm:py-3"></TableHead>
                <TableHead className="px-2 sm:px-4 py-2 sm:py-3"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <SortableContext
                items={paginationCategories.paginatedItems.map((cat) => cat.id)}
                strategy={verticalListSortingStrategy}
              >
                {paginationCategories.paginatedItems.map((category) => (
                  <SortableCategoryRow
                    key={category.id}
                    category={category}
                    latestPrice={getLatestPrice(category.id)}
                    onDelete={(id) => {
                      setDeleteTarget({ id, type: 'category' })
                      setDeleteDialogOpen(true)
                    }}
                    isDeleting={isDeleting}
                  />
                ))}
              </SortableContext>
            </TableBody>
          </Table>
        </DndContext>
      </div>

      <TablePagination
        currentPage={paginationCategories.currentPage}
        totalPages={paginationCategories.totalPages}
        totalItems={paginationCategories.totalItems}
        itemsPerPage={itemsPerPage}
        onPageChange={paginationCategories.goToPage}
        onItemsPerPageChange={setItemsPerPage}
      />

      {/* Price History Table */}
      {priceHistory.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Price History</h3>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 justify-between">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 w-full sm:w-auto">
              <div className="w-full sm:w-auto">
                <label className="text-sm font-medium block mb-1">Filter by Category</label>
                <input
                  className="px-3 py-2 border rounded-md w-full sm:w-auto"
                  placeholder="Filter..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>
              <div className="w-full sm:w-auto">
                <label className="text-sm font-medium block mb-1">From date</label>
                <input
                  type="date"
                  className="px-3 py-2 border rounded-md w-full sm:w-auto"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="w-full sm:w-auto">
                <label className="text-sm font-medium block mb-1">To date</label>
                <input
                  type="date"
                  className="px-3 py-2 border rounded-md w-full sm:w-auto"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleExport} size="sm" variant="outline" title="Export to CSV" className="w-full sm:w-auto">
              <Download className="h-4 w-4" />
            </Button>
          </div>
          <div className="rounded-lg border bg-white overflow-hidden overflow-x-auto">
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
                            setDeleteTarget({ id: price.id, type: 'price' })
                            setDeleteDialogOpen(true)
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.type === 'category' ? 'category' : 'price update'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. {deleteTarget?.type === 'category' ? 'This will remove the category and its history.' : 'This will remove this specific price entry.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget.id, deleteTarget.type)}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
