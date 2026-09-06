// src/components/insights/OverviewStats.tsx
// Headline metrics for the top-post cohort only (not account-wide).
import { useMemo } from "react";
import { fmtNum } from "../../utils/insights";
import type { Post } from "../../types/insights";
import { StatCard } from "../common/StatCard";

export function OverviewStats({
  posts,
  loading,
  platformCount,
}: {
  posts: Post[];
  loading: boolean;
  platformCount: number;
}) {
  const { totalViews, totalLikes, engagementRate } = useMemo(() => {
    const views = posts.reduce((s, p) => s + p.views, 0);
    const likes = posts.reduce((s, p) => s + p.likes, 0);
    const shares = posts.reduce((s, p) => s + p.shares, 0);
    return {
      totalViews: views,
      totalLikes: likes,
      engagementRate:
        views > 0 ? (((likes + shares) / views) * 100).toFixed(1) : "0.0",
    };
  }, [posts]);

  const isEmpty = loading && posts.length === 0;
  const platformSuffix = `${platformCount} platform${platformCount === 1 ? "" : "s"}`;

  return (
    <>
      <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-signal-border sm:grid-cols-3 sm:divide-x sm:divide-signal-border">
        <StatCard
          label="Total views"
          value={isEmpty ? "—" : fmtNum(totalViews)}
          sub={`Top posts only · ${platformSuffix}`}
          tone="up"
        />
        <StatCard
          label="Total likes"
          value={isEmpty ? "—" : fmtNum(totalLikes)}
          sub={`Same top-post cohort · ${platformSuffix}`}
          tone="none"
        />
        <StatCard
          label="Engagement rate"
          value={isEmpty ? "—" : `${engagementRate}%`}
          sub="Likes + shares ÷ views · top posts"
          tone="down"
        />
      </div>
      <p
        id="briefing-heading"
        className="font-signal-mono text-[10px] leading-5 text-signal-muted sm:text-[11px]"
      >
        Scope note: headline values describe the top-post cohort, not
        account-wide performance.
      </p>
    </>
  );
}
