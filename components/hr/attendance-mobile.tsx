"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Info,
  Lock,
  MoreHorizontal,
  Save,
  SlidersHorizontal,
  Unlock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getIndianCurrentMonth } from "@/lib/date-time";
import { daysInMonth, type DayAttendanceMark } from "@/lib/hr-calculations";
import { cn } from "@/lib/utils";
import {
  type AttendanceEdit,
  STATUS_CLASS_EDITABLE,
  STATUS_CLASS_LOCKED,
  STATUS_LABEL,
  STATUS_NAME,
} from "@/components/hr/attendance-shared";

type Filters = { name: string; status: string };

interface AttendanceMobileProps {
  /** Rows of the current page (already filtered + sorted). */
  rows: AttendanceEdit[];
  /** All rows, used for today's progress. */
  allRows: AttendanceEdit[];
  selectedMonth: string;
  monthLabel: string;
  today: string;
  isLoadingDays: boolean;
  filters: Filters;
  onFiltersChange: (next: Filters) => void;
  onMonthChange: (month: string) => void;
  statusOptions: { value: string; label: string }[];
  canEditDay: (date: string, row: AttendanceEdit) => boolean;
  onSetDayStatus: (
    employeeId: string,
    date: string,
    status: DayAttendanceMark,
  ) => void;
  showPastEditToggle: boolean;
  pastEditModeEnabled: boolean;
  onTogglePastEdit: () => void;
  onSaveDraft: () => void;
  onFinalize: () => void;
  showUnlock: boolean;
  onUnlock: () => void;
  isSaving: boolean;
  isFinalizing: boolean;
  isUnlocking: boolean;
  allFinalized: boolean;
  /** Rendered under the list, above the action bar (pagination). */
  children?: ReactNode;
}

const PICKER_ORDER: DayAttendanceMark[] = [
  "present",
  "half_day",
  "absent",
  "casual_leave",
];

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function formatShortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function StatusBadge({ row }: { row: AttendanceEdit }) {
  if (row.isPaid)
    return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
  if (row.status === "finalized")
    return <Badge className="bg-blue-100 text-blue-800">Finalized</Badge>;
  return <Badge variant="secondary">Draft</Badge>;
}

