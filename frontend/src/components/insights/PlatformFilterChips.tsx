// src/components/insights/PlatformFilterChips.tsx
// Used by the engagement comparison panel (no "all platforms" option by design).
import { PlatformIcon } from "../common/PlatformIcon";

export function PlatformFilterChips({
  platforms,
  active,
  onChange,
}: {
  platforms: string[];
  active: string;
  onChange: (p: string) => void;
}) {
  if (platforms.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Filter engagement by platform"
    >
      {platforms.map((p) => (
        <button
          key={p}
          type="button"
          aria-pressed={active === p}
          onClick={() => onChange(p)}
          className={`inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-[11px] font-semibold transition-colors focus-visible:outline-none sm:text-xs ${active === p
            ? "border-signal-cyan bg-signal-cyan text-signal-ink"
            : "border-signal-border bg-transparent text-signal-muted hover:border-signal-cyan hover:text-signal-cyan"
            }`}
        >
          <PlatformIcon name={p} />
          <span className="capitalize">{p}</span>
        </button>
      ))}
    </div>
  );
}
