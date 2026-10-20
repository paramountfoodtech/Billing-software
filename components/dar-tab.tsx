"use client";

import { Fragment, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Activity,
  Lock,
  Package,
  Receipt,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { formatIndianDate, getIndianToday } from "@/lib/date-time";
import { cn } from "@/lib/utils";
import { BiAvatar, BiEmpty, BiPanel } from "@/components/bi-ui";
import type { MortalityReportRow } from "@/lib/mortality-report";

export type DarSaleRow = {
  id: string;
  invoiceNumber: string;
  client: string;
  weightKg: number;
  amount: number;
};

export type DarPurchaseRow = {
  id: string;
  invoiceNumber: string;
  purchaser: string;
  weightKg: number;
  pricePerKg: number;
  amount: number;
};

export type DarExpenseRow = {
  id: string;
  entryNumber: string;
  category: string;
  description: string;
  amount: number;
};

export type DarStockLeftover = {
  leftoverBirds: number;
  leftoverWeightKg: number;
  remarks: string;
} | null;

interface DarTabProps {
  date: string;
  organizationId: string | null;
  userId: string;
  sales: DarSaleRow[];
  purchases: DarPurchaseRow[];
  expenses: DarExpenseRow[];
  stockLeftover: DarStockLeftover;
  /** Transit mortality & loss rows for the day (same rules as Purchase Reports). */
  mortality: MortalityReportRow[];
  /** Whether this user may save the stock leftover for `date`. */
  canEditLeftover: boolean;
}

function fmtMoney(n: number) {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtKg(n: number) {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  });
}

/** Shift a YYYY-MM-DD date by whole days. */
function shiftDate(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Table that shows VISIBLE_ROWS rows and scrolls for the rest, with sticky header and
 * footer. Plain <table> on purpose: the shared Table wrapper adds its own
 * overflow container, which breaks sticky positioning.
 */
function DarScrollTable({
  columns,
  children,
  footer,
  minWidth = 560,
  className,
}: {
  columns: Array<{ label: string; right?: boolean }>;
  children: React.ReactNode;
  footer?: React.ReactNode;
  minWidth?: number;
  className?: string;
}) {
  return (
    <div className={cn("bi-table-scroll", className)}>
      <table className="bi-table bi-table-compact" style={{ minWidth }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.label} className={c.right ? "num" : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>
    </div>
  );
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="!p-0">
        <BiEmpty icon={<Inbox />}>{text}</BiEmpty>
      </td>
    </tr>
  );
}

/** Avatar + primary name with a muted reference (invoice / entry #) below. */
function PartyCell({
  name,
  reference,
  avatar = true,
  className,
}: {
  name: string;
  reference: string;
  avatar?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-3", className)}>
      {avatar && <BiAvatar name={name} />}
      <span className="min-w-0">
        <span className="block truncate font-medium">{name}</span>
        <span className="block truncate text-xs text-[var(--bi-ink-3)]">
          {reference}
        </span>
      </span>
    </span>
  );
}

/** "−₹7,080.00" rather than "₹-7,080.00". */
const fmtSignedMoney = (n: number) =>
  `${n < 0 ? "−" : ""}₹${fmtMoney(Math.abs(n))}`;

/**
 * One sentence of the day summary, e.g.
 * "Today's Purchase is ₹7,080.00 (59.00 kg from 1 invoice)".
 */
function SummaryLine({
  lead,
  subject,
  tail,
  verb,
  amount,
  value,
  detail,
  color,
  total,
  className,
}: {
  /** "Today's " / "Yesterday's " / "" */
  lead: string;
  subject: string;
  /** "" / " on 11 Oct 2026" */
  tail: string;
  verb: string;
  /** Money amount; ignored for colouring when `value` is given. */
  amount?: number;
  /** Pre-formatted value (e.g. "4.50 kg") used instead of a money amount. */
  value?: string;
  detail: string;
  color: string;
  total?: boolean;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-baseline gap-2.5 border-b border-[var(--bi-line)] py-3.5 text-[15px] leading-snug text-[var(--bi-ink-2)] last:border-b-0",
        className,
      )}
    >
      <span
        className="bi-dot shrink-0 self-center"
        style={{ "--accent": color } as React.CSSProperties}
        aria-hidden
      />
      <span className="min-w-0">
        {lead}
        <span className="font-semibold text-[var(--bi-ink)]">{subject}</span>
        {tail} {verb}{" "}
        <strong
          className={cn(
            "font-bold tabular-nums text-[var(--bi-ink)]",
            amount !== undefined && amount < 0 && "text-[var(--bi-crit)]",
            total && amount !== undefined && amount > 0 && "text-[var(--bi-good)]",
          )}
        >
          {value ?? fmtSignedMoney(amount ?? 0)}
        </strong>
        <span className="text-[var(--bi-ink-3)]"> ({detail})</span>
      </span>
    </p>
  );
}

