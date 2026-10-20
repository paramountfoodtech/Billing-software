import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** iOS-style gradient icon tile; `accent` is a CSS color such as "var(--bi-blue)". */
export function BiIcon({
  accent,
  children,
  size = "md",
  round,
}: {
  accent: string;
  children: ReactNode;
  size?: "sm" | "md";
  round?: boolean;
}) {
  return (
    <span
      className={cn("bi-icon", size === "sm" && "bi-icon-sm")}
      data-round={round ? "" : undefined}
      style={{ "--accent": accent } as CSSProperties}
      aria-hidden
    >
      {children}
    </span>
  );
}

const AVATAR_COLORS = [
  "var(--bi-blue)",
  "var(--bi-orange)",
  "var(--bi-pink)",
  "var(--bi-indigo)",
  "var(--bi-green)",
  "var(--bi-teal)",
  "var(--bi-purple)",
];

function hashString(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Initials avatar with a stable color derived from the name. */
export function BiAvatar({ name }: { name: string }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "—";
  const color = AVATAR_COLORS[hashString(name) % AVATAR_COLORS.length];
  return (
    <span
      className="bi-avatar"
      style={{ "--accent": color } as CSSProperties}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/** Panel ("visual") with an optional header strip. */
export function BiPanel({
  title,
  subtitle,
  action,
  icon,
  accent = "var(--bi-blue)",
  children,
  className,
  bodyClassName,
  flush,
  index = 0,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  /** Optional lucide icon shown in a colored tile next to the title. */
  icon?: ReactNode;
  accent?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Remove body padding (tables that go edge to edge). */
  flush?: boolean;
  index?: number;
}) {
  return (
    <section
      className={cn("bi-panel bi-rise", className)}
      style={{ "--i": index } as CSSProperties}
    >
      {(title || action) && (
        <header className="bi-panel-head">
          <div className="flex min-w-0 items-start gap-3">
            {icon && (
              <BiIcon accent={accent} size="sm">
                {icon}
              </BiIcon>
            )}
            <div className="min-w-0">
              {title && <h3 className="bi-panel-title">{title}</h3>}
              {subtitle && <p className="bi-panel-sub">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn(!flush && "bi-panel-body", bodyClassName)}>{children}</div>
    </section>
  );
}

export function BiEyebrow({ children }: { children: ReactNode }) {
  return <h2 className="bi-eyebrow">{children}</h2>;
}

/** Centered empty / no-data message with an optional icon. */
export function BiEmpty({
  icon,
  children,
  className,
}: {
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bi-empty", className)}>
      {icon}
      <p>{children}</p>
    </div>
  );
}

/** Thin horizontal share bar; `value` is a 0–100 percentage. */
export function BiMeter({ value, color }: { value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className="bi-meter" aria-hidden>
      <span style={{ width: `${pct}%`, "--meter": color } as CSSProperties} />
    </div>
  );
}

/** Monotone cubic (Fritsch–Carlson) path: smooth, never overshoots the data. */
function smoothPath(pts: ReadonlyArray<readonly [number, number]>) {
  const n = pts.length;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0];
    m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i];
  }
  const t: number[] = new Array(n);
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) {
    t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  const f = (v: number) => v.toFixed(2);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${f(pts[i][0] + h)},${f(pts[i][1] + t[i] * h)} ${f(pts[i + 1][0] - h)},${f(
      pts[i + 1][1] - t[i + 1] * h,
    )} ${f(pts[i + 1][0])},${f(pts[i + 1][1])}`;
  }
  return d;
}

/**
 * Edge-to-edge sparkline: smooth 2px line over a vertical color fade.
 * The SVG stretches horizontally (non-scaling stroke keeps the line crisp).
 */
export function Sparkline({
  values,
  color,
  height = 52,
  fillOpacity = 0.28,
}: {
  values: number[];
  color: string;
  height?: number;
  fillOpacity?: number;
}) {
  if (values.length < 2 || values.every((v) => v === 0)) return null;
  const W = 100;
  const padTop = 8;
  const padBottom = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = padTop + (1 - (v - min) / span) * (height - padTop - padBottom);
    return [x, y] as const;
  });
  const line = smoothPath(pts);
  const area = `${line} L${W},${height} L0,${height} Z`;
  const gid = `bi-spark-${hashString(color + values.join(","))}`;
  return (
    <div className="bi-spark" style={{ height }} aria-hidden>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gid})`} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

/**
 * KPI card: colored icon tile + label, large value, hint, optional
 * edge-to-edge sparkline. `variant="hero"` renders the gradient card.
 */
export function BiKpi({
  label,
  display,
  hint,
  accent,
  icon,
  trend,
  trendLabel,
  negative,
  index = 0,
  valueClassName,
  className,
  variant = "default",
  size,
  sparkHeight,
}: {
  label: ReactNode;
  display: string;
  hint?: ReactNode;
  /** The metric's color, e.g. "var(--bi-blue)". */
  accent: string;
  icon?: ReactNode;
  trend?: number[];
  /** Short caption for the sparkline period, e.g. "Apr – Oct". */
  trendLabel?: string;
  negative?: boolean;
  index?: number;
  valueClassName?: string;
  className?: string;
  variant?: "default" | "hero";
  /** Hero only: "lg" for the tall bento tile. */
  size?: "lg";
  /** Override the sparkline height in px. */
  sparkHeight?: number;
}) {
  const hero = variant === "hero";
  const hasSpark =
    !!trend && trend.length >= 2 && !trend.every((v) => v === 0);
  return (
    <div
      className={cn("bi-kpi bi-rise", className)}
      data-variant={hero ? "hero" : undefined}
      data-tone={hero ? (negative ? "neg" : "pos") : undefined}
      data-size={size}
      style={{ "--accent": accent, "--i": index } as CSSProperties}
    >
      <div className="bi-kpi-head">
        {icon && <BiIcon accent={accent}>{icon}</BiIcon>}
        <span className="bi-kpi-label">{label}</span>
      </div>
      <div
        className={cn("bi-kpi-value", valueClassName)}
        data-neg={negative ? "true" : undefined}
        title={display}
      >
        {display}
      </div>
      {(hint || hasSpark) && (
        <div className="bi-kpi-foot">
          {(hint || trendLabel) && (
            <p className="bi-kpi-hint">
              <span>{hint}</span>
              {hasSpark && trendLabel && <span>{trendLabel}</span>}
            </p>
          )}
          {hasSpark && trend && (
            <Sparkline
              values={trend}
              color={hero && negative ? "var(--bi-red)" : accent}
              height={sparkHeight ?? (hero && size === "lg" ? 148 : 52)}
              fillOpacity={0.12}
            />
          )}
        </div>
      )}
    </div>
  );
}
