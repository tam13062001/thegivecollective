// src/components/insights/ContentTypeFilterChips.tsx
import { CONTENT_TYPE_META } from "../../constants/insights";
import type { ContentType } from "../../types/insights";
import { ContentTypeGlyph } from "./ContentTypeBadge";

export function ContentTypeFilterChips({
  availableTypes,
  active,
  onChange,
}: {
  availableTypes: ContentType[];
  active: ContentType | "all";
  onChange: (t: ContentType | "all") => void;
}) {
  if (availableTypes.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Filter top posts by content type"
    >
      <button
        type="button"
        aria-pressed={active === "all"}
        onClick={() => onChange("all")}
        className={`min-h-10 rounded-md border px-3 py-2 text-[11px] font-semibold transition-colors focus-visible:outline-none sm:text-xs ${active === "all"
          ? "border-signal-text bg-signal-text text-signal-ink"
          : "border-signal-border bg-transparent text-signal-muted hover:border-signal-cyan hover:text-signal-cyan"
          }`}
      >
        All types
      </button>
      {availableTypes.map((t) => {
        const meta = CONTENT_TYPE_META[t];
        const isActive = active === t;
        return (
          <button
            key={t}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(t)}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-md border px-3 py-2 text-[11px] font-semibold transition-colors focus-visible:outline-none sm:text-xs ${isActive
              ? "border-signal-cyan bg-signal-cyan text-signal-ink"
              : "border-signal-border bg-transparent text-signal-muted hover:border-signal-cyan hover:text-signal-cyan"
              }`}
          >
            <ContentTypeGlyph type={t} />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
