import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Shrink KPI typography as the displayed value gets longer so cards stay tidy. */
export function kpiValueSizeClass(display: string) {
  const len = display.replace(/\s/g, "").length;
  if (len >= 16) return "text-xs sm:text-sm md:text-base";
  if (len >= 13) return "text-sm sm:text-base md:text-lg";
  if (len >= 10) return "text-base sm:text-lg md:text-xl";
  return "text-lg sm:text-xl md:text-2xl";
}

type KpiValueProps = {
  children: ReactNode;
  /** Full string used for sizing (and tooltip). Prefer the formatted amount. */
  display: string;
  className?: string;
};

export function KpiValue({ children, display, className }: KpiValueProps) {
  return (
    <div
      title={display}
      className={cn(
        "font-bold tabular-nums leading-tight tracking-tight min-w-0 max-w-full break-words [overflow-wrap:anywhere]",
        kpiValueSizeClass(display),
        className,
      )}
    >
      {children}
    </div>
  );
}
