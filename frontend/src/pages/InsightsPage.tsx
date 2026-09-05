import { useState, useEffect, useMemo } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Layers3,
  Lightbulb,
  RefreshCw,
  Video,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

// Content type of a post
type ContentType =
  | "video"
  | "image"
  | "carousel"
  | "text"
  | "story"
  | "unknown";

type Post = {
  id: string | number;
  platform: string;
  title: string;
  views: number;
  likes: number;
  shares: number;
  clicks?: number;
  date: string;
  url?: string;
  contentType: ContentType;
  rawMediaType?: string;
};

type DemographicRow = {
  age: string;
  female: number;
  male: number;
  undisclosed: number;
};

type TimeEngagementHour = {
  pt_hour: number;
  vn_hour: number;
  followers_online: number;
};

type TimeEngagementData = {
  recommended_vn_times: string[];
  top_hours_detail: TimeEngagementHour[];
  full_day_stats: TimeEngagementHour[];
};

type PlatformKey = "tiktok" | "facebook" | "instagram" | "youtube";

type TimeEngagementDayStat = {
  end_time: string;
  top3_vn_times: string[];
  full_day_stats: { vn_hour: number; followers_online: number }[];
};

type TimeEngagementWeeklyData = Record<string, TimeEngagementDayStat>;

type TimeEngagementMonthlyDayStat = {
  top3_vn_times: string[];
  full_day_stats: { vn_hour: number; followers_online: number }[];
};

// monthKey (e.g. "Jan-2022") -> VN weekday label (e.g. "Thứ 2") -> stat
type TimeEngagementMonthlyData = Record<
  string,
  Record<string, TimeEngagementMonthlyDayStat>
>;

// Map display day labels (EN, shared with post-history grid) -> backend response keys (VN)
const VN_WEEKDAY_MAP: Record<string, string> = {
  Mon: "Thứ 2",
  Tue: "Thứ 3",
  Wed: "Thứ 4",
  Thu: "Thứ 5",
  Fri: "Thứ 6",
  Sat: "Thứ 7",
  Sun: "Chủ Nhật",
};

// ─── Constants ───────────────────────────────────────────────────────────────

const API_BASE_URL = "https://thegivecollective-backend.vercel.app/api/v1";

const REAL_DEMOGRAPHICS_SNAPSHOT: DemographicRow[] = [
  { age: "13-17", female: 8, male: 6, undisclosed: 10 },
  { age: "18-24", female: 33, male: 25, undisclosed: 30 },
  { age: "25-34", female: 62, male: 48, undisclosed: 26 },
  { age: "35-44", female: 61, male: 35, undisclosed: 16 },
  { age: "45-54", female: 22, male: 11, undisclosed: 7 },
  { age: "55-64", female: 13, male: 4, undisclosed: 1 },
  { age: "65+", female: 1, male: 2, undisclosed: 1 },
];

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOUR_LABELS = Array.from({ length: 12 }, (_, i) => i * 2);

const PLATFORM_TABS: { key: PlatformKey; label: string }[] = [
  { key: "tiktok", label: "TikTok" },
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "youtube", label: "YouTube" },
];

// Display metadata for each content type: label, icon, color
const CONTENT_TYPE_META: Record<
  ContentType,
  { label: string; icon: string; className: string }
> = {
  video: {
    label: "Video",
    icon: "▶",
    className: "bg-violet-100 text-violet-700 border-violet-200",
  },
  image: {
    label: "Image",
    icon: "🖼",
    className: "bg-sky-100 text-sky-700 border-sky-200",
  },
  carousel: {
    label: "Carousel",
    icon: "▦",
    className: "bg-amber-100 text-amber-700 border-amber-200",
  },
  story: {
    label: "Story",
    icon: "◐",
    className: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
  },
  text: {
    label: "Text",
    icon: "✎",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
  unknown: {
    label: "Other",
    icon: "•",
    className: "bg-slate-100 text-slate-500 border-slate-200",
  },
};

const CONTENT_TYPE_ORDER: ContentType[] = [
  "video",
  "image",
  "carousel",
  "story",
  "text",
  "unknown",
];

type PlatformTheme = {
  accent: string;
  soft: string;
  marker: string;
  heatColors: readonly string[];
};

const PLATFORM_THEMES: Record<PlatformKey, PlatformTheme> = {
  tiktok: {
    accent: "#111827",
    soft: "#f3f4f6",
    marker: "#00a8a2",
    heatColors: [
      "#f3f4f6",
      "#e5e7eb",
      "#d1d5db",
      "#9ca3af",
      "#6b7280",
      "#4b5563",
      "#374151",
      "#111827",
    ],
  },
  facebook: {
    accent: "#1877f2",
    soft: "#eff6ff",
    marker: "#1877f2",
    heatColors: [
      "#eff6ff",
      "#dbeafe",
      "#bfdbfe",
      "#93c5fd",
      "#60a5fa",
      "#3b82f6",
      "#2563eb",
      "#1d4ed8",
    ],
  },
  instagram: {
    accent: "#c13584",
    soft: "#fdf2f8",
    marker: "#c13584",
    heatColors: [
      "#fff1f2",
      "#ffe4e6",
      "#fecdd3",
      "#fda4af",
      "#fb7185",
      "#f43f5e",
      "#e11d48",
      "#be123c",
    ],
  },
  youtube: {
    accent: "#ff0000",
    soft: "#fff1f2",
    marker: "#ff0000",
    heatColors: [
      "#fff1f2",
      "#fee2e2",
      "#fecaca",
      "#fca5a5",
      "#f87171",
      "#ef4444",
      "#dc2626",
      "#991b1b",
    ],
  },
};

const SIGNAL_CHART = {
  ink: "#172033",
  panel: "#ffffff",
  surface: "#ffffff",
  track: "#f1f5f9",
  text: "#172033",
  muted: "#64748b",
  border: "#e2e8f0",
  cyan: "#0891b2",
  coral: "#e11d48",
  amber: "#d97706",
  slate: "#64748b",
  female: "#e11d48",
  male: "#0891b2",
  undisclosed: "#94a3b8",
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function splitDateTime(dateStr: string): { date: string; time: string } {
  if (!dateStr) return { date: "—", time: "" };
  const [datePart, timePart] = dateStr.split(" ");
  return { date: datePart || "—", time: timePart || "" };
}

// Parse a "YYYY-MM-DD HH:mm" date string (stored in VN time) and shift it
// forward by 1 hour to get the equivalent SGT (Singapore) time.
function toSgtDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr.replace(" ", "T"));
  if (isNaN(d.getTime())) return null;
  d.setHours(d.getHours() + 1);
  return d;
}

// Format a VN-time date string as a "YYYY-MM-DD HH:mm" SGT string for display.
function formatSgtDateTime(dateStr: string): string {
  const d = toSgtDate(dateStr);
  if (!d) return dateStr || "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Normalize content type from various backend field/value sources
function normalizeContentType(raw: any): ContentType {
  const val = String(
    raw?.contentType ??
    raw?.content_type ??
    raw?.mediaType ??
    raw?.media_type ??
    raw?.type ??
    "",
  )
    .toLowerCase()
    .trim();

  if (!val) return "unknown";

  if (["video", "reel", "reels", "short", "shorts"].includes(val))
    return "video";
  if (["image", "photo", "picture", "img"].includes(val)) return "image";
  if (["carousel", "album", "sidecar", "gallery"].includes(val))
    return "carousel";
  if (["story", "stories"].includes(val)) return "story";
  if (["text", "status", "note"].includes(val)) return "text";

  return "unknown";
}

function normalizeTopPosts(raw: any): Post[] {
  let rawArray: any[] = [];
  if (Array.isArray(raw)) {
    rawArray = raw;
  } else if (raw && typeof raw === "object" && Array.isArray(raw.posts)) {
    rawArray = raw.posts;
  }
  const flatDocs = rawArray.flat();

  return flatDocs.map((doc, idx) => ({
    id: doc._id || idx + 1,
    platform: doc.platform || "Unknown",
    title: doc.title || "(No title)",
    views: doc.views || 0,
    likes: doc.likes || 0,
    shares: doc.shares || 0,
    clicks: doc.clicks || 0, // ← dòng bị thiếu, đây là lý do BE có data nhưng FE không hiện
    date: doc.date || "",
    url: doc.url || "",
    contentType: normalizeContentType(doc),
    rawMediaType: doc.rawMediaType || doc.mediaType || doc.media_type || "",
  }));
}

function getCtr(post: Post): string | null {
  if (post.platform?.toLowerCase() !== "facebook") return null;
  if (!post.clicks || post.views <= 0) return null;
  return ((post.clicks / post.views) * 100).toFixed(1);
}

// ─── Trend styles ──────────────────────────────────────────────────────────────

const TREND = {
  up: {
    dot: "bg-emerald-500",
    border: "border-emerald-200",
    bg: "bg-emerald-50/60",
  },
  down: { dot: "bg-rose-500", border: "border-rose-200", bg: "bg-rose-50/60" },
  none: { dot: "bg-slate-400", border: "border-slate-100", bg: "bg-slate-50" },
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  colorKey,
}: {
  label: string;
  value: string;
  sub: string;
  colorKey: keyof typeof TREND;
}) {
  const tone = colorKey === "up" ? "cyan" : colorKey === "down" ? "coral" : "slate";
  return (
    <div
      data-tone={tone === "cyan" ? undefined : tone}
      className="signal-metric-card min-h-[132px] border p-4 sm:p-5"
    >
      <p className="font-signal-mono text-[10px] uppercase tracking-[0.14em] text-signal-muted sm:text-[11px]">
        {label}
      </p>
      <p className="mt-4 font-signal-display text-3xl font-semibold leading-none tabular-nums text-signal-text sm:text-4xl">
        {value}
      </p>
      <p className="mt-3 max-w-[24ch] text-[11px] leading-5 text-signal-muted sm:text-xs">
        {sub}
      </p>
    </div>
  );
}

