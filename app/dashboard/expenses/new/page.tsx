import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ExpenseEntryForm } from "@/components/expense-entry-form";
import { suggestNextNumber } from "@/lib/purchase-document-numbers";
import { canAccessExpenses } from "@/lib/permissions";

export default async function NewExpensePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id || !canAccessExpenses(profile.role)) {
    redirect("/dashboard");
  }

  const organizationId = profile.organization_id;

  const [categoriesResult, entriesResult] = await Promise.all([
    supabase
      .from("expense_categories")
      .select("id, name, slug, is_active")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("position", { ascending: true }),
    supabase
      .from("expense_entries")
      .select("entry_number")
      .eq("organization_id", organizationId),
  ]);

  const suggestedEntryNumber = suggestNextNumber(
    "EXP",
    (entriesResult.data || []).map((e) => e.entry_number),
  );

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">New Expense Entry</h1>
        <p className="text-muted-foreground mt-1">
          Record salary or other expenses with units, GST, and discounts
        </p>
      </div>

      <ExpenseEntryForm
        categories={categoriesResult.data || []}
        suggestedEntryNumber={suggestedEntryNumber}
      />
    </div>
  );
}