function PanelTotal({ label, value }: { label: string; value: string }) {
  return (
    <div className="bi-stat">
      <div className="bi-stat-label">{label}</div>
      <div className="bi-stat-value">{value}</div>
    </div>
  );
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** Tables show this many rows; the rest scroll inside the card. */
const VISIBLE_ROWS = 10;
const scrollHint = (n: number) =>
  n > VISIBLE_ROWS ? ` · showing ${VISIBLE_ROWS}, scroll for more` : "";

export function DarTab({
  date,
  organizationId,
  userId,
  sales,
  purchases,
  expenses,
  stockLeftover,
  canEditLeftover,
  mortality,
}: DarTabProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const today = getIndianToday();

  const [birds, setBirds] = useState(String(stockLeftover?.leftoverBirds ?? ""));
  const [weightKg, setWeightKg] = useState(
    String(stockLeftover?.leftoverWeightKg ?? ""),
  );
  const [remarks, setRemarks] = useState(stockLeftover?.remarks ?? "");
  const [saving, setSaving] = useState(false);

  const saleKg = sales.reduce((s, r) => s + r.weightKg, 0);
  const saleValue = sales.reduce((s, r) => s + r.amount, 0);
  const purchaseKg = purchases.reduce((s, r) => s + r.weightKg, 0);
  const purchaseValue = purchases.reduce((s, r) => s + r.amount, 0);
  const expenseTotal = expenses.reduce((s, r) => s + r.amount, 0);
  const mort = mortality.reduce(
    (acc, r) => {
      acc.kg += r.mortality_weight_kg;
      acc.birds += r.mortality_birds;
      acc.deducted += r.deducted_amount;
      acc.loss += r.loss_amount;
      return acc;
    },
    { kg: 0, birds: 0, deducted: 0, loss: 0 },
  );
  const gross = saleValue - purchaseValue;
  const net = gross - expenseTotal;

  const changeDate = (value: string) => {
    if (!value) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("darDate", value);
    router.push(`/dashboard/dar?${params.toString()}`);
  };

  const saveLeftover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditLeftover) return;
    if (!organizationId) {
      toast({
        variant: "destructive",
        title: "Organization not found",
        description: "Cannot save stock leftover without an organization.",
      });
      return;
    }
    const birdsNum = birds.trim() === "" ? 0 : Number(birds);
    const kgNum = weightKg.trim() === "" ? 0 : Number(weightKg);
    if (
      !Number.isInteger(birdsNum) ||
      birdsNum < 0 ||
      !Number.isFinite(kgNum) ||
      kgNum < 0
    ) {
      toast({
        variant: "destructive",
        title: "Invalid values",
        description: "Birds must be a whole number and kgs must be 0 or more.",
      });
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("dar_stock_leftover").upsert(
      {
        organization_id: organizationId,
        entry_date: date,
        leftover_birds: birdsNum,
        leftover_weight_kg: kgNum,
        remarks: remarks.trim() || null,
        created_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,entry_date" },
    );
    setSaving(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Could not save stock leftover",
        description: error.message,
      });
      return;
    }
    toast({
      variant: "success",
      title: "Stock leftover saved",
      description: `Saved for ${date}.`,
    });
    router.refresh();
  };

  const mortalityCard = (
    <BiPanel
      className="order-4 xl:order-none"
      flush
      index={6}
      icon={<Activity />}
      accent="var(--bi-red)"
      title="Mortality & Loss"
      subtitle={`${plural(mortality.length, "record")} · ${fmtKg(mort.kg)} kg · ${plural(mort.birds, "bird")}${scrollHint(mortality.length)}`}
    >
      <DarScrollTable
        minWidth={440}
        columns={[
          { label: "Purchaser · Challan / Inv" },
          { label: "Dead / Gross", right: true },
          { label: "Status" },
          { label: "Impact (₹)", right: true },
        ]}
        footer={
          mortality.length > 0 && (
            <tr>
              <td>Total ({mortality.length})</td>
              <td className="num">{fmtKg(mort.kg)} kg</td>
              <td />
              <td className="num">
                {/* Net impact: deducted (saved) minus company loss */}
                {mort.deducted - mort.loss < 0 ? (
                  <span className="text-[var(--bi-crit)]">
                    −{fmtMoney(mort.loss - mort.deducted)}
                  </span>
                ) : mort.deducted - mort.loss > 0 ? (
                  <span className="text-[var(--bi-good)]">
                    +{fmtMoney(mort.deducted - mort.loss)}
                  </span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          )
        }
      >
        {mortality.length === 0 ? (
          <EmptyRow colSpan={4} text="No mortality recorded on this date" />
        ) : (
          mortality.map((r) => (
            <tr key={r.id}>
              <td>
                <PartyCell
                  className="max-w-[230px]"
                  name={r.purchaser_name}
                  reference={
                    r.invoice_number
                      ? `${r.challan_number} · Inv #${r.purchaser_invoice_number || r.invoice_number}`
                      : r.challan_number
                  }
                />
              </td>
              <td className="num">
                <span className="block">
                  <span className="font-semibold">{fmtKg(r.mortality_weight_kg)}</span>
                  <span className="text-[var(--bi-ink-3)]"> / {fmtKg(r.gross_weight_kg)} kg</span>
                </span>
                <span className="block text-xs text-[var(--bi-ink-3)]">
                  {r.mortality_birds} / {r.gross_birds.toLocaleString("en-IN")} birds
                </span>
              </td>
              <td>
                <span
                  className="bi-pill"
                  data-tone={
                    r.status === "accepted"
                      ? "good"
                      : r.status === "neglected"
                        ? "crit"
                        : undefined
                  }
                >
                  {r.status === "accepted"
                    ? "Deducted"
                    : r.status === "neglected"
                      ? "Loss"
                      : "Pending"}
                </span>
                {r.has_discrepancy && (
                  <span
                    className="mt-1 block text-[11px] text-[var(--bi-warn)]"
                    title={r.discrepancy_notes ?? undefined}
                  >
                    Disc −{r.discrepancy_birds ?? 0}b / −
                    {fmtKg(Number(r.discrepancy_weight_kg || 0))} kg
                  </span>
                )}
              </td>
              <td className="num">
                <span className="block font-semibold">
                  {r.loss_amount > 0 ? (
                    <span className="text-[var(--bi-crit)]">−{fmtMoney(r.loss_amount)}</span>
                  ) : r.deducted_amount > 0 ? (
                    <span className="text-[var(--bi-good)]">+{fmtMoney(r.deducted_amount)}</span>
                  ) : (
                    "—"
                  )}
                </span>
                {r.rate_per_kg > 0 && (
                  <span className="block text-xs text-[var(--bi-ink-3)]">
                    @ ₹{fmtMoney(r.rate_per_kg)}/kg
                  </span>
                )}
              </td>
            </tr>
          ))
        )}
      </DarScrollTable>
    </BiPanel>
  );

  const salesCard = (
    <BiPanel
      className="order-2 xl:order-none"
      flush
      index={6}
      icon={<TrendingUp />}
      accent="var(--bi-blue)"
      title="Sales"
      subtitle={`${plural(sales.length, "invoice")} · ${fmtKg(saleKg)} kg${scrollHint(sales.length)}`}
      action={<PanelTotal label="Total value" value={`₹${fmtMoney(saleValue)}`} />}
    >
      <DarScrollTable
        minWidth={380}
        columns={[
          { label: "Client · Invoice #" },
          { label: "Kgs", right: true },
          { label: "Value (₹)", right: true },
        ]}
        footer={
          sales.length > 0 && (
            <tr>
              <td>Total ({sales.length})</td>
              <td className="num">{fmtKg(saleKg)}</td>
              <td className="num">{fmtMoney(saleValue)}</td>
            </tr>
          )
        }
      >
        {sales.length === 0 ? (
          <EmptyRow colSpan={3} text="No sales invoices on this date" />
        ) : (
          sales.map((r) => (
            <tr key={r.id}>
              <td>
                <PartyCell name={r.client} reference={r.invoiceNumber} />
              </td>
              <td className="num">{fmtKg(r.weightKg)}</td>
              <td className="num font-semibold">{fmtMoney(r.amount)}</td>
            </tr>
          ))
        )}
      </DarScrollTable>
    </BiPanel>
  );

  const purchaseCard = (
    <BiPanel
      className="order-1 xl:order-none"
      flush
      index={5}
      icon={<ShoppingCart />}
      accent="var(--bi-orange)"
      title="Purchase"
      subtitle={`${plural(purchases.length, "invoice")} · ${fmtKg(purchaseKg)} kg${scrollHint(purchases.length)}`}
      action={
        <PanelTotal label="Total value" value={`₹${fmtMoney(purchaseValue)}`} />
      }
    >
      <DarScrollTable
        minWidth={460}
        columns={[
          { label: "Purchaser · Invoice #" },
          { label: "Kgs", right: true },
          { label: "Rate / kg (₹)", right: true },
          { label: "Value (₹)", right: true },
        ]}
        footer={
          purchases.length > 0 && (
            <tr>
              <td>Total ({purchases.length})</td>
              <td className="num">{fmtKg(purchaseKg)}</td>
              <td className="num" />
              <td className="num">{fmtMoney(purchaseValue)}</td>
            </tr>
          )
        }
      >
        {purchases.length === 0 ? (
          <EmptyRow colSpan={4} text="No purchase invoices on this date" />
        ) : (
          purchases.map((r) => (
            <tr key={r.id}>
              <td>
                <PartyCell name={r.purchaser} reference={r.invoiceNumber} />
              </td>
              <td className="num">{fmtKg(r.weightKg)}</td>
              <td className="num text-[var(--bi-ink-2)]">{fmtMoney(r.pricePerKg)}</td>
              <td className="num font-semibold">{fmtMoney(r.amount)}</td>
            </tr>
          ))
        )}
      </DarScrollTable>
    </BiPanel>
  );

  const expenseCard = (
    <BiPanel
      className="order-3 xl:order-none"
      flush
      index={7}
      icon={<Receipt />}
      accent="var(--bi-pink)"
      title="Expense"
      subtitle={`${plural(expenses.length, "entry", "entries")}${scrollHint(expenses.length)}`}
      action={<PanelTotal label="Total" value={`₹${fmtMoney(expenseTotal)}`} />}
    >
      <DarScrollTable
        minWidth={400}
        columns={[
          { label: "Category · Entry #" },
          { label: "Description" },
          { label: "Amount (₹)", right: true },
        ]}
        footer={
          expenses.length > 0 && (
            <tr>
              <td colSpan={2}>Total ({expenses.length})</td>
              <td className="num">{fmtMoney(expenseTotal)}</td>
            </tr>
          )
        }
      >
        {expenses.length === 0 ? (
          <EmptyRow colSpan={3} text="No expenses on this date" />
        ) : (
          expenses.map((r) => (
            <tr key={r.id}>
              <td>
                <PartyCell
                  name={r.category}
                  reference={r.entryNumber}
                  avatar={false}
                />
              </td>
              <td className="max-w-[220px] truncate text-[var(--bi-ink-2)]">
                {r.description || "—"}
              </td>
              <td className="num font-semibold">{fmtMoney(r.amount)}</td>
            </tr>
          ))
        )}
      </DarScrollTable>
    </BiPanel>
  );

  const leftoverCard = (
    <BiPanel
      className="order-5 xl:order-none"
      index={8}
      icon={<Package />}
      accent="var(--bi-teal)"
      title="Stock Leftover"
      subtitle="Closing stock recorded for this date"
      action={
        <span className="bi-pill" data-tone={stockLeftover ? "good" : "warn"}>
          {stockLeftover ? "Recorded" : "Not recorded"}
        </span>
      }
    >
      <form onSubmit={saveLeftover}>
        <fieldset disabled={!canEditLeftover} className="space-y-4 disabled:opacity-70">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dar-birds">Birds</Label>
            <div className="relative">
              <Input
                id="dar-birds"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                placeholder="0"
                value={birds}
                onChange={(e) => setBirds(e.target.value)}
                className="bi-field pr-14"
              />
              <span className="bi-field-suffix">birds</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dar-kgs">Kgs</Label>
            <div className="relative">
              <Input
                id="dar-kgs"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.001"
                placeholder="0.000"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="bi-field pr-10"
              />
              <span className="bi-field-suffix">kg</span>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dar-remarks">Remarks</Label>
          <Textarea
            id="dar-remarks"
            rows={2}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="bi-field"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          {canEditLeftover ? (
            <>
              <Button type="submit" disabled={saving} className="rounded-full px-5">
                {saving && <Spinner className="mr-2" />}
                {stockLeftover ? "Update stock leftover" : "Save stock leftover"}
              </Button>
              {!stockLeftover && (
                <span className="text-xs text-[var(--bi-ink-3)]">
                  No entry recorded for this date yet.
                </span>
              )}
            </>
          ) : (
            <span className="inline-flex items-center gap-2 text-xs text-[var(--bi-ink-2)]">
              <Lock className="h-3.5 w-3.5" aria-hidden />
              Read-only — stock leftover can be edited for today only.
            </span>
          )}
        </div>
        </fieldset>
      </form>
    </BiPanel>
  );

  const cards = {
    mortality: mortalityCard,
    sales: salesCard,
    purchase: purchaseCard,
    expense: expenseCard,
    leftover: leftoverCard,
  };
  // xl: Expense, Mortality and Stock on the left; Purchase and Sales on the right.
  const leftColumn = ["expense", "mortality", "leftover"] as const;
  const rightColumn = ["purchase", "sales"] as const;

  const yesterday = shiftDate(today, -1);
  const relativeDay =
    date === today ? "Today" : date === yesterday ? "Yesterday" : null;
  // Sentence parts: "Today's Purchase is", "Yesterday's Sale was",
  // or "Purchase on 11 Oct 2026 was" for older dates.
  const isToday = date === today;
  const phrase = (subject: string, pluralSubject: boolean) => ({
    lead: relativeDay ? `${relativeDay}'s ` : "",
    subject,
    tail: relativeDay
      ? ""
      : ` on ${formatIndianDate(date, { day: "numeric", month: "short", year: "numeric" })}`,
    verb: isToday
      ? pluralSubject
        ? "are"
        : "is"
      : pluralSubject
        ? "were"
        : "was",
  });
  const prettyDate = formatIndianDate(date, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-8">
      {/* Header: date + navigation */}
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <p className="bi-hero-sub !mt-0 flex items-center gap-2">
            <CalendarDays className="h-4 w-4" aria-hidden />
            Daily activity
            {relativeDay && (
              <span className="bi-pill" data-tone="info">
                {relativeDay}
              </span>
            )}
          </p>
          <h2 className="bi-hero-title mt-1.5">{prettyDate}</h2>
        </div>

        <div className="bi-datenav">
          <button
            type="button"
            className="bi-datenav-btn"
            onClick={() => changeDate(shiftDate(date, -1))}
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <Label htmlFor="dar-date" className="sr-only">
            DAR date
          </Label>
          <Input
            id="dar-date"
            type="date"
            max={today}
            value={date}
            onChange={(e) => changeDate(e.target.value)}
            className="bi-datenav-input"
          />
          <button
            type="button"
            className="bi-datenav-btn"
            onClick={() => changeDate(shiftDate(date, 1))}
            disabled={date >= today}
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {date !== today && (
            <button
              type="button"
              className="bi-datenav-today"
              onClick={() => changeDate(today)}
            >
              Today
            </button>
          )}
        </div>
      </header>

      {/* Day summary as sentences: "Today's Purchase is ₹…" */}
      <section>
        <h2 className="bi-eyebrow">Day summary</h2>
        {/* lg: Purchase | Sale, Gross | Net, Expenses | Mortality */}
        <div className="bi-panel grid grid-cols-1 gap-x-10 px-[22px] py-1 lg:grid-cols-2">
          <SummaryLine
            {...phrase("Purchase", false)}
            amount={purchaseValue}
            detail={`${fmtKg(purchaseKg)} kg from ${plural(purchases.length, "invoice")}`}
            color="var(--bi-orange)"
          />
          <SummaryLine
            {...phrase("Sale", false)}
            amount={saleValue}
            detail={`${fmtKg(saleKg)} kg from ${plural(sales.length, "invoice")}`}
            color="var(--bi-blue)"
          />
          <SummaryLine
            {...phrase("Gross", false)}
            amount={gross}
            detail="Sale − Purchase"
            color="var(--bi-indigo)"
          />
          <SummaryLine
            {...phrase("Net", false)}
            amount={net}
            detail="Gross − Expenses"
            color="var(--bi-green)"
            total
          />
          <SummaryLine
            {...phrase("Expenses", true)}
            amount={expenseTotal}
            detail={plural(expenses.length, "entry", "entries")}
            color="var(--bi-pink)"
            className="lg:border-b-0"
          />
          <SummaryLine
            {...phrase("Mortality", false)}
            value={`${fmtKg(mort.kg)} kg`}
            detail={[
              plural(mort.birds, "bird"),
              mort.loss > 0 && `₹${fmtMoney(mort.loss)} company loss`,
              mort.deducted > 0 && `₹${fmtMoney(mort.deducted)} deducted`,
            ]
              .filter(Boolean)
              .join(" · ")}
            color="var(--bi-red)"
          />
        </div>
      </section>

      {/*
        xl: two fixed columns, cards at natural height (no stretching).
        Below xl the column wrappers dissolve (display: contents) and `order`
        stacks Purchase → Sales → Expense → Mortality → Stock.
      */}
      <div className="flex flex-col gap-6 xl:grid xl:grid-cols-2 xl:items-start">
        {[leftColumn, rightColumn].map((column, i) => (
          <div key={i} className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-6">
            {column.map((key) => (
              <Fragment key={key}>{cards[key]}</Fragment>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
