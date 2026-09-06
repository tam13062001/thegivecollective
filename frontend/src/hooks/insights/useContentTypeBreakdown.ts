// src/hooks/insights/useContentTypeBreakdown.ts
// Groups posts by whatever content type value exists in the data (not a fixed list).

import { useMemo } from "react";
import { formatTypeLabel } from "../../utils/insights";
import type { ContentTypeRow, Post } from "../../types/insights";

export function useContentTypeBreakdown(posts: Post[]): ContentTypeRow[] {
  return useMemo(() => {
    const groups: Record<
      string,
      {
        count: number;
        views: number;
        likes: number;
        shares: number;
        platforms: Set<string>;
      }
    > = {};

    for (const p of posts) {
      // Prefer the normalized contentType, fall back to rawMediaType if available,
      // and finally fall back to 'unknown' — not limited to a fixed list.
      const raw =
        (p.contentType && p.contentType !== "unknown"
          ? p.contentType
          : p.rawMediaType) || "unknown";
      const key = String(raw).trim() || "unknown";

      if (!groups[key]) {
        groups[key] = {
          count: 0,
          views: 0,
          likes: 0,
          shares: 0,
          platforms: new Set(),
        };
      }
      groups[key].count += 1;
      groups[key].views += p.views || 0;
      groups[key].likes += p.likes || 0;
      groups[key].shares += p.shares || 0;
      if (p.platform) groups[key].platforms.add(p.platform);
    }

    return Object.entries(groups)
      .map(([key, g]) => ({
        key,
        label: formatTypeLabel(key),
        count: g.count,
        totalViews: g.views,
        avgViews: Math.round(g.views / g.count),
        avgLikes: Math.round(g.likes / g.count),
        avgShares: Math.round(g.shares / g.count),
        engagementRate:
          g.views > 0
            ? (((g.likes + g.shares) / g.views) * 100).toFixed(1)
            : "0.0",
        platforms: Array.from(g.platforms),
      }))
      .sort((a, b) => b.count - a.count);
  }, [posts]);
}
