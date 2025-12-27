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
import { Input } from "@/components/ui/input"

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

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

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

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return <ArrowUpDown className="ml-2 h-4 w-4 inline opacity-40" />
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4 inline" />
      : <ArrowDown className="ml-2 h-4 w-4 inline" />
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
      return
    }

    const supabase = createClient()
    const { error } = await supabase.from("profiles").update({ is_active: false }).eq("id", id)

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error deactivating user: " + error.message,
      })
    } else {
      toast({
        title: "User deactivated",
        description: "The user has been deactivated successfully.",
      })
      router.refresh()
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
    <div className="bg-white rounded-lg border border-slate-200">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('name')}>
              Name<SortIcon column="name" />
            </TableHead>
            <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('email')}>
              Email<SortIcon column="email" />
            </TableHead>
            <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('role')}>
              Role<SortIcon column="role" />
            </TableHead>
            <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('organization')}>
              Organization<SortIcon column="organization" />
            </TableHead>
            <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('status')}>
              Status<SortIcon column="status" />
            </TableHead>
            {userRole === "super_admin" && <TableHead className="text-right">Actions</TableHead>}
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
                value={filters.role}
                onChange={(e) => handleFilterChange('role', e.target.value)}
                className="h-8"
              />
            </TableHead>
            <TableHead></TableHead>
            <TableHead></TableHead>
            {userRole === "admin" && <TableHead></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {processedUsers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                No users found
              </TableCell>
            </TableRow>
          ) : (
            processedUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.full_name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge className={getRoleBadgeColor(user.role)} variant="secondary">
                    {user.role.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>{user.organizations?.name || "N/A"}</TableCell>
                <TableCell>
                  <Badge variant={user.is_active ? "default" : "secondary"}>
                    {user.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                {userRole === "super_admin" && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/dashboard/users/${user.id}/edit`}>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(user.id, user.full_name)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
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
  )
}
