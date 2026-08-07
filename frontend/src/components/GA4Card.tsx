import { useState, useEffect } from 'react';
import {
  Eye, Users, UserPlus, BarChart3, TrendingUp, Clock, RefreshCw, Pencil,
  Target, Handshake, ShoppingCart, Globe, FileText, AlertTriangle,
} from 'lucide-react';

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
  totalKeyEvents: number;
  qualifyLeads: number;
  closeConvertLeads: number;
  purchases: number;
  trafficSources: TrafficSource[];
  countries: CountryStat[];
  ageBrackets: AgeBracket[];
  genders: GenderStat[];
  topPages: TopPage[];
  lastUpdated: string;
}

const GA4_API_URL = 'https://thegivecollective-backend.vercel.app/api/v1/ga4-secondary';

function fmtDuration(seconds: number): string {
  return `${Math.round(seconds)}s`;
}

function fmtLastUpdated(value: string | undefined | null): string {
  if (!value) return 'Chưa có dữ liệu';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa có dữ liệu';
  return date.toISOString();
}

export function GA4Card() {
  const [stats, setStats] = useState<GA4Stats | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [websiteDraft, setWebsiteDraft] = useState('');

  const fetchStats = async () => {
    try {
      const res = await fetch(GA4_API_URL);
      const data = await res.json();

      if (!res.ok) {
        // API trả lỗi (403 Forbidden, 500...) — data lúc này KHÔNG phải shape GA4Stats,
        // không được setStats(data) vì sẽ crash render bên dưới (thiếu field số).
        setLoadError(data?.message || `Lỗi ${res.status} khi tải GA4 stats`);
        setStats(null);
        return;
      }

      setLoadError(null);
      setStats(data);
      setWebsiteDraft(data.websiteUrl ?? '');
    } catch (error) {
      console.error('Error fetching GA4 stats:', error);
      setLoadError('Lỗi kết nối server');
      setStats(null);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`${GA4_API_URL}/refresh`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setLoadError(null);
        setStats(data);
      } else {
        alert(data.message || 'Không thể refresh GA4 stats');
      }
    } catch {
      alert('Lỗi kết nối server');
    } finally {
      setIsRefreshing(false);
    }
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
        alert(data.message || 'Không thể cập nhật website');
      }
    } catch {
      alert('Lỗi kết nối server');
    }
  };

  // Trạng thái lỗi — hiện thông báo rõ ràng thay vì crash hoặc trắng trang
  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50/60 p-6 flex items-center gap-3">
        <AlertTriangle size={18} className="text-red-500 shrink-0" />
        <div>
          <p className="text-sm font-medium text-red-700">Không tải được GA4 stats</p>
          <p className="text-xs text-red-500 mt-0.5">{loadError}</p>
        </div>
        <button
          onClick={fetchStats}
          className="ml-auto text-xs font-medium text-red-600 hover:text-red-700 underline"
        >
          Thử lại
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

  const maxSourceSessions = Math.max(1, ...trafficSources.map((t) => t.sessions));
  const maxCountryUsers = Math.max(1, ...countries.map((c) => c.users));
  const maxAgeUsers = Math.max(1, ...ageBrackets.map((a) => a.users));
  const maxGenderUsers = Math.max(1, ...genders.map((g) => g.users));
  const maxPageViews = Math.max(1, ...topPages.map((p) => p.views));

  return (
    <div className="relative rounded-2xl border border-slate-100 bg-slate-50/60 p-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-sm text-slate-500">Website</p>
          {isEditing ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={websiteDraft}
                onChange={(e) => setWebsiteDraft(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm w-72 focus:outline-none focus:ring-1 focus:ring-blue-300"
                autoFocus
              />
              <button onClick={handleSaveWebsite} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                Lưu
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setWebsiteDraft(stats.websiteUrl);
                }}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Hủy
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <a
                href={stats.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="text-lg font-semibold text-blue-600 hover:underline"
              >
                {stats.websiteUrl || 'Chưa thiết lập website'}
              </a>
              <button onClick={() => setIsEditing(true)} title="Sửa" className="text-slate-400 hover:text-slate-600">
                <Pencil size={14} />
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-300 transition-colors"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          {isRefreshing ? 'Đang cập nhật...' : 'Refresh GA4 Stats'}
        </button>
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
          note="Cần bật Google Signals trong GA4 để có data"
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
          note="Cần bật Google Signals trong GA4 để có data"
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
          className="lg:col-span-2"
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
      </div>

      <p className="mt-4 text-right text-xs text-slate-400">
        Last updated: {fmtLastUpdated(stats.lastUpdated)}
      </p>
    </div>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-200/60 px-4 py-3">
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
  return <p className="text-xs text-slate-400 italic">Chưa có dữ liệu</p>;
}