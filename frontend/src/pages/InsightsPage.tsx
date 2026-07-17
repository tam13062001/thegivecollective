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
  id: string | number; // Cập nhật để nhận _id từ MongoDB
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

  // 1. Lấy ra mảng posts an toàn
  if (Array.isArray(raw)) {
    rawArray = raw;
  } else if (raw && typeof raw === 'object' && Array.isArray(raw.posts)) {
    rawArray = raw.posts;
  }

  // 2. Dùng .flat() để trải phẳng nếu nó là mảng 2D
  const flatDocs = rawArray.flat();

  // 3. Map thành chuẩn Post[] cho UI
  return flatDocs.map((doc, idx) => ({
    id: doc._id || idx + 1, // Ưu tiên _id của MongoDB
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

// ─── Post Schedule Table (giờ có tab theo platform) ────────────────────────────

const PAGE_SIZE = 10;

function PostScheduleTable({ posts, loading }: { posts: Post[]; loading: boolean }) {
  // Danh sách platform xuất hiện trong data, giữ thứ tự xuất hiện đầu tiên
  const platforms = useMemo(() => {
    const seen: string[] = [];
    for (const p of posts) {
      if (!seen.includes(p.platform)) seen.push(p.platform);
    }
    return seen;
  }, [posts]);

  const [activeTab, setActiveTab] = useState<string>('All');
  const [page, setPage] = useState(1);

  // Nếu tab đang chọn không còn tồn tại trong data mới (vd sau khi refetch) thì reset về All
  useEffect(() => {
    if (activeTab !== 'All' && !platforms.includes(activeTab)) {
      setActiveTab('All');
    }
  }, [platforms, activeTab]);

  // Đổi tab thì quay lại trang 1
  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  const filteredPosts = useMemo(() => {
    const base = activeTab === 'All' ? posts : posts.filter((p) => p.platform === activeTab);
    return [...base].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [posts, activeTab]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE));

  // Nếu data thay đổi khiến trang hiện tại vượt quá tổng số trang thì kéo về trang cuối
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedPosts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredPosts.slice(start, start + PAGE_SIZE);
  }, [filteredPosts, page]);

  const tabs = ['All', ...platforms];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
          Post schedule
        </span>
        <span className="text-xs font-mono text-slate-400">
          {loading ? 'Loading...' : `${filteredPosts.length} posts`}
        </span>
      </div>

      {/* Tabs theo platform */}
      <div className="px-5 pt-3 flex items-center gap-2 flex-wrap border-b border-slate-100 pb-3">
        {tabs.map((tab) => {
          const isActive = tab === activeTab;
          const count = tab === 'All' ? posts.length : posts.filter((p) => p.platform === tab).length;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {tab !== 'All' && <PlatformIcon name={tab} />}
              <span className="capitalize">{tab}</span>
              <span className={`tabular-nums ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left">
              <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Platform</th>
              <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Title</th>
              <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Date</th>
              <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Time</th>
              <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 text-right">Views</th>
              <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 text-right">Likes</th>
            </tr>
          </thead>
          <tbody>
            {loading && paginatedPosts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                  Loading posts...
                </td>
              </tr>
            ) : paginatedPosts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                  No posts available.
                </td>
              </tr>
            ) : (
              paginatedPosts.map((post) => {
                const { date, time } = splitDateTime(post.date);
                return (
                  <tr
                    key={post.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="px-5 py-2.5">
                      <PlatformIcon name={post.platform} />
                    </td>
                    <td className="px-5 py-2.5 max-w-[320px]">
                      {post.url ? (
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-700 hover:text-slate-900 hover:underline line-clamp-1"
                          title={post.title}
                        >
                          {post.title}
                        </a>
                      ) : (
                        <span className="text-slate-700 line-clamp-1" title={post.title}>
                          {post.title}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-slate-500 tabular-nums whitespace-nowrap">{date}</td>
                    <td className="px-5 py-2.5 text-slate-500 tabular-nums whitespace-nowrap">{time || '—'}</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-slate-700 tabular-nums">{fmtNum(post.views)}</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-slate-700 tabular-nums">{fmtNum(post.likes)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Phân trang */}
      {filteredPosts.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <span className="text-xs text-slate-400">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredPosts.length)} of {filteredPosts.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              // Giới hạn hiển thị số trang xung quanh trang hiện tại để tránh tràn khi có nhiều trang
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx) =>
                p === 'ellipsis' ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-xs text-slate-300">…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`rounded-lg w-8 h-8 text-xs font-semibold tabular-nums transition-colors ${
                      p === page
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-500 bg-slate-100 hover:bg-slate-200'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InsightsPage() {
  // Top 3 posts / platform - dùng cho phần "Top performing posts" và các stat card
  const [topPosts, setTopPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  // Toàn bộ bài viết - dùng riêng cho bảng "Post schedule"
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [allPostsLoading, setAllPostsLoading] = useState(false);

  const [demographics, setDemographics] = useState<DemographicRow[]>(REAL_DEMOGRAPHICS_SNAPSHOT);
  const [demoLoading, setDemoLoading] = useState(false);

  useEffect(() => {
    const fetchTopPosts = async () => {
      setPostsLoading(true); // Bật loading
      try {
        // Bạn có thể cân nhắc đổi url này thành `${API_BASE_URL}/insights/top-posts` cho đồng bộ
        const response = await fetch('https://thegivecollective-backend.vercel.app/api/v1/insights/top-posts');
        const data = await response.json();

        // Sử dụng hàm normalize để trích xuất array an toàn
        const normalizedPosts = normalizeTopPosts(data);
        setTopPosts(normalizedPosts);
      } catch (error) {
        console.error("Lỗi khi tải top posts:", error);
      } finally {
        setPostsLoading(false); // Tắt loading dù thành công hay thất bại
      }
    };
    fetchTopPosts();
  }, []);

  useEffect(() => {
    const fetchAllPosts = async () => {
      setAllPostsLoading(true);
      try {
        const response = await fetch(`https://thegivecollective-backend.vercel.app/api/v1/insights/all-posts`);
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
        const res = await fetch(`https://thegivecollective-backend.vercel.app/api/v1/insights/demographics`);
        if (!res.ok) return;
        const parsed: DemographicRow[] = await res.json();
        if (Array.isArray(parsed) && parsed.length > 0) setDemographics(parsed);
      } catch {
        // Fallback giữ nguyên data mẫu nếu lỗi
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

  // Gom nhóm bài viết theo platform (dùng cho phần "Top performing posts")
  const groupedPosts = useMemo(() => {
    return topPosts.reduce((acc, post) => {
      if (!acc[post.platform]) acc[post.platform] = [];
      acc[post.platform].push(post);
      return acc;
    }, {} as Record<string, Post[]>);
  }, [topPosts]);

  const platformCount = Object.keys(groupedPosts).length;

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

          {/* Stat cards */}
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

              {/* Khu vực cuộn hiển thị tất cả bài viết */}
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
                      {/* Tên Nền Tảng */}
                      <div className="flex items-center gap-2 mb-4">
                        <PlatformIcon name={platform} />
                        <h3 className="text-sm font-bold text-slate-700 capitalize">{platform}</h3>
                      </div>

                      {/* Lưới các bài viết */}
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

        {/* ── SECTION 2: Post Schedule (full posts, chia tab theo platform) ── */}
        <section>
          <PostScheduleTable posts={allPosts} loading={allPostsLoading} />
        </section>

      </div>
    </div>
  );
}