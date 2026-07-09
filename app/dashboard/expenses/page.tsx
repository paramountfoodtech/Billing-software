import { createClient } from "@/lib/supabase/server";
import { ExpensesPageClient } from "./expenses-page-client";
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper";
import { Suspense } from "react";
import { LoadingOverlay } from "@/components/loading-overlay";
import { Button } from "@/components/ui/button";
import { Plus, Tags, BarChart3 } from "lucide-react";
import Link from "next/link";

async function ExpensesContent({ userRole }: { userRole?: string }) {
  const supabase = await createClient();

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

  return <ExpensesPageClient entries={entries || []} userRole={userRole} />;
}

export default async function ExpensesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userRole: string | undefined;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    userRole = profile?.role;
  }

  return (
    <DashboardPageWrapper title="Salary & Expenses">
      <div className="w-full p-4 sm:p-6 lg:p-8 space-y-4">
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link href="/dashboard/expenses/categories">
              <Tags className="h-4 w-4 mr-2" />
              Categories
            </Link>
          </Button>
          {(userRole === "super_admin" || userRole === "admin") && (
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link href="/dashboard/expenses/reports">
                <BarChart3 className="h-4 w-4 mr-2" />
                Reports
              </Link>
            </Button>
          )}
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashboard/expenses/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Entry
            </Link>
          </Button>
        </div>
        <Suspense fallback={<LoadingOverlay />}>
          <ExpensesContent userRole={userRole} />
        </Suspense>
      </div>
    </DashboardPageWrapper>
  );
}
