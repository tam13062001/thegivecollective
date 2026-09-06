// src/components/insights/EngagementRateTables.tsx
// Posts split into above / below average engagement rate, filterable by
// platform + month (SGT), each side paginated.
import { ENGAGEMENT_PAGE_SIZE } from "../../constants/insights";
import { useEngagementRateGroups } from "../../hooks/insights/useEngagementRateGroups";
import type { ErRow, Post } from "../../types/insights";
import { EngagementPagination } from "./EngagementPagination";
import { ErPostRow } from "./ErPostRow";
import { PlatformFilterChips } from "./PlatformFilterChips";

function ErGroupColumn({
  title,
  tone,
  rows,
  visibleRows,
  page,
  pageCount,
  onPageChange,
  emptyLabel,
}: {
  title: string;
  tone: "above" | "below";
  rows: ErRow[];
  visibleRows: ErRow[];
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  emptyLabel: string;
}) {
  const toneText = tone === "above" ? "text-emerald-600" : "text-rose-600";
  const toneDot = tone === "above" ? "bg-emerald-500" : "bg-rose-500";

  return (
    <div className="p-3 sm:p-4">
      <div className="mb-2.5 flex items-center justify-between px-1 sm:mb-3">
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide sm:text-xs ${toneText}`}
        >
          <span className={`h-2 w-2 rounded-full ${toneDot}`} />
          {title}
        </span>
        <span className="text-[10px] text-signal-muted sm:text-[11px]">
          {rows.length} posts
        </span>
      </div>
      <div className="space-y-1.5 pr-1 sm:space-y-2">
        {rows.length === 0 ? (
          <div className="flex h-20 items-center justify-center text-[12px] text-signal-muted">
            {emptyLabel}
          </div>
        ) : (
          visibleRows.map((r, i) => (
            <ErPostRow
              key={r.id}
              row={r}
              rank={(page - 1) * ENGAGEMENT_PAGE_SIZE + i + 1}
            />
          ))
        )}
      </div>
      <EngagementPagination
        page={page}
        pageCount={pageCount}
        pageSize={ENGAGEMENT_PAGE_SIZE}
        total={rows.length}
        onPageChange={onPageChange}
      />
    </div>
  );
}

export function EngagementRateTables({
  posts,
  loading,
}: {
  posts: Post[];
  loading: boolean;
}) {
  const {
    selectedPlatform,
    setSelectedPlatform,
    selectedMonth,
    setSelectedMonth,
    availablePlatforms,
    availableMonths,
    avgEr,
    rows,
    aboveAvg,
    belowAvg,
    visibleAboveAvg,
    visibleBelowAvg,
    abovePage,
    setAbovePage,
    belowPage,
    setBelowPage,
    abovePageCount,
    belowPageCount,
  } = useEngagementRateGroups(posts);

  return (
    <div className="signal-panel overflow-hidden rounded-2xl border border-signal-border lg:col-span-12">
      <div className="flex flex-col gap-3 border-b border-signal-border bg-signal-surface px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-signal-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-signal-cyan sm:text-[11px]">
            Engagement compared with the average
            {selectedPlatform && (
              <span className="ml-1.5 font-semibold normal-case text-signal-muted">
                · {selectedPlatform}
              </span>
            )}
          </span>
          <span className="font-signal-mono text-[10px] text-signal-muted sm:text-xs">
            {loading
              ? "Loading..."
              : `Avg ER: ${avgEr.toFixed(1)}% · ${rows.length} posts (SGT)`}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <PlatformFilterChips
            platforms={availablePlatforms}
            active={selectedPlatform}
            onChange={setSelectedPlatform}
          />

          <label className="flex min-h-10 items-center gap-2 rounded-md border border-signal-border px-3 text-[11px] font-semibold text-signal-muted">
            <span className="font-signal-mono text-[9px] uppercase tracking-wide">
              Month
            </span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              aria-label="Filter engagement by month"
              className="cursor-pointer border-0 bg-transparent py-2 text-xs font-semibold text-signal-text outline-none focus:ring-0"
            >
              <option value="all">All months</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex h-24 items-center justify-center text-[13px] text-signal-muted sm:text-sm">
          {loading ? "Loading..." : "No engagement data available yet."}
        </div>
      ) : (
        <div className="grid grid-cols-1 divide-y divide-signal-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <ErGroupColumn
            title="Above Average ER"
            tone="above"
            rows={aboveAvg}
            visibleRows={visibleAboveAvg}
            page={abovePage}
            pageCount={abovePageCount}
            onPageChange={setAbovePage}
            emptyLabel="No posts above average."
          />
          <ErGroupColumn
            title="Below Average ER"
            tone="below"
            rows={belowAvg}
            visibleRows={visibleBelowAvg}
            page={belowPage}
            pageCount={belowPageCount}
            onPageChange={setBelowPage}
            emptyLabel="No posts below average."
          />
        </div>
      )}
    </div>
  );
}
