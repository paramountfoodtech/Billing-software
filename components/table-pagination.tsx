"use client"

import { cn } from "@/lib/utils"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { SearchableSelect } from "@/components/ui/searchable-select"

interface TablePaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  onPageChange: (page: number) => void
  onItemsPerPageChange?: (itemsPerPage: number) => void
  showItemsPerPage?: boolean
}

export function TablePagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  showItemsPerPage = true,
}: TablePaginationProps) {
  if (totalPages <= 1) {
    return null
  }

  const generatePageNumbers = () => {
    const pages: (number | string)[] = []
    const showPages = 5

    if (totalPages <= showPages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      pages.push(1)

      if (currentPage > 3) {
        pages.push("...")
      }

      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i)
        }
      }

      if (currentPage < totalPages - 2) {
        pages.push("...")
      }

      pages.push(totalPages)
    }

    return pages
  }

  const pageNumbers = generatePageNumbers()
  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)
  const perPageOptions = ["5", "10", "25", "50", "100"].map((value) => ({
    value,
    label: value,
  }))

  return (
    <div className="flex flex-col gap-4 mt-6">
      {/* Items info and per-page selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-sm text-slate-600">
          Showing <span className="font-medium">{startItem}</span> to{" "}
          <span className="font-medium">{endItem}</span> of{" "}
          <span className="font-medium">{totalItems}</span> items
        </div>

        {showItemsPerPage && onItemsPerPageChange && (
          <div className="flex items-center gap-2">
            <label htmlFor="items-per-page" className="text-sm text-slate-600">
              Items per page:
            </label>
            <SearchableSelect
              id="items-per-page"
              value={itemsPerPage.toString()}
              onValueChange={(val) => onItemsPerPageChange(parseInt(val))}
              options={perPageOptions}
              placeholder="Rows"
              searchPlaceholder="Type rows..."
              triggerClassName="w-[80px]"
            />
          </div>
        )}
      </div>

      {/* Pagination controls */}
      <Pagination className="justify-start sm:justify-center">
        <PaginationContent className="flex-wrap">
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault()
                if (currentPage > 1) {
                  onPageChange(currentPage - 1)
                }
              }}
              className={cn(currentPage === 1 && "pointer-events-none opacity-50")}
            />
          </PaginationItem>

          {pageNumbers.map((page, index) => (
            <PaginationItem key={index}>
              {page === "..." ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    onPageChange(page as number)
                  }}
                  isActive={currentPage === page}
                  className={cn(
                    "cursor-pointer",
                    currentPage === page && "pointer-events-none"
                  )}
                >
                  {page}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}

          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => {
                e.preventDefault()
                if (currentPage < totalPages) {
                  onPageChange(currentPage + 1)
                }
              }}
              className={cn(currentPage === totalPages && "pointer-events-none opacity-50")}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