function EmployeeCard({
  row,
  selectedMonth,
  today,
  activeDate,
  canEditDay,
  onSetDayStatus,
}: {
  row: AttendanceEdit;
  selectedMonth: string;
  today: string;
  activeDate: string;
  canEditDay: AttendanceMobileProps["canEditDay"];
  onSetDayStatus: AttendanceMobileProps["onSetDayStatus"];
}) {
  const activeStatus: DayAttendanceMark = row.days[activeDate] || "empty";
  const activeEditable = canEditDay(activeDate, row);
  const quickOptions = PICKER_ORDER.filter(
    (s) => s !== "casual_leave" || row.maxCL > 0,
  );

  return (
    <div className="rounded-xl border bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{row.employeeName}</p>
          <p className="text-[11px] text-muted-foreground">
            {row.maxCL > 0
              ? `CL left: ${Math.max(0, row.maxCL - row.casualLeave)}/${row.maxCL}`
              : "No CL · Absent/HL = LOP"}
          </p>
        </div>
        <StatusBadge row={row} />
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {activeDate === today ? "Today" : formatShortDate(activeDate)}
        </p>
        <div
          className={cn(
            "grid gap-2",
            quickOptions.length === 4 ? "grid-cols-4" : "grid-cols-3",
          )}
        >
          {quickOptions.map((s) => {
            const selected = activeStatus === s;
            return (
              <button
                key={s}
                type="button"
                disabled={!activeEditable}
                aria-pressed={selected}
                aria-label={STATUS_NAME[s]}
                onClick={() =>
                  onSetDayStatus(row.employeeId, activeDate, selected ? "empty" : s)
                }
                className={cn(
                  "h-11 rounded-lg text-sm font-bold transition-colors",
                  activeEditable
                    ? selected
                      ? STATUS_CLASS_EDITABLE[s]
                      : "border-2 border-slate-200 bg-white text-slate-600 active:bg-slate-100"
                    : selected
                      ? STATUS_CLASS_LOCKED[s]
                      : "border border-slate-200 bg-slate-50 text-slate-300",
                )}
              >
                {STATUS_LABEL[s]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="rounded-md bg-green-50 px-2 py-1 font-medium text-green-700">
            P {row.daysPresent}
          </span>
          <span className="rounded-md bg-amber-50 px-2 py-1 font-medium text-amber-700">
            CL {row.casualLeave}
          </span>
          <span className="rounded-md bg-red-50 px-2 py-1 font-medium text-red-700">
            LOP {row.lop}
          </span>
        </div>
      </div>

    </div>
  );
}

export function AttendanceMobile({
  rows,
  allRows,
  selectedMonth,
  monthLabel,
  today,
  isLoadingDays,
  filters,
  onFiltersChange,
  onMonthChange,
  statusOptions,
  canEditDay,
  onSetDayStatus,
  showPastEditToggle,
  pastEditModeEnabled,
  onTogglePastEdit,
  onSaveDraft,
  onFinalize,
  showUnlock,
  onUnlock,
  isSaving,
  isFinalizing,
  isUnlocking,
  allFinalized,
  children,
}: AttendanceMobileProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [chosenDate, setChosenDate] = useState(today);
  const stripRef = useRef<HTMLDivElement>(null);

  const monthDates = useMemo(() => {
    const n = daysInMonth(selectedMonth);
    return Array.from(
      { length: n },
      (_, i) => `${selectedMonth}-${String(i + 1).padStart(2, "0")}`,
    );
  }, [selectedMonth]);

  // Falls back to today (or the month's last day) when the month changes.
  const activeDate = monthDates.includes(chosenDate)
    ? chosenDate
    : monthDates.includes(today)
      ? today
      : monthDates[monthDates.length - 1];

  const markedByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of monthDates) {
      counts[d] = allRows.filter((r) => (r.days[d] || "empty") !== "empty").length;
    }
    return counts;
  }, [allRows, monthDates]);
  const markedActive = markedByDate[activeDate] ?? 0;

  const activeIndex = monthDates.indexOf(activeDate);
  const prevDate = activeIndex > 0 ? monthDates[activeIndex - 1] : null;
  const nextCandidate =
    activeIndex < monthDates.length - 1 ? monthDates[activeIndex + 1] : null;
  const nextDate = nextCandidate && nextCandidate <= today ? nextCandidate : null;

  useEffect(() => {
    const strip = stripRef.current;
    const el = strip?.querySelector<HTMLElement>('[data-active="true"]');
    if (!strip || !el) return;
    strip.scrollTo({
      left: el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2,
      behavior: "smooth",
    });
  }, [activeDate, selectedMonth]);

  const pastLocked = activeDate < today && !pastEditModeEnabled;

  const activeFilters =
    (filters.status ? 1 : 0) +
    (selectedMonth !== getIndianCurrentMonth() ? 1 : 0);

  const busy = isSaving || isFinalizing;
  const hasMenu = showUnlock;

  return (
    <div className="space-y-3">
      <div className="space-y-3 rounded-xl border bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {monthLabel}
              {isLoadingDays && <Spinner className="ml-2 inline-block h-3.5 w-3.5" />}
            </p>
            <p className="text-xs text-muted-foreground">
              {activeDate === today ? "Today" : formatShortDate(activeDate)}:{" "}
              {markedActive} of {allRows.length} marked
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 shrink-0 gap-1.5"
            onClick={() => setFiltersOpen(true)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilters > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
                {activeFilters}
              </span>
            )}
          </Button>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              aria-label="Previous day"
              disabled={!prevDate}
              onClick={() => prevDate && setChosenDate(prevDate)}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
              <span className="truncate text-sm font-semibold">
                {formatShortDate(activeDate)}
              </span>
              {activeDate !== today && monthDates.includes(today) && (
                <button
                  type="button"
                  className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                  onClick={() => setChosenDate(today)}
                >
                  Today
                </button>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              aria-label="Next day"
              disabled={!nextDate}
              onClick={() => nextDate && setChosenDate(nextDate)}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          <div
            ref={stripRef}
            className="relative -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {monthDates.map((d) => {
              const future = d > today;
              const active = d === activeDate;
              const complete =
                allRows.length > 0 && markedByDate[d] === allRows.length;
              return (
                <button
                  key={d}
                  type="button"
                  data-active={active}
                  disabled={future}
                  aria-label={formatShortDate(d)}
                  aria-pressed={active}
                  onClick={() => setChosenDate(d)}
                  className={cn(
                    "relative flex h-14 w-11 shrink-0 flex-col items-center justify-center rounded-lg border text-xs",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-white text-slate-700",
                    d === today && !active && "border-blue-500 text-blue-700",
                    future && "opacity-35",
                  )}
                >
                  <span className="text-[10px] opacity-80">
                    {WEEKDAYS[new Date(`${d}T00:00:00`).getDay()]}
                  </span>
                  <span className="text-sm font-semibold">{Number(d.slice(-2))}</span>
                  {complete && (
                    <span
                      className={cn(
                        "absolute bottom-1 h-1 w-1 rounded-full",
                        active ? "bg-primary-foreground" : "bg-green-500",
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <Input
          placeholder="Search employee..."
          value={filters.name}
          onChange={(e) => onFiltersChange({ ...filters, name: e.target.value })}
          className="h-11"
          aria-label="Search employee"
        />
        {showPastEditToggle && pastLocked && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900"
          >
            <Lock className="h-4 w-4 shrink-0" />
            Past day locked — Enable Edit to change
          </p>
        )}
        <div className="text-xs text-muted-foreground">
          <button
            type="button"
            className="inline-flex items-center gap-1 font-medium text-blue-600"
            onClick={() => setLegendOpen((v) => !v)}
            aria-expanded={legendOpen}
          >
            <Info className="h-3.5 w-3.5" />
            Legend
          </button>
          {pastEditModeEnabled && (
            <span className="ml-2 font-medium text-amber-700">
              Past dates editable
            </span>
          )}
          {legendOpen && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="inline-flex items-center gap-1">
                <Badge className="bg-green-500 text-white">P</Badge> Present
              </span>
              <span className="inline-flex items-center gap-1">
                <Badge className="bg-purple-500 text-white">HL</Badge> Half Day
              </span>
              <span className="inline-flex items-center gap-1">
                <Badge className="bg-red-500 text-white">A</Badge> Absent
              </span>
              <span className="inline-flex items-center gap-1">
                <Badge className="bg-amber-500 text-white">CL</Badge> Casual Leave
              </span>
              <span className="w-full">
                Pick a day above, tap a button to mark it; tap again to clear. Green
                dot = everyone marked. Past days need Enable Edit (bottom bar). Future days are
                locked.
              </span>
            </div>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border bg-white py-8 text-center text-sm text-muted-foreground">
          No active employees found
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <EmployeeCard
              key={row.employeeId}
              row={row}
              selectedMonth={selectedMonth}
              today={today}
              activeDate={activeDate}
              canEditDay={canEditDay}
              onSetDayStatus={onSetDayStatus}
            />
          ))}
        </div>
      )}

      {children}

      <div className="sticky bottom-0 z-20 -mx-4 flex items-center gap-2 border-t bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-2px_8px_rgba(0,0,0,0.06)] sm:-mx-6 sm:px-6">
        {hasMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-14 w-11 shrink-0 px-0"
                aria-label="More actions"
              >
                <MoreHorizontal className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="min-w-48">
              {showUnlock && (
                <DropdownMenuItem
                  className="h-11"
                  disabled={isUnlocking}
                  onSelect={onUnlock}
                >
                  <Unlock className="mr-2 h-4 w-4" />
                  Unlock finalized
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {showPastEditToggle && (
          <Button
            type="button"
            variant={pastEditModeEnabled ? "default" : "outline"}
            className="h-14 min-w-0 flex-1 flex-col gap-0.5 px-1 text-xs"
            aria-pressed={pastEditModeEnabled}
            onClick={onTogglePastEdit}
          >
            {pastEditModeEnabled ? (
              <Unlock className="size-5" />
            ) : (
              <Lock className="size-5" />
            )}
            <span className="whitespace-nowrap">
              {pastEditModeEnabled ? "Editing On" : "Enable Edit"}
            </span>
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="h-14 min-w-0 flex-1 flex-col gap-0.5 px-1 text-xs"
          onClick={onSaveDraft}
          disabled={busy || allFinalized}
        >
          {isSaving ? (
            <Spinner className="size-5" />
          ) : (
            <Save className="size-5" />
          )}
          <span className="whitespace-nowrap">Save Draft</span>
        </Button>
        <Button
          type="button"
          className="h-14 min-w-0 flex-1 flex-col gap-0.5 px-1 text-xs"
          onClick={onFinalize}
          disabled={busy || allFinalized || allRows.length === 0}
        >
          {isFinalizing ? (
            <Spinner className="size-5" />
          ) : (
            <Lock className="size-5" />
          )}
          <span className="whitespace-nowrap">Finalize</span>
        </Button>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>Choose a month and status.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Month</Label>
              <Input
                type="month"
                value={selectedMonth}
                max={getIndianCurrentMonth()}
                onChange={(e) => e.target.value && onMonthChange(e.target.value)}
                className="h-11 w-full"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <div className="flex flex-wrap gap-2">
                {[{ value: "", label: "All" }, ...statusOptions].map((o) => (
                  <button
                    key={o.value || "all"}
                    type="button"
                    aria-pressed={filters.status === o.value}
                    onClick={() => onFiltersChange({ ...filters, status: o.value })}
                    className={cn(
                      "h-10 rounded-full border px-4 text-sm font-medium",
                      filters.status === o.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-white text-slate-700",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <Button
              type="button"
              className="h-11 w-full"
              onClick={() => setFiltersOpen(false)}
            >
              Done
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
