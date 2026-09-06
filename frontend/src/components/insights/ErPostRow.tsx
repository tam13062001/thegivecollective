// src/components/insights/ErPostRow.tsx
import { fmtNum, formatSgtDateTime, getCtr } from "../../utils/insights";
import type { ErRow } from "../../types/insights";
import { ContentTypeBadge } from "./ContentTypeBadge";
import { PlatformIcon } from "../common/PlatformIcon";

export function ErPostRow({ row, rank }: { row: ErRow; rank: number }) {
  const ctr = getCtr(row);

  return (
    <a
      href={row.url}
      target="_blank"
      rel="noreferrer"
      className={`group flex items-center gap-2.5 rounded-lg border border-signal-border bg-signal-surface px-2.5 py-3 transition-colors sm:gap-3 sm:px-3 sm:py-3 ${row.url ? "hover:border-signal-cyan hover:bg-signal-track" : "pointer-events-none"}`}
    >
      <span className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-full bg-signal-track font-signal-mono text-[10px] font-bold text-signal-muted sm:flex">
        {rank}
      </span>
      <PlatformIcon name={row.platform} />
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-1.5">
          <ContentTypeBadge type={row.contentType} />
          <span className="shrink-0 font-signal-mono text-[9px] text-signal-muted sm:text-[10px]">
            {formatSgtDateTime(row.date)}
          </span>
        </div>
        <h4
          className="truncate text-[11px] font-semibold leading-snug text-signal-text sm:text-xs"
          title={row.title}
        >
          {row.title}
        </h4>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-signal-mono text-[9px] tabular-nums text-signal-muted sm:text-[10px]">
          {fmtNum(row.views)} views
        </p>
        <p className="text-xs font-bold tabular-nums text-signal-cyan sm:text-[13px]">
          {row.er.toFixed(1)}%
        </p>
        {ctr && (
          <p className="font-signal-mono text-[9px] font-semibold tabular-nums text-signal-coral sm:text-[10px]">
            CTR {ctr}%
          </p>
        )}
      </div>
    </a>
  );
}
