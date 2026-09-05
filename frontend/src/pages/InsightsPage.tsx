import { useState, useEffect, useMemo } from "react";
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
    date: doc.date || "",
    url: doc.url || "",
    contentType: normalizeContentType(doc),
    rawMediaType: doc.rawMediaType || doc.mediaType || doc.media_type || "",
  }));
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
  const s = TREND[colorKey];
  return (
    <div
      className={`relative rounded-2xl border p-4 sm:p-5 ${s.border} ${s.bg}`}
    >
      <span
        className={`absolute top-4 right-4 w-2 h-2 rounded-full ${s.dot}`}
      />
      <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2 sm:mb-3">
        {label}
      </p>
      <p className="text-2xl sm:text-3xl font-bold tabular-nums text-slate-800">
        {value}
      </p>
      <p className="mt-1 sm:mt-2 text-[10px] sm:text-xs text-slate-400">
        {sub}
      </p>
    </div>
  );
}

// ─── Chart Tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-gray-100 bg-white/95 backdrop-blur shadow-xl px-3 py-2 sm:px-4 sm:py-3 min-w-[120px] sm:min-w-[130px]">
      <p className="text-[10px] sm:text-xs text-slate-400 mb-1 font-medium">
        {label}
      </p>
      {payload.map((p: any) => (
        <p
          key={p.dataKey}
          className="text-xs sm:text-sm font-bold tabular-nums"
          style={{ color: p.fill }}
        >
          {fmtNum(p.value)}{" "}
          <span className="font-normal text-slate-400">
            {p.name ?? p.dataKey}
          </span>
        </p>
      ))}
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
      className={`inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-md text-white text-[10px] sm:text-xs font-bold ${p.bg}`}
    >
      {p.label}
    </span>
  );
}

// ─── Content Type Badge ─────────────────────────────────────────────────────────

