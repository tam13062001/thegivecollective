// src/components/insights/ContentTypeBreakdownTable.tsx
// Dynamic table — shows exactly the content types present in the data.
import { useContentTypeBreakdown } from "../../hooks/insights/useContentTypeBreakdown";
import { fmtNum } from "../../utils/insights";
import type { Post } from "../../types/insights";
import { PlatformIcon } from "../common/PlatformIcon";

const HEAD_CELL =
  "px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-signal-muted sm:text-[11px]";
const NUM_CELL =
  "px-4 py-2.5 text-right text-xs tabular-nums text-signal-muted sm:text-[13px]";

export function ContentTypeBreakdownTable({
  posts,
  loading,
}: {
  posts: Post[];
  loading: boolean;
}) {
  const rows = useContentTypeBreakdown(posts);

  return (
    <div className="signal-panel overflow-hidden rounded-2xl border border-signal-border">
      <div className="flex items-center justify-between border-b border-signal-border px-4 py-3 sm:px-5">
        <span className="font-signal-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-signal-cyan sm:text-[11px]">
          Content type breakdown
        </span>
        <span className="font-signal-mono text-[10px] text-signal-muted sm:text-xs">
          {loading
            ? "Loading..."
            : `${rows.length} type${rows.length === 1 ? "" : "s"} found`}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="flex h-24 items-center justify-center text-[13px] text-signal-muted sm:text-sm">
          {loading ? "Loading..." : "No content type data available yet."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-left">
            <thead>
              <tr className="border-b border-signal-border bg-signal-track">
                <th className={HEAD_CELL}>Type</th>
                <th className={HEAD_CELL}>Platforms</th>
                <th className={`${HEAD_CELL} text-right`}>Posts</th>
                <th className={`${HEAD_CELL} text-right`}>Total Views</th>
                <th className={`${HEAD_CELL} text-right`}>Avg Views</th>
                <th className={`${HEAD_CELL} text-right`}>Avg Likes</th>
                <th className={`${HEAD_CELL} text-right`}>Avg Shares</th>
                <th
                  className={`${HEAD_CELL} text-right text-signal-cyan`}
                >
                  Eng. Rate
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.key}
                  className="border-b border-signal-border last:border-0"
                >
                  <td className="px-4 py-2.5">
                    <span className="text-xs font-semibold text-signal-text sm:text-[13px]">
                      {r.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-1">
                      {r.platforms.map((pl) => (
                        <PlatformIcon key={pl} name={pl} />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs font-bold tabular-nums text-signal-text sm:text-[13px]">
                    {r.count}
                  </td>
                  <td className={NUM_CELL}>{fmtNum(r.totalViews)}</td>
                  <td className={NUM_CELL}>{fmtNum(r.avgViews)}</td>
                  <td className={NUM_CELL}>{fmtNum(r.avgLikes)}</td>
                  <td className={NUM_CELL}>{fmtNum(r.avgShares)}</td>
                  <td className="px-4 py-2.5 text-right text-xs font-bold tabular-nums text-signal-cyan sm:text-[13px]">
                    {r.engagementRate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
