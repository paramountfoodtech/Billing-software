import { createClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/supabase/fetch-all";
import { redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  ShoppingCart,
  Receipt,
  Scale,
  Wallet,
  Users,
  Inbox,
  FileText,
  ArrowDownLeft,
} from "lucide-react";
import { DashboardCharts } from "@/components/dashboard-charts";
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper";
import { DashboardRefresh } from "@/components/dashboard-refresh";
import { DashboardMonthlyHeader } from "@/components/dashboard-monthly-header";
import { Suspense } from "react";
import { PageLoadingFallback } from "@/components/page-loading-fallback";
import { MaterialDashboardWidgets } from "@/components/material-dashboard-widgets";
import { BiAvatar, BiEmpty, BiIcon, BiKpi, BiPanel } from "@/components/bi-ui";
import { formatIndianDate, getIndianCurrentMonth } from "@/lib/date-time";
import {
  buildExpenseAmountsForKpi,
  dedupeExpenseEntriesById,
  resolveReportMonthYear,
} from "@/lib/expense-report-aggregation";
import { buildFyMonthlyRows } from "@/lib/dashboard-monthly";
import { FyMonthlyTable } from "@/components/fy-monthly-table";

// Prevent caching to ensure fresh data on every request
export const revalidate = 0;

function formatINR(amount: number) {
  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const inrAmount = (amount: number | string) => `₹${formatINR(Number(amount))}`;

const shortDate = (value: string) =>
  formatIndianDate(value, { day: "2-digit", month: "short", year: "numeric" });

const statusLabel = (status: string | null | undefined) =>
  (status ?? "—").replace(/_/g, " ");


function getCurrentFinancialYearRange() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-indexed
  const startYear = month < 3 ? year - 1 : year;
  const endYear = startYear + 1;
  return {
    start: `${startYear}-04-01`,
    end: `${endYear}-03-31`,
    fy: `${startYear}-${endYear}`,
  };
}

function computeFinancialKpis(input: {
  invoices: Array<{ total_amount: string | number; status: string }>;
  purchases: Array<{ total_amount: string | number; status: string }>;
  expenses: Array<{ total_amount: string | number }>;
}) {
  const activeSales = input.invoices.filter((inv) => inv.status !== "cancelled");
  const activePurchases = input.purchases.filter(
    (inv) => inv.status !== "cancelled",
  );
  const totalSale = activeSales.reduce(
    (sum, inv) => sum + Number(inv.total_amount),
    0,
  );
  const totalPurchase = activePurchases.reduce(
    (sum, inv) => sum + Number(inv.total_amount),
    0,
  );
  const totalExpenses = input.expenses.reduce(
    (sum, entry) => sum + Number(entry.total_amount),
    0,
  );
  const grossAmount = totalSale - totalPurchase;
  const netAmount = grossAmount - totalExpenses;

  return {
    activeSalesCount: activeSales.length,
    totalSale,
    totalPurchase,
    totalExpenses,
    grossAmount,
    netAmount,
  };
}

function FinancialKpiCards({
  kpis,
  periodHint,
  trends,
  trendLabel,
  layout = "row",
  indexOffset = 0,
}: {
  kpis: ReturnType<typeof computeFinancialKpis>;
  periodHint: string;
  /** Optional month-by-month series (FY view) drawn as sparklines. */
  trends?: {
    sale: number[];
    purchase: number[];
    expenses: number[];
    gross: number[];
    net: number[];
  };
  /** Caption for the sparkline period, e.g. "Apr – Oct 2026". */
  trendLabel?: string;
  /** "bento": tall Net hero beside a 2×2 grid; "row": five across. */
  layout?: "bento" | "row";
  indexOffset?: number;
}) {
  const fmt = (n: number) => `₹${formatINR(n)}`;
  const bento = layout === "bento";

  // Sequence everywhere: Purchase → Sale → Expenses → Gross → Net.
  return (
    <div
      className={
        bento
          ? "bi-bento grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.3fr]"
          : "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5"
      }
    >
      <BiKpi
        index={indexOffset}
        label="Total Purchase"
        icon={<ShoppingCart />}
        display={fmt(kpis.totalPurchase)}
        accent="var(--bi-orange)"
        trend={trends?.purchase}
        sparkHeight={bento ? 28 : undefined}
        hint={`Purchase challan purchases ${periodHint}`}
      />
      <BiKpi
        index={indexOffset + 1}
        label="Total Sale"
        icon={<TrendingUp />}
        display={fmt(kpis.totalSale)}
        accent="var(--bi-blue)"
        trend={trends?.sale}
        sparkHeight={bento ? 28 : undefined}
        hint={`${kpis.activeSalesCount} sales invoices ${periodHint}`}
      />
      <BiKpi
        index={indexOffset + 2}
        label="Total Expenses"
        icon={<Receipt />}
        display={fmt(kpis.totalExpenses)}
        accent="var(--bi-pink)"
        trend={trends?.expenses}
        sparkHeight={bento ? 28 : undefined}
        hint={`Expense entries ${periodHint}`}
      />
      <BiKpi
        index={indexOffset + 3}
        label="Gross Amount"
        icon={<Scale />}
        display={fmt(kpis.grossAmount)}
        accent="var(--bi-indigo)"
        negative={kpis.grossAmount < 0}
        trend={trends?.gross}
        sparkHeight={bento ? 28 : undefined}
        hint="Sale − Purchase"
      />
      {/* Net closes the sequence; in the bento it is the tall tile on the right. */}
      <BiKpi
        variant="hero"
        size={bento ? "lg" : undefined}
        index={indexOffset + 4}
        className={
          bento
            ? "sm:col-span-2 xl:col-span-1 xl:col-start-3 xl:row-start-1 xl:row-span-2"
            : "sm:col-span-2 lg:col-span-1"
        }
        label="Net Amount"
        icon={<Wallet />}
        display={fmt(kpis.netAmount)}
        accent="var(--bi-green)"
        negative={kpis.netAmount < 0}
        trend={trends?.net}
        trendLabel={trendLabel}
        sparkHeight={bento ? 72 : undefined}
        hint="Gross − Expenses"
      />
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
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

  if (profile?.role === "accountant") redirect("/dashboard/prices");

  const fyRange = getCurrentFinancialYearRange();
  const {
    reportYear,
    reportMonth,
    reportMonthKey: monthKey,
    monthStart,
    monthEnd,
    monthLabel,
  } = resolveReportMonthYear(params);
  const fyStartMonth = fyRange.start.slice(0, 7);
  const fyEndMonth = fyRange.end.slice(0, 7);

  const expenseEntrySelect =
    "id, total_amount, status, entry_month, issue_date, notes, description, expense_categories(slug)";

  const [
    fyInvoices,
    fyPayments,
    fyPurchaseInvoices,
    fyExpensesByMonth,
    fyExpensesLegacy,
    monthInvoices,
    monthPurchaseInvoices,
    monthExpensesByMonth,
    monthExpensesLegacy,
    paidSalaries,
    linkedExpenseIds,
  ] = await Promise.all([
    fetchAllPages(async (from, to) => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, clients(name)")
        .gte("issue_date", fyRange.start)
        .lte("issue_date", fyRange.end)
        .order("created_at", { ascending: false })
        .range(from, to);
      return { data, error };
    }),
    fetchAllPages(async (from, to) => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .gte("payment_date", fyRange.start)
        .lte("payment_date", fyRange.end)
        .order("payment_date", { ascending: false })
        .range(from, to);
      return { data, error };
    }),
    fetchAllPages(async (from, to) => {
      const { data, error } = await supabase
        .from("purchase_invoices")
        .select("total_amount, status, invoice_type, issue_date")
        .or("invoice_type.eq.challan,invoice_type.is.null")
        .gte("issue_date", fyRange.start)
        .lte("issue_date", fyRange.end)
        .order("issue_date", { ascending: true })
        .range(from, to);
      return { data, error };
    }),
    fetchAllPages(async (from, to) => {
      let query = supabase
        .from("expense_entries")
        .select(expenseEntrySelect)
        .gte("entry_month", fyStartMonth)
        .lte("entry_month", fyEndMonth)
        .neq("status", "cancelled")
        .order("id", { ascending: true })
        .range(from, to);
      if (profile?.organization_id) {
        query = query.eq("organization_id", profile.organization_id);
      }
      const { data, error } = await query;
      return { data, error };
    }),
    fetchAllPages(async (from, to) => {
      let query = supabase
        .from("expense_entries")
        .select(expenseEntrySelect)
        .is("entry_month", null)
        .gte("issue_date", fyRange.start)
        .lte("issue_date", fyRange.end)
        .neq("status", "cancelled")
        .order("id", { ascending: true })
        .range(from, to);
      if (profile?.organization_id) {
        query = query.eq("organization_id", profile.organization_id);
      }
      const { data, error } = await query;
      return { data, error };
    }),
    fetchAllPages(async (from, to) => {
      const { data, error } = await supabase
        .from("invoices")
        .select("total_amount, status")
        .gte("issue_date", monthStart)
        .lte("issue_date", monthEnd)
        .order("issue_date", { ascending: true })
        .range(from, to);
      return { data, error };
    }),
    fetchAllPages(async (from, to) => {
      const { data, error } = await supabase
        .from("purchase_invoices")
        .select("total_amount, status, invoice_type")
        .or("invoice_type.eq.challan,invoice_type.is.null")
        .gte("issue_date", monthStart)
        .lte("issue_date", monthEnd)
        .order("issue_date", { ascending: true })
        .range(from, to);
      return { data, error };
    }),
    fetchAllPages(async (from, to) => {
      let query = supabase
        .from("expense_entries")
        .select(expenseEntrySelect)
        .eq("entry_month", monthKey)
        .neq("status", "cancelled")
        .order("id", { ascending: true })
        .range(from, to);
      if (profile?.organization_id) {
        query = query.eq("organization_id", profile.organization_id);
      }
      const { data, error } = await query;
      return { data, error };
    }),
    fetchAllPages(async (from, to) => {
      let query = supabase
        .from("expense_entries")
        .select(expenseEntrySelect)
        .is("entry_month", null)
        .gte("issue_date", monthStart)
        .lte("issue_date", monthEnd)
        .neq("status", "cancelled")
        .order("id", { ascending: true })
        .range(from, to);
      if (profile?.organization_id) {
        query = query.eq("organization_id", profile.organization_id);
      }
      const { data, error } = await query;
      return { data, error };
    }),
    profile?.organization_id
      ? fetchAllPages<{ net_payable: string | number; salary_month: string }>(
          async (from, to) => {
            const { data, error } = await supabase
              .from("hr_salary")
              .select("net_payable, salary_month")
              .eq("organization_id", profile.organization_id)
              .eq("payment_status", "paid")
              .gte("salary_month", fyStartMonth)
              .lte("salary_month", fyEndMonth)
              .order("id", { ascending: true })
              .range(from, to);
            return { data, error };
          },
        )
      : Promise.resolve(
          [] as { net_payable: string | number; salary_month: string }[],
        ),
    profile?.organization_id
      ? fetchAllPages<{ expense_entry_id: string }>(async (from, to) => {
          const { data, error } = await supabase
            .from("hr_salary")
            .select("expense_entry_id")
            .eq("organization_id", profile.organization_id)
            .not("expense_entry_id", "is", null)
            .order("id", { ascending: true })
            .range(from, to);
          return { data, error };
        })
      : Promise.resolve([] as { expense_entry_id: string }[]),
  ]);

  const linkedExpenseEntryIds = new Set(
    linkedExpenseIds.map((row) => row.expense_entry_id),
  );
  const fyExpenseEntries = dedupeExpenseEntriesById([
    ...fyExpensesByMonth,
    ...fyExpensesLegacy,
  ]);
  const monthExpenseEntries = dedupeExpenseEntriesById([
    ...monthExpensesByMonth,
    ...monthExpensesLegacy,
  ]);
  const monthPaidSalaries = paidSalaries.filter(
    (row) => row.salary_month === monthKey,
  );

  const fyExpensesForKpi = buildExpenseAmountsForKpi(
    fyExpenseEntries,
    paidSalaries,
    linkedExpenseEntryIds,
  );
  const monthExpensesForKpi = buildExpenseAmountsForKpi(
    monthExpenseEntries,
    monthPaidSalaries,
    linkedExpenseEntryIds,
  );

  const fyKpis = computeFinancialKpis({
    invoices: fyInvoices,
    purchases: fyPurchaseInvoices,
    expenses: fyExpensesForKpi,
  });
  const monthKpis = computeFinancialKpis({
    invoices: monthInvoices,
    purchases: monthPurchaseInvoices,
    expenses: monthExpensesForKpi,
  });

  // Top clients by revenue
  const clientRevenue = fyInvoices.reduce(
    (acc, invoice) => {
      const clientName = (invoice.clients as { name: string } | null)?.name ?? "Unknown";
      if (!acc[clientName])
        acc[clientName] = { total: 0, paid: 0, outstanding: 0, invoiceCount: 0 };
      acc[clientName].total += Number(invoice.total_amount);
      acc[clientName].paid += Number(invoice.amount_paid);
      acc[clientName].outstanding +=
        Number(invoice.total_amount) - Number(invoice.amount_paid);
      acc[clientName].invoiceCount += 1;
      return acc;
    },
    {} as Record<
      string,
      { total: number; paid: number; outstanding: number; invoiceCount: number }
    >,
  );

  type ClientRevenueData = { total: number; paid: number; outstanding: number; invoiceCount: number };
  const topClients = (Object.entries(clientRevenue) as [string, ClientRevenueData][])
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 10);

  // Recent activity
  const recentInvoices = fyInvoices.slice(0, 10);
  const recentPayments = fyPayments.slice(0, 10);

  // FY month-wise Purchase / Sale / Expenses / Gross / Net
  const fyMonthly = buildFyMonthlyRows({
    fy: fyRange.fy,
    invoices: fyInvoices,
    purchases: fyPurchaseInvoices,
    expenses: fyExpensesForKpi,
  });

  // Shape data for DashboardCharts
  const chartsInvoices = fyInvoices.map((inv) => ({
    id: inv.id,
    issue_date: inv.issue_date,
    due_date: inv.due_date,
    total_amount: inv.total_amount,
    amount_paid: inv.amount_paid,
    status: inv.status,
  }));

  // Sparklines run through the current month only (future months are empty).
  const trendRows = fyMonthly.rows.filter(
    (r) => r.monthKey <= getIndianCurrentMonth(),
  );
  const fyTrends = {
    sale: trendRows.map((r) => r.sale),
    purchase: trendRows.map((r) => r.purchase),
    expenses: trendRows.map((r) => r.expenses),
    gross: trendRows.map((r) => r.gross),
    net: trendRows.map((r) => r.net),
  };
  // Revenue trend: invoiced (sale) amount per FY month, through this month.
  const monthlyInvoiced = trendRows.map((r) => {
    const [mon, yr] = r.label.split(" ");
    return { month: `${mon} ${yr.slice(2)}`, amount: r.sale };
  });
  const firstTrend = trendRows[0]?.label;
  const lastTrend = trendRows[trendRows.length - 1]?.label;
  const fyTrendLabel =
    firstTrend && lastTrend && firstTrend !== lastTrend
      ? firstTrend.split(" ")[1] === lastTrend.split(" ")[1]
        ? `${firstTrend.split(" ")[0]} – ${lastTrend}`
        : `${firstTrend} – ${lastTrend}`
      : undefined;


  return (
    <DashboardPageWrapper title="Dashboard Overview">
      <div className="bi w-full p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Header row */}
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="bi-hero-title">
              Financial Year{" "}
              {fyRange.fy.replace("-", "–")}
            </p>
            <p className="bi-hero-sub">
              {formatIndianDate(fyRange.start, { day: "numeric", month: "short", year: "numeric" })}
              {" – "}
              {formatIndianDate(fyRange.end, { day: "numeric", month: "short", year: "numeric" })}
              <span aria-hidden> · </span>
              Monthly view: <strong>{monthLabel}</strong>
            </p>
          </div>
          <DashboardRefresh />
        </header>

        {/* FY Financial summary: Purchase, Sale, Expenses, Gross, Net */}
        <section>
          <h2 className="bi-eyebrow">Financial year</h2>
          <FinancialKpiCards
            layout="bento"
            kpis={fyKpis}
            periodHint="this FY"
            trends={fyTrends}
            trendLabel={fyTrendLabel}
          />
        </section>

        {/* Monthly Financial summary */}
        <section>
          <DashboardMonthlyHeader
            reportYear={reportYear}
            reportMonth={reportMonth}
            monthLabel={monthLabel}
          />
          <FinancialKpiCards
            kpis={monthKpis}
            periodHint={`in ${monthLabel}`}
            indexOffset={5}
          />
        </section>

        {/* FY month-wise table */}
        <FyMonthlyTable fy={fyRange.fy} rows={fyMonthly.rows} total={fyMonthly.total} />

        {/* Charts: revenue / status / daily charts */}
        <DashboardCharts invoices={chartsInvoices} monthlyInvoiced={monthlyInvoiced} />

        {/* Tabs: Top Clients | Recent Activity */}
        <Tabs defaultValue="top-clients" className="space-y-5">
          <TabsList className="bi-tabs-list">
            <TabsTrigger className="bi-tabs-trigger" value="top-clients">
              Top Clients
            </TabsTrigger>
            <TabsTrigger className="bi-tabs-trigger" value="activity">
              Recent Activity
            </TabsTrigger>
          </TabsList>

          {/* Top Clients tab */}
          <TabsContent value="top-clients" className="space-y-5">
            <BiPanel
              icon={<Users />}
              accent="var(--bi-orange)"
              title="Top 10 Clients by Revenue"
              subtitle={`Financial year ${fyRange.fy}`}
              flush={topClients.length > 0}
            >
              {topClients.length === 0 ? (
                <BiEmpty icon={<Users />}>No client data available</BiEmpty>
              ) : (
                <div className="overflow-x-auto">
                  <table className="bi-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Client Name</th>
                        <th className="num">Total Invoiced</th>
                        <th className="num">Amount Paid</th>
                        <th className="num">Outstanding</th>
                        <th className="num">Invoices</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topClients.map(([clientName, data], i) => (
                        <tr key={clientName}>
                          <td className="text-[var(--bi-ink-3)] tabular-nums">
                            {i + 1}
                          </td>
                          <td className="font-medium">
                            <span className="flex items-center gap-3">
                              <BiAvatar name={clientName} />
                              {clientName}
                            </span>
                          </td>
                          <td className="num font-medium">
                            {inrAmount(data.total)}
                          </td>
                          <td className="num text-[var(--bi-ink-2)]">
                            {inrAmount(data.paid)}
                          </td>
                          <td
                            className={
                              data.outstanding > 0
                                ? "num"
                                : "num text-[var(--bi-ink-3)]"
                            }
                          >
                            {inrAmount(data.outstanding)}
                          </td>
                          <td className="num">{data.invoiceCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </BiPanel>
          </TabsContent>

          {/* Recent Activity tab */}
          <TabsContent value="activity" className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <BiPanel
                title="Recent Invoices"
                icon={<FileText />}
                accent="var(--bi-blue)"
                flush={recentInvoices.length > 0}
                bodyClassName={recentInvoices.length > 0 ? "pt-2 pb-2" : undefined}
              >
                {recentInvoices.length === 0 ? (
                  <BiEmpty icon={<Inbox />}>No invoices yet</BiEmpty>
                ) : (
                  <ul className="divide-y divide-[var(--bi-line)]">
                    {recentInvoices.map((invoice) => (
                      <li key={invoice.id} className="bi-row">
                        <div className="flex min-w-0 items-center gap-3">
                          <BiAvatar
                            name={(invoice.clients as { name: string } | null)?.name ?? "—"}
                          />
                          <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {invoice.invoice_number}
                          </p>
                          <p className="text-xs text-[var(--bi-ink-3)] truncate">
                            {(invoice.clients as { name: string } | null)?.name ?? "—"}
                          </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-semibold tabular-nums">
                            {inrAmount(invoice.total_amount)}
                          </span>
                          <span
                            className="bi-pill"
                            data-tone={
                              invoice.status === "paid"
                                ? "good"
                                : invoice.status === "overdue"
                                  ? "crit"
                                  : "info"
                            }
                          >
                            {statusLabel(invoice.status)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </BiPanel>

              <BiPanel
                title="Recent Payments"
                icon={<ArrowDownLeft />}
                accent="var(--bi-green)"
                flush={recentPayments.length > 0}
                bodyClassName={recentPayments.length > 0 ? "pt-2 pb-2" : undefined}
              >
                {recentPayments.length === 0 ? (
                  <BiEmpty icon={<Inbox />}>No payments yet</BiEmpty>
                ) : (
                  <ul className="divide-y divide-[var(--bi-line)]">
                    {recentPayments.map((payment) => (
                      <li key={payment.id} className="bi-row">
                        <div className="flex min-w-0 items-center gap-3">
                          <BiIcon accent="var(--bi-green)" round>
                            <ArrowDownLeft />
                          </BiIcon>
                          <div className="min-w-0">
                          <p className="text-sm font-medium capitalize truncate">
                            {payment.payment_method?.replace("_", " ") ?? "—"}
                          </p>
                          <p className="text-xs text-[var(--bi-ink-3)]">
                            {shortDate(payment.payment_date)}
                          </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-semibold tabular-nums text-[var(--bi-good)]">
                            {inrAmount(payment.amount)}
                          </span>
                          <span
                            className="bi-pill"
                            data-tone={
                              payment.status === "completed"
                                ? "good"
                                : payment.status === "failed"
                                  ? "crit"
                                  : "warn"
                            }
                          >
                            {statusLabel(payment.status)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </BiPanel>
            </div>
          </TabsContent>
        </Tabs>

        <Suspense fallback={<PageLoadingFallback scope="content" variant="kpi-section" />}>
          <MaterialDashboardWidgets />
        </Suspense>
      </div>
    </DashboardPageWrapper>
  );
}
