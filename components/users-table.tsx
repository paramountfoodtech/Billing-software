"use client"

import { useState, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { usePagination } from "@/hooks/use-pagination"
import { TablePagination } from "@/components/table-pagination"
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

interface User {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  organizations?: { name: string }
  created_at: string
}

export function UsersTable({ users, userRole }: { users: User[]; userRole?: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<null | { id: string; name: string }>(null)

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Pagination state
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Filter state
  const [filters, setFilters] = useState({
    name: '',
    email: '',
    role: '',
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
  const processedUsers = useMemo(() => {
    let filtered = [...users]

    // Apply filters
    if (filters.name) {
      filtered = filtered.filter(u => 
        u.full_name.toLowerCase().includes(filters.name.toLowerCase())
      )
    }
    if (filters.email) {
      filtered = filtered.filter(u => 
        u.email.toLowerCase().includes(filters.email.toLowerCase())
      )
    }
    if (filters.role) {
      filtered = filtered.filter(u => 
        u.role.toLowerCase().includes(filters.role.toLowerCase())
      )
    }

    // Apply sorting
    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal: any
        let bVal: any

        switch (sortColumn) {
          case 'name':
            aVal = a.full_name
            bVal = b.full_name
            break
          case 'email':
            aVal = a.email
            bVal = b.email
            break
          case 'role':
            aVal = a.role
            bVal = b.role
            break
          case 'organization':
            aVal = a.organizations?.name || ''
            bVal = b.organizations?.name || ''
            break
          case 'status':
            aVal = a.is_active ? 1 : 0
            bVal = b.is_active ? 1 : 0
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
  }, [users, filters, sortColumn, sortDirection])

  const pagination = usePagination({
    items: processedUsers,
    itemsPerPage,
  })

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return <ArrowUpDown className="ml-2 h-4 w-4 inline opacity-40" />
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4 inline" />
      : <ArrowDown className="ml-2 h-4 w-4 inline" />
  }

  const handleDelete = async (id: string, name: string) => {
    try {
      console.log('Deactivating user:', { id, name })
      
      const res = await fetch("/api/users/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })

      console.log('Deactivate response status:', res.status)

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        console.error('Deactivate failed:', data)
        throw new Error(data?.error || "Failed to deactivate user")
      }

      const result = await res.json()
      console.log('Deactivate result:', result)

      setDeleteDialogOpen(false)
      setUserToDelete(null)
      
      toast({
        variant: "success",
        title: "User deactivated",
        description: "The user has been deactivated successfully.",
      })
      
      // Wait a moment for database transaction to complete, then force full reload
      await new Promise(resolve => setTimeout(resolve, 300))
      
      console.log('Forcing page reload')
      window.location.reload()
    } catch (err: unknown) {
      console.error('Deactivate error:', err)
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Error deactivating user",
      })
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "super_admin":
        return "bg-purple-100 text-purple-700"
      case "admin":
        return "bg-blue-100 text-blue-700"
      case "manager":
        return "bg-amber-100 text-amber-700"
      case "accountant":
        return "bg-green-100 text-green-700"
      default:
        return "bg-slate-100 text-slate-700"
    }
  }

  return (
    <>
    <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
      <Table className="text-xs sm:text-sm">
        <TableHeader>
          <TableRow>
            <TableHead className="cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3" onClick={() => handleSort('name')}>
              Name<SortIcon column="name" />
            </TableHead>
            <TableHead className="cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3" onClick={() => handleSort('email')}>
              Email<SortIcon column="email" />
            </TableHead>
            <TableHead className="cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3" onClick={() => handleSort('role')}>
              Role<SortIcon column="role" />
            </TableHead>
            <TableHead className="hidden md:table-cell cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3" onClick={() => handleSort('organization')}>
              Organization<SortIcon column="organization" />
            </TableHead>
            <TableHead className="cursor-pointer hover:bg-muted/50 px-2 sm:px-4 py-2 sm:py-3" onClick={() => handleSort('status')}>
              Status<SortIcon column="status" />
            </TableHead>
            {userRole === "super_admin" && <TableHead className="text-right px-2 sm:px-4 py-2 sm:py-3">Actions</TableHead>}
          </TableRow>
          <TableRow>
            <TableHead className="px-2 sm:px-4 py-2 sm:py-3">
              <Input
                placeholder="Filter..."
                value={filters.name}
                onChange={(e) => handleFilterChange('name', e.target.value)}
                className="h-7 text-xs"
              />
            </TableHead>
            <TableHead className="px-2 sm:px-4 py-2 sm:py-3">
              <Input
                placeholder="Filter..."
                value={filters.email}
                onChange={(e) => handleFilterChange('email', e.target.value)}
                className="h-7 text-xs"
              />
            </TableHead>
            <TableHead className="px-2 sm:px-4 py-2 sm:py-3">
              <Input
                placeholder="Filter..."
                value={filters.role}
                onChange={(e) => handleFilterChange('role', e.target.value)}
                className="h-7 text-xs"
              />
            </TableHead>
            <TableHead className="hidden md:table-cell px-2 sm:px-4 py-2 sm:py-3"></TableHead>
            <TableHead className="px-2 sm:px-4 py-2 sm:py-3"></TableHead>
            {userRole === "admin" && <TableHead className="px-2 sm:px-4 py-2 sm:py-3"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagination.paginatedItems.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-slate-500 py-8 px-2 sm:px-4">
                No users found
              </TableCell>
            </TableRow>
          ) : (
            pagination.paginatedItems.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium px-2 sm:px-4 py-2 sm:py-3 max-w-[100px] sm:max-w-none truncate text-xs sm:text-sm">{user.full_name}</TableCell>
                <TableCell className="px-2 sm:px-4 py-2 sm:py-3 text-xs hidden sm:table-cell">{user.email}</TableCell>
                <TableCell className="px-2 sm:px-4 py-2 sm:py-3">
                  <Badge className={`${getRoleBadgeColor(user.role)} text-xs`} variant="secondary">
                    {user.role.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell px-2 sm:px-4 py-2 sm:py-3 text-xs">{user.organizations?.name || "N/A"}</TableCell>
                <TableCell className="px-2 sm:px-4 py-2 sm:py-3">
                  <Badge variant={user.is_active ? "default" : "secondary"} className="text-xs">
                    {user.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                {userRole === "super_admin" && (
                  <TableCell className="text-right px-2 sm:px-4 py-2 sm:py-3">
                    <div className="flex justify-end gap-1 sm:gap-2">
                      <Link href={`/dashboard/users/${user.id}/edit`}>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setUserToDelete({ id: user.id, name: user.full_name })
                          setDeleteDialogOpen(true)
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
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
          <AlertDialogTitle>Deactivate user?</AlertDialogTitle>
          <AlertDialogDescription>
            This action will deactivate the user account. They will no longer be able to sign in.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => userToDelete && handleDelete(userToDelete.id, userToDelete.name)}
            className="bg-red-600 hover:bg-red-700"
          >
            Deactivate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
