// src/components/insights/CtrComparisonCard.tsx
// CTR comparison: Facebook = sum(post clicks) / sum(views),
// Instagram = account-level profile clicks / sum(views).
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SIGNAL_CHART } from "../../constants/insights";
import { useCtrByPlatform } from "../../hooks/insights/useCtrByPlatform";
import { fmtNum } from "../../utils/insights";
import type { CtrDatum, Post } from "../../types/insights";
import { InlineDataState } from "../common/InlineDataState";
import { PlatformIcon } from "../common/PlatformIcon";

function CtrTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d: CtrDatum | undefined = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="min-w-[190px] rounded-lg border border-signal-border bg-signal-surface px-3 py-2 shadow-lg">
      <p className="mb-1 font-signal-mono text-[10px] uppercase tracking-wide text-signal-muted">
        {d.label}
      </p>
      <p className="text-sm font-bold tabular-nums" style={{ color: d.color }}>
        {d.ctr.toFixed(2)}%{" "}
        <span className="font-signal-body font-normal text-signal-muted">
          CTR
        </span>
      </p>
      <p className="mt-1 font-signal-mono text-[10px] tabular-nums text-signal-muted">
        {fmtNum(d.clicks)} clicks ÷ {fmtNum(d.views)} views · {d.postCount} posts
      </p>
      <p className="mt-1 text-[10px] leading-4 text-signal-muted">{d.note}</p>
    </div>
  );
}

export function CtrComparisonCard({
  facebookPosts,
  instagramPosts,
  loading,
}: {
  facebookPosts: Post[];
  instagramPosts: Post[];
  loading: boolean;
}) {
  const { data, igLoading, igError } = useCtrByPlatform(
    facebookPosts,
    instagramPosts,
  );

  const isLoading = loading || igLoading;
  const maxCtr = Math.max(...data.map((d) => d.ctr), 0.1);

  return (
    <div className="signal-panel overflow-hidden rounded-2xl border border-signal-border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-signal-border px-4 py-3 sm:px-5">
        <span className="font-signal-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-signal-cyan sm:text-[11px]">
          Click-through rate · Facebook vs Instagram
        </span>
        <span className="font-signal-mono text-[10px] text-signal-muted sm:text-xs">
          {isLoading ? "Loading..." : "Clicks ÷ views"}
        </span>
      </div>

      <div className="p-4 sm:p-5">
        {data.length === 0 ? (
          <InlineDataState
            tone={isLoading ? "loading" : igError ? "error" : "empty"}
            title={
              isLoading
                ? "Loading CTR data..."
                : igError
                  ? "Couldn’t load Instagram profile clicks."
                  : "No CTR data available yet."
            }
            description={
              igError
                ? "Facebook CTR still renders once post clicks are available."
                : "CTR needs both clicks and views for Facebook or Instagram."
            }
          />
        ) : (
          <>
            <div className="h-[220px] w-full sm:h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data}
                  margin={{ top: 16, right: 16, bottom: 0, left: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke={SIGNAL_CHART.border}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{
                      fontSize: 11,
                      fill: SIGNAL_CHART.text,
                      fontWeight: 600,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, Math.ceil(maxCtr * 1.25 * 10) / 10]}
                    tickFormatter={(v: number) => `${v}%`}
                    tick={{ fontSize: 10, fill: SIGNAL_CHART.muted }}
                    axisLine={false}
                    tickLine={false}
                    width={45}
                  />
                  <Tooltip
                    content={<CtrTooltip />}
                    cursor={{ fill: SIGNAL_CHART.track }}
                  />
                  <Bar
                    dataKey="ctr"
                    name="CTR"
                    barSize={56}
                    radius={[4, 4, 0, 0]}
                  >
                    {data.map((d) => (
                      <Cell key={d.platform} fill={d.color} />
                    ))}
                    <LabelList
                      dataKey="ctr"
                      position="top"
                      formatter={(v: number) => `${Number(v).toFixed(2)}%`}
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        fill: SIGNAL_CHART.text,
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {data.map((d) => (
                <div
                  key={d.platform}
                  className="border-l-2 pl-3"
                  style={{ borderColor: d.color }}
                >
                  <dt className="flex items-center gap-2 font-signal-mono text-[10px] uppercase tracking-[0.14em] text-signal-muted">
                    <PlatformIcon name={d.platform} />
                    {d.label}
                  </dt>
                  <dd className="mt-1 font-signal-display text-2xl font-semibold tabular-nums text-signal-text">
                    {d.ctr.toFixed(2)}%
                  </dd>
                  <dd className="mt-0.5 font-signal-mono text-[10px] tabular-nums text-signal-muted">
                    {fmtNum(d.clicks)} clicks · {fmtNum(d.views)} views
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mt-4 border-t border-signal-border pt-4 text-xs leading-5 text-signal-muted">
              Facebook uses post-level clicks. Instagram has no per-post clicks,
              so account-level profile clicks are divided by total post views —
              treat the two as directional, not strictly like-for-like.
            </p>
            {igError && (
              <p className="mt-2 font-signal-mono text-[10px] uppercase tracking-wide text-signal-coral">
                Instagram profile clicks unavailable — IG CTR shows 0%.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
