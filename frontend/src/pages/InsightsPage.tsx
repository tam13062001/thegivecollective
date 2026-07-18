import { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

type Post = {
  id: string | number; // Nhận _id từ MongoDB
  platform: string;
  title: string;
  views: number;
  likes: number;
  date: string;
  url?: string;
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

// Đã bổ sung 'youtube'
type PlatformKey = 'tiktok' | 'facebook' | 'instagram' | 'youtube';

// ─── Constants ───────────────────────────────────────────────────────────────

const API_BASE_URL = 'https://thegivecollective-backend.vercel.app/api/v1';

const REAL_DEMOGRAPHICS_SNAPSHOT: DemographicRow[] = [
  { age: '13-17', female: 8,  male: 6,  undisclosed: 10 },
  { age: '18-24', female: 33, male: 25, undisclosed: 30 },
  { age: '25-34', female: 62, male: 48, undisclosed: 26 },
  { age: '35-44', female: 61, male: 35, undisclosed: 16 },
  { age: '45-54', female: 22, male: 11, undisclosed: 7  },
  { age: '55-64', female: 13, male: 4,  undisclosed: 1  },
  { age: '65+',   female: 1,  male: 2,  undisclosed: 1  },
];

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOUR_LABELS = Array.from({ length: 12 }, (_, i) => i * 2); // 0,2,4,...,22

// Đã bổ sung tab YouTube
const PLATFORM_TABS: { key: PlatformKey; label: string }[] = [
  { key: 'tiktok', label: 'TikTok' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'youtube', label: 'YouTube' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/**
 * Tách chuỗi "YYYY-MM-DD HH:mm" thành { date, time }.
 * Nếu chuỗi chỉ có ngày (không có giờ) thì time sẽ rỗng.
 */
function splitDateTime(dateStr: string): { date: string; time: string } {
  if (!dateStr) return { date: '—', time: '' };
  const [datePart, timePart] = dateStr.split(' ');
  return { date: datePart || '—', time: timePart || '' };
}

/**
 * Xử lý dữ liệu BE trả về: hỗ trợ cả Mảng 1D, Mảng 2D (Array of Arrays)
 * hoặc bọc trong object { posts: [...] }
 */
function normalizeTopPosts(raw: any): Post[] {
  let rawArray: any[] = [];

  if (Array.isArray(raw)) {
    rawArray = raw;
  } else if (raw && typeof raw === 'object' && Array.isArray(raw.posts)) {
    rawArray = raw.posts;
  }

  const flatDocs = rawArray.flat();

  return flatDocs.map((doc, idx) => ({
    id: doc._id || idx + 1,
    platform: doc.platform || 'Unknown',
    title: doc.title || '(Không có tiêu đề)',
    views: doc.views || 0,
    likes: doc.likes || 0,
    date: doc.date || '',
    url: doc.url || '',
  }));
}

// ─── Trend styles ──────────────────────────────────────────────────────────────

const TREND = {
  up:   { dot: 'bg-emerald-500', border: 'border-emerald-200', bg: 'bg-emerald-50/60' },
  down: { dot: 'bg-rose-500',    border: 'border-rose-200',    bg: 'bg-rose-50/60' },
  none: { dot: 'bg-slate-400',   border: 'border-slate-100',   bg: 'bg-slate-50' },
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, colorKey,
}: {
  label: string; value: string; sub: string; colorKey: keyof typeof TREND;
}) {
  const s = TREND[colorKey];
  return (
    <div className={`relative rounded-2xl border p-5 ${s.border} ${s.bg}`}>
      <span className={`absolute top-4 right-4 w-2 h-2 rounded-full ${s.dot}`} />
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">{label}</p>
      <p className="text-3xl font-bold tabular-nums text-slate-800">{value}</p>
      <p className="mt-2 text-xs text-slate-400">{sub}</p>
    </div>
  );
}

// ─── Chart Tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-gray-100 bg-white/95 backdrop-blur shadow-xl px-4 py-3 min-w-[130px]">
      <p className="text-xs text-slate-400 mb-1 font-medium">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-sm font-bold tabular-nums" style={{ color: p.fill }}>
          {fmtNum(p.value)} <span className="font-normal text-slate-400">{p.name ?? p.dataKey}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Platform Icon ─────────────────────────────────────────────────────────────

function PlatformIcon({ name }: { name: string }) {
  const map: Record<string, { bg: string; label: string }> = {
    tiktok:    { bg: 'bg-black',       label: 'TK' },
    facebook:  { bg: 'bg-blue-600',    label: 'FB' },
    instagram: { bg: 'bg-pink-500',    label: 'IG' },
    twitter:   { bg: 'bg-sky-500',     label: 'TW' },
    youtube:   { bg: 'bg-red-600',     label: 'YT' },
    linkedin:  { bg: 'bg-blue-700',    label: 'LI' },
    threads:   { bg: 'bg-gray-800',    label: 'TH' },
  };
  const p = map[name.toLowerCase()] ?? { bg: 'bg-slate-500', label: name.slice(0, 2).toUpperCase() };
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-white text-xs font-bold ${p.bg}`}>
      {p.label}
    </span>
  );
}

// ─── Platform navbar switcher ───────────────────────────────────────────────────

function PlatformSwitcher({
  active, onChange,
}: { active: PlatformKey; onChange: (p: PlatformKey) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {PLATFORM_TABS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => onChange(p.key)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            active === p.key
              ? 'bg-slate-800 text-white'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <PlatformIcon name={p.key} />
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ─── Best Time to Post: shared post-history grid logic ─────────────────────────

type HeatCell = { count: number; totalViews: number };

function usePostHistoryGrid(posts: Post[]) {
  return useMemo(() => {
    const g: HeatCell[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ count: 0, totalViews: 0 }))
    );

    for (const post of posts) {
      if (!post.date) continue;
      const { time } = splitDateTime(post.date);
      if (!time) continue;

      const parsed = new Date(post.date.replace(' ', 'T'));
      if (isNaN(parsed.getTime())) continue;

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

    return { grid: g, minAvg: any ? min : 0, maxAvg: any ? max : 0, hasData: any };
  }, [posts]);
}

function PostHistoryGridView({
  grid, minAvg, maxAvg, hasData, loading,
}: {
  grid: HeatCell[][]; minAvg: number; maxAvg: number; hasData: boolean; loading: boolean;
}) {
  const cellColor = (cell: HeatCell) => {
    if (cell.count === 0) return '#eef2f7';
    if (maxAvg === minAvg) return 'hsl(205, 85%, 55%)';
    const avg = cell.totalViews / cell.count;
    const normalized = (avg - minAvg) / (maxAvg - minAvg); 
    const lightness = 88 - normalized * 68; 
    return `hsl(205, 85%, ${lightness}%)`;
  };

  if (!hasData && !loading) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-slate-400">
        Chưa có đủ dữ liệu giờ đăng bài để hiển thị.
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-4 flex-wrap text-xs text-slate-500">
        <span className="tabular-nums">{fmtNum(minAvg)}</span>
        <span
          className="h-2.5 w-32 rounded-full"
          style={{ background: 'linear-gradient(to right, hsl(205,85%,88%), hsl(205,85%,20%))' }}
        />
        <span className="tabular-nums">{fmtNum(maxAvg)}</span>
        <span className="flex items-center gap-1.5 ml-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
          Your posts
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          {WEEKDAY_LABELS.map((day, dayIdx) => (
            <div key={day} className="flex items-center gap-1.5 mb-1.5">
              <span className="w-9 text-[11px] text-slate-400 text-right pr-2 shrink-0">{day}</span>
              <div className="flex gap-[4px] flex-1">
                {grid[dayIdx].map((cell, hourIdx) => (
                  <div
                    key={hourIdx}
                    title={`${day} ${String(hourIdx).padStart(2, '0')}:00 — ${cell.count} bài, ${fmtNum(cell.totalViews)} views`}
                    className="relative flex-1 aspect-square rounded-[4px]"
                    style={{ backgroundColor: cellColor(cell) }}
                  >
                    {cell.count > 0 && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="w-3.5 h-3.5 rounded-full bg-amber-400" />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Nhãn giờ, cứ mỗi 2h */}
          <div className="flex items-center gap-1.5 mt-2">
            <span className="w-9 shrink-0" />
            <div className="flex-1 relative h-4">
              {HOUR_LABELS.map((h) => (
                <span
                  key={h}
                  className="absolute text-[10px] text-slate-400 -translate-x-1/2"
                  style={{ left: `${(h / 24) * 100}%` }}
                >
                  {String(h).padStart(2, '0')}:00
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Big single-panel card: TikTok / Facebook / YouTube (chỉ post history) ───────────────

function BestTimeBigCard({
  platform, posts, loading,
}: { platform: 'tiktok' | 'facebook' | 'youtube'; posts: Post[]; loading: boolean }) {
  const { grid, minAvg, maxAvg, hasData } = usePostHistoryGrid(posts);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <PlatformIcon name={platform} />
          <span className="text-sm font-bold text-slate-800">Best Time to Post</span>
        </div>
        <span className="text-xs font-mono text-slate-400">
          {loading ? 'Loading...' : 'All time'}
        </span>
      </div>
      <div className="p-6">
        <PostHistoryGridView grid={grid} minAvg={minAvg} maxAvg={maxAvg} hasData={hasData} loading={loading} />
      </div>
    </div>
  );
}

// ─── Big single-panel card: Instagram (2 tab — post history + fan online) ──────

function InstagramBigCard({ posts, loading }: { posts: Post[]; loading: boolean }) {
  const [tab, setTab] = useState<'online' | 'history'>('online');

  const { grid, minAvg, maxAvg, hasData } = usePostHistoryGrid(posts);

  const [feData, setFeData] = useState<TimeEngagementData | null>(null);
  const [feLoading, setFeLoading] = useState(false);
  const [feError, setFeError] = useState(false);

  useEffect(() => {
    const fetchTimeEngagement = async () => {
      setFeLoading(true);
      setFeError(false);
      try {
        const res = await fetch(`${API_BASE_URL}/insights/time-engagement`);
        const json = await res.json();
        if (!json.success) throw new Error(json.message || 'Fetch failed');
        setFeData(json.data);
      } catch (err) {
        console.error('Lỗi khi tải time-engagement (IG):', err);
        setFeError(true);
      } finally {
        setFeLoading(false);
      }
    };
    fetchTimeEngagement();
  }, []);

  const { feHours, feMin, feMax, recommendedSet } = useMemo(() => {
    const sorted = [...(feData?.full_day_stats || [])].sort((a, b) => a.vn_hour - b.vn_hour);
    let min = Infinity;
    let max = -Infinity;
    for (const h of sorted) {
      if (h.followers_online < min) min = h.followers_online;
      if (h.followers_online > max) max = h.followers_online;
    }
    const recSet = new Set(
      (feData?.recommended_vn_times || []).map((t) => Number(t.split(':')[0]))
    );
    return {
      feHours: sorted,
      feMin: sorted.length ? min : 0,
      feMax: sorted.length ? max : 0,
      recommendedSet: recSet,
    };
  }, [feData]);

  const feCellColor = (followersOnline: number) => {
    if (feHours.length === 0) return '#eef2f7';
    if (feMax === feMin) return 'hsl(330, 75%, 55%)';
    const normalized = (followersOnline - feMin) / (feMax - feMin);
    const lightness = 88 - normalized * 68;
    return `hsl(330, 75%, ${lightness}%)`;
  };

  return (
    <div className="rounded-2xl border border-pink-200 bg-white overflow-hidden">
      <div className="px-5 py-3 bg-pink-50/60 border-b border-pink-200 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <PlatformIcon name="instagram" />
          <span className="text-sm font-bold text-slate-800">Best Time to Post</span>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-pink-100">
        <button
          type="button"
          onClick={() => setTab('online')}
          className={`flex-1 text-xs font-semibold py-2.5 transition-colors ${
            tab === 'online'
              ? 'text-pink-600 border-b-2 border-pink-500 bg-pink-50/40'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Fan online (thực tế)
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`flex-1 text-xs font-semibold py-2.5 transition-colors ${
            tab === 'history'
              ? 'text-pink-600 border-b-2 border-pink-500 bg-pink-50/40'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Ước lượng từ post history
        </button>
      </div>

      <div className="p-6">
        {tab === 'history' ? (
          <PostHistoryGridView grid={grid} minAvg={minAvg} maxAvg={maxAvg} hasData={hasData} loading={loading} />
        ) : feError ? (
          <div className="flex items-center justify-center h-24 text-sm text-slate-400">
            Không tải được dữ liệu. Thử lại sau.
          </div>
        ) : feHours.length === 0 && !feLoading ? (
          <div className="flex items-center justify-center h-24 text-sm text-slate-400">
            Chưa có đủ dữ liệu.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4 flex-wrap text-xs text-slate-500">
              <span className="tabular-nums">{fmtNum(feMin)}</span>
              <span
                className="h-2.5 w-32 rounded-full"
                style={{ background: 'linear-gradient(to right, hsl(330,75%,88%), hsl(330,75%,20%))' }}
              />
              <span className="tabular-nums">{fmtNum(feMax)}</span>
              <span className="flex items-center gap-1.5 ml-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                Recommended
              </span>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                <div className="flex gap-[4px]">
                  {feHours.map((h) => (
                    <div
                      key={h.vn_hour}
                      title={`${String(h.vn_hour).padStart(2, '0')}:00 (VN) — ${fmtNum(h.followers_online)} followers online`}
                      className="relative flex-1 aspect-square rounded-[4px]"
                      style={{ backgroundColor: feCellColor(h.followers_online) }}
                    >
                      {recommendedSet.has(h.vn_hour) && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="w-3.5 h-3.5 rounded-full bg-amber-400" />
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 mt-2">
                  <div className="flex-1 relative h-4">
                    {HOUR_LABELS.map((h) => (
                      <span
                        key={h}
                        className="absolute text-[10px] text-slate-400 -translate-x-1/2"
                        style={{ left: `${(h / 24) * 100}%` }}
                      >
                        {String(h).padStart(2, '0')}:00
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {feData?.recommended_vn_times && feData.recommended_vn_times.length > 0 && (
              <div className="mt-5 p-3 bg-pink-50/50 border border-pink-100 rounded-xl">
                <p className="text-xs text-pink-700 font-semibold mb-1">Nên đăng bài lúc</p>
                <div className="flex gap-2 flex-wrap">
                  {feData.recommended_vn_times.map((t) => (
                    <span
                      key={t}
                      className="text-xs font-bold text-pink-600 bg-white border border-pink-200 rounded-full px-2.5 py-0.5"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-3 text-[11px] text-slate-400 leading-relaxed">
              Follower online thực tế (giờ VN) — chưa tách theo thứ trong tuần.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InsightsPage() {
  const [topPosts, setTopPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [allPostsLoading, setAllPostsLoading] = useState(false);

  const [demographics, setDemographics] = useState<DemographicRow[]>(REAL_DEMOGRAPHICS_SNAPSHOT);
  const [demoLoading, setDemoLoading] = useState(false);

  const [activePlatform, setActivePlatform] = useState<PlatformKey>('tiktok');

  useEffect(() => {
    const fetchTopPosts = async () => {
      setPostsLoading(true);
      try {
        const response = await fetch('https://thegivecollective-backend.vercel.app/api/v1/insights/top-posts');
        const data = await response.json();
        const normalizedPosts = normalizeTopPosts(data);
        setTopPosts(normalizedPosts);
      } catch (error) {
        console.error("Lỗi khi tải top posts:", error);
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
        console.error("Lỗi khi tải all posts:", error);
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
  const engagementRate = totalViews > 0 ? ((totalLikes / totalViews) * 100).toFixed(1) : '0.0';

  const totalKnownFollowers = demographics.reduce(
    (s, d) => s + d.female + d.male + d.undisclosed, 0,
  );

  const groupedPosts = useMemo(() => {
    return topPosts.reduce((acc, post) => {
      if (!acc[post.platform]) acc[post.platform] = [];
      acc[post.platform].push(post);
      return acc;
    }, {} as Record<string, Post[]>);
  }, [topPosts]);

  const platformCount = Object.keys(groupedPosts).length;

  // Lọc thêm mảng bài viết YouTube
  const tiktokPosts = useMemo(() => allPosts.filter((p) => p.platform?.toLowerCase() === 'tiktok'), [allPosts]);
  const facebookPosts = useMemo(() => allPosts.filter((p) => p.platform?.toLowerCase() === 'facebook'), [allPosts]);
  const instagramPosts = useMemo(() => allPosts.filter((p) => p.platform?.toLowerCase() === 'instagram'), [allPosts]);
  const youtubePosts = useMemo(() => allPosts.filter((p) => p.platform?.toLowerCase() === 'youtube'), [allPosts]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 mt-16 pb-12">
      <div className="mx-auto max-w-7xl px-6 py-8 space-y-10">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Insights &amp; Performance</h1>
          <p className="text-sm text-slate-500 mt-1">
            In-depth analysis of our audience and top-performing content.
          </p>
        </div>

        {/* ── SECTION 1: Overview ── */}
        <section className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Total Views"      value={fmtNum(totalViews)}     sub={`Top posts across ${platformCount} platforms`}   colorKey="up"   />
            <StatCard label="Total Likes"      value={fmtNum(totalLikes)}     sub={`Top posts across ${platformCount} platforms`}   colorKey="none" />
            <StatCard label="Engagement Rate"  value={`${engagementRate}%`}   sub="Likes / views, top posts"                        colorKey="none" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Demographics */}
            <div className="lg:col-span-5 rounded-2xl border border-emerald-200 bg-white overflow-hidden flex flex-col">
              <div className="px-5 py-3 flex items-center justify-between bg-emerald-50/60 border-b border-emerald-200">
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">Audience demographics</span>
                <span className="text-xs font-mono text-emerald-600">
                  {demoLoading ? 'Loading...' : `${fmtNum(totalKnownFollowers)} followers · IG`}
                </span>
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={demographics}
                      layout="vertical"
                      margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="#e2e8f0" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis dataKey="age" type="category" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Bar dataKey="female" name="Female" stackId="a" fill="#ec4899" barSize={16} />
                      <Bar dataKey="male" name="Male" stackId="a" fill="#6366f1" barSize={16} />
                      <Bar dataKey="undisclosed" name="Undisclosed" stackId="a" fill="#cbd5e1" radius={[0, 4, 4, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl flex gap-3">
                  <span className="text-xl">💡</span>
                  <div>
                    <p className="text-sm text-emerald-800 font-semibold mb-1">Quick Insight</p>
                    <p className="text-xs text-emerald-600 leading-relaxed">
                      The 25-44 age group makes up the majority of followers with available demographic data.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Posts */}
            <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col">
              <div className="px-5 py-3 flex items-center justify-between bg-slate-50 border-b border-slate-200">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Top performing posts</span>
                <span className="text-xs font-mono text-slate-400">
                  {postsLoading ? 'Loading...' : 'Top 3 posts / platform'}
                </span>
              </div>

              <div className="p-5 flex-1 overflow-y-auto max-h-[460px] space-y-8">
                {postsLoading && topPosts.length === 0 ? (
                   <div className="flex items-center justify-center h-full text-sm text-slate-400 py-10">
                     Loading posts...
                   </div>
                ) : Object.keys(groupedPosts).length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-slate-400 py-10">
                    No posts available.
                  </div>
                ) : (
                  Object.entries(groupedPosts).map(([platform, posts]) => (
                    <div key={platform}>
                      <div className="flex items-center gap-2 mb-4">
                        <PlatformIcon name={platform} />
                        <h3 className="text-sm font-bold text-slate-700 capitalize">{platform}</h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {posts.map((post) => (
                          <a
                            key={post.id}
                            href={post.url}
                            target="_blank"
                            rel="noreferrer"
                            className={`relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between ${!post.url ? 'pointer-events-none' : ''}`}
                          >
                            <div className="mb-4">
                              <h4 className="text-[13px] font-semibold text-slate-800 leading-snug line-clamp-3" title={post.title}>
                                {post.title}
                              </h4>
                              <p className="text-[11px] text-slate-400 mt-1.5">{post.date}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 border border-slate-100 p-2.5 text-center mt-auto">
                              <div>
                                <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wide">Views</p>
                                <p className="mt-0.5 text-[13px] font-bold text-slate-700">{fmtNum(post.views)}</p>
                              </div>
                              <div className="border-l border-slate-200">
                                <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wide">Likes</p>
                                <p className="mt-0.5 text-[13px] font-bold text-slate-700">{fmtNum(post.likes)}</p>
                              </div>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </section>

        {/* ── SECTION 2: Best Time to Post — navbar chọn platform, 1 bảng lớn ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Best Time to Post</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Chọn nền tảng để xem chi tiết khung giờ đăng bài tốt nhất.
              </p>
            </div>
            <PlatformSwitcher active={activePlatform} onChange={setActivePlatform} />
          </div>

          {activePlatform === 'tiktok' && (
            <BestTimeBigCard platform="tiktok" posts={tiktokPosts} loading={allPostsLoading} />
          )}
          {activePlatform === 'facebook' && (
            <BestTimeBigCard platform="facebook" posts={facebookPosts} loading={allPostsLoading} />
          )}
          {activePlatform === 'instagram' && (
            <InstagramBigCard posts={instagramPosts} loading={allPostsLoading} />
          )}
          {activePlatform === 'youtube' && (
            <BestTimeBigCard platform="youtube" posts={youtubePosts} loading={allPostsLoading} />
          )}
        </section>

      </div>
    </div>
  );
}