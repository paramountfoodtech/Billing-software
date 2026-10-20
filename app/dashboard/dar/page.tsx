import { createClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/supabase/fetch-all";
import { redirect } from "next/navigation";
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper";
import {
  DarTab,
  type DarExpenseRow,
  type DarPurchaseRow,
  type DarSaleRow,
} from "@/components/dar-tab";
import { isLegacySalaryExpenseEntry } from "@/lib/expense-salary-report";
import { getIndianToday } from "@/lib/date-time";
import {
  buildMortalityRows,
  MORTALITY_CHALLAN_COLUMNS,
  MORTALITY_INVOICE_COLUMNS,
  type MortalityChallanInput,
} from "@/lib/mortality-report";

// Prevent caching to ensure fresh data on every request
export const revalidate = 0;

const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

export default async function DailyActivityReportPage({
  searchParams,
}: {
  searchParams: Promise<{ darDate?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();

  const organizationId = profile?.organization_id ?? null;
  const darDate = /^\d{4}-\d{2}-\d{2}$/.test(params.darDate ?? "")
    ? (params.darDate as string)
    : getIndianToday();

  const [darInvoices, darPurchases, darExpenses, linkedExpenseIds, leftoverResult] =
    await Promise.all([
      fetchAllPages(async (from, to) => {
        const { data, error } = await supabase
          .from("invoices")
          .select(
            "id, invoice_number, total_amount, status, clients(name), invoice_items(quantity)",
          )
          .eq("issue_date", darDate)
          .neq("status", "cancelled")
          .order("created_at", { ascending: true })
          .range(from, to);
        return { data, error };
      }),
      fetchAllPages(async (from, to) => {
        const { data, error } = await supabase
          .from("purchase_invoices")
          .select(MORTALITY_INVOICE_COLUMNS)
          .or("invoice_type.eq.challan,invoice_type.is.null")
          .eq("issue_date", darDate)
          .neq("status", "cancelled")
          .order("created_at", { ascending: true })
          .range(from, to);
        return { data, error };
      }),
      fetchAllPages(async (from, to) => {
        let query = supabase
          .from("expense_entries")
          .select(
            "id, entry_number, total_amount, status, notes, description, expense_categories(name, slug)",
          )
          .eq("issue_date", darDate)
          .neq("status", "cancelled")
          .order("id", { ascending: true })
          .range(from, to);
        if (organizationId) query = query.eq("organization_id", organizationId);
        const { data, error } = await query;
        return { data, error };
      }),
      organizationId
        ? fetchAllPages<{ expense_entry_id: string }>(async (from, to) => {
            const { data, error } = await supabase
              .from("hr_salary")
              .select("expense_entry_id")
              .eq("organization_id", organizationId)
              .not("expense_entry_id", "is", null)
              .order("id", { ascending: true })
              .range(from, to);
            return { data, error };
          })
        : Promise.resolve([] as { expense_entry_id: string }[]),
      organizationId
        ? supabase
            .from("dar_stock_leftover")
            .select("leftover_birds, leftover_weight_kg, remarks")
            .eq("organization_id", organizationId)
            .eq("entry_date", darDate)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  // Mortality & loss (same rules as Purchase Reports): the day's challans, plus
  // challans linked to the day's invoices so challan numbers resolve.
  const dayInvoiceIds = darPurchases.map((p) => p.id);
  const dayChallanIds = darPurchases
    .map((p) => p.challan_id)
    .filter((id): id is string => Boolean(id));
  const challanFilters = [`challan_date.eq.${darDate}`];
  if (dayInvoiceIds.length > 0) {
    challanFilters.push(`purchase_invoice_id.in.(${dayInvoiceIds.join(",")})`);
  }
  if (dayChallanIds.length > 0) {
    challanFilters.push(`id.in.(${dayChallanIds.join(",")})`);
  }
  const { data: darChallans } = await supabase
    .from("challans")
    .select(MORTALITY_CHALLAN_COLUMNS)
    .or(challanFilters.join(","));
  const mortality = buildMortalityRows({
    invoices: darPurchases,
    challans: (darChallans ?? []) as MortalityChallanInput[],
  });

  const linkedExpenseEntryIds = new Set(
    linkedExpenseIds.map((row) => row.expense_entry_id),
  );

  const sales: DarSaleRow[] = darInvoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoice_number,
    client:
      one(inv.clients as { name: string } | { name: string }[] | null)?.name ?? "—",
    weightKg: (
      (inv.invoice_items as Array<{ quantity: string | number | null }> | null) ?? []
    ).reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    amount: Number(inv.total_amount || 0),
  }));

  const purchases: DarPurchaseRow[] = darPurchases.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoice_number,
    purchaser:
      one(inv.purchasers as { name: string } | { name: string }[] | null)?.name ?? "—",
    weightKg: Number(inv.total_weight_kg || 0),
    pricePerKg: Number(inv.price_per_kg || 0),
    amount: Number(inv.total_amount || 0),
  }));

  const expenses: DarExpenseRow[] = darExpenses
    .filter((e) => !isLegacySalaryExpenseEntry(e, linkedExpenseEntryIds))
    .map((e) => ({
      id: e.id,
      entryNumber: e.entry_number ?? "—",
      category:
        one(e.expense_categories as { name: string } | { name: string }[] | null)
          ?.name ?? "—",
      description: e.description ?? "",
      amount: Number(e.total_amount || 0),
    }));

  const leftover = leftoverResult.data;

  // Super Admin edits any day; Admin and Accountant only today's entry
  // (mirrors the dar_stock_leftover RLS policies).
  const role = profile?.role;
  const canEditLeftover =
    role === "super_admin" ||
    ((role === "admin" || role === "accountant") && darDate === getIndianToday());

  return (
    <DashboardPageWrapper title="Daily Activity Report">
      <div className="bi w-full p-4 sm:p-6 lg:p-8">
        <DarTab
          key={darDate}
          date={darDate}
          organizationId={organizationId}
          userId={user.id}
          canEditLeftover={canEditLeftover}
          sales={sales}
          purchases={purchases}
          expenses={expenses}
          mortality={mortality}
          stockLeftover={
            leftover
              ? {
                  leftoverBirds: Number(leftover.leftover_birds || 0),
                  leftoverWeightKg: Number(leftover.leftover_weight_kg || 0),
                  remarks: leftover.remarks ?? "",
                }
              : null
          }
        />
      </div>
    </DashboardPageWrapper>
  );
}
