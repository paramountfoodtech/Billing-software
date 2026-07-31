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
      className="sticky top-4 z-50 flex justify-center pointer-events-none"
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-3 shadow-lg pointer-events-auto">
        <Spinner className="h-5 w-5" />
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
    </div>
  );
}
