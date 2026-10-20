import type { CSSProperties } from "react";
import { CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FyMonthlyRow } from "@/lib/dashboard-monthly";
import { BiPanel } from "@/components/bi-ui";
import { getIndianCurrentMonth } from "@/lib/date-time";

function formatINR(amount: number) {
  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type ColKey = "sale" | "purchase" | "expenses" | "gross" | "net";

/** Colors match the KPI cards so the table reads as the same story. */
const COLUMNS: Array<{ key: ColKey; label: string; color: string }> = [
  { key: "purchase", label: "Purchase", color: "var(--bi-orange)" },
  { key: "sale", label: "Sale", color: "var(--bi-blue)" },
  { key: "expenses", label: "Expenses", color: "var(--bi-pink)" },
  { key: "gross", label: "Gross", color: "var(--bi-indigo)" },
  { key: "net", label: "Net", color: "var(--bi-green)" },
];

/**
 * Month-wise Purchase / Sale / Expenses / Gross / Net for a financial year.
 * Shows ~6 months at a time; the remaining months scroll. Header and FY total
 * stay pinned. Uses a plain <table> because the shared Table wrapper adds its
 * own overflow container, which breaks sticky positioning.
 */
export function FyMonthlyTable({
  fy,
  rows,
  total,
}: {
  fy: string;
  rows: FyMonthlyRow[];
  total: FyMonthlyRow;
}) {
  const currentMonth = getIndianCurrentMonth();

  return (
    <BiPanel
      flush
      index={6}
      icon={<CalendarRange />}
      accent="var(--bi-indigo)"
      title={`Month by month · FY ${fy}`}
      subtitle="Gross = Sale − Purchase · Net = Gross − Expenses"
    >
      <div className="mt-3 max-h-[24rem] overflow-auto">
        <table className="bi-table bi-table-pin-first min-w-[680px]">
          <thead>
            <tr>
              <th>Month</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="num">
                  <span
                    className="bi-dot"
                    style={{ "--accent": c.color } as CSSProperties}
                    aria-hidden
                  />
                  {c.label} (₹)
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.monthKey}
                aria-current={row.monthKey === currentMonth ? "date" : undefined}
                data-muted={row.monthKey > currentMonth ? "true" : undefined}
              >
                <td className="font-medium">
                  <span className="inline-flex items-center gap-2">
                    {row.label}
                    {row.monthKey === currentMonth && (
                      <span className="bi-pill" data-tone="info">
                        Now
                      </span>
                    )}
                  </span>
                </td>
                {COLUMNS.map((c) => {
                  const value = row[c.key];
                  return (
                    <td
                      key={c.key}
                      className={cn(
                        "num",
                        c.key === "net" && "font-semibold",
                        c.key === "net" && value > 0 && "text-[var(--bi-good)]",
                        value < 0 && "text-[var(--bi-crit)]",
                      )}
                    >
                      {formatINR(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>{total.label}</td>
              {COLUMNS.map((c) => (
                <td
                  key={c.key}
                  className={cn("num", total[c.key] < 0 && "text-[var(--bi-crit)]")}
                >
                  {formatINR(total[c.key])}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </BiPanel>
  );
}
