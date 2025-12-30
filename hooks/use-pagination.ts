import { useState, useMemo } from "react"

interface UsePaginationProps {
  items: any[]
  itemsPerPage?: number
}

interface PaginationState {
  currentPage: number
  totalPages: number
  paginatedItems: any[]
  goToPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
  canGoNext: boolean
  canGoPrev: boolean
  totalItems: number
}

export function usePagination({
  items,
  itemsPerPage = 10,
}: UsePaginationProps): PaginationState {
  const [currentPage, setCurrentPage] = useState(1)

  const { paginatedItems, totalPages, totalItems } = useMemo(() => {
    const total = items.length
    const pages = Math.ceil(total / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const paginated = items.slice(startIndex, endIndex)

    return {
      paginatedItems: paginated,
      totalPages: Math.max(1, pages),
      totalItems: total,
    }
  }, [items, currentPage, itemsPerPage])

  const goToPage = (page: number) => {
    const pageNum = Math.max(1, Math.min(page, totalPages))
    setCurrentPage(pageNum)
  }

  const nextPage = () => {
    goToPage(currentPage + 1)
  }

  const prevPage = () => {
    goToPage(currentPage - 1)
  }

  return {
    currentPage,
    totalPages,
    paginatedItems,
    goToPage,
    nextPage,
    prevPage,
    canGoNext: currentPage < totalPages,
    canGoPrev: currentPage > 1,
    totalItems,
  }
}
