// src/components/insights/DemographicsCard.tsx
import { useMemo } from "react";
import { Lightbulb } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SIGNAL_CHART } from "../../constants/insights";
import { fmtNum } from "../../utils/insights";
import type { DemographicRow } from "../../types/insights";
import { ChartTooltip } from "../common/ChartTooltip";

export function DemographicsCard({
  demographics,
  loading,
  error,
}: {
  demographics: DemographicRow[];
  loading: boolean;
  error: boolean;
}) {
  const totalKnownFollowers = useMemo(
    () =>
      demographics.reduce(
        (s, d) => s + d.female + d.male + d.undisclosed,
        0,
      ),
    [demographics],
  );

  return (
    <div className="signal-panel flex flex-col overflow-hidden rounded-2xl border border-signal-border lg:col-span-5">
      <div className="flex items-center justify-between border-b border-signal-border px-4 py-3 sm:px-5">
        <span className="font-signal-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-signal-coral sm:text-[11px]">
          Audience snapshot
        </span>
        <span className="font-signal-mono text-[10px] text-signal-muted sm:text-xs">
          {loading
            ? "Loading..."
            : error
              ? "Snapshot fallback"
              : `${fmtNum(totalKnownFollowers)} followers`}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <div className="h-[240px] w-full sm:h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={demographics}
              layout="vertical"
              margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal
                vertical={false}
                stroke={SIGNAL_CHART.border}
              />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: SIGNAL_CHART.muted }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                dataKey="age"
                type="category"
                tick={{
                  fontSize: 10,
                  fill: SIGNAL_CHART.text,
                  fontWeight: 600,
                }}
                axisLine={false}
                tickLine={false}
                width={45}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: SIGNAL_CHART.track }}
              />
              <Legend
                iconType="circle"
                wrapperStyle={{
                  fontSize: "10px",
                  paddingTop: "8px",
                  color: SIGNAL_CHART.muted,
                }}
              />
              <Bar
                dataKey="female"
                name="Female"
                stackId="a"
                fill={SIGNAL_CHART.female}
                barSize={16}
              />
              <Bar
                dataKey="male"
                name="Male"
                stackId="a"
                fill={SIGNAL_CHART.male}
                barSize={16}
              />
              <Bar
                dataKey="undisclosed"
                name="Undisclosed"
                stackId="a"
                fill={SIGNAL_CHART.undisclosed}
                radius={[0, 4, 4, 0]}
                barSize={16}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 flex gap-3 border-l-2 border-signal-coral px-3 py-3 sm:px-4">
          <Lightbulb
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0 text-signal-coral"
          />
          <div>
            <p className="mb-1 font-signal-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-signal-coral sm:text-[11px]">
              Quick insight
            </p>
            <p className="text-xs leading-relaxed text-signal-muted sm:text-sm">
              The 25–44 age group makes up the majority of followers with
              available demographic data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
