// src/components/insights/ContentTypePerformanceCard.tsx
import { useMemo } from "react";
import {
  CONTENT_TYPE_META,
  CONTENT_TYPE_ORDER,
} from "../../constants/insights";
import { fmtNum } from "../../utils/insights";
import type { Post } from "../../types/insights";

export function ContentTypePerformanceCard({ posts }: { posts: Post[] }) {
  const chartData = useMemo(() => {
    const buckets: Record<
      string,
      { views: number; likes: number; shares: number; count: number }
    > = {};

    for (const p of posts) {
      const key = p.contentType;
      if (!buckets[key])
        buckets[key] = { views: 0, likes: 0, shares: 0, count: 0 };
      buckets[key].views += p.views;
      buckets[key].likes += p.likes;
      buckets[key].shares += p.shares;
      buckets[key].count += 1;
    }

    return CONTENT_TYPE_ORDER.filter(
      (t) => buckets[t] && buckets[t].count > 0,
    ).map((t) => {
      const b = buckets[t];
      return {
        type: CONTENT_TYPE_META[t].label,
        avgViews: Math.round(b.views / b.count),
        avgLikes: Math.round(b.likes / b.count),
        count: b.count,
      };
    });
  }, [posts]);

  const { maxViews, maxLikes } = useMemo(
    () => ({
      maxViews: Math.max(...chartData.map((d) => d.avgViews), 1),
      maxLikes: Math.max(...chartData.map((d) => d.avgLikes), 1),
    }),
    [chartData],
  );

  if (chartData.length === 0) return null;

  return (
    <div className="signal-panel overflow-hidden rounded-2xl border border-signal-border">
      <div className="flex items-center justify-between border-b border-signal-border px-4 py-3 sm:px-5">
        <span className="font-signal-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-signal-cyan sm:text-[11px]">
          Performance by content type
        </span>
        <span className="font-signal-mono text-[10px] text-signal-muted sm:text-xs">
          Avg per post
        </span>
      </div>
      <div className="space-y-5 p-4 sm:p-5">
        <div className="flex items-center gap-4 font-signal-mono text-[10px] uppercase tracking-wide text-signal-muted">
          <span className="inline-flex items-center gap-2">
            <i className="h-2 w-2 rounded-full bg-signal-cyan" /> Avg views
          </span>
          <span className="inline-flex items-center gap-2">
            <i className="h-2 w-2 rounded-full bg-signal-slate" /> Avg likes
          </span>
        </div>
        <div className="space-y-5">
          {chartData.map((d) => (
            <div key={d.type} className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-signal-text">
                  {d.type}{" "}
                  <span className="font-signal-mono text-[10px] text-signal-muted">
                    · {d.count} posts
                  </span>
                </span>
                <span className="font-signal-mono text-[10px] text-signal-muted">
                  {fmtNum(d.avgViews)} views
                </span>
              </div>
              <div
                className="space-y-1.5"
                aria-label={`${d.type}: average ${fmtNum(d.avgViews)} views and ${fmtNum(d.avgLikes)} likes per post`}
              >
                <div className="h-2 overflow-hidden rounded-sm bg-signal-track">
                  <div
                    className="h-full rounded-sm bg-signal-cyan"
                    style={{ width: `${(d.avgViews / maxViews) * 100}%` }}
                  />
                </div>
                <div className="h-2 overflow-hidden rounded-sm bg-signal-track">
                  <div
                    className="h-full rounded-sm bg-signal-slate"
                    style={{ width: `${(d.avgLikes / maxLikes) * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex justify-between font-signal-mono text-[10px] text-signal-muted">
                <span>{fmtNum(d.avgLikes)} likes</span>
                <span>
                  {((d.avgLikes / Math.max(d.avgViews, 1)) * 100).toFixed(1)}%
                  like/view
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="border-t border-signal-border pt-4 text-xs leading-5 text-signal-muted">
          Views and likes use separate honest scales so smaller signals remain
          legible.
        </p>
      </div>
    </div>
  );
}
