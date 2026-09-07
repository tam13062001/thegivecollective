// src/components/home/ProfileLinkTapsChart.tsx
// Daily Instagram profile link taps (website_clicks + profile_links_taps),
// account-level metrics — not split per post. See useInstagramLinkTaps for
// the day-boundary caveat on the backend's `end_time` conversion.
import { useId, useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "../common/ChartTooltip";
import { InlineDataState } from "../common/InlineDataState";
import { SIGNAL_CHART } from "../../constants/insights";
import {
  LINK_TAPS_RANGES,
  useInstagramLinkTaps,
} from "../../hooks/home/useInstagramLinkTaps";
import { fmtNum } from "../../utils/insights";

function fmtDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

export function ProfileLinkTapsChart() {
  const { days, setDays, series, note, loading, error } = useInstagramLinkTaps();
  const gradId = useId();

  const chartData = useMemo(
    () => series.map((d) => ({ ...d, label: fmtDate(d.date) })),
    [series],
  );

  const totalTaps = useMemo(
    () => series.reduce((sum, d) => sum + d.total, 0),
    [series],
  );

  return (
    <div className="signal-panel overflow-hidden rounded-2xl border border-signal-border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-signal-border px-4 py-3 sm:px-5">
        <div>
          <span className="font-signal-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-signal-coral sm:text-[11px]">
            Instagram profile link taps
          </span>
          <p className="mt-1 text-[11px] text-signal-muted sm:text-xs">
            Website clicks + profile link taps · account-level, not per post
          </p>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-signal-border text-sm">
          {LINK_TAPS_RANGES.map(({ label, days: d }) => (
            <button
              key={d}
              type="button"
              aria-pressed={days === d}
              onClick={() => setDays(d)}
              className={`h-9 px-3 font-medium transition-colors ${days === d
                ? "bg-signal-text text-signal-ink"
                : "bg-signal-surface text-signal-muted hover:bg-signal-track"
                }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {loading && series.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-signal-muted">
            Loading...
          </div>
        ) : error && series.length === 0 ? (
          <InlineDataState
            tone="error"
            title="Couldn’t load Instagram link taps."
            description="Try a shorter range, or check back once Meta's insights window refreshes."
          />
        ) : series.length === 0 ? (
          <InlineDataState
            tone="empty"
            title="No link tap data for this range."
            description="Try a longer range."
          />
        ) : (
          <>
            <div className="flex items-end gap-3 pb-1">
              <span className="font-signal-display text-3xl font-semibold tabular-nums text-signal-text">
                {fmtNum(totalTaps)}
              </span>
              <span className="mb-1 font-signal-mono text-[10px] uppercase tracking-wide text-signal-muted">
                total taps · last {days} days
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={SIGNAL_CHART.coral} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={SIGNAL_CHART.coral} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={SIGNAL_CHART.border}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: SIGNAL_CHART.muted }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={fmtNum}
                    tick={{ fontSize: 10, fill: SIGNAL_CHART.muted }}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ stroke: SIGNAL_CHART.coral, strokeDasharray: "4 4" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Profile link taps"
                    stroke={SIGNAL_CHART.coral}
                    strokeWidth={2.5}
                    fill={`url(#${gradId})`}
                    dot={false}
                    activeDot={{ r: 5, fill: SIGNAL_CHART.coral, stroke: "#fff", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <p className="mt-3 border-t border-signal-border pt-3 text-[11px] leading-5 text-signal-muted">
              {note ||
                "Account-level Instagram metric (no per-post breakdown available)."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
