import { useState, useEffect } from 'react';
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
  id: number;
  platform: string;
  title: string;
  views: number;
  likes: number;
  date: string;
  url?: string;
};

// Shape thật trả về từ MongoDB (bảng TopPost) — có _id, createdAt, updatedAt...
type TopPostDoc = {
  _id: string;
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

// ─── Constants ───────────────────────────────────────────────────────────────

const API_BASE_URL = 'https://thegivecollective-backend.vercel.app/api/v1';

// ─── Mock data (fallback nếu backend/API lỗi hoặc cache rỗng) ──────────────────

const MOCK_TOP_POSTS: Post[] = [
  { id: 1, platform: 'Instagram', title: 'Behind the scenes: Give Collective team behind the scenes', views: 125000, likes: 14200, date: '2026-07-10' },
  { id: 2, platform: 'TikTok', title: 'A day in the life of our volunteers', views: 45000, likes: 5100, date: '2026-07-12' },
  { id: 3, platform: 'Facebook', title: 'Join our upcoming charity event this weekend!', views: 1500, likes: 120, date: '2026-07-14' },
  { id: 4, platform: 'YouTube', title: 'The Give Collective — 2026 Impact Recap', views: 8600, likes: 410, date: '2026-06-28' },
];

// Snapshot thật lấy từ Meta Graph API v25.0
// GET /17841422427064625/insights?metric=follower_demographics&period=lifetime&timeframe=this_month&breakdown=age,gender
const REAL_DEMOGRAPHICS_SNAPSHOT: DemographicRow[] = [
  { age: '13-17', female: 8,  male: 6,  undisclosed: 10 },
  { age: '18-24', female: 33, male: 25, undisclosed: 30 },
  { age: '25-34', female: 62, male: 48, undisclosed: 26 },
  { age: '35-44', female: 61, male: 35, undisclosed: 16 },
  { age: '45-54', female: 22, male: 11, undisclosed: 7  },
  { age: '55-64', female: 13, male: 4,  undisclosed: 1  },
  { age: '65+',   female: 1,  male: 2,  undisclosed: 1  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/**
 * Backend /insights/top-posts trả về 2 dạng:
 *  - Mảng TopPostDoc[] thẳng, khi cache có data
 *  - { message, posts: [] } khi cache rỗng (chưa refresh lần nào)
 * Chuẩn hoá về Post[] (id số) dùng chung cho UI, dùng luôn cho cả 2 trường hợp.
 */
function normalizeTopPosts(raw: unknown): Post[] {
  const docs: TopPostDoc[] = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as any)?.posts)
      ? (raw as any).posts
      : [];

  return docs.map((doc, idx) => ({
    id: idx + 1,
    platform: doc.platform,
    title: doc.title,
    views: doc.views,
    likes: doc.likes,
    date: doc.date,
    url: doc.url,
  }));
}

// ─── Trend styles (shared with Homepage) ───────────────────────────────────────

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

// ─── Platform Icon (shared with Homepage) ──────────────────────────────────────

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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InsightsPage() {
  const [topPosts, setTopPosts] = useState<Post[]>(MOCK_TOP_POSTS);
  const [postsLoading, setPostsLoading] = useState(false);

  const [demographics, setDemographics] = useState<DemographicRow[]>(REAL_DEMOGRAPHICS_SNAPSHOT);
  const [demoLoading, setDemoLoading] = useState(false);

  // Top posts: đọc cache từ /insights/top-posts (xem controllers/topPostController.js)
  useEffect(() => {
    const fetchTopPosts = async () => {
      setPostsLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/insights/top-posts`);
        if (!res.ok) return; // giữ mock nếu backend lỗi
        const raw = await res.json();
        const posts = normalizeTopPosts(raw);
        if (posts.length > 0) setTopPosts(posts);
        // Nếu posts.length === 0 (cache chưa có data) → giữ nguyên MOCK_TOP_POSTS
      } catch {
        // giữ MOCK_TOP_POSTS nếu fetch lỗi
      } finally {
        setPostsLoading(false);
      }
    };
    fetchTopPosts();
  }, []);

  // Demographics: xem routes/Insights.js ở backend
  useEffect(() => {
    const fetchDemographics = async () => {
      setDemoLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/insights/demographics`);
        if (!res.ok) return;
        const parsed: DemographicRow[] = await res.json();
        if (Array.isArray(parsed) && parsed.length > 0) setDemographics(parsed);
      } catch {
        // giữ REAL_DEMOGRAPHICS_SNAPSHOT nếu fetch lỗi
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

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 mt-16 pb-12">
      <div className="mx-auto max-w-7xl px-6 py-8 space-y-10">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Insights &amp; Performance</h1>
          <p className="text-sm text-slate-500 mt-1">
            Phân tích chuyên sâu về khán giả và nội dung hoạt động tốt nhất.
          </p>
        </div>

        {/* ── SECTION 1: Overview ── */}
        <section className="space-y-5">

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Total Views"      value={fmtNum(totalViews)}     sub={`Top post trên ${topPosts.length} nền tảng`}   colorKey="up"   />
            <StatCard label="Total Likes"      value={fmtNum(totalLikes)}     sub={`Top post trên ${topPosts.length} nền tảng`}   colorKey="none" />
            <StatCard label="Engagement Rate"  value={`${engagementRate}%`}   sub="Likes / views, top posts"                        colorKey="none" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

            {/* Demographics */}
            <div className="lg:col-span-5 rounded-2xl border border-emerald-200 bg-white overflow-hidden flex flex-col">
              <div className="px-5 py-3 flex items-center justify-between bg-emerald-50/60 border-b border-emerald-200">
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">Audience demographics</span>
                <span className="text-xs font-mono text-emerald-600">
                  {demoLoading ? 'Đang tải…' : `${fmtNum(totalKnownFollowers)} followers · IG`}
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
                      <Bar dataKey="female" name="Nữ" stackId="a" fill="#ec4899" barSize={16} />
                      <Bar dataKey="male" name="Nam" stackId="a" fill="#6366f1" barSize={16} />
                      <Bar dataKey="undisclosed" name="Không xác định" stackId="a" fill="#cbd5e1" radius={[0, 4, 4, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl flex gap-3">
                  <span className="text-xl">💡</span>
                  <div>
                    <p className="text-sm text-emerald-800 font-semibold mb-1">Quick Insight</p>
                    <p className="text-xs text-emerald-600 leading-relaxed">
                      Nhóm tuổi 25-44 chiếm đông nhất trong followers có dữ liệu demographic (Meta chỉ tính followers mà họ xác định được tuổi/giới tính).
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
                  {postsLoading ? 'Đang tải…' : '1 bài / nền tảng'}
                </span>
              </div>

              <div className="p-4 grid grid-cols-1 gap-3 flex-1">
                {topPosts.map((post) => {
                  const card = (
                    <div className="flex items-start gap-2.5 mb-3">
                      <PlatformIcon name={post.platform} />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-slate-800 leading-tight truncate" title={post.title}>
                          {post.title}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">{post.date}</p>
                      </div>
                    </div>
                  );
                  return (
                    <a
                      key={post.id}
                      href={post.url}
                      target="_blank"
                      rel="noreferrer"
                      className={`relative rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow block ${!post.url ? 'pointer-events-none' : ''}`}
                    >
                      {card}
                      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 border border-slate-100 p-3 text-center">
                        <div>
                          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Views</p>
                          <p className="mt-1 text-sm font-semibold text-slate-700">{fmtNum(post.views)}</p>
                        </div>
                        <div className="border-l border-slate-200">
                          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Likes</p>
                          <p className="mt-1 text-sm font-semibold text-slate-700">{fmtNum(post.likes)}</p>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>

          </div>
        </section>

      </div>
    </div>
  );
}