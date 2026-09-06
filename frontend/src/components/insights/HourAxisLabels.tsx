// src/components/insights/HourAxisLabels.tsx
// Shared 00:00 → 22:00 axis used under every heatmap row.
import { HOUR_LABELS } from "../../constants/insights";

export function HourAxisLabels({ withGutter = true }: { withGutter?: boolean }) {
  const labels = (
    <div className="relative h-4 flex-1">
      {HOUR_LABELS.map((h) => (
        <span
          key={h}
          className="absolute -translate-x-1/2 text-[9px] text-signal-muted sm:text-[10px]"
          style={{ left: `${(h / 24) * 100}%` }}
        >
          {String(h).padStart(2, "0")}:00
        </span>
      ))}
    </div>
  );

  if (!withGutter) return <div className="relative mt-2 h-4">{labels}</div>;

  return (
    <div className="mt-2 flex items-center gap-1 sm:gap-1.5">
      <span className="w-8 shrink-0 sm:w-9" />
      {labels}
    </div>
  );
}
