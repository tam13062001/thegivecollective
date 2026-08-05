import { useState, useEffect } from 'react';
import { Eye, Users, BarChart3, TrendingUp, Clock, RefreshCw, Pencil, Target, Handshake, ShoppingCart } from 'lucide-react';

interface GA4Stats {
  _id?: string;
  websiteUrl: string;
  pageviews: number;
  users: number;
  sessions: number;
  bounceRate: number;
  avgDuration: number;
  engagementRate: number;
  totalKeyEvents: number;
  qualifyLeads: number;
  closeConvertLeads: number;
  purchases: number;
  lastUpdated: string;
}

const GA4_API_URL = 'http://localhost:5001/api/v1/ga4';

function fmtDuration(seconds: number): string {
  return `${Math.round(seconds)}s`;
}

export function GA4Card() {
  const [stats, setStats] = useState<GA4Stats | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [websiteDraft, setWebsiteDraft] = useState('');

  const fetchStats = async () => {
    try {
      const res = await fetch(GA4_API_URL);
      const data = await res.json();
      setStats(data);
      setWebsiteDraft(data.websiteUrl ?? '');
    } catch (error) {
      console.error('Error fetching GA4 stats:', error);
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
      if (res.ok) setStats(data);
      else alert(data.message || 'Không thể refresh GA4 stats');
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

  if (!stats) return null;

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

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
        <StatBox icon={<Eye size={16} className="text-blue-500" />} label="Pageviews" value={stats.pageviews.toLocaleString()} />
        <StatBox icon={<Users size={16} className="text-emerald-500" />} label="Users" value={stats.users.toLocaleString()} />
        <StatBox icon={<BarChart3 size={16} className="text-purple-500" />} label="Sessions" value={stats.sessions.toLocaleString()} />
        <StatBox icon={<TrendingUp size={16} className="text-orange-500" />} label="Bounce Rate" value={`${stats.bounceRate}%`} />
        <StatBox icon={<TrendingUp size={16} className="text-teal-500" />} label="Engagement Rate" value={`${stats.engagementRate}%`} />
        <StatBox icon={<Clock size={16} className="text-pink-500" />} label="Avg Duration" value={fmtDuration(stats.avgDuration)} />
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Key Events (30 ngày)</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatBox icon={<Target size={16} className="text-indigo-500" />} label="Tổng Key Events" value={stats.totalKeyEvents.toLocaleString()} />
          <StatBox icon={<Target size={16} className="text-cyan-500" />} label="Qualify Lead" value={stats.qualifyLeads.toLocaleString()} />
          <StatBox icon={<Handshake size={16} className="text-lime-500" />} label="Close/Convert Lead" value={stats.closeConvertLeads.toLocaleString()} />
          <StatBox icon={<ShoppingCart size={16} className="text-amber-500" />} label="Purchase" value={stats.purchases.toLocaleString()} />
        </div>
      </div>

      <p className="mt-4 text-right text-xs text-slate-400">
        Last updated: {new Date(stats.lastUpdated).toISOString()}
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