import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { ExpenseEntryForm } from "@/components/expense-entry-form";
import { canEdit } from "@/lib/permissions";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id || !canEdit(profile.role)) {
    notFound();
  }

  const organizationId = profile.organization_id;

  const { data: entry } = await supabase
    .from("expense_entries")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!entry || entry.status === "cancelled") {
    notFound();
  }

  const { data: categories } = await supabase
    .from("expense_categories")
    .select("id, name, slug, is_active")
    .eq("organization_id", organizationId)
    .order("position", { ascending: true });

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Edit Expense Entry
        </h1>
        <p className="text-muted-foreground mt-1">
          Update salary or other expense details
        </p>
      </div>

      <ExpenseEntryForm
        categories={categories || []}
        suggestedEntryNumber={entry.entry_number}
        initialEntry={entry}
      />
    </div>
  );
}
