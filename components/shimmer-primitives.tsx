import { cn } from "@/lib/utils";

export const shimmerStyle = {
  animation: "shimmerContent 1.6s linear infinite",
  backgroundSize: "200% 100%",
} as const;

export function ShimmerBox({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        "rounded bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200",
        className,
      )}
      style={{ ...shimmerStyle, ...style }}
      aria-hidden
    />
  );
}

export function ShimmerField({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <ShimmerBox className="h-3.5 w-24" />
      <ShimmerBox className="h-10 w-full" />
    </div>
  );
}

export function ShimmerButton({
  size = "default",
  className,
}: {
  size?: "default" | "sm" | "icon";
  className?: string;
}) {
  if (size === "icon") {
    return <ShimmerBox className={cn("h-8 w-8 rounded-md", className)} />;
  }
  if (size === "sm") {
    return <ShimmerBox className={cn("h-8 w-24 rounded-md", className)} />;
  }
  return <ShimmerBox className={cn("h-10 w-full sm:w-36 rounded-md", className)} />;
}

export function ShimmerCard({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border bg-white", className)}>
      {children}
    </div>
  );
}
