import { Spinner } from "@/components/ui/spinner";

/** Full-form busy overlay so users see feedback during multi-second saves. */
export function FormBusyOverlay({
  active,
  label = "Saving…",
}: {
  active: boolean;
  label?: string;
}) {
  if (!active) return null;

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-background/70 backdrop-blur-[1px]"
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-md">
        <Spinner className="h-5 w-5" />
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
    </div>
  );
}
