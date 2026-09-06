// src/components/common/StatCard.tsx
import type { StatTone } from "../../types/insights";

export function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: StatTone;
}) {
  const dataTone = tone === "up" ? undefined : tone === "down" ? "coral" : "slate";

  return (
    <div
      data-tone={dataTone}
      className="signal-metric-card min-h-[132px] border p-4 sm:p-5"
    >
      <p className="font-signal-mono text-[10px] uppercase tracking-[0.14em] text-signal-muted sm:text-[11px]">
        {label}
      </p>
      <p className="mt-4 font-signal-display text-3xl font-semibold leading-none tabular-nums text-signal-text sm:text-4xl">
        {value}
      </p>
      <p className="mt-3 max-w-[24ch] text-[11px] leading-5 text-signal-muted sm:text-xs">
        {sub}
      </p>
    </div>
  );
}
