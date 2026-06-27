import { useState, useEffect, useId } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { GrowthChart } from '../components/GrowthChart';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Metric {
  _id: string;
  platformName: string;
  accountHandle: string;
  profileUrl: string;
  followersCount: number;
  postsCount: number;
  viewsCount: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const API_BASE_URL = 'https://thegivecollective-backend.vercel.app/api/v1/tasks';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ─── Trend styles ─────────────────────────────────────────────────────────────

const TREND = {
  up:   { color: '#10b981', badge: 'bg-emerald-500/15 text-emerald-600 border border-emerald-200', dot: 'bg-emerald-500', border: 'border-emerald-200', bg: 'bg-emerald-50/60', label: 'text-emerald-600' },
  down: { color: '#f43f5e', badge: 'bg-rose-500/15 text-rose-600 border border-rose-200',        dot: 'bg-rose-500',    border: 'border-rose-200',    bg: 'bg-rose-50/60',    label: 'text-rose-600' },
  none: { color: '#6366f1', badge: 'bg-slate-100 text-slate-500 border border-slate-200',        dot: 'bg-slate-400',   border: 'border-slate-100',   bg: 'bg-slate-50',       label: 'text-slate-500' },
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, colorKey,
}: {
  label: string; value: number; sub: string; colorKey: keyof typeof TREND;
}) {
  const s = TREND[colorKey];
  return (
    <div className={`relative rounded-2xl border p-5 ${s.border} ${s.bg}`}>
      <span className={`absolute top-4 right-4 w-2 h-2 rounded-full ${s.dot}`} />
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">{label}</p>
      <p className={`text-3xl font-bold tabular-nums text-slate-800`}>{fmtNum(value)}</p>
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
          {fmtNum(p.value)} <span className="font-normal text-slate-400">{p.dataKey}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Platform Icon ────────────────────────────────────────────────────────────

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

const Homepage = () => {
  const [metrics, setMetrics]     = useState<Metric[]>([]);
  const [urlInput, setUrlInput]   = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchMetrics = async () => {
    try {
      const response = await fetch(API_BASE_URL);
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => { fetchMetrics(); }, []);

  const handleAddMetric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return alert('Please enter a URL!');
    setIsLoading(true);
    try {
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: [urlInput] }),
      });
      const result = await response.json();
      if (response.ok) { setUrlInput(''); fetchMetrics(); }
      else alert(result.message || 'An error occurred');
    } catch { alert('Error connecting to server'); }
    finally { setIsLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete?')) return;
    try {
      const response = await fetch(`${API_BASE_URL}/${id}`, { method: 'DELETE' });
      if (response.ok) setMetrics(metrics.filter((item) => item._id !== id));
      else alert('Error deleting data');
    } catch { alert('Error connecting to server'); }
  };

  // Summary totals
  const totalFollowers = metrics.reduce((s, i) => s + (i.followersCount || 0), 0);
  const totalPosts     = metrics.reduce((s, i) => s + (i.postsCount    || 0), 0);
  const totalViews     = metrics.reduce((s, i) => s + (i.viewsCount    || 0), 0);

  // Bar chart data: views per platform
  const viewsChartData = metrics.map((m) => ({
    name: m.platformName,
    views: m.viewsCount || 0,
    posts: m.postsCount || 0,
  }));

  const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#f43f5e', '#3b82f6', '#8b5cf6', '#ec4899'];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 mt-16">
      <div className="mx-auto max-w-7xl px-6 py-8 space-y-10">
        <GrowthChart />
        {/* ── SECTION 1: Overview stats + charts ── */}
        <section className="space-y-5">

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Total Views"     value={totalViews}     sub={`Total from ${metrics.length} platforms`} colorKey="up"   />
            <StatCard label="Total Posts"     value={totalPosts}     sub={`Total from ${metrics.length} platforms`} colorKey="none" />
            <StatCard label="Total Followers" value={totalFollowers} sub={`Total from ${metrics.length} platforms`} colorKey="none" />
          </div>

          {/* Charts */}
          {metrics.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Views per platform */}
              <div className="rounded-2xl border border-emerald-200 bg-white overflow-hidden">
                <div className="px-5 py-3 flex items-center justify-between bg-emerald-50/60 border-b border-emerald-200">
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">Views per platform</span>
                  <span className="text-xs font-mono text-emerald-600">{metrics.length} platforms</span>
                </div>
                <div className="p-4">
                  <ResponsiveContainer width="100%" height={190}>
                    <BarChart data={viewsChartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={fmtNum} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={44} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="views" radius={[6, 6, 0, 0]}>
                        {viewsChartData.map((_, i) => (
                          <rect key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Posts per platform */}
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-5 py-3 flex items-center justify-between bg-slate-50 border-b border-slate-200">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Posts per platform</span>
                  <span className="text-xs font-mono text-slate-400">{metrics.length} platforms</span>
                </div>
                <div className="p-4">
                  <ResponsiveContainer width="100%" height={190}>
                    <BarChart data={viewsChartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={fmtNum} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={44} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="posts" radius={[6, 6, 0, 0]} fill="#6366f1" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── DIVIDER ── */}
        <div className="border-t border-slate-100" />

        {/* ── SECTION 2: Social Media Performance ── */}
        <section className="space-y-6">

          {/* Header & add form */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-2xl font-bold text-slate-800">Social Media Performance</h2>
            <form onSubmit={handleAddMetric} className="flex w-full md:w-auto gap-2">
              <input
                type="text"
                placeholder="Enter TikTok, Facebook link..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="w-full md:w-72 rounded-lg border border-slate-200 px-4 py-2 text-sm bg-white focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-300"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading}
                className="whitespace-nowrap rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:bg-slate-300"
              >
                {isLoading ? 'Updating...' : 'Update'}
              </button>
            </form>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-2xl bg-blue-50 border border-blue-100 p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Total Followers</p>
              <p className="mt-3 text-3xl font-bold text-slate-800">{totalFollowers.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl bg-blue-50 border border-blue-100 p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Total Posts</p>
              <p className="mt-3 text-3xl font-bold text-slate-800">{totalPosts.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Total Views</p>
              <p className="mt-3 text-3xl font-bold text-slate-800">{fmtNum(totalViews)}</p>
            </div>
            <div className="rounded-2xl bg-purple-50 border border-purple-100 p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Connected Platforms</p>
              <p className="mt-3 text-3xl font-bold text-slate-800">{metrics.length}</p>
            </div>
          </div>

          {/* Platform cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {metrics.map((metric) => (
              <div
                key={metric._id}
                className="relative rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <button
                  onClick={() => handleDelete(metric._id)}
                  className="absolute right-4 top-4 text-slate-300 hover:text-red-400 transition-colors text-lg leading-none"
                  title="Delete"
                >
                  ✕
                </button>

                <div className="flex items-center gap-2.5 mb-4">
                  <PlatformIcon name={metric.platformName} />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 leading-tight">{metric.platformName}</h3>
                    <a
                      href={metric.profileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-slate-400 hover:text-blue-500 transition-colors"
                    >
                      {metric.accountHandle} ↗
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 border border-slate-100 p-3 text-center">
                  <div>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Followers</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{fmtNum(metric.followersCount ?? 0)}</p>
                  </div>
                  <div className="border-x border-slate-200">
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Posts</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{fmtNum(metric.postsCount ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Views</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{fmtNum(metric.viewsCount ?? 0)}</p>
                  </div>
                </div>
              </div>
            ))}

            {metrics.length === 0 && (
              <div className="col-span-full py-14 text-center text-slate-400">
                <p className="text-sm">No platform data available yet.</p>
                <p className="text-xs mt-1 text-slate-300">Enter a link above to get started.</p>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
};

export default Homepage;