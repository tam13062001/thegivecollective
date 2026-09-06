// src/components/insights/BestTimeBigCard.tsx
// Best time to post for TikTok / Facebook / YouTube (own post history only).
import { PLATFORM_THEMES } from "../../constants/insights";
import { usePostHistoryGrid } from "../../hooks/insights/usePostHistoryGrid";
import type { Post } from "../../types/insights";
import { PlatformIcon } from "./PlatformIcon";
import { PostHistoryGridView } from "./PostHistoryGridView";

export function BestTimeBigCard({
  platform,
  posts,
  loading,
}: {
  platform: "tiktok" | "facebook" | "youtube";
  posts: Post[];
  loading: boolean;
}) {
  const theme = PLATFORM_THEMES[platform];
  const { grid, minAvg, maxAvg, hasData } = usePostHistoryGrid(posts);

  return (
    <div
      className="signal-panel overflow-hidden rounded-2xl border border-signal-border border-t-4"
      style={{ borderTopColor: theme.accent }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-signal-border px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <PlatformIcon name={platform} />
          <span
            className="font-signal-display text-lg font-semibold"
            style={{ color: theme.accent }}
          >
            Best time to post (SGT)
          </span>
        </div>
        <span className="font-signal-mono text-[10px] uppercase tracking-wide text-signal-muted sm:text-xs">
          {loading ? "Loading..." : "All available history"}
        </span>
      </div>
      <div className="p-4 sm:p-6">
        <PostHistoryGridView
          grid={grid}
          minAvg={minAvg}
          maxAvg={maxAvg}
          hasData={hasData}
          loading={loading}
          platform={platform}
        />
      </div>
    </div>
  );
}
