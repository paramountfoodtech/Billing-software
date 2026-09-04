import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { EntryHistoryButton } from "@/components/entry-history-button";
import { formatIndianDate } from "@/lib/date-time";
import { canAccessExpenses } from "@/lib/permissions";

export default async function ExpenseDetailPage({
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
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!canAccessExpenses(profile?.role)) {
    redirect("/dashboard");
  }

  const { data: entry, error } = await supabase
    .from("expense_entries")
    .select(
      `
      *,
      expense_categories(name, slug),
      profiles!expense_entries_created_by_fkey(full_name)
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !entry) notFound();

  const category = entry.expense_categories as {
    name: string;
    slug: string | null;
  } | null;

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" asChild>
          <Link href="/dashboard/expenses">Back to Expenses</Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href="/dashboard/expenses/new">Create New Expense</Link>
          </Button>
          <EntryHistoryButton
            entityType="expense_entry"
            entityId={id}
            createdAt={entry.created_at}
            createdByName={
              (entry.profiles as { full_name: string } | null)?.full_name
            }
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{entry.entry_number}</CardTitle>
            <Badge variant="secondary">{category?.name || "—"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <p className="text-muted-foreground">Invoice Number</p>
              <p className="font-medium">
                {entry.vendor_invoice_number || "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Issue Date</p>
              <p className="font-medium">
                {formatIndianDate(entry.issue_date, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            {entry.entry_month && (
              <div>
                <p className="text-muted-foreground">Month</p>
                <p className="font-medium">
                  {new Date(`${entry.entry_month}-01`).toLocaleDateString(
                    "en-IN",
                    { month: "long", year: "numeric" },
                  )}
                </p>
              </div>
            )}
            {entry.payment_method && (
              <div>
                <p className="text-muted-foreground">Payment Mode</p>
                <p className="font-medium capitalize">
                  {entry.payment_method.replace("_", " ")}
                </p>
              </div>
            )}
            {entry.reference_number && (
              <div>
                <p className="text-muted-foreground">Reference Number</p>
                <p className="font-medium">{entry.reference_number}</p>
              </div>
            )}
            {entry.description && entry.description !== category?.name && (
              <div className="sm:col-span-2">
                <p className="text-muted-foreground">Description</p>
                <p className="font-medium">{entry.description}</p>
              </div>
            )}
          </div>

          <div className="border-t pt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Units</span>
              <span>{Number(entry.units).toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span>Per Unit Cost</span>
              <span>₹{Number(entry.unit_cost).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>₹{Number(entry.subtotal_amount).toFixed(2)}</span>
            </div>
            {Number(entry.discount_amount) > 0 && (
              <div className="flex justify-between text-green-700">
                <span>
                  Discount
                  {entry.discount_type === "percent"
                    ? ` (${Number(entry.discount_value)}%)`
                    : ""}
                </span>
                <span>-₹{Number(entry.discount_amount).toFixed(2)}</span>
              </div>
            )}
            {Number(entry.gst_amount) > 0 && (
              <div className="flex justify-between">
                <span>GST</span>
                <span>₹{Number(entry.gst_amount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-base pt-2 border-t">
              <span>Total Amount</span>
              <span>₹{Number(entry.total_amount).toFixed(2)}</span>
            </div>
          </div>

          {entry.notes && (
            <div className="border-t pt-4">
              <p className="text-muted-foreground text-sm">Notes</p>
              <p className="text-sm mt-1">{entry.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