function ContentTypeBadge({ type }: { type: ContentType }) {
  const meta = CONTENT_TYPE_META[type];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold ${meta.className}`}
      title={meta.label}
    >
      <span aria-hidden>{meta.icon}</span>
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
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        type="button"
        onClick={() => onChange("all")}
        className={`text-[10px] sm:text-[11px] font-semibold px-2 py-1 rounded-full border transition-colors ${active === "all"
          ? "bg-slate-800 text-white border-slate-800"
          : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
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
            onClick={() => onChange(t)}
            className={`inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold px-2 py-1 rounded-full border transition-colors ${isActive
              ? "bg-slate-800 text-white border-slate-800"
              : `${meta.className} hover:opacity-80`
              }`}
          >
            <span aria-hidden>{meta.icon}</span>
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
    <div className="lg:col-span-12 rounded-2xl border border-indigo-200 bg-white overflow-hidden">
      <div className="px-4 py-3 sm:px-5 flex items-center justify-between bg-indigo-50/60 border-b border-indigo-200">
        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-indigo-600">
          Performance by Content Type
        </span>
        <span className="text-[10px] sm:text-xs font-mono text-indigo-400">
          Avg per post
        </span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="h-[240px] sm:h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e2e8f0"
              />
              <XAxis
                dataKey="type"
                tick={{ fontSize: 10, fill: "#64748b", fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: "#f8fafc" }}
              />
              <Legend
                iconType="circle"
                wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }}
              />
              <Bar
                dataKey="avgViews"
                name="Avg Views"
                fill="#6366f1"
                radius={[4, 4, 0, 0]}
                barSize={28}
              />
              <Bar
                dataKey="avgLikes"
                name="Avg Likes"
                fill="#a5b4fc"
                radius={[4, 4, 0, 0]}
                barSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {chartData.map((d) => (
            <span
              key={d.type}
              className="text-[10px] sm:text-[11px] text-slate-400"
            >
              {d.type}:{" "}
              <span className="font-semibold text-slate-600">
                {d.count} posts
              </span>
            </span>
          ))}
        </div>
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
    <div className="lg:col-span-12 rounded-2xl border border-indigo-200 bg-white overflow-hidden">
      <div className="px-4 py-3 sm:px-5 flex items-center justify-between bg-indigo-50/60 border-b border-indigo-200">
        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-indigo-600">
          Content Type Breakdown
        </span>
        <span className="text-[10px] sm:text-xs font-mono text-indigo-400">
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
    <div
      className="w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 hide-scrollbar"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm min-w-max">
        {PLATFORM_TABS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange(p.key)}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors ${active === p.key
              ? "bg-slate-800 text-white"
              : "text-slate-500 hover:bg-slate-50"
              }`}
          >
            <PlatformIcon name={p.key} />
            {p.label}
          </button>
        ))}
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
}: {
  grid: HeatCell[][];
  minAvg: number;
  maxAvg: number;
  hasData: boolean;
  loading: boolean;
}) {
  const cellColor = (cell: HeatCell) => {
    if (cell.count === 0) return "#eef2f7";
    if (maxAvg === minAvg) return "hsl(205, 85%, 55%)";
    const avg = cell.totalViews / cell.count;
    const normalized = (avg - minAvg) / (maxAvg - minAvg);
    const lightness = 88 - normalized * 68;
    return `hsl(205, 85%, ${lightness}%)`;
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
            background:
              "linear-gradient(to right, hsl(205,85%,88%), hsl(205,85%,20%))",
          }}
        />
        <span className="tabular-nums">{fmtNum(maxAvg)}</span>
        <span className="flex items-center gap-1 sm:gap-1.5 ml-1 sm:ml-2">
          <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-amber-400 inline-block" />
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
                    title={`${day} ${String(hourIdx).padStart(2, "0")}:00 SGT — ${cell.count} posts, ${fmtNum(cell.totalViews)} views`}
                    className="relative flex-1 aspect-square rounded-[3px] sm:rounded-[4px]"
                    style={{ backgroundColor: cellColor(cell) }}
                  >
                    {cell.count > 0 && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full bg-amber-400" />
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
  const { grid, minAvg, maxAvg, hasData } = usePostHistoryGrid(posts);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 sm:px-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <PlatformIcon name={platform} />
          <span className="text-[13px] sm:text-sm font-bold text-slate-800">
            Best Time to Post (SGT)
          </span>
        </div>
        <span className="text-[11px] sm:text-xs font-mono text-slate-400">
          {loading ? "Loading..." : "All time"}
        </span>
      </div>
      <div className="p-4 sm:p-6">
        <PostHistoryGridView
          grid={grid}
          minAvg={minAvg}
          maxAvg={maxAvg}
          hasData={hasData}
          loading={loading}
        />
      </div>
    </div>
  );
}

// ─── Big single-panel card: Instagram ──────

function InstagramBigCard({ posts }: { posts: Post[]; loading: boolean }) {
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
    if (!hasData) return "#eef2f7";
    if (max === min) return "hsl(330, 75%, 55%)";
    const normalized = (value - min) / (max - min);
    const lightness = 88 - normalized * 68;
    return `hsl(330, 75%, ${lightness}%)`;
  };

  const bothLoading = feLoading && feDailyLoading;
  const bothError = feError && feDailyError;

  return (
    <div className="rounded-2xl border border-pink-200 bg-white overflow-hidden">
      <div className="px-4 py-3 sm:px-5 bg-pink-50/60 border-b border-pink-200 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <PlatformIcon name="instagram" />
          <span className="text-[13px] sm:text-sm font-bold text-slate-800">
            Best Time to Post (SGT)
          </span>
        </div>
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
                          ? "bg-pink-600 text-white border-pink-600"
                          : "bg-white text-pink-600 border-pink-200 hover:bg-pink-50"
                          }`}
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
                      background:
                        "linear-gradient(to right, hsl(330,75%,88%), hsl(330,75%,20%))",
                    }}
                  />
                  <span className="tabular-nums">{fmtNum(feMax)}</span>
                  <span className="flex items-center gap-1 sm:gap-1.5 ml-1 sm:ml-2">
                    <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-amber-400 inline-block" />
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
                                className="relative flex-1 aspect-square rounded-[3px] sm:rounded-[4px]"
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
                                    <span className="flex items-center justify-center min-w-[14px] h-[14px] sm:min-w-[16px] sm:h-[16px] px-0.5 rounded-full bg-amber-400 text-white text-[8px] sm:text-[9px] font-bold leading-none shadow-sm">
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

            <div className="border-t border-pink-100" />

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
                      background:
                        "linear-gradient(to right, hsl(330,75%,88%), hsl(330,75%,20%))",
                    }}
                  />
                  <span className="tabular-nums">{fmtNum(dailyMax)}</span>
                  <span className="flex items-center gap-1 sm:gap-1.5 ml-1 sm:ml-2">
                    <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-amber-400 inline-block" />
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
                          className="relative flex-1 aspect-square rounded-[3px] sm:rounded-[4px]"
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
                              <span className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full bg-amber-400" />
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
                  <div className="mt-4 sm:mt-5 p-3 bg-pink-50/50 border border-pink-100 rounded-xl">
                    <p className="text-[11px] sm:text-xs text-pink-700 font-semibold mb-1.5">
                      Best times to post:
                    </p>
                    <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                      {recommendedSgtTimes.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] sm:text-xs font-bold text-pink-600 bg-white border border-pink-200 rounded-full px-2 py-0.5 sm:px-2.5"
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
  return (
    <a
      href={row.url}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-2.5 sm:gap-3 rounded-lg border border-slate-100 bg-white px-2.5 py-2 sm:px-3 sm:py-2.5 hover:border-slate-300 hover:shadow-sm transition-all ${!row.url ? "pointer-events-none" : ""}`}
    >
      <span className="hidden sm:flex items-center justify-center w-5 h-5 shrink-0 rounded-full bg-slate-100 text-[10px] font-bold text-slate-400">
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
        <h4
          className="text-[11px] sm:text-xs font-semibold text-slate-800 leading-snug truncate"
          title={row.title}
        >
          {row.title}
        </h4>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[9px] sm:text-[10px] text-slate-400 tabular-nums">
          {fmtNum(row.views)} views
        </p>
        <p className="text-xs sm:text-[13px] font-bold tabular-nums">
          {row.er.toFixed(1)}%
        </p>
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
    <div className="flex items-center gap-1.5 flex-wrap">
      {platforms.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${active === p
              ? "bg-slate-800 text-white border-slate-800"
              : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
            }`}
        >
          <PlatformIcon name={p} />
          <span className="capitalize">{p}</span>
        </button>
      ))}
    </div>
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

  // Avg ER (weighted): tổng likes+shares / tổng views của tập đã lọc (platform + tháng, giờ SGT).
  // Post có views = 0 không đóng góp vào tổng views/engaged nhưng vẫn xuất hiện trong danh sách với ER = 0%.
  const { avgEr, rows } = useMemo(() => {
    let sumViews = 0;
    let sumEngaged = 0;
    for (const p of monthFilteredPosts) {
      sumViews += p.views;
      sumEngaged += p.likes + p.shares;
    }
    const avg = sumViews > 0 ? (sumEngaged / sumViews) * 100 : 0;

    const withEr: ErRow[] = monthFilteredPosts.map((p) => ({
      ...p,
      er: p.views > 0 ? ((p.likes + p.shares) / p.views) * 100 : 0,
    }));

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

  return (
    <div className="lg:col-span-12 rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 sm:px-5 flex flex-col gap-2.5 sm:gap-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-slate-500">
            Engagement Rate Breakdown
            {selectedPlatform && (
              <span className="ml-1.5 normal-case font-semibold text-slate-400">
                · {selectedPlatform}
              </span>
            )}
          </span>
          <span className="text-[10px] sm:text-xs font-mono text-slate-500">
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

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-[10px] sm:text-[11px] font-semibold px-2.5 py-1.5 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option value="all">All months</option>
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
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
            <div className="space-y-1.5 sm:space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {aboveAvg.length === 0 ? (
                <div className="flex items-center justify-center h-20 text-[12px] text-slate-400">
                  No posts above average.
                </div>
              ) : (
                aboveAvg.map((r, i) => (
                  <ErPostRow key={r.id} row={r} rank={i + 1} />
                ))
              )}
            </div>
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
            <div className="space-y-1.5 sm:space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {belowAvg.length === 0 ? (
                <div className="flex items-center justify-center h-20 text-[12px] text-slate-400">
                  No posts below average.
                </div>
              ) : (
                belowAvg.map((r, i) => (
                  <ErPostRow key={r.id} row={r} rank={i + 1} />
                ))
              )}
            </div>
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

  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [allPostsLoading, setAllPostsLoading] = useState(false);

  const [demographics, setDemographics] = useState<DemographicRow[]>(
    REAL_DEMOGRAPHICS_SNAPSHOT,
  );
  const [demoLoading, setDemoLoading] = useState(false);

  const [activePlatform, setActivePlatform] = useState<PlatformKey>("tiktok");

  // Content type filter applied to the Top Posts area
  const [activeContentType, setActiveContentType] = useState<
    ContentType | "all"
  >("all");

  useEffect(() => {
    const fetchTopPosts = async () => {
      setPostsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/insights/top-posts`);
        const data = await response.json();
        const normalizedPosts = normalizeTopPosts(data);
        setTopPosts(normalizedPosts);
      } catch (error) {
        console.error("Error loading top posts:", error);
      } finally {
        setPostsLoading(false);
      }
    };
    fetchTopPosts();
  }, []);

  useEffect(() => {
    const fetchAllPosts = async () => {
      setAllPostsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/insights/all-posts`);
        const data = await response.json();
        const normalizedPosts = normalizeTopPosts(data);
        setAllPosts(normalizedPosts);
      } catch (error) {
        console.error("Error loading all posts:", error);
      } finally {
        setAllPostsLoading(false);
      }
    };
    fetchAllPosts();
  }, []);

  useEffect(() => {
    const fetchDemographics = async () => {
      setDemoLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/insights/demographics`);
        if (!res.ok) return;
        const parsed: DemographicRow[] = await res.json();
        if (Array.isArray(parsed) && parsed.length > 0) setDemographics(parsed);
      } catch {
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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 mt-16 pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8 space-y-8 sm:space-y-10">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
            Insights &amp; Performance
          </h1>
          <p className="text-[13px] sm:text-sm text-slate-500 mt-1">
            In-depth analysis of our audience and top-performing content.
          </p>
        </div>

        {/* ── SECTION 1: Overview ── */}
        <section className="space-y-4 sm:space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <StatCard
              label="Total Views"
              value={fmtNum(totalViews)}
              sub={`Top posts across ${platformCount} platforms`}
              colorKey="up"
            />
            <StatCard
              label="Total Likes"
              value={fmtNum(totalLikes)}
              sub={`Top posts across ${platformCount} platforms`}
              colorKey="none"
            />
            <StatCard
              label="Engagement Rate"
              value={`${engagementRate}%`}
              sub="Likes + shares / views, top posts"
              colorKey="none"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Demographics */}
            <div className="lg:col-span-5 rounded-2xl border border-emerald-200 bg-white overflow-hidden flex flex-col">
              <div className="px-4 py-3 sm:px-5 flex items-center justify-between bg-emerald-50/60 border-b border-emerald-200">
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-emerald-600">
                  Audience
                </span>
                <span className="text-[10px] sm:text-xs font-mono text-emerald-600">
                  {demoLoading
                    ? "Loading..."
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
                        stroke="#e2e8f0"
                      />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        dataKey="age"
                        type="category"
                        tick={{
                          fontSize: 10,
                          fill: "#64748b",
                          fontWeight: 600,
                        }}
                        axisLine={false}
                        tickLine={false}
                        width={45}
                      />
                      <Tooltip
                        content={<ChartTooltip />}
                        cursor={{ fill: "#f8fafc" }}
                      />
                      <Legend
                        iconType="circle"
                        wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }}
                      />
                      <Bar
                        dataKey="female"
                        name="Female"
                        stackId="a"
                        fill="#ec4899"
                        barSize={16}
                      />
                      <Bar
                        dataKey="male"
                        name="Male"
                        stackId="a"
                        fill="#6366f1"
                        barSize={16}
                      />
                      <Bar
                        dataKey="undisclosed"
                        name="Undisclosed"
                        stackId="a"
                        fill="#cbd5e1"
                        radius={[0, 4, 4, 0]}
                        barSize={16}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 p-3 sm:p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl flex gap-2 sm:gap-3">
                  <span className="text-lg sm:text-xl">💡</span>
                  <div>
                    <p className="text-[13px] sm:text-sm text-emerald-800 font-semibold mb-1">
                      Quick Insight
                    </p>
                    <p className="text-[11px] sm:text-xs text-emerald-600 leading-relaxed">
                      The 25-44 age group makes up the majority of followers
                      with available demographic data.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Posts */}
            <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col">
              <div className="px-4 py-3 sm:px-5 flex flex-col gap-2 sm:gap-3 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-slate-500">
                    Top posts
                  </span>
                  <span className="text-[10px] sm:text-xs font-mono text-slate-400">
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

              <div className="p-4 sm:p-5 flex-1 overflow-y-auto max-h-[500px] space-y-6 sm:space-y-8">
                {postsLoading && topPosts.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-[13px] sm:text-sm text-slate-400 py-10">
                    Loading posts...
                  </div>
                ) : Object.keys(groupedPosts).length === 0 ? (
                  <div className="flex items-center justify-center h-full text-[13px] sm:text-sm text-slate-400 py-10">
                    No posts available.
                  </div>
                ) : (
                  Object.entries(groupedPosts).map(([platform, posts]) => (
                    <div key={platform}>
                      <div className="flex items-center gap-2 mb-3 sm:mb-4">
                        <PlatformIcon name={platform} />
                        <h3 className="text-[13px] sm:text-sm font-bold text-slate-700 capitalize">
                          {platform}
                        </h3>
                      </div>

                      <div className="flex flex-col gap-2">
                        {posts.map((post, i) => {
                          const er =
                            post.views > 0
                              ? (
                                ((post.likes + post.shares) / post.views) *
                                100
                              ).toFixed(1)
                              : "0.0";
                          return (
                            <a
                              key={post.id}
                              href={post.url}
                              target="_blank"
                              rel="noreferrer"
                              className={`group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3 hover:border-slate-300 hover:shadow-sm transition-all ${!post.url ? "pointer-events-none" : ""}`}
                            >
                              <span className="hidden sm:flex items-center justify-center w-5 h-5 shrink-0 rounded-full bg-slate-100 text-[10px] font-bold text-slate-400">
                                {i + 1}
                              </span>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  {/* <ContentTypeBadge type={post.contentType} /> */}
                                  <span className="text-[10px] sm:text-[11px] text-slate-400 shrink-0">
                                    {post.date}
                                  </span>
                                </div>
                                <h4
                                  className="text-xs sm:text-[13px] font-semibold text-slate-800 leading-snug truncate group-hover:text-slate-900"
                                  title={post.title}
                                >
                                  {post.title}
                                </h4>
                              </div>

                              <div className="hidden xs:flex sm:flex items-center gap-3 sm:gap-4 shrink-0 text-right">
                                <div>
                                  <p className="text-[8px] sm:text-[9px] font-medium text-slate-400 uppercase tracking-wide">
                                    Views
                                  </p>
                                  <p className="text-xs sm:text-[13px] font-bold text-slate-700 tabular-nums">
                                    {fmtNum(post.views)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[8px] sm:text-[9px] font-medium text-slate-400 uppercase tracking-wide">
                                    Likes
                                  </p>
                                  <p className="text-xs sm:text-[13px] font-bold text-slate-700 tabular-nums">
                                    {fmtNum(post.likes)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[8px] sm:text-[9px] font-medium text-slate-400 uppercase tracking-wide">
                                    Shares
                                  </p>
                                  <p className="text-xs sm:text-[13px] font-bold text-slate-700 tabular-nums">
                                    {fmtNum(post.shares)}
                                  </p>
                                </div>
                                <div className="min-w-[44px]">
                                  <p className="text-[8px] sm:text-[9px] font-medium text-indigo-400 uppercase tracking-wide">
                                    ER
                                  </p>
                                  <p className="text-xs sm:text-[13px] font-bold text-indigo-600 tabular-nums">
                                    {er}%
                                  </p>
                                </div>
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Content Type Performance — uses allPosts since that's the source with full contentType/rawMediaType data */}
            <ContentTypePerformanceCard posts={allPosts} />

            {/* Content Type Breakdown Table — displayed dynamically based on the actual data present */}
            <ContentTypeBreakdownTable
              posts={allPosts}
              loading={allPostsLoading}
            />

            {/* Engagement Rate Breakdown — average ER + above/below average tables, filterable by month (SGT) */}
            <EngagementRateTables posts={allPosts} loading={allPostsLoading} />
          </div>
        </section>

        {/* ── SECTION 2: Best Time to Post ── */}
        <section className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between flex-col sm:flex-row gap-3 sm:gap-0">
            <div className="w-full sm:w-auto">
              <h2 className="text-lg font-bold text-slate-800">
                Best Time to Post
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                Select a platform to view detailed best posting times.
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