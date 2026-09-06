// src/components/insights/InlineDataState.tsx
import { ArrowRight, RefreshCw } from "lucide-react";

export function InlineDataState({
  tone,
  title,
  description,
  actionLabel,
  onAction,
}: {
  tone: "loading" | "empty" | "error";
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const toneClass =
    tone === "error"
      ? "border-signal-coral/50 text-signal-coral"
      : tone === "loading"
        ? "border-signal-cyan/50 text-signal-cyan"
        : "border-signal-border text-signal-muted";

  return (
    <div
      className={`border-l-2 px-4 py-6 ${toneClass}`}
      role={tone === "loading" ? "status" : undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-signal-display text-xl font-semibold text-signal-text">
            {title}
          </p>
          {description && (
            <p className="mt-1 text-sm text-signal-muted">{description}</p>
          )}
        </div>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md border border-signal-border bg-signal-surface px-3 py-2 text-xs font-semibold text-signal-text transition-colors hover:border-signal-cyan hover:text-signal-cyan focus-visible:outline-none"
          >
            {actionLabel}
            <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {tone === "empty" && (
        <ArrowRight aria-hidden="true" className="mt-4 h-4 w-4 text-signal-muted" />
      )}
    </div>
  );
}
