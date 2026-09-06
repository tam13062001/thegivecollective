// src/components/insights/TopPostsCard.tsx
// Top posts grouped per platform, filterable by content type.
import { ExternalLink } from "lucide-react";
import { CONTENT_TYPE_META } from "../../constants/insights";
import { useTopPostsGrouping } from "../../hooks/insights/useTopPostsGrouping";
import { fmtNum, formatSgtDateTime, getCtr } from "../../utils/insights";
import type { Post } from "../../types/insights";
import { ContentTypeBadge } from "./ContentTypeBadge";
import { ContentTypeFilterChips } from "./ContentTypeFilterChips";
import { InlineDataState } from "./InlineDataState";
import { PlatformIcon } from "./PlatformIcon";

function MetricCell({
  label,
  value,
  className = "",
  valueClassName = "text-signal-text",
}: {
  label: string;
  value: string;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={className}>
      <p className="font-signal-mono text-[9px] uppercase tracking-wide text-signal-muted">
        {label}
      </p>
      <p className={`text-sm font-semibold tabular-nums ${valueClassName}`}>
        {value}
      </p>
    </div>
  );
}

function TopPostRow({ post, index }: { post: Post; index: number }) {
  const er =
    post.views > 0
      ? (((post.likes + post.shares) / post.views) * 100).toFixed(1)
      : "0.0";
  const ctr = getCtr(post);

  return (
    <a
      href={post.url || undefined}
      target={post.url ? "_blank" : undefined}
      rel={post.url ? "noreferrer" : undefined}
      aria-label={post.url ? `Open ${post.title}` : undefined}
      className={`group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-4 transition-colors sm:grid-cols-[40px_minmax(0,1fr)_auto] sm:gap-4 ${post.url ? "hover:bg-signal-track/70" : "pointer-events-none"}`}
    >
      <span className="font-signal-mono text-sm tabular-nums text-signal-slate sm:text-base">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <ContentTypeBadge type={post.contentType} />
          <span className="font-signal-mono text-[10px] text-signal-muted sm:text-[11px]">
            {formatSgtDateTime(post.date)} SGT
          </span>
        </div>
        <h4
          className="flex min-w-0 items-center gap-2 truncate text-sm font-semibold text-signal-text group-hover:text-signal-cyan sm:text-[15px]"
          title={post.title}
        >
          <span className="truncate">{post.title}</span>
          {post.url && (
            <ExternalLink
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
            />
          )}
        </h4>
      </div>
      <div className="flex items-center gap-3 text-right sm:gap-5">
        <MetricCell
          label="Likes"
          value={fmtNum(post.likes)}
          className="hidden sm:block"
        />
        <MetricCell
          label="Shares"
          value={fmtNum(post.shares)}
          className="hidden sm:block"
        />
        <MetricCell label="Views" value={fmtNum(post.views)} />
        <MetricCell
          label="ER"
          value={`${er}%`}
          className="min-w-[46px]"
          valueClassName="font-bold text-signal-cyan"
        />
        {ctr && (
          <MetricCell
            label="CTR"
            value={`${ctr}%`}
            className="hidden min-w-[46px] sm:block"
            valueClassName="font-bold text-signal-coral"
          />
        )}
      </div>
    </a>
  );
}

export function TopPostsCard({
  posts,
  loading,
  error,
  onRetry,
}: {
  posts: Post[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const {
    activeContentType,
    setActiveContentType,
    availableContentTypes,
    groupedPosts,
  } = useTopPostsGrouping(posts);

  const platformEntries = Object.entries(groupedPosts);

  return (
    <div className="signal-panel flex flex-col overflow-hidden rounded-2xl border border-signal-border lg:col-span-7">
      <div className="flex flex-col gap-3 border-b border-signal-border bg-signal-surface px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between">
          <span className="font-signal-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-signal-cyan sm:text-[11px]">
            Top posts
          </span>
          <span className="font-signal-mono text-[10px] text-signal-muted sm:text-xs">
            {loading ? "Loading..." : "Top 5 / platform"}
          </span>
        </div>
        <ContentTypeFilterChips
          availableTypes={availableContentTypes}
          active={activeContentType}
          onChange={setActiveContentType}
        />
      </div>

      <div className="flex-1 space-y-6 p-4 sm:space-y-8 sm:p-5">
        {loading && posts.length === 0 ? (
          <div className="space-y-3 py-8" aria-live="polite">
            <div className="h-12 animate-pulse rounded-lg bg-signal-track" />
            <div className="h-12 animate-pulse rounded-lg bg-signal-track" />
            <div className="h-12 animate-pulse rounded-lg bg-signal-track" />
            <p className="font-signal-mono text-[10px] uppercase tracking-wide text-signal-muted">
              Loading top posts...
            </p>
          </div>
        ) : error && posts.length === 0 ? (
          <InlineDataState
            tone="error"
            title="Couldn’t load top posts."
            description="Other sections remain available."
            actionLabel="Try again"
            onAction={onRetry}
          />
        ) : platformEntries.length === 0 ? (
          <InlineDataState
            tone="empty"
            title={
              activeContentType === "all"
                ? "No posts available."
                : `No posts match “${CONTENT_TYPE_META[activeContentType].label}”.`
            }
            description={
              activeContentType === "all"
                ? "There are no loaded top-post rows yet."
                : "Try another content type."
            }
          />
        ) : (
          <div className="signal-scroll-area max-h-[560px] overflow-y-auto pr-1 sm:pr-2">
            {platformEntries.map(([platform, platformPosts]) => (
              <div
                key={platform}
                className="border-b border-signal-border last:border-0"
              >
                <div className="flex items-center gap-2 border-b border-signal-border pt-3 pb-3">
                  <PlatformIcon name={platform} />
                  <h3 className="font-signal-display text-lg font-semibold capitalize text-signal-text">
                    {platform}
                  </h3>
                  <span className="font-signal-mono text-[10px] uppercase tracking-wide text-signal-muted">
                    Top {platformPosts.length} / platform
                  </span>
                </div>

                <div className="divide-y divide-signal-border">
                  {platformPosts.map((post, i) => (
                    <TopPostRow key={post.id} post={post} index={i} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
