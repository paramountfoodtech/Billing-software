import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper";
import { ExpenseCategoriesManagement } from "@/components/expense-categories-management";

export default async function ExpenseCategoriesPage() {
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

  if (!profile?.organization_id) redirect("/dashboard");

  const { data: categories } = await supabase
    .from("expense_categories")
    .select(
      `
      *,
      profiles!expense_categories_created_by_fkey(full_name)
    `,
    )
    .eq("organization_id", profile.organization_id)
    .order("position", { ascending: true });

  return (
    <DashboardPageWrapper title="Expense Categories">
      <div className="w-full p-4 sm:p-6 lg:p-8">
        <ExpenseCategoriesManagement categories={categories || []} />
      </div>
    </DashboardPageWrapper>
  );
}
