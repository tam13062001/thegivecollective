import { useState, useEffect, useId } from 'react';
import {
  Eye, Users, UserPlus, BarChart3, TrendingUp, Clock, RefreshCw, Pencil,
  Globe, FileText, AlertTriangle, Zap,
} from 'lucide-react';
import {
  AreaChart, Area,
  XAxis, YAxis,
  CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ─── GA4 Types ────────────────────────────────────────────────────────────────

interface TrafficSource {
  source: string;
  medium: string;
  sessions: number;
  users: number;
}

interface CountryStat {
  country: string;
  users: number;
  sessions: number;
}

interface AgeBracket {
  age: string;
  users: number;
}

interface GenderStat {
  gender: string;
  users: number;
}

interface TopPage {
  path: string;
  views: number;
  users: number;
}

interface KeyEvent {
  eventName: string;
  count: number;
}

interface DonationFunnel {
  donateNowBtn: number;
  donorInfoForm: number;
  donationAmountEdit: number;
  tipEditButtonClick: number;
  checkoutBtnClick: number;
  donationPayment: number;
  donationConfirmation: number;
}

interface GA4Stats {
  _id?: string;
  websiteUrl: string;
  pageviews: number;
  users: number;
  newUsers: number;
  sessions: number;
  bounceRate: number;
  avgDuration: number;
  engagementRate: number;
  days: number;
  totalKeyEvents: number;
  donationFunnel: DonationFunnel;
  keyEventsBreakdown: KeyEvent[];
  keyEventsBreakdownExcludeDirect: KeyEvent[];
  trafficSources: TrafficSource[];
  countries: CountryStat[];
  ageBrackets: AgeBracket[];
  genders: GenderStat[];
  topPages: TopPage[];
  lastUpdated: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Dùng proxy nên gọi tương đối, không cần domain + port
const GA4_API_URL = 'https://thegivecollective-backend.vercel.app/api/v1/ga4-secondary';
const HISTORY_API = 'https://thegivecollective-backend.vercel.app/api/v1/ga4-secondary/history'; 

const RANGES = [
  { label: '7D',  days: 7  },
  { label: '14D', days: 14 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
];

const GA4_RANGES = RANGES;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(seconds: number): string {
  return `${Math.round(seconds)}s`;
}

function fmtLastUpdated(value: string | undefined | null): string {
  if (!value) return 'No data';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No data';
  return date.toISOString();
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: '2-digit',
  });
}

function getDelta(data: ChartPoint[], key: keyof ChartPoint): number | null {
  if (data.length < 2) return null;
  const first = data[0][key] as number;
  const last  = data[data.length - 1][key] as number;
  if (!first) return null;
  return ((last - first) / first) * 100;
}

// ─── GA4 Component ────────────────────────────────────────────────────────────

export function GA4Card() {
  const [stats, setStats] = useState<GA4Stats | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [websiteDraft, setWebsiteDraft] = useState('');
  const [days, setDays] = useState(30);

  const fetchStats = async () => {
    try {
      const res = await fetch(GA4_API_URL);
      const data = await res.json();

      if (!res.ok) {
        setLoadError(data?.message || `Error ${res.status} loading GA4 stats`);
        setStats(null);
        return;
      }

      setLoadError(null);
      setStats(data);
      setWebsiteDraft(data.websiteUrl ?? '');
      if (data.days) setDays(data.days);
    } catch (error) {
      console.error('Error fetching GA4 stats:', error);
      setLoadError('Server connection error');
      setStats(null);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleRefresh = async (rangeToUse: number = days) => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`${GA4_API_URL}/refresh?days=${rangeToUse}`, { method: 'GET' });
      const data = await res.json();
      if (res.ok) {
        setLoadError(null);
        setStats(data);
        setDays(rangeToUse);
      } else {
        alert(data.message || 'Failed to refresh GA4 stats');
      }
    } catch {
      alert('Server connection error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRangeChange = (newDays: number) => {
    setDays(newDays);
    handleRefresh(newDays);
  };

  const handleSaveWebsite = async () => {
    try {
      const res = await fetch(`${GA4_API_URL}/website`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteUrl: websiteDraft }),
      });
      const data = await res.json();
      if (res.ok) {
        setStats(data);
        setIsEditing(false);
      } else {
        alert(data.message || 'Failed to update website');
      }
    } catch {
      alert('Server connection error');
    }
  };

  if (loadError) {
    return (
      <div className="rounded-2xl border border-signal-border bg-signal-panel p-6 flex items-center gap-3">
        <AlertTriangle size={18} className="text-signal-coral shrink-0" />
        <div>
          <p className="text-sm font-medium text-signal-text">Failed to load GA4 stats</p>
          <p className="text-xs text-signal-coral mt-0.5">{loadError}</p>
        </div>
        <button
          onClick={fetchStats}
          className="ml-auto text-xs font-medium text-signal-coral hover:text-signal-text underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const trafficSources = stats.trafficSources ?? [];
  const countries = stats.countries ?? [];
  const ageBrackets = stats.ageBrackets ?? [];
  const genders = stats.genders ?? [];
  const topPages = stats.topPages ?? [];
  const keyEventsBreakdown = stats.keyEventsBreakdown ?? [];
  const keyEventsBreakdownExcludeDirect = stats.keyEventsBreakdownExcludeDirect ?? [];

  const maxSourceSessions = Math.max(1, ...trafficSources.map((t) => t.sessions));
  const maxCountryUsers = Math.max(1, ...countries.map((c) => c.users));
  const maxAgeUsers = Math.max(1, ...ageBrackets.map((a) => a.users));
  const maxGenderUsers = Math.max(1, ...genders.map((g) => g.users));
  const maxPageViews = Math.max(1, ...topPages.map((p) => p.views));
  const maxEventCount = Math.max(1, ...keyEventsBreakdown.map((e) => e.count));
  const maxEventCountExcludeDirect = Math.max(1, ...keyEventsBreakdownExcludeDirect.map((e) => e.count));

  return (
    <div className="relative rounded-2xl border border-slate-100 bg-slate-50/60 p-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm text-slate-500">Website</p>
          </div>
          {isEditing ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={websiteDraft}
                onChange={(e) => setWebsiteDraft(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm w-72 focus:outline-none focus:ring-1 focus:ring-blue-300"
                autoFocus
              />
              <button onClick={handleSaveWebsite} className="text-xs font-medium text-signal-cyan hover:text-signal-text">
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setWebsiteDraft(stats.websiteUrl);
                }}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <a
                href={stats.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="text-lg font-semibold text-signal-cyan hover:underline"
              >
                {stats.websiteUrl || 'Website not set'}
              </a>
              <button onClick={() => setIsEditing(true)} title="Edit" className="text-slate-400 hover:text-slate-600">
                <Pencil size={14} />
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
            {GA4_RANGES.map(({ label, days: d }) => (
              <button
                key={d}
                onClick={() => handleRangeChange(d)}
                disabled={isRefreshing}
                className={`px-3 h-9 font-medium transition-colors disabled:opacity-50 ${
                  days === d
                    ? 'bg-slate-800 text-white'
                    : 'bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => handleRefresh()}
            disabled={isRefreshing}
            className="flex items-center gap-2 rounded-full bg-signal-cyan px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:bg-signal-slate transition-colors"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Updating...' : 'Refresh GA4 Stats'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-7 gap-4">
        <StatBox icon={<Eye size={16} className="text-blue-500" />} label="Pageviews" value={stats.pageviews.toLocaleString()} />
        <StatBox icon={<Users size={16} className="text-emerald-500" />} label="Users" value={stats.users.toLocaleString()} />
        <StatBox icon={<UserPlus size={16} className="text-green-500" />} label="New Users" value={stats.newUsers.toLocaleString()} />
        <StatBox icon={<BarChart3 size={16} className="text-purple-500" />} label="Sessions" value={stats.sessions.toLocaleString()} />
        <StatBox icon={<TrendingUp size={16} className="text-orange-500" />} label="Bounce Rate" value={`${stats.bounceRate}%`} />
        <StatBox icon={<TrendingUp size={16} className="text-teal-500" />} label="Engagement Rate" value={`${stats.engagementRate}%`} />
        <StatBox icon={<Clock size={16} className="text-pink-500" />} label="Avg Duration" value={fmtDuration(stats.avgDuration)} />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BreakdownPanel
          icon={<Globe size={14} className="text-blue-500" />}
          title="Traffic Source / Medium"
        >
          {trafficSources.length === 0 && <EmptyNote />}
          {trafficSources.map((t, i) => (
            <BarRow
              key={i}
              label={`${t.source} / ${t.medium}`}
              value={t.sessions}
              max={maxSourceSessions}
              suffix={`${t.sessions} sessions`}
            />
          ))}
        </BreakdownPanel>

        <BreakdownPanel
          icon={<Globe size={14} className="text-emerald-500" />}
          title="Countries"
        >
          {countries.length === 0 && <EmptyNote />}
          {countries.map((c, i) => (
            <BarRow
              key={i}
              label={c.country}
              value={c.users}
              max={maxCountryUsers}
              suffix={`${c.users} users`}
              barClassName="bg-emerald-400"
            />
          ))}
        </BreakdownPanel>

        <BreakdownPanel
          icon={<Users size={14} className="text-purple-500" />}
          title="Age"
          note="Enable Google Signals in GA4 to see this data"
        >
          {ageBrackets.length === 0 && <EmptyNote />}
          {ageBrackets.map((a, i) => (
            <BarRow
              key={i}
              label={a.age}
              value={a.users}
              max={maxAgeUsers}
              suffix={`${a.users} users`}
              barClassName="bg-purple-400"
            />
          ))}
        </BreakdownPanel>

        <BreakdownPanel
          icon={<Users size={14} className="text-pink-500" />}
          title="Gender"
          note="Enable Google Signals in GA4 to see this data"
        >
          {genders.length === 0 && <EmptyNote />}
          {genders.map((g, i) => (
            <BarRow
              key={i}
              label={g.gender}
              value={g.users}
              max={maxGenderUsers}
              suffix={`${g.users} users`}
              barClassName="bg-pink-400"
            />
          ))}
        </BreakdownPanel>

        <BreakdownPanel
          icon={<FileText size={14} className="text-orange-500" />}
          title="Top Pages"
        >
          {topPages.length === 0 && <EmptyNote />}
          {topPages.map((p, i) => (
            <BarRow
              key={i}
              label={p.path}
              value={p.views}
              max={maxPageViews}
              suffix={`${p.views} views · ${p.users} users`}
              barClassName="bg-orange-400"
            />
          ))}
        </BreakdownPanel>

        <BreakdownPanel
          icon={<Zap size={14} className="text-amber-500" />}
          title={`Key Events (${stats.totalKeyEvents.toLocaleString()} total)`}
        >
          {keyEventsBreakdown.length === 0 && <EmptyNote />}
          {keyEventsBreakdown.map((e, i) => (
            <BarRow
              key={i}
              label={e.eventName}
              value={e.count}
              max={maxEventCount}
              suffix={`${e.count} events`}
              barClassName="bg-amber-400"
            />
          ))}
        </BreakdownPanel>

        <BreakdownPanel
          icon={<Zap size={14} className="text-cyan-500" />}
          title="Key Events (excl. direct/none)"
          note="Eliminate traffic with unknown sources (direct URL, bookmarks...)"
        >
          {keyEventsBreakdownExcludeDirect.length === 0 && <EmptyNote />}
          {keyEventsBreakdownExcludeDirect.map((e, i) => (
            <BarRow
              key={i}
              label={e.eventName}
              value={e.count}
              max={maxEventCountExcludeDirect}
              suffix={`${e.count} events`}
              barClassName="bg-cyan-400"
            />
          ))}
        </BreakdownPanel>

      </div>

      <p className="mt-4 text-right text-xs text-slate-400">
        Data range: last {stats.days ?? days} days · Last updated: {fmtLastUpdated(stats.lastUpdated)}
      </p>
    </div>
  );
}

// ─── GA4 Helper Components ────────────────────────────────────────────────────

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-signal-track px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

function BreakdownPanel({
  icon,
  title,
  note,
  className = '',
  children,
}: {
  icon: React.ReactNode;
  title: string;
  note?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl bg-white border border-slate-100 p-4 ${className}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{title}</p>
      </div>
      {note && <p className="text-[11px] text-slate-400 mb-2">{note}</p>}
      <div className="space-y-2 mt-2">{children}</div>
    </div>
  );
}

function BarRow({
  label,
  value,
  max,
  suffix,
  barClassName = 'bg-blue-400',
}: {
  label: string;
  value: number;
  max: number;
  suffix: string;
  barClassName?: string;
}) {
  const pct = Math.max(2, Math.round((value / max) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
        <span className="truncate max-w-[65%]" title={label}>{label}</span>
        <span className="text-slate-400 whitespace-nowrap">{suffix}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${barClassName}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function EmptyNote() {
  return <p className="text-xs text-slate-400 italic">No data</p>;
}

// ─── Growth Chart Types ─────────────────────────────────────────────────────

interface ChartPoint {
  date: string;
  views: number;
  posts: number;
  followers?: number;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-100 bg-white/95 backdrop-blur shadow-xl px-4 py-3 min-w-[140px]">
      <p className="text-xs text-slate-400 mb-2 font-medium">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-base font-bold tabular-nums" style={{ color: p.stroke }}>
          {fmtNum(p.value)}
          <span className="text-xs font-normal text-slate-400 ml-1">{p.name}</span>
        </p>
      ))}
    </div>
  );
}

function ChartPanel({
  title, data, dataKey, color, days,
}: {
  title: string;
  data: ChartPoint[];
  dataKey: keyof ChartPoint;
  color: string;
  days: number;
}) {
  const gradId = useId();

  const chartData = data.length === 1
    ? [{ ...data[0], date: '—' }, ...data.map((d) => ({ ...d, date: fmtDate(d.date) }))]
    : data.map((d) => ({ ...d, date: fmtDate(d.date) }));

  const delta = getDelta(data, dataKey);
  const isUp  = delta !== null && delta > 0;
  const isDown = delta !== null && delta < 0;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
      <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100 bg-slate-50/60">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{title}</span>
        <span className="text-xs text-slate-400 font-mono">{days} days</span>
      </div>

      <div className="px-5 pt-4 pb-1 flex items-end gap-3">
        <span className="text-3xl font-bold text-slate-800 tabular-nums">
          {fmtNum((data[data.length - 1]?.[dataKey] as number) ?? 0)}
        </span>
        {delta !== null && (
          <span
            className={`mb-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
              isUp   ? 'bg-emerald-100 text-emerald-600' :
              isDown ? 'bg-rose-100 text-rose-600' :
                       'bg-slate-100 text-slate-500'
            }`}
          >
            {isUp ? '↑' : isDown ? '↓' : '→'} {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
          </span>
        )}
        {delta === null && (
          <span className="mb-1 text-xs text-slate-400">vs period start</span>
        )}
      </div>

      <div className="px-2 pb-3">
        {data.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-sm text-slate-400">
            No historical data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} strokeOpacity={0.6} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={fmtNum}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey={dataKey as string}
                name={title}
                stroke={color}
                strokeWidth={2.5}
                fill={`url(#${gradId})`}
                dot={false}
                activeDot={{ r: 5, fill: color, stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ─── Growth Chart Component ───────────────────────────────────────────────────

export function GrowthChart() {
  const [platforms, setPlatforms]   = useState<Platform[]>([]);
  const [selectedId, setSelectedId] = useState<string>('all');
  const [days, setDays]             = useState(30);
  const [data, setData]             = useState<ChartPoint[]>([]);
  const [loading, setLoading]       = useState(false);

  useEffect(() => {
    fetch(`${HISTORY_API}/platforms`)
      .then((r) => r.json())
      .then(setPlatforms)
      .catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ days: String(days) });
    if (selectedId !== 'all') params.set('taskId', selectedId);

    fetch(`${HISTORY_API}?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedId, days]);

  const selectedPlatform = platforms.find((p) => p.taskId === selectedId);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Daily Growth</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {selectedId === 'all'
              ? 'Aggregated summary of all platforms'
              : `${selectedPlatform?.platformName} · @${selectedPlatform?.accountHandle}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="h-9 pl-3 pr-8 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200 appearance-none"
          >
            <option value="all">All profiles</option>
            {platforms.map((p) => (
              <option key={p.taskId} value={p.taskId}>
                {p.platformName} · @{p.accountHandle}
              </option>
            ))}
          </select>

          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
            {RANGES.map(({ label, days: d }) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 h-9 font-medium transition-colors ${
                  days === d
                    ? 'bg-slate-800 text-white'
                    : 'bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
          <svg className="animate-spin w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Loading...
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartPanel title="Views over time"     data={data} dataKey="views"     color="#10b981" days={days} />
        <ChartPanel title="Posts over time"     data={data} dataKey="posts"     color="#10b981" days={days} />
        <ChartPanel title="Followers over time" data={data} dataKey="followers" color="#6366f1" days={days} />
      </div>
      )}
    </section>
  );
}

// ─── Need to define Platform interface for GrowthChart ─────────────────────
interface Platform {
  taskId: string;
  platformName: string;
  accountHandle: string;
}