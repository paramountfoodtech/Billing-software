"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Spinner } from "@/components/ui/spinner"
import { Pencil, Trash2, Plus } from "lucide-react"
import Link from "next/link"
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

interface PriceCategory {
  id: string
  name: string
  description: string | null
  is_active?: boolean
}

interface CategoriesManagementProps {
  priceCategories: PriceCategory[]
}

export function CategoriesManagement({ priceCategories }: CategoriesManagementProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  })
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<null | { id: string; name: string }>(null)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Category name is required.",
      })
      return
    }

    // Check for duplicate categories (case-insensitive)
    const isDuplicate = priceCategories.some(
      cat => cat.name.toLowerCase() === formData.name.trim().toLowerCase()
    )

    if (isDuplicate) {
      toast({
        variant: "destructive",
        title: "Duplicate Category",
        description: `A category named "${formData.name}" already exists.`,
      })
      return
    }

    setLoading(true)
    const supabase = createClient()

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error("Not authenticated")

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", userData.user.id)
        .single()

      if (!userProfile?.organization_id) throw new Error("Organization not found")

      const { error } = await supabase
        .from("price_categories")
        .insert({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          organization_id: userProfile.organization_id,
          created_by: userData.user.id,
        })

      if (error) throw error

      toast({
        variant: "success",
        title: "Success",
        description: "Category added successfully.",
      })

      setFormData({ name: "", description: "" })
      setShowAddForm(false)
      router.refresh()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add category.",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    setLoading(true)
    const supabase = createClient()

    try {
      const { error } = await supabase.from("price_categories").delete().eq("id", id)
      if (error) throw error

      toast({
        variant: "success",
        title: "Success",
        description: "Category deleted successfully.",
      })

      router.refresh()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete category.",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from("price_categories")
        .update({ is_active: !currentStatus })
        .eq("id", id)

      if (error) throw error

      toast({
        variant: "success",
        title: "Success",
        description: `Category ${!currentStatus ? "activated" : "deactivated"} successfully.`,
      })

      router.refresh()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update category status.",
      })
    }
  }

  return (
    <>
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          variant={showAddForm ? "outline" : "default"}
        >
          {showAddForm ? "Cancel" : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Add New Category
            </>
          )}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/prices">
            Back to Prices
          </Link>
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Category Name*</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Paper Price, Skinless, With Skin, Eggs"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description for this category"
                  rows={2}
                />
              </div>

              <Button type="submit" disabled={loading}>
                {loading && <Spinner className="h-4 w-4 mr-2" />}
                Add Category
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {priceCategories.map((category) => (
          <Card key={category.id} className={!category.is_active ? "opacity-60" : ""}>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{category.name}</h3>
                      {!category.is_active && (
                        <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">Inactive</span>
                      )}
                    </div>
                    {category.description && (
                      <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Switch
                    checked={category.is_active ?? true}
                    onCheckedChange={() => handleToggleActive(category.id, category.is_active ?? true)}
                  />
                  <Label className="text-sm cursor-pointer" onClick={() => handleToggleActive(category.id, category.is_active ?? true)}>
                    {category.is_active ? "Active" : "Inactive"}
                  </Label>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/prices/${category.id}/edit`}>
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPendingDelete({ id: category.id, name: category.name })
                      setDeleteDialogOpen(true)
                    }}
                    disabled={loading}
                  >
                    <Trash2 className="h-3 w-3 mr-1 text-red-600" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {priceCategories.length === 0 && !showAddForm && (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground mb-4">No categories found. Add your first category to get started.</p>
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        </div>
      )}
    </div>
    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete category?</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove the category and all its price history entries. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => pendingDelete && handleDelete(pendingDelete.id, pendingDelete.name)}
            className="bg-red-600 hover:bg-red-700"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
