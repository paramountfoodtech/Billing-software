import { createClient } from "@/lib/supabase/server";
import { ExpensesPageClient } from "./expenses-page-client";
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper";
import { Button } from "@/components/ui/button";
import { Plus, Tags, BarChart3 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { canAccessExpenses } from "@/lib/permissions";

export default async function ExpensesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!canAccessExpenses(profile?.role)) {
    redirect("/dashboard");
  }

  const userRole = profile?.role;

  const { data: entries } = await supabase
    .from("expense_entries")
    .select(
      `
      *,
      expense_categories(name, slug),
      profiles!expense_entries_created_by_fkey(full_name)
    `,
    )
    .order("created_at", { ascending: false });

  return (
    <DashboardPageWrapper title="Expenses">
      <div className="w-full p-4 sm:p-6 lg:p-8 space-y-4">
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link href="/dashboard/expenses/categories">
              <Tags className="h-4 w-4 mr-2" />
              Categories
            </Link>
          </Button>
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link href="/dashboard/expenses/reports">
              <BarChart3 className="h-4 w-4 mr-2" />
              Reports
            </Link>
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashboard/expenses/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Entry
            </Link>
          </Button>
        </div>

        <ExpensesPageClient entries={entries || []} userRole={userRole} />
      </div>
    </DashboardPageWrapper>
  );
}
