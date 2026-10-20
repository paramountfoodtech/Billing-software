"use client";

import {
  Line,
  Area,
  ComposedChart,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useEffect, useState, type ReactNode } from "react";
import { ChartColumn, ChartLine } from "lucide-react";
import { BiEmpty, BiPanel } from "@/components/bi-ui";
import { formatIndianDate } from "@/lib/date-time";

const BLUE = "var(--bi-accent)";

const inr = (v: number | string) =>
  `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const compactInr = (v: number) =>
  `₹${new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(v)}`;

/** True when the OS asks for reduced motion; chart entry animations are skipped. */
function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduce(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduce;
}

/** Gradient fills (url(#…)) can't paint an HTML swatch; fall back to the accent. */
const swatch = (color?: string) =>
  !color || color.startsWith("url(") ? BLUE : color;

/** Hairline tooltip: value leads, label follows, line-key swatch. */
function BiTooltip({
  active,
  payload,
  label,
  format,
  seriesLabel,
}: {
  active?: boolean;
  payload?: Array<{
    value?: number | string;
    color?: string;
    name?: string;
    payload?: { color?: string };
  }>;
  label?: string;
  format: (v: number | string) => string;
  seriesLabel?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--bi-surface)",
        borderRadius: 12,
        boxShadow: "0 0 0 1px var(--bi-ring), 0 10px 30px -10px rgba(0,0,0,0.25)",
        padding: "10px 12px",
        fontSize: 12,
        minWidth: 132,
      }}
    >
      {label && (
        <div style={{ color: "var(--bi-ink-3)", marginBottom: 4 }}>{label}</div>
      )}
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: swatch(p.payload?.color || p.color),
            }}
          />
          <strong
            style={{
              color: "var(--bi-ink)",
              fontSize: 13,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {format(p.value ?? 0)}
          </strong>
          <span style={{ color: "var(--bi-ink-2)" }}>
            {seriesLabel ?? p.name}
          </span>
        </div>
      ))}
    </div>
  );
}

function PanelStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bi-stat">
      <div className="bi-stat-label">{label}</div>
      <div className="bi-stat-value">{value}</div>
    </div>
  );
}

const empty = (icon: ReactNode, text: string) => (
  <BiEmpty icon={icon} className="h-[280px]">
    {text}
  </BiEmpty>
);

interface DashboardChartsProps {
  invoices: Array<{
    id: string;
    issue_date: string;
    due_date: string;
    total_amount: string;
    amount_paid: string;
    status: string;
  }>;
  /** Invoiced (sale) amount per FY month through the current month. */
  monthlyInvoiced: Array<{ month: string; amount: number }>;
}

export function DashboardCharts({ invoices, monthlyInvoiced }: DashboardChartsProps) {
  const reduceMotion = usePrefersReducedMotion();

  // Monthly invoiced amount (sales invoices, cancelled excluded) for the FY
  const revenueChartData = monthlyInvoiced.map((m) => ({
    month: m.month,
    revenue: m.amount,
  }));

  // Calculate daily invoices (last 30 days)
  const last30DaysData: Record<string, number> = {};
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split("T")[0];
    last30DaysData[dateKey] = 0;
  }

  invoices.forEach((inv) => {
    const dateKey = inv.issue_date;
    if (last30DaysData.hasOwnProperty(dateKey)) {
      last30DaysData[dateKey] += Number(inv.total_amount);
    }
  });

  const invoicesChartData = Object.entries(last30DaysData).map(
    ([date, amount]) => ({
      date: formatIndianDate(date, {
        month: "short",
        day: "numeric",
      }),
      amount,
    }),
  );

  const revenueTotal = revenueChartData.reduce((sum, d) => sum + d.revenue, 0);
  const invoicedTotal = invoicesChartData.reduce((sum, d) => sum + d.amount, 0);

  return (
    <section>
      <h2 className="bi-eyebrow">Trends</h2>
      <div className="grid gap-4 grid-cols-1">
        {/* Revenue Trend */}
        <BiPanel
          index={7}
          icon={<ChartLine />}
          accent="var(--bi-blue)"
          title="Invoice Trend"
          subtitle="Invoiced amount by month · this financial year"
          action={
            revenueChartData.some((d) => d.revenue > 0) ? (
              <PanelStat label="FY total" value={inr(revenueTotal)} />
            ) : undefined
          }
        >
          {revenueChartData.some((d) => d.revenue > 0) ? (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart
                data={revenueChartData}
                margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="bi-rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BLUE} stopOpacity={0.14} />
                    <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={{ stroke: "var(--bi-axis)" }}
                  tickMargin={10}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={(v) => compactInr(Number(v))}
                />
                <Tooltip
                  cursor={{ stroke: "var(--bi-axis)", strokeWidth: 1, strokeDasharray: "3 3" }}
                  animationDuration={150}
                  content={<BiTooltip format={inr} seriesLabel="Invoiced" />}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="none"
                  fill="url(#bi-rev)"
                  tooltipType="none"
                  activeDot={false}
                  isAnimationActive={!reduceMotion}
                  animationDuration={900}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke={BLUE}
                  strokeWidth={2}
                  strokeLinecap="round"
                  isAnimationActive={!reduceMotion}
                  animationDuration={900}
                  dot={false}
                  activeDot={{ r: 6, fill: BLUE, stroke: "var(--bi-surface)", strokeWidth: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            empty(<ChartLine />, "No invoices this financial year")
          )}
        </BiPanel>

        {/* Daily Invoices (Last 30 Days) */}
        <BiPanel
          index={9}
          icon={<ChartColumn />}
          accent="var(--bi-cyan)"
          title="Invoice Amount (Last 30 Days)"
          subtitle="Daily invoice totals"
          action={
            invoicedTotal > 0 ? (
              <PanelStat label="30-day total" value={inr(invoicedTotal)} />
            ) : undefined
          }
        >
          {invoicesChartData.some((item) => item.amount > 0) ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={invoicesChartData}
                margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={{ stroke: "var(--bi-axis)" }}
                  tickMargin={10}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={(v) => compactInr(Number(v))}
                />
                <Tooltip
                  cursor={{ fill: "var(--bi-hover)" }}
                  animationDuration={150}
                  content={<BiTooltip format={inr} seriesLabel="Invoiced" />}
                />
                <Bar
                  dataKey="amount"
                  fill={BLUE}
                  activeBar={{ fill: "var(--bi-indigo)" }}
                  radius={[6, 6, 2, 2]}
                  maxBarSize={22}
                  isAnimationActive={!reduceMotion}
                  animationDuration={600}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            empty(<ChartColumn />, "No invoices in the last 30 days")
          )}
        </BiPanel>
      </div>
    </section>
  );
}
