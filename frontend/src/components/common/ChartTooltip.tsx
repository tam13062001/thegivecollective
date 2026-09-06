// src/components/common/ChartTooltip.tsx
import { SIGNAL_CHART } from "../../constants/insights";
import { fmtNum } from "../../utils/insights";

export function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[140px] rounded-lg border border-signal-border bg-signal-surface px-3 py-2 shadow-lg">
      <p className="mb-1 font-signal-mono text-[10px] uppercase tracking-wide text-signal-muted">
        {label}
      </p>
      {payload.map((p: any) => (
        <p
          key={p.dataKey}
          className="text-xs font-bold tabular-nums text-signal-text sm:text-sm"
          style={{ color: p.color ?? p.fill ?? SIGNAL_CHART.cyan }}
        >
          {fmtNum(p.value)}{" "}
          <span className="font-signal-body font-normal text-signal-muted">
            {p.name ?? p.dataKey}
          </span>
        </p>
      ))}
    </div>
  );
}
