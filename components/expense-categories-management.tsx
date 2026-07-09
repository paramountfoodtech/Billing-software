"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { Pencil, Trash2, Plus } from "lucide-react";
import Link from "next/link";
import { EntryHistoryButton } from "@/components/entry-history-button";
import {
  getProfileDisplayName,
  logEntryHistory,
} from "@/lib/entry-history";
import { IconTooltip } from "@/components/icon-tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface ExpenseCategory {
  id: string;
  name: string;
  slug: string | null;
  is_system?: boolean;
  is_active?: boolean;
  position?: number;
  created_at?: string;
  profiles?: { full_name: string } | null;
}

interface ExpenseCategoriesManagementProps {
  categories: ExpenseCategory[];
}

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function ExpenseCategoriesManagement({
  categories,
}: ExpenseCategoriesManagementProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ name: "" });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<null | {
    id: string;
    name: string;
  }>(null);

  const sortedCategories = [...categories].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Category name is required.",
      });
      return;
    }

    const isDuplicate = categories.some(
      (cat) => cat.name.toLowerCase() === formData.name.trim().toLowerCase(),
    );

    if (isDuplicate) {
      toast({
        variant: "destructive",
        title: "Duplicate Category",
        description: `A category named "${formData.name}" already exists.`,
      });
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", userData.user.id)
        .single();

      if (!userProfile?.organization_id) throw new Error("Organization not found");

      const maxPosition = categories.reduce(
        (max, c) => Math.max(max, c.position ?? 0),
        -1,
      );

      const { data: created, error } = await supabase
        .from("expense_categories")
        .insert({
          name: formData.name.trim(),
          slug: slugify(formData.name),
          organization_id: userProfile.organization_id,
          is_system: false,
          is_active: true,
          position: maxPosition + 1,
          created_by: userData.user.id,
        })
        .select("id")
        .single();

      if (error) throw error;

      if (created?.id) {
        const userName = await getProfileDisplayName(supabase, userData.user.id);
        await logEntryHistory(supabase, {
          organizationId: userProfile.organization_id,
          entityType: "expense_category",
          entityId: created.id,
          action: "created",
          userId: userData.user.id,
          userName,
          summary: formData.name.trim(),
        });
      }

      toast({
        variant: "success",
        title: "Success",
        description: "Category added successfully.",
      });

      setFormData({ name: "" });
      setShowAddForm(false);
      router.refresh();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to add category.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    setLoading(true);
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from("expense_categories")
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      router.refresh();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update category.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async (id: string, newName: string) => {
    if (!newName.trim()) return;

    setLoading(true);
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from("expense_categories")
        .update({
          name: newName.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      setEditingId(null);
      router.refresh();
      toast({
        variant: "success",
        title: "Updated",
        description: "Category renamed successfully.",
      });
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to rename category.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;

    const category = categories.find((c) => c.id === pendingDelete.id);
    if (category?.is_system) {
      toast({
        variant: "destructive",
        title: "Cannot delete",
        description: "System categories cannot be deleted.",
      });
      setDeleteDialogOpen(false);
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      const { count } = await supabase
        .from("expense_entries")
        .select("id", { count: "exact", head: true })
        .eq("category_id", pendingDelete.id);

      if (count && count > 0) {
        toast({
          variant: "destructive",
          title: "Cannot delete",
          description:
            "This category has expense entries. Deactivate it instead.",
        });
        setDeleteDialogOpen(false);
        return;
      }

      const { error } = await supabase
        .from("expense_categories")
        .delete()
        .eq("id", pendingDelete.id);

      if (error) throw error;

      toast({
        variant: "success",
        title: "Deleted",
        description: "Category deleted successfully.",
      });
      router.refresh();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete category.",
      });
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
      setPendingDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" asChild>
          <Link href="/dashboard/expenses">Back to Expenses</Link>
        </Button>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category_name">Category Name</Label>
                <Input
                  id="category_name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ name: e.target.value })
                  }
                  placeholder="e.g. Rent, Utilities, Transport"
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading && <Spinner className="mr-2 h-4 w-4" />}
                  Save Category
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {sortedCategories.map((category) => (
          <Card key={category.id}>
            <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                {editingId === category.id ? (
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const input = (
                        e.currentTarget.elements.namedItem(
                          "edit_name",
                        ) as HTMLInputElement
                      ).value;
                      handleRename(category.id, input);
                    }}
                  >
                    <Input
                      name="edit_name"
                      defaultValue={category.name}
                      className="max-w-xs"
                      autoFocus
                    />
                    <Button type="submit" size="sm" disabled={loading}>
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      {category.name}
                      {category.is_system && (
                        <span className="text-xs text-muted-foreground">
                          (system)
                        </span>
                      )}
                      {category.slug === "salary" && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          Default
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`active-${category.id}`} className="text-sm">
                    Active
                  </Label>
                  <Switch
                    id={`active-${category.id}`}
                    checked={category.is_active !== false}
                    onCheckedChange={(checked) =>
                      handleToggleActive(category.id, checked)
                    }
                    disabled={loading || category.slug === "salary"}
                  />
                </div>
                {!category.is_system && (
                  <IconTooltip label="Rename">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingId(category.id)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </IconTooltip>
                )}
                <EntryHistoryButton
                  entityType="expense_category"
                  entityId={category.id}
                  createdAt={category.created_at}
                  createdByName={category.profiles?.full_name}
                />
                {!category.is_system && (
                  <IconTooltip label="Delete">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setPendingDelete({
                          id: category.id,
                          name: category.name,
                        });
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </IconTooltip>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{pendingDelete?.name}&quot;? This cannot be undone if
              the category has no entries.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