// ─── Chart Tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[140px] rounded-lg border border-signal-border bg-signal-surface px-3 py-2 shadow-lg">
      <p className="mb-1 font-signal-mono text-[10px] uppercase tracking-wide text-signal-muted">
        {label}
      </p>
      {payload.map((p: any) => (
        <p
          key={p.dataKey}
          className="text-xs font-bold tabular-nums text-signal-text sm:text-sm"
          style={{ color: p.color ?? p.fill ?? SIGNAL_CHART.cyan }}
        >
          {fmtNum(p.value)}{" "}
          <span className="font-signal-body font-normal text-signal-muted">
            {p.name ?? p.dataKey}
          </span>
        </p>
      ))}
    </div>
  );
}

function InlineDataState({
  tone,
  title,
  description,
  actionLabel,
  onAction,
}: {
  tone: "loading" | "empty" | "error";
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const toneClass =
    tone === "error"
      ? "border-signal-coral/50 text-signal-coral"
      : tone === "loading"
        ? "border-signal-cyan/50 text-signal-cyan"
        : "border-signal-border text-signal-muted";

  return (
    <div className={`border-l-2 px-4 py-6 ${toneClass}`} role={tone === "loading" ? "status" : undefined}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-signal-display text-xl font-semibold text-signal-text">{title}</p>
          {description && <p className="mt-1 text-sm text-signal-muted">{description}</p>}
        </div>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md border border-signal-border bg-signal-surface px-3 py-2 text-xs font-semibold text-signal-text transition-colors hover:border-signal-cyan hover:text-signal-cyan focus-visible:outline-none"
          >
            {actionLabel}
            <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {tone === "empty" && (
        <ArrowRight aria-hidden="true" className="mt-4 h-4 w-4 text-signal-muted" />
      )}
    </div>
  );
}

// ─── Platform Icon ─────────────────────────────────────────────────────────────

function PlatformIcon({ name }: { name: string }) {
  const map: Record<string, { bg: string; label: string }> = {
    tiktok: { bg: "bg-black", label: "TK" },
    facebook: { bg: "bg-blue-600", label: "FB" },
    instagram: { bg: "bg-pink-500", label: "IG" },
    twitter: { bg: "bg-sky-500", label: "TW" },
    youtube: { bg: "bg-red-600", label: "YT" },
    linkedin: { bg: "bg-blue-700", label: "LI" },
    threads: { bg: "bg-gray-800", label: "TH" },
  };
  const p = map[name.toLowerCase()] ?? {
    bg: "bg-slate-500",
    label: name.slice(0, 2).toUpperCase(),
  };
  return (
    <span
      role="img"
      aria-label={`${name} platform`}
      title={name}
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[9px] font-bold text-white sm:h-7 sm:w-7 sm:text-[10px] ${p.bg}`}
    >
      {p.label}
    </span>
  );
}

// ─── Content Type Badge ─────────────────────────────────────────────────────────

function ContentTypeGlyph({ type }: { type: ContentType }) {
  const Icon =
    type === "video"
      ? Video
      : type === "image"
        ? ImageIcon
        : type === "carousel"
          ? Layers3
          : type === "text"
            ? FileText
            : type === "story"
              ? CircleDot
              : CircleDot;

  return <Icon aria-hidden="true" className="h-3 w-3" strokeWidth={2.2} />;
}

function ContentTypeBadge({ type }: { type: ContentType }) {
  const meta = CONTENT_TYPE_META[type];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-signal-border bg-signal-track px-1.5 py-0.5 text-[9px] font-semibold text-signal-muted sm:text-[10px]"
      title={meta.label}
    >
      <ContentTypeGlyph type={type} />
      {meta.label}
    </span>
  );
}

// ─── Content Type Filter Chips ──────────────────────────────────────────────────

function ContentTypeFilterChips({
  availableTypes,
  active,
  onChange,
}: {
  availableTypes: ContentType[];
  active: ContentType | "all";
  onChange: (t: ContentType | "all") => void;
}) {
  if (availableTypes.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter top posts by content type">
      <button
        type="button"
        aria-pressed={active === "all"}
        onClick={() => onChange("all")}
        className={`min-h-10 rounded-md border px-3 py-2 text-[11px] font-semibold transition-colors focus-visible:outline-none sm:text-xs ${active === "all"
          ? "border-signal-text bg-signal-text text-signal-ink"
          : "border-signal-border bg-transparent text-signal-muted hover:border-signal-cyan hover:text-signal-cyan"
          }`}
      >
        All types
      </button>
      {availableTypes.map((t) => {
        const meta = CONTENT_TYPE_META[t];
        const isActive = active === t;
        return (
          <button
            key={t}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(t)}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-md border px-3 py-2 text-[11px] font-semibold transition-colors focus-visible:outline-none sm:text-xs ${isActive
              ? "border-signal-cyan bg-signal-cyan text-signal-ink"
              : "border-signal-border bg-transparent text-signal-muted hover:border-signal-cyan hover:text-signal-cyan"
              }`}
          >
            <ContentTypeGlyph type={t} />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Content Type Performance Chart ─────────────────────────────────────────────

function ContentTypePerformanceCard({ posts }: { posts: Post[] }) {
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

  if (chartData.length === 0) {
    return null;
  }

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
          <span className="inline-flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-signal-cyan" /> Avg views</span>
          <span className="inline-flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-signal-slate" /> Avg likes</span>
        </div>
        <div className="space-y-5">
          {chartData.map((d) => {
            const maxValue = Math.max(...chartData.map((item) => item.avgViews), 1);
            const maxLikes = Math.max(...chartData.map((item) => item.avgLikes), 1);
            return (
              <div key={d.type} className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-signal-text">{d.type} <span className="font-signal-mono text-[10px] text-signal-muted">· {d.count} posts</span></span>
                  <span className="font-signal-mono text-[10px] text-signal-muted">{fmtNum(d.avgViews)} views</span>
                </div>
                <div className="space-y-1.5" aria-label={`${d.type}: average ${fmtNum(d.avgViews)} views and ${fmtNum(d.avgLikes)} likes per post`}>
                  <div className="h-2 overflow-hidden rounded-sm bg-signal-track">
                    <div className="h-full rounded-sm bg-signal-cyan" style={{ width: `${(d.avgViews / maxValue) * 100}%` }} />
                  </div>
                  <div className="h-2 overflow-hidden rounded-sm bg-signal-track">
                    <div className="h-full rounded-sm bg-signal-slate" style={{ width: `${(d.avgLikes / maxLikes) * 100}%` }} />
                  </div>
                </div>
                <div className="flex justify-between font-signal-mono text-[10px] text-signal-muted">
                  <span>{fmtNum(d.avgLikes)} likes</span>
                  <span>{((d.avgLikes / Math.max(d.avgViews, 1)) * 100).toFixed(1)}% like/view</span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="border-t border-signal-border pt-4 text-xs leading-5 text-signal-muted">
          Views and likes use separate honest scales so smaller signals remain legible.
        </p>
      </div>
    </div>
  );
}

// ─── Content Type Breakdown Table (dynamic — shows exactly what's present in the data) ───

type ContentTypeRow = {
  key: string;
  label: string;
  count: number;
  totalViews: number;
  avgViews: number;
  avgLikes: number;
  avgShares: number;
  engagementRate: string;
  platforms: string[];
};

// Convert a raw value (e.g. "CAROUSEL_ALBUM", "photo", "blog_post") into a readable label,
// no need to match a fixed list — just display whatever value exists.
function formatTypeLabel(raw: string): string {
  if (!raw) return "Unknown";
  return raw
    .replace(/[_-]/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function useContentTypeBreakdown(posts: Post[]): ContentTypeRow[] {
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

function ContentTypeBreakdownTable({
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
        <div className="flex items-center justify-center h-24 text-[13px] sm:text-sm text-slate-400">
          {loading ? "Loading..." : "No content type data available yet."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-2.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Type
                </th>
                <th className="px-4 py-2.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Platforms
                </th>
                <th className="px-4 py-2.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-slate-400 text-right">
                  Posts
                </th>
                <th className="px-4 py-2.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-slate-400 text-right">
                  Total Views
                </th>
                <th className="px-4 py-2.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-slate-400 text-right">
                  Avg Views
                </th>
                <th className="px-4 py-2.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-slate-400 text-right">
                  Avg Likes
                </th>
                <th className="px-4 py-2.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-slate-400 text-right">
                  Avg Shares
                </th>
                <th className="px-4 py-2.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-indigo-500 text-right">
                  Eng. Rate
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr
                  key={r.key}
                  className={`border-b border-slate-100 last:border-0 ${idx % 2 === 1 ? "bg-slate-50/40" : ""}`}
                >
                  <td className="px-4 py-2.5">
                    <span className="text-xs sm:text-[13px] font-semibold text-slate-700">
                      {r.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1 flex-wrap">
                      {r.platforms.map((pl) => (
                        <PlatformIcon key={pl} name={pl} />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs sm:text-[13px] font-bold tabular-nums text-slate-700">
                    {r.count}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs sm:text-[13px] tabular-nums text-slate-600">
                    {fmtNum(r.totalViews)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs sm:text-[13px] tabular-nums text-slate-600">
                    {fmtNum(r.avgViews)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs sm:text-[13px] tabular-nums text-slate-600">
                    {fmtNum(r.avgLikes)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs sm:text-[13px] tabular-nums text-slate-600">
                    {fmtNum(r.avgShares)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs sm:text-[13px] font-bold tabular-nums text-indigo-600">
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

// ─── Platform navbar switcher ───────────────────────────────────────────────────

function PlatformSwitcher({
  active,
  onChange,
}: {
  active: PlatformKey;
  onChange: (p: PlatformKey) => void;
}) {
  return (
    <div className="w-full overflow-x-auto pb-1 sm:w-auto" role="tablist" aria-label="Best time platform">
      <div className="inline-flex min-w-max items-stretch gap-1 border-b border-signal-border">
        {PLATFORM_TABS.map((p) => {
          const theme = PLATFORM_THEMES[p.key];
          const isActive = active === p.key;

          return (
            <button
              key={p.key}
              id={`timing-tab-${p.key}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(p.key)}
              className={`relative flex min-h-11 items-center gap-2 px-3 text-xs font-semibold transition-colors focus-visible:outline-none sm:px-4 ${isActive
                ? "text-signal-text"
                : "text-signal-muted hover:text-signal-text"
                }`}
              style={{ color: isActive ? theme.accent : undefined }}
            >
              <PlatformIcon name={p.key} />
              {p.label}
              <span
                aria-hidden="true"
                className="absolute inset-x-2 bottom-0 h-0.5"
                style={{ backgroundColor: isActive ? theme.accent : "transparent" }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Best Time to Post: shared post-history grid logic ─────────────────────────

type HeatCell = { count: number; totalViews: number };

function usePostHistoryGrid(posts: Post[]) {
  return useMemo(() => {
    const g: HeatCell[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ count: 0, totalViews: 0 })),
    );

    for (const post of posts) {
      if (!post.date) continue;
      const { time } = splitDateTime(post.date);
      if (!time) continue;

      const parsed = new Date(post.date.replace(" ", "T"));
      if (isNaN(parsed.getTime())) continue;

      // Add 1 hour to convert to SGT
      parsed.setHours(parsed.getHours() + 1);

      const dayIdx = (parsed.getDay() + 6) % 7;
      const hourIdx = parsed.getHours();

      g[dayIdx][hourIdx].count += 1;
      g[dayIdx][hourIdx].totalViews += post.views || 0;
    }

    let min = Infinity;
    let max = -Infinity;
    let any = false;
    for (const row of g) {
      for (const cell of row) {
        if (cell.count > 0) {
          any = true;
          const avg = cell.totalViews / cell.count;
          if (avg < min) min = avg;
          if (avg > max) max = avg;
        }
      }
    }

    return {
      grid: g,
      minAvg: any ? min : 0,
      maxAvg: any ? max : 0,
      hasData: any,
    };
  }, [posts]);
}

function PostHistoryGridView({
  grid,
  minAvg,
  maxAvg,
  hasData,
  loading,
  platform,
}: {
  grid: HeatCell[][];
  minAvg: number;
  maxAvg: number;
  hasData: boolean;
  loading: boolean;
  platform: PlatformKey;
}) {
  const theme = PLATFORM_THEMES[platform];
  const heatColors = theme.heatColors;

  const cellColor = (cell: HeatCell) => {
    if (cell.count === 0) return heatColors[0];
    if (maxAvg === minAvg) return heatColors[4];
    const avg = cell.totalViews / cell.count;
    const normalized = Math.max(0, Math.min(1, (avg - minAvg) / (maxAvg - minAvg)));
    const colorIndex = Math.round(normalized * (heatColors.length - 1));
    return heatColors[colorIndex];
  };

  if (!hasData && !loading) {
    return (
      <div className="flex items-center justify-center h-32 text-[13px] sm:text-sm text-slate-400">
        Not enough post time data to display.
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 flex-wrap text-[11px] sm:text-xs text-slate-500">
        <span className="tabular-nums">{fmtNum(minAvg)}</span>
        <span
          className="h-2 sm:h-2.5 w-24 sm:w-32 rounded-full"
          style={{
            background: `linear-gradient(to right, ${heatColors[0]}, ${heatColors[heatColors.length - 1]})`,
          }}
        />
        <span className="tabular-nums">{fmtNum(maxAvg)}</span>
        <span className="flex items-center gap-1 sm:gap-1.5 ml-1 sm:ml-2">
          <span
            className="inline-block h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5"
            style={{ backgroundColor: theme.marker }}
          />
          Your posts (SGT)
        </span>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="min-w-[650px] sm:min-w-[720px]">
          {WEEKDAY_LABELS.map((day, dayIdx) => (
            <div
              key={day}
              className="flex items-center gap-1 sm:gap-1.5 mb-1.5"
            >
              <span className="w-8 sm:w-9 text-[10px] sm:text-[11px] text-slate-400 text-right pr-1 sm:pr-2 shrink-0">
                {day}
              </span>
              <div className="flex gap-[3px] sm:gap-[4px] flex-1">
                {grid[dayIdx].map((cell, hourIdx) => (
                  <div
                    key={hourIdx}
                    role="img"
                    tabIndex={cell.count > 0 ? 0 : -1}
                    title={`${day} ${String(hourIdx).padStart(2, "0")}:00 SGT — ${cell.count} posts, ${fmtNum(cell.totalViews)} views`}
                    aria-label={`${day} ${String(hourIdx).padStart(2, "0")}:00 SGT, ${cell.count} posts, ${fmtNum(cell.totalViews)} views`}
                    className="relative flex-1 aspect-square rounded-[3px] outline-none transition-[filter] focus-visible:ring-2 focus-visible:ring-signal-cyan sm:rounded-[4px]"
                    style={{ backgroundColor: cellColor(cell) }}
                  >
                    {cell.count > 0 && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span
                          className="h-2.5 w-2.5 rounded-full sm:h-3.5 sm:w-3.5"
                          style={{ backgroundColor: theme.marker }}
                        />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Hour labels */}
          <div className="flex items-center gap-1 sm:gap-1.5 mt-2">
            <span className="w-8 sm:w-9 shrink-0" />
            <div className="flex-1 relative h-4">
              {HOUR_LABELS.map((h) => (
                <span
                  key={h}
                  className="absolute text-[9px] sm:text-[10px] text-slate-400 -translate-x-1/2"
                  style={{ left: `${(h / 24) * 100}%` }}
                >
                  {String(h).padStart(2, "0")}:00
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Big single-panel card: TikTok / Facebook / YouTube ───────────────

function BestTimeBigCard({
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

// ─── Big single-panel card: Instagram ──────

function InstagramBigCard({ posts }: { posts: Post[]; loading: boolean }) {
  const theme = PLATFORM_THEMES.instagram;
  const heatColors = theme.heatColors;

  // --- Data source 1: by month, each month has 7 days x 24 hours ---
  const [feMonthlyData, setFeMonthlyData] =
    useState<TimeEngagementMonthlyData | null>(null);
  const [feLoading, setFeLoading] = useState(false);
  const [feError, setFeError] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  // --- Data source 2: aggregated by hour, not split by day ---
  const [feDailyData, setFeDailyData] = useState<TimeEngagementData | null>(
    null,
  );
  const [feDailyLoading, setFeDailyLoading] = useState(false);
  const [feDailyError, setFeDailyError] = useState(false);

  useEffect(() => {
    const fetchMonthly = async () => {
      setFeLoading(true);
      setFeError(false);
      try {
        const res = await fetch(
          `${API_BASE_URL}/insights/time-engagement-monthly`,
        );
        const json = await res.json();
        if (!json.success) throw new Error(json.message || "Fetch failed");
        setFeMonthlyData(json.data);

        // Auto-select the most recent month (sort by actual time, not alphabetically)
        const monthKeys = Object.keys(json.data || {});
        if (monthKeys.length > 0) {
          const sorted = [...monthKeys].sort(
            (a, b) =>
              new Date(`1 ${a}`).getTime() - new Date(`1 ${b}`).getTime(),
          );
          setSelectedMonth(sorted[sorted.length - 1]);
        }
      } catch (err) {
        console.error("Error loading time-engagement-monthly (IG):", err);
        setFeError(true);
      } finally {
        setFeLoading(false);
      }
    };

    const fetchDaily = async () => {
      setFeDailyLoading(true);
      setFeDailyError(false);
      try {
        const res = await fetch(`${API_BASE_URL}/insights/time-engagement`);
        const json = await res.json();
        if (!json.success) throw new Error(json.message || "Fetch failed");
        setFeDailyData(json.data);
      } catch (err) {
        console.error("Error loading time-engagement (IG):", err);
        setFeDailyError(true);
      } finally {
        setFeDailyLoading(false);
      }
    };

    fetchMonthly();
    fetchDaily();
  }, []);

  // List of months with data, sorted newest first, used to render month selector tags
  const availableMonths = useMemo(() => {
    const keys = Object.keys(feMonthlyData || {});
    return keys.sort(
      (a, b) => new Date(`1 ${b}`).getTime() - new Date(`1 ${a}`).getTime(),
    );
  }, [feMonthlyData]);

  const feData = selectedMonth ? feMonthlyData?.[selectedMonth] : undefined;

  // Map "dayIdx-hourIdx" -> number of posts falling into that weekday + hour (SGT) in the selected month
  const postCountByCell = useMemo(() => {
    const map = new Map<string, number>();
    if (!selectedMonth) return map;

    const [monShort, yearStr] = selectedMonth.split("-");
    const refDate = new Date(`1 ${monShort} ${yearStr}`);
    const targetMonth = refDate.getMonth();
    const targetYear = refDate.getFullYear();

    console.log(
      "%c[IG monthly] selectedMonth:",
      "color:#ec4899;font-weight:bold",
      selectedMonth,
      "-> targetMonth:",
      targetMonth,
      "targetYear:",
      targetYear,
    );

    for (const p of posts) {
      if (!p.date) continue;
      const parts = p.date.trim().split(/\s+/);
      if (parts.length < 2) continue;

      const dPart = parts[0];
      const tPart =
        parts[1].length === 5 ? parts[1] : parts[1].padStart(5, "0");

      const vnLogicalDate = new Date(`${dPart}T${tPart}:00Z`);
      if (isNaN(vnLogicalDate.getTime())) {
        console.warn("[IG monthly] Could not parse date:", p.date);
        continue;
      }

      if (
        vnLogicalDate.getUTCMonth() !== targetMonth ||
        vnLogicalDate.getUTCFullYear() !== targetYear
      ) {
        continue; // not part of the selected month, skip logging to reduce noise
      }

      const sgtLogicalDate = new Date(
        vnLogicalDate.getTime() + 1 * 3600 * 1000,
      );
      const dayIdx = (sgtLogicalDate.getUTCDay() + 6) % 7;
      const hourIdx = sgtLogicalDate.getUTCHours();

      const key = `${dayIdx}-${hourIdx}`;
      map.set(key, (map.get(key) || 0) + 1);

      console.log(
        `[IG monthly] raw date="${p.date}" (VN)` +
        ` -> SGT hour=${String(hourIdx).padStart(2, "0")}:00` +
        ` | weekday=${WEEKDAY_LABELS[dayIdx]} (dayIdx=${dayIdx})` +
        ` | title="${String(p.title).slice(0, 30)}..."`,
      );
    }

    console.log(
      "[IG monthly] postCountByCell summary:",
      Object.fromEntries(map),
    );

    return map;
  }, [posts, selectedMonth]);

  // Build a 7-day x 24-hour grid from the selected month's data, converting VN -> SGT
  const {
    feGrid,
    feMin,
    feMax,
    feHasData,
    actualPostCountGrid,
    totalPostsThisMonth,
  } = useMemo(() => {
    const g: number[][] = Array.from({ length: 7 }, () =>
      new Array(24).fill(0),
    );
    const pCountGrid: number[][] = Array.from({ length: 7 }, () =>
      new Array(24).fill(0),
    );

    let min = Infinity;
    let max = -Infinity;
    let any = false;

    WEEKDAY_LABELS.forEach((label, dayIdx) => {
      const vnKey = VN_WEEKDAY_MAP[label];
      const dayStat = feData?.[vnKey];
      if (!dayStat) return;

      for (const h of dayStat.full_day_stats || []) {
        if (h.vn_hour < 0 || h.vn_hour >= 24) continue;

        const sgtHour = (h.vn_hour + 1) % 24;
        const targetDayIdx = h.vn_hour === 23 ? (dayIdx + 1) % 7 : dayIdx;

        g[targetDayIdx][sgtHour] = h.followers_online;
        any = true;
        if (h.followers_online < min) min = h.followers_online;
        if (h.followers_online > max) max = h.followers_online;
      }
    });

    // Fill in actual post counts for ALL cells present in postCountByCell
    // (not just cells with followers_online data, since a post may fall into
    // an hour without online_followers data)
    let totalPosts = 0;
    postCountByCell.forEach((count, key) => {
      const [dStr, hStr] = key.split("-");
      const d = Number(dStr);
      const h = Number(hStr);
      pCountGrid[d][h] = count;
      totalPosts += count;
    });

    return {
      feGrid: g,
      feMin: any ? min : 0,
      feMax: any ? max : 0,
      feHasData: any,
      actualPostCountGrid: pCountGrid,
      totalPostsThisMonth: totalPosts,
    };
  }, [feData, postCountByCell]);

  // Top 3 aggregated time slots in the selected month (already in SGT since feGrid was converted)
  const overallTop3SgtTimes = useMemo(() => {
    if (!feHasData) return [];
    const hourTotals = new Array(24).fill(0);
    feGrid.forEach((day) =>
      day.forEach((v, h) => {
        hourTotals[h] += v;
      }),
    );
    return hourTotals
      .map((total, hour) => ({ hour, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3)
      .map((t) => `${String(t.hour).padStart(2, "0")}:00`);
  }, [feGrid, feHasData]);

  // Build a single 24-hour row from the daily API, converting to SGT (keeping original logic)
  const {
    dailyRow,
    dailyMin,
    dailyMax,
    dailyHasData,
    dailyRecSet,
    recommendedSgtTimes,
  } = useMemo(() => {
    const hourly = new Array(24).fill(0);
    let any = false;

    for (const h of feDailyData?.full_day_stats || []) {
      if (h.vn_hour >= 0 && h.vn_hour < 24) {
        const sgtHour = (h.vn_hour + 1) % 24;
        hourly[sgtHour] = h.followers_online;
        any = true;
      }
    }

    let min = Infinity;
    let max = -Infinity;
    for (const v of hourly) {
      if (v < min) min = v;
      if (v > max) max = v;
    }

    const recSet = new Set(
      (feDailyData?.recommended_vn_times || []).map((t) => {
        const vnHour = Number(t.split(":")[0]);
        return (vnHour + 1) % 24;
      }),
    );

    const recSgtTimes = (feDailyData?.recommended_vn_times || []).map((t) => {
      const vnHour = Number(t.split(":")[0]);
      if (isNaN(vnHour)) return t;
      const sgtHour = (vnHour + 1) % 24;
      return `${String(sgtHour).padStart(2, "0")}:00`;
    });

    return {
      dailyRow: hourly,
      dailyMin: any ? min : 0,
      dailyMax: any ? max : 0,
      dailyHasData: any,
      dailyRecSet: recSet,
      recommendedSgtTimes: recSgtTimes,
    };
  }, [feDailyData]);

  const cellColor = (
    value: number,
    hasData: boolean,
    min: number,
    max: number,
  ) => {
    if (!hasData) return heatColors[0];
    if (max === min) return heatColors[4];
    const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));
    const colorIndex = Math.round(normalized * (heatColors.length - 1));
    return heatColors[colorIndex];
  };

  const bothLoading = feLoading && feDailyLoading;
  const bothError = feError && feDailyError;

  return (
    <div
      className="signal-panel overflow-hidden rounded-2xl border border-signal-border border-t-4"
      style={{ borderTopColor: theme.accent }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-signal-border px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <PlatformIcon name="instagram" />
          <span
            className="font-signal-display text-lg font-semibold"
            style={{ color: theme.accent }}
          >
            Best time to post (SGT)
          </span>
        </div>
        <span className="font-signal-mono text-[10px] uppercase tracking-wide text-signal-muted">
          Monthly + hourly follower activity
        </span>
      </div>

      <div className="p-4 sm:p-6">
        {bothError ? (
          <div className="flex items-center justify-center h-24 text-[13px] sm:text-sm text-slate-400">
            Failed to load data. Please try again later.
          </div>
        ) : !feHasData && !dailyHasData && !bothLoading ? (
          <div className="flex items-center justify-center h-24 text-[13px] sm:text-sm text-slate-400">
            Not enough data.
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            {/* ===== Table 1: By Month (7 days x 24 hours) ===== */}
            {feError ? (
              <div className="flex items-center justify-center h-20 text-[13px] sm:text-sm text-slate-400">
                Failed to load monthly data.
              </div>
            ) : availableMonths.length === 0 && !feLoading ? (
              <div className="flex items-center justify-center h-20 text-[13px] sm:text-sm text-slate-400">
                Not enough monthly data.
              </div>
            ) : (
              <div>
                {/* Month selector */}
                {availableMonths.length > 0 && (
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-3 sm:mb-4">
                    {availableMonths.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSelectedMonth(m)}
                        className={`text-[10px] sm:text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${selectedMonth === m
                          ? "text-white"
                          : "bg-white"
                          }`}
                        style={
                          selectedMonth === m
                            ? { backgroundColor: theme.accent, borderColor: theme.accent }
                            : { color: theme.accent, borderColor: `${theme.accent}55` }
                        }
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 flex-wrap text-[11px] sm:text-xs text-slate-500">
                  <span className="tabular-nums">{fmtNum(feMin)}</span>
                  <span
                    className="h-2 sm:h-2.5 w-24 sm:w-32 rounded-full"
                    style={{
background: `linear-gradient(to right, ${heatColors[0]}, ${heatColors[heatColors.length - 1]})`,
                    }}
                  />
                  <span className="tabular-nums">{fmtNum(feMax)}</span>
                  <span className="flex items-center gap-1 sm:gap-1.5 ml-1 sm:ml-2">
<span
                      className="inline-block h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5"
                      style={{ backgroundColor: theme.marker }}
                    />
                    Your posts
                  </span>
                </div>

                <div className="overflow-x-auto pb-2">
                  <div className="min-w-[650px] sm:min-w-[720px]">
                    {WEEKDAY_LABELS.map((day, dayIdx) => (
                      <div
                        key={day}
                        className="flex items-center gap-1 sm:gap-1.5 mb-1.5"
                      >
                        <span className="w-8 sm:w-9 text-[10px] sm:text-[11px] text-slate-400 text-right pr-1 sm:pr-2 shrink-0">
                          {day}
                        </span>
                        <div className="flex gap-[3px] sm:gap-[4px] flex-1">
                          {feGrid[dayIdx].map((value, hourIdx) => {
                            const postCount =
                              actualPostCountGrid[dayIdx][hourIdx];
                            return (
                              <div
                                key={hourIdx}
                                title={`${day} ${String(hourIdx).padStart(2, "0")}:00 SGT — ${fmtNum(value)} followers online, ${postCount} post${postCount === 1 ? "" : "s"} (${selectedMonth})`}
                                role="img"
                                tabIndex={postCount > 0 ? 0 : -1}
                                aria-label={`${day} ${String(hourIdx).padStart(2, "0")}:00 SGT, ${fmtNum(value)} followers online, ${postCount} posts, ${selectedMonth}`}
                                className="relative flex-1 aspect-square rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan sm:rounded-[4px]"
                                style={{
                                  backgroundColor: cellColor(
                                    value,
                                    feHasData,
                                    feMin,
                                    feMax,
                                  ),
                                }}
                              >
                                {postCount > 0 && (
                                  <span className="absolute inset-0 flex items-center justify-center">
<span
                                      className="flex min-w-[14px] items-center justify-center rounded-full px-0.5 text-[8px] font-bold leading-none text-white shadow-sm sm:min-w-[16px] sm:text-[9px]"
                                      style={{ backgroundColor: theme.marker }}
                                    >
                                      {postCount}
                                    </span>
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    <div className="flex items-center gap-1 sm:gap-1.5 mt-2">
                      <span className="w-8 sm:w-9 shrink-0" />
                      <div className="flex-1 relative h-4">
                        {HOUR_LABELS.map((h) => (
                          <span
                            key={h}
                            className="absolute text-[9px] sm:text-[10px] text-slate-400 -translate-x-1/2"
                            style={{ left: `${(h / 24) * 100}%` }}
                          >
                            {String(h).padStart(2, "0")}:00
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div
              className="border-t"
              style={{ borderColor: `${theme.accent}33` }}
            />

            {/* ===== Table 2: Aggregated by hour, not split by weekday (unchanged) ===== */}
            {feDailyError ? (
              <div className="flex items-center justify-center h-20 text-[13px] sm:text-sm text-slate-400">
                Failed to load hourly aggregated data.
              </div>
            ) : !dailyHasData && !feDailyLoading ? (
              <div className="flex items-center justify-center h-20 text-[13px] sm:text-sm text-slate-400">
                Not enough hourly aggregated data.
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 flex-wrap text-[11px] sm:text-xs text-slate-500">
                  <span className="tabular-nums">{fmtNum(dailyMin)}</span>
                  <span
                    className="h-2 sm:h-2.5 w-24 sm:w-32 rounded-full"
                    style={{
background: `linear-gradient(to right, ${heatColors[0]}, ${heatColors[heatColors.length - 1]})`,
                    }}
                  />
                  <span className="tabular-nums">{fmtNum(dailyMax)}</span>
                  <span className="flex items-center gap-1 sm:gap-1.5 ml-1 sm:ml-2">
<span
                      className="inline-block h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5"
                      style={{ backgroundColor: theme.marker }}
                    />
                    Recommended
                  </span>
                </div>

                <div className="overflow-x-auto pb-2">
                  <div className="min-w-[650px] sm:min-w-[720px]">
                    <div className="flex gap-[3px] sm:gap-[4px]">
                      {dailyRow.map((value, hourIdx) => (
                        <div
                          key={hourIdx}
                          title={`${String(hourIdx).padStart(2, "0")}:00 SGT — ${fmtNum(value)} followers online`}
                          role="img"
                          tabIndex={dailyRecSet.has(hourIdx) ? 0 : -1}
                          aria-label={`${String(hourIdx).padStart(2, "0")}:00 SGT, ${fmtNum(value)} followers online`}
                          className="relative flex-1 aspect-square rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan sm:rounded-[4px]"
                          style={{
                            backgroundColor: cellColor(
                              value,
                              dailyHasData,
                              dailyMin,
                              dailyMax,
                            ),
                          }}
                        >
                          {dailyRecSet.has(hourIdx) && (
                            <span className="absolute inset-0 flex items-center justify-center">
<span
                                className="h-2.5 w-2.5 rounded-full sm:h-3.5 sm:w-3.5"
                                style={{ backgroundColor: theme.marker }}
                              />
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="relative h-4 mt-2">
                      {HOUR_LABELS.map((h) => (
                        <span
                          key={h}
                          className="absolute text-[9px] sm:text-[10px] text-slate-400 -translate-x-1/2"
                          style={{ left: `${(h / 24) * 100}%` }}
                        >
                          {String(h).padStart(2, "0")}:00
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {recommendedSgtTimes.length > 0 && (
                  <div
                    className="mt-4 rounded-xl border p-3 sm:mt-5"
                    style={{
                      backgroundColor: theme.soft,
                      borderColor: `${theme.accent}55`,
                    }}
                  >
                    <p
                      className="mb-1.5 text-[11px] font-semibold sm:text-xs"
                      style={{ color: theme.accent }}
                    >
                      Best times to post:
                    </p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {recommendedSgtTimes.map((t) => (
                        <span
                          key={t}
                          className="rounded-full border bg-white px-2 py-0.5 text-[10px] font-bold sm:px-2.5 sm:text-xs"
                          style={{
                            color: theme.accent,
                            borderColor: `${theme.accent}55`,
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <p className="mt-3 text-[10px] sm:text-[11px] text-slate-400 leading-relaxed">
                  Actual online followers (SGT time) — not separated by day of
                  the week.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Engagement Rate Breakdown: below / above average, filterable by month ─────

type ErRow = Post & { er: number };

// Get a readable month label (e.g. "Jul 2026") from a VN-time date string
// "YYYY-MM-DD HH:mm", converted to SGT first so the month bucket matches SGT.
function getMonthLabel(dateStr: string): string | null {
  const d = toSgtDate(dateStr);
  if (!d) return null;
  return d.toLocaleString("en-US", { month: "short", year: "numeric" });
}

// Used as a real-time sort key for month labels (e.g. "Jul 2026" -> timestamp)
function monthLabelSortKey(label: string): number {
  const d = new Date(`1 ${label}`);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function MonthFilterChips({
  months,
  active,
  onChange,
}: {
  months: string[];
  active: string;
  onChange: (m: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        type="button"
        onClick={() => onChange("all")}
        className={`text-[10px] sm:text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${active === "all"
          ? "bg-slate-800 text-white border-slate-800"
          : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
          }`}
      >
        All months
      </button>
      {months.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`text-[10px] sm:text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${active === m
            ? "bg-slate-800 text-white border-slate-800"
            : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
            }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

function ErPostRow({ row, rank }: { row: ErRow; rank: number }) {
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
        <div className="flex items-center gap-1.5 mb-0.5">
          <ContentTypeBadge type={row.contentType} />
          <span className="text-[9px] sm:text-[10px] text-slate-400 shrink-0">
            {formatSgtDateTime(row.date)}
          </span>
        </div>
        <h4 className="text-[11px] sm:text-xs font-semibold text-slate-800 leading-snug truncate" title={row.title}>
          {row.title}
        </h4>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[9px] sm:text-[10px] text-slate-400 tabular-nums">
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

// ─── Platform Filter Chips (used specifically for Engagement Rate Breakdown) ──────────

function PlatformFilterChips({
  platforms,
  active,
  onChange,
}: {
  platforms: string[];
  active: string;
  onChange: (p: string) => void;
}) {
  if (platforms.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter engagement by platform">
      {platforms.map((p) => (
        <button
          key={p}
          type="button"
          aria-pressed={active === p}
          onClick={() => onChange(p)}
          className={`inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-[11px] font-semibold transition-colors focus-visible:outline-none sm:text-xs ${active === p
              ? "border-signal-cyan bg-signal-cyan text-signal-ink"
              : "border-signal-border bg-transparent text-signal-muted hover:border-signal-cyan hover:text-signal-cyan"
            }`}
        >
          <PlatformIcon name={p} />
          <span className="capitalize">{p}</span>
        </button>
      ))}
    </div>
  );
}

function EngagementPagination({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;

  const firstItem = (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);

  return (
    <nav
      className="mt-3 flex items-center justify-between gap-3 border-t border-signal-border px-1 pt-3"
      aria-label="Engagement posts pagination"
    >
      <span className="font-signal-mono text-[9px] uppercase tracking-wide text-signal-muted sm:text-[10px]">
        {firstItem}–{lastItem} of {total}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Previous engagement posts page"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-signal-border bg-signal-surface text-signal-muted transition-colors hover:border-signal-cyan hover:text-signal-cyan disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-16 text-center font-signal-mono text-[9px] uppercase tracking-wide text-signal-muted">
          Page {page} / {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === pageCount}
          aria-label="Next engagement posts page"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-signal-border bg-signal-surface text-signal-muted transition-colors hover:border-signal-cyan hover:text-signal-cyan disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>
    </nav>
  );
}

// ─── Engagement Rate Breakdown: below / above average, filterable by platform + month ─────

function EngagementRateTables({
  posts,
  loading,
}: {
  posts: Post[];
  loading: boolean;
}) {
  const [selectedPlatform, setSelectedPlatform] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [abovePage, setAbovePage] = useState(1);
  const [belowPage, setBelowPage] = useState(1);

  const ENGAGEMENT_PAGE_SIZE = 5;

  // Hiện toàn bộ posts, kể cả views = 0 (ER sẽ tính ra 0% và rơi vào nhóm Below Average)
  const availablePlatforms = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => {
      if (p.platform) set.add(p.platform);
    });
    return Array.from(set).sort();
  }, [posts]);

  // Không có nút "All platforms", nên tự chọn platform đầu tiên có dữ liệu
  // khi danh sách thay đổi hoặc lựa chọn hiện tại không còn hợp lệ.
  useEffect(() => {
    if (availablePlatforms.length === 0) {
      if (selectedPlatform !== "") setSelectedPlatform("");
      return;
    }
    if (!availablePlatforms.includes(selectedPlatform)) {
      setSelectedPlatform(availablePlatforms[0]);
    }
  }, [availablePlatforms, selectedPlatform]);

  const platformFilteredPosts = useMemo(() => {
    if (!selectedPlatform) return [];
    return posts.filter((p) => p.platform === selectedPlatform);
  }, [posts, selectedPlatform]);

  // Danh sách tháng chỉ tính trong phạm vi platform đang chọn, theo giờ SGT
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    platformFilteredPosts.forEach((p) => {
      const m = getMonthLabel(p.date);
      if (m) set.add(m);
    });
    return Array.from(set).sort(
      (a, b) => monthLabelSortKey(b) - monthLabelSortKey(a),
    );
  }, [platformFilteredPosts]);

  // Reset filter tháng khi đổi platform, tránh dừng ở tháng không tồn tại của platform mới
  useEffect(() => {
    setSelectedMonth("all");
  }, [selectedPlatform]);

  const monthFilteredPosts = useMemo(() => {
    if (selectedMonth === "all") return platformFilteredPosts;
    return platformFilteredPosts.filter(
      (p) => getMonthLabel(p.date) === selectedMonth,
    );
  }, [platformFilteredPosts, selectedMonth]);

  // Avg ER = trung bình cộng ER của từng bài trong tập đã lọc (platform + tháng, giờ SGT).
  // Không dùng weighted (tổng likes+shares / tổng views) nữa vì 1 bài có views = 0
  // nhưng vẫn có likes/shares sẽ làm sai lệch mẫu số, kéo Avg ER cao bất thường
  // so với ER thực tế của từng bài trong danh sách.
  const { avgEr, rows } = useMemo(() => {
    const withEr: ErRow[] = monthFilteredPosts.map((p) => ({
      ...p,
      er: p.views > 0 ? ((p.likes + p.shares) / p.views) * 100 : 0,
    }));

    const avg =
      withEr.length > 0
        ? withEr.reduce((sum, r) => sum + r.er, 0) / withEr.length
        : 0;

    return { avgEr: avg, rows: withEr };
  }, [monthFilteredPosts]);

  const belowAvg = useMemo(
    () => rows.filter((r) => r.er < avgEr).sort((a, b) => a.er - b.er),
    [rows, avgEr],
  );
  const aboveAvg = useMemo(
    () => rows.filter((r) => r.er >= avgEr).sort((a, b) => b.er - a.er),
    [rows, avgEr],
  );

  const abovePageCount = Math.max(1, Math.ceil(aboveAvg.length / ENGAGEMENT_PAGE_SIZE));
  const belowPageCount = Math.max(1, Math.ceil(belowAvg.length / ENGAGEMENT_PAGE_SIZE));

  useEffect(() => {
    setAbovePage(1);
    setBelowPage(1);
  }, [selectedPlatform, selectedMonth]);

  useEffect(() => {
    setAbovePage((page) => Math.min(page, abovePageCount));
  }, [abovePageCount]);

  useEffect(() => {
    setBelowPage((page) => Math.min(page, belowPageCount));
  }, [belowPageCount]);

  const visibleAboveAvg = aboveAvg.slice(
    (abovePage - 1) * ENGAGEMENT_PAGE_SIZE,
    abovePage * ENGAGEMENT_PAGE_SIZE,
  );
  const visibleBelowAvg = belowAvg.slice(
    (belowPage - 1) * ENGAGEMENT_PAGE_SIZE,
    belowPage * ENGAGEMENT_PAGE_SIZE,
  );

  return (
    <div className="signal-panel lg:col-span-12 overflow-hidden rounded-2xl border border-signal-border">
      <div className="flex flex-col gap-3 border-b border-signal-border bg-signal-surface px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="font-signal-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-signal-cyan sm:text-[11px]">
            Engagement compared with the average
            {selectedPlatform && (
              <span className="ml-1.5 normal-case font-semibold text-signal-muted">
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

        <div className="flex items-center justify-between flex-wrap gap-2">
          <PlatformFilterChips
            platforms={availablePlatforms}
            active={selectedPlatform}
            onChange={setSelectedPlatform}
          />

          <label className="flex min-h-10 items-center gap-2 rounded-md border border-signal-border px-3 text-[11px] font-semibold text-signal-muted">
            <span className="font-signal-mono text-[9px] uppercase tracking-wide">Month</span>
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
        <div className="flex items-center justify-center h-24 text-[13px] sm:text-sm text-slate-400">
          {loading ? "Loading..." : "No engagement data available yet."}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          {/* Above average */}
          <div className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2.5 sm:mb-3 px-1">
              <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wide text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Above Average ER
              </span>
              <span className="text-[10px] sm:text-[11px] text-slate-400">
                {aboveAvg.length} posts
              </span>
            </div>
            <div className="space-y-1.5 sm:space-y-2 pr-1">
              {aboveAvg.length === 0 ? (
                <div className="flex items-center justify-center h-20 text-[12px] text-slate-400">
                  No posts above average.
                </div>
              ) : (
                visibleAboveAvg.map((r, i) => (
                  <ErPostRow
                    key={r.id}
                    row={r}
                    rank={(abovePage - 1) * ENGAGEMENT_PAGE_SIZE + i + 1}
                  />
                ))
              )}
            </div>
            <EngagementPagination
              page={abovePage}
              pageCount={abovePageCount}
              pageSize={ENGAGEMENT_PAGE_SIZE}
              total={aboveAvg.length}
              onPageChange={setAbovePage}
            />
          </div>

          {/* Below average */}
          <div className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2.5 sm:mb-3 px-1">
              <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wide text-rose-600">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Below Average ER
              </span>
              <span className="text-[10px] sm:text-[11px] text-slate-400">
                {belowAvg.length} posts
              </span>
            </div>
            <div className="space-y-1.5 sm:space-y-2 pr-1">
              {belowAvg.length === 0 ? (
                <div className="flex items-center justify-center h-20 text-[12px] text-slate-400">
                  No posts below average.
                </div>
              ) : (
                visibleBelowAvg.map((r, i) => (
                  <ErPostRow
                    key={r.id}
                    row={r}
                    rank={(belowPage - 1) * ENGAGEMENT_PAGE_SIZE + i + 1}
                  />
                ))
              )}
            </div>
            <EngagementPagination
              page={belowPage}
              pageCount={belowPageCount}
              pageSize={ENGAGEMENT_PAGE_SIZE}
              total={belowAvg.length}
              onPageChange={setBelowPage}
            />
          </div>


        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InsightsPage() {
  const [topPosts, setTopPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [topPostsError, setTopPostsError] = useState(false);

  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [allPostsLoading, setAllPostsLoading] = useState(false);
  const [allPostsError, setAllPostsError] = useState(false);

  const [demographics, setDemographics] = useState<DemographicRow[]>(
    REAL_DEMOGRAPHICS_SNAPSHOT,
  );
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState(false);

  const [activePlatform, setActivePlatform] = useState<PlatformKey>("tiktok");

  // Content type filter applied to the Top Posts area
  const [activeContentType, setActiveContentType] = useState<
    ContentType | "all"
  >("all");

  useEffect(() => {
    const fetchTopPosts = async () => {
      setPostsLoading(true);
      setTopPostsError(false);
      try {
        const response = await fetch(`${API_BASE_URL}/insights/top-posts`);
        if (!response.ok) throw new Error(`Top posts request failed: ${response.status}`);
        const data = await response.json();
        const normalizedPosts = normalizeTopPosts(data);
        setTopPosts(normalizedPosts);
      } catch (error) {
        console.error("Error loading top posts:", error);
        setTopPostsError(true);
      } finally {
        setPostsLoading(false);
      }
    };
    fetchTopPosts();
  }, []);

  useEffect(() => {
    const fetchAllPosts = async () => {
      setAllPostsLoading(true);
      setAllPostsError(false);
      try {
        const response = await fetch(`${API_BASE_URL}/insights/all-posts`);
        if (!response.ok) throw new Error(`All posts request failed: ${response.status}`);
        const data = await response.json();
        const normalizedPosts = normalizeTopPosts(data);
        setAllPosts(normalizedPosts);
      } catch (error) {
        console.error("Error loading all posts:", error);
        setAllPostsError(true);
      } finally {
        setAllPostsLoading(false);
      }
    };
    fetchAllPosts();
  }, []);

  useEffect(() => {
    const fetchDemographics = async () => {
      setDemoLoading(true);
      setDemoError(false);
      try {
        const res = await fetch(`${API_BASE_URL}/insights/demographics`);
        if (!res.ok) throw new Error(`Demographics request failed: ${res.status}`);
        const parsed: DemographicRow[] = await res.json();
        if (Array.isArray(parsed) && parsed.length > 0) setDemographics(parsed);
      } catch (error) {
        console.error("Error loading demographics:", error);
        setDemoError(true);
      } finally {
        setDemoLoading(false);
      }
    };
    fetchDemographics();
  }, []);

  const totalViews = topPosts.reduce((s, p) => s + p.views, 0);
  const totalLikes = topPosts.reduce((s, p) => s + p.likes, 0);
  const totalShares = topPosts.reduce((s, p) => s + p.shares, 0);
  const engagementRate =
    totalViews > 0
      ? (((totalLikes + totalShares) / totalViews) * 100).toFixed(1)
      : "0.0";

  const totalKnownFollowers = demographics.reduce(
    (s, d) => s + d.female + d.male + d.undisclosed,
    0,
  );

  // List of content types actually present in topPosts, used to render the filter chips
  const availableContentTypes = useMemo(() => {
    const set = new Set<ContentType>();
    topPosts.forEach((p) => set.add(p.contentType));
    return CONTENT_TYPE_ORDER.filter((t) => set.has(t));
  }, [topPosts]);

  // Apply the content type filter before grouping by platform
  const filteredTopPosts = useMemo(() => {
    if (activeContentType === "all") return topPosts;
    return topPosts.filter((p) => p.contentType === activeContentType);
  }, [topPosts, activeContentType]);

  const TOP_POSTS_PER_PLATFORM = 5;

  const groupedPosts = useMemo(() => {
    const grouped = filteredTopPosts.reduce(
      (acc, post) => {
        if (!acc[post.platform]) acc[post.platform] = [];
        acc[post.platform].push(post);
        return acc;
      },
      {} as Record<string, Post[]>,
    );
    // Cap at 5 posts / platform (the API may return more if the backend supports it)
    for (const platform of Object.keys(grouped)) {
      grouped[platform] = grouped[platform].slice(0, TOP_POSTS_PER_PLATFORM);
    }
    return grouped;
  }, [filteredTopPosts]);

  const platformCount = Object.keys(groupedPosts).length;

  const tiktokPosts = useMemo(
    () => allPosts.filter((p) => p.platform?.toLowerCase() === "tiktok"),
    [allPosts],
  );
  const facebookPosts = useMemo(
    () => allPosts.filter((p) => p.platform?.toLowerCase() === "facebook"),
    [allPosts],
  );
  const instagramPosts = useMemo(
    () => allPosts.filter((p) => p.platform?.toLowerCase() === "instagram"),
    [allPosts],
  );
  const youtubePosts = useMemo(
    () => allPosts.filter((p) => p.platform?.toLowerCase() === "youtube"),
    [allPosts],
  );

  return (
    <div className="signal-atlas min-h-screen bg-signal-ink font-signal-body text-signal-text mt-16 pb-16">
      <div className="mx-auto max-w-[1640px] px-4 sm:px-8 py-10 sm:py-14 space-y-14 sm:space-y-20">
        {/* Header */}
        <header className="border-b border-signal-border pb-10 sm:pb-14">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-5 flex items-center gap-3 font-signal-mono text-[10px] uppercase tracking-[0.18em] text-signal-muted sm:text-[11px]">
                <span className="h-0.5 w-8 bg-signal-coral" aria-hidden="true" />
                Signals at a glance
              </div>
              <h1 className="max-w-3xl font-signal-display text-4xl font-semibold leading-[0.95] tracking-[-0.04em] text-signal-text sm:text-6xl">
                Insights &amp; <span className="text-signal-cyan">performance</span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-signal-muted sm:text-lg">
                Read the audience, compare what landed, then choose when to post.
              </p>
            </div>
            <div className="border-l-2 border-signal-cyan pl-4 font-signal-mono text-[10px] uppercase tracking-[0.12em] text-signal-muted sm:max-w-sm">
              <span className="text-signal-text">Top-post cohort</span>
              <span className="mx-2 text-signal-slate">•</span>
              all available loaded data
              <span className="mx-2 text-signal-slate">•</span>
              4 platforms
            </div>
          </div>
        </header>

        {/* ── SECTION 1: Overview ── */}
        <section id="briefing" aria-labelledby="briefing-heading" className="space-y-6 sm:space-y-8">
          <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-signal-border sm:grid-cols-3 sm:divide-x sm:divide-signal-border">
            <StatCard
              label="Total views"
              value={postsLoading && topPosts.length === 0 ? "—" : fmtNum(totalViews)}
              sub={`Top posts only · ${platformCount} platform${platformCount === 1 ? "" : "s"}`}
              colorKey="up"
            />
            <StatCard
              label="Total likes"
              value={postsLoading && topPosts.length === 0 ? "—" : fmtNum(totalLikes)}
              sub={`Same top-post cohort · ${platformCount} platform${platformCount === 1 ? "" : "s"}`}
              colorKey="none"
            />
            <StatCard
              label="Engagement rate"
              value={postsLoading && topPosts.length === 0 ? "—" : `${engagementRate}%`}
              sub="Likes + shares ÷ views · top posts"
              colorKey="down"
            />
          </div>
          <p id="briefing-heading" className="font-signal-mono text-[10px] leading-5 text-signal-muted sm:text-[11px]">
            Scope note: headline values describe the top-post cohort, not account-wide performance.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Demographics */}
            <div className="signal-panel lg:col-span-5 flex flex-col overflow-hidden rounded-2xl border border-signal-border">
              <div className="flex items-center justify-between border-b border-signal-border px-4 py-3 sm:px-5">
                <span className="font-signal-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-signal-coral sm:text-[11px]">
                  Audience snapshot
                </span>
                <span className="font-signal-mono text-[10px] text-signal-muted sm:text-xs">
                  {demoLoading
                    ? "Loading..."
                    : demoError
                      ? "Snapshot fallback"
                      : `${fmtNum(totalKnownFollowers)} followers`}
                </span>
              </div>
              <div className="p-3 sm:p-4 flex-1 flex flex-col">
                <div className="h-[240px] sm:h-[260px] w-full">
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
                        wrapperStyle={{ fontSize: "10px", paddingTop: "8px", color: SIGNAL_CHART.muted }}
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
                  <Lightbulb aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-signal-coral" />
                  <div>
                    <p className="mb-1 font-signal-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-signal-coral sm:text-[11px]">
                      Quick insight
                    </p>
                    <p className="text-xs leading-relaxed text-signal-muted sm:text-sm">
                      The 25–44 age group makes up the majority of followers with available demographic data.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Posts */}
            <div className="signal-panel lg:col-span-7 flex flex-col overflow-hidden rounded-2xl border border-signal-border">
              <div className="flex flex-col gap-3 border-b border-signal-border bg-signal-surface px-4 py-3 sm:px-5">
                <div className="flex items-center justify-between">
                  <span className="font-signal-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-signal-cyan sm:text-[11px]">
                    Top posts
                  </span>
                  <span className="font-signal-mono text-[10px] text-signal-muted sm:text-xs">
                    {postsLoading ? "Loading..." : "Top 5 / platform"}
                  </span>
                </div>
                {/* Filter by content type */}
                <ContentTypeFilterChips
                  availableTypes={availableContentTypes}
                  active={activeContentType}
                  onChange={setActiveContentType}
                />
              </div>

              <div className="flex-1 space-y-6 p-4 sm:space-y-8 sm:p-5">
                {postsLoading && topPosts.length === 0 ? (
                  <div className="space-y-3 py-8" aria-live="polite">
                    <div className="h-12 animate-pulse rounded-lg bg-signal-track" />
                    <div className="h-12 animate-pulse rounded-lg bg-signal-track" />
                    <div className="h-12 animate-pulse rounded-lg bg-signal-track" />
                    <p className="font-signal-mono text-[10px] uppercase tracking-wide text-signal-muted">Loading top posts...</p>
                  </div>
                ) : topPostsError && topPosts.length === 0 ? (
                  <InlineDataState
                    tone="error"
                    title="Couldn’t load top posts."
                    description="Other sections remain available."
                    actionLabel="Try again"
                    onAction={() => window.location.reload()}
                  />
                ) : Object.keys(groupedPosts).length === 0 ? (
                  <InlineDataState
                    tone="empty"
                    title={activeContentType === "all" ? "No posts available." : `No posts match “${CONTENT_TYPE_META[activeContentType].label}”.`}
                    description={activeContentType === "all" ? "There are no loaded top-post rows yet." : "Try another content type."}
                  />
                ) : (
                  <div className="signal-scroll-area max-h-[560px] overflow-y-auto pr-1 sm:pr-2">
                    {Object.entries(groupedPosts).map(([platform, posts]) => (
                    <div key={platform} className="border-b border-signal-border last:border-0">
                      <div className="flex items-center gap-2 border-b border-signal-border pb-3">
                        <PlatformIcon name={platform} />
                        <h3 className="font-signal-display text-lg font-semibold capitalize text-signal-text">
                          {platform}
                        </h3>
                        <span className="font-signal-mono text-[10px] uppercase tracking-wide text-signal-muted">
                          Top {posts.length} / platform
                        </span>
                      </div>

                      <div className="divide-y divide-signal-border">
                        {posts.map((post, i) => {
                          const er = post.views > 0 ? (((post.likes + post.shares) / post.views) * 100).toFixed(1) : "0.0";
                          const ctr = getCtr(post);
                          return (
                            <a
                              key={post.id}
                              href={post.url || undefined}
                              target={post.url ? "_blank" : undefined}
                              rel={post.url ? "noreferrer" : undefined}
                              aria-label={post.url ? `Open ${post.title}` : undefined}
                              className={`group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-4 transition-colors sm:grid-cols-[40px_minmax(0,1fr)_auto] sm:gap-4 ${post.url ? "hover:bg-signal-track/70" : ""} ${!post.url ? "pointer-events-none" : ""}`}
                            >
                              <span className="font-signal-mono text-sm tabular-nums text-signal-slate sm:text-base">
                                {String(i + 1).padStart(2, "0")}
                              </span>
                              <div className="min-w-0">
                                <div className="mb-1 flex flex-wrap items-center gap-2">
                                  <ContentTypeBadge type={post.contentType} />
                                  <span className="font-signal-mono text-[10px] text-signal-muted sm:text-[11px]">
                                    {formatSgtDateTime(post.date)} SGT
                                  </span>
                                </div>
                                <h4 className="flex min-w-0 items-center gap-2 truncate text-sm font-semibold text-signal-text group-hover:text-signal-cyan sm:text-[15px]" title={post.title}>
                                  <span className="truncate">{post.title}</span>
                                  {post.url && <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />}
                                </h4>
                              </div>
                              <div className="flex items-center gap-3 text-right sm:gap-5">
                                <div className="hidden sm:block">
                                  <p className="font-signal-mono text-[9px] uppercase tracking-wide text-signal-muted">Likes</p>
                                  <p className="text-sm font-semibold tabular-nums text-signal-text">{fmtNum(post.likes)}</p>
                                </div>
                                <div className="hidden sm:block">
                                  <p className="font-signal-mono text-[9px] uppercase tracking-wide text-signal-muted">Shares</p>
                                  <p className="text-sm font-semibold tabular-nums text-signal-text">{fmtNum(post.shares)}</p>
                                </div>
                                <div>
                                  <p className="font-signal-mono text-[9px] uppercase tracking-wide text-signal-muted">Views</p>
                                  <p className="text-sm font-semibold tabular-nums text-signal-text">{fmtNum(post.views)}</p>
                                </div>
                                <div className="min-w-[46px]">
                                  <p className="font-signal-mono text-[9px] uppercase tracking-wide text-signal-muted">ER</p>
                                  <p className="text-sm font-bold tabular-nums text-signal-cyan">{er}%</p>
                                </div>
                                {ctr && (
                                  <div className="hidden min-w-[46px] sm:block">
                                    <p className="font-signal-mono text-[9px] uppercase tracking-wide text-signal-muted">CTR</p>
                                    <p className="text-sm font-bold tabular-nums text-signal-coral">{ctr}%</p>
                                  </div>
                                )}
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Content Type: biểu đồ + bảng chi tiết đặt cạnh nhau trên desktop, xếp chồng trên mobile */}
            {allPostsError && (
              <InlineDataState
                tone="error"
                title="Couldn’t load all post history."
                description="Format and engagement comparisons will update when the source is available."
                actionLabel="Try again"
                onAction={() => window.location.reload()}
              />
            )}
            <div className="lg:col-span-12 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <ContentTypePerformanceCard posts={allPosts} />
              <ContentTypeBreakdownTable posts={allPosts} loading={allPostsLoading} />
            </div>

            {/* Engagement Rate Breakdown — giữ full width vì bảng 2 cột bên trong đã đủ rộng */}
            <EngagementRateTables posts={allPosts} loading={allPostsLoading} />
          </div>
        </section>

        {/* ── SECTION 2: Best Time to Post ── */}
        <section id="time-signals" aria-labelledby="time-signals-heading" className="space-y-4 sm:space-y-6">
          <div className="flex flex-col justify-between gap-5 border-t border-signal-border pt-10 sm:flex-row sm:items-end sm:pt-14">
            <div className="w-full sm:w-auto">
              <div
                className="mb-3 flex items-center gap-3 font-signal-mono text-[10px] uppercase tracking-[0.16em]"
                style={{ color: PLATFORM_THEMES[activePlatform].accent }}
              >
                <span>04</span>
                <span
                  className="h-px w-8"
                  aria-hidden="true"
                  style={{ backgroundColor: PLATFORM_THEMES[activePlatform].accent }}
                />
                Time signals · SGT
              </div>
              <h2
                id="time-signals-heading"
                className="font-signal-display text-3xl font-semibold text-signal-text sm:text-4xl"
                style={{ color: PLATFORM_THEMES[activePlatform].accent }}
              >
                When to post
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-signal-muted sm:text-base">
                Darker cells indicate stronger historical performance. Accent markers show your published posts.
              </p>
            </div>
            {/* Display Platform Switcher full width on mobile if needed */}
            <PlatformSwitcher
              active={activePlatform}
              onChange={setActivePlatform}
            />
          </div>

          {activePlatform === "tiktok" && (
            <BestTimeBigCard
              platform="tiktok"
              posts={tiktokPosts}
              loading={allPostsLoading}
            />
          )}
          {activePlatform === "facebook" && (
            <BestTimeBigCard
              platform="facebook"
              posts={facebookPosts}
              loading={allPostsLoading}
            />
          )}
          {activePlatform === "instagram" && (
            <InstagramBigCard
              posts={instagramPosts}
              loading={allPostsLoading}
            />
          )}
          {activePlatform === "youtube" && (
            <BestTimeBigCard
              platform="youtube"
              posts={youtubePosts}
              loading={allPostsLoading}
            />
          )}
        </section>
      </div>
    </div>
  );
}