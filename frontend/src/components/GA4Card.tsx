import React, { useState, useEffect } from 'react';
import {
  Eye, Users, UserPlus, BarChart3, TrendingUp, Clock, RefreshCw, Pencil,
  Globe, FileText, AlertTriangle, Activity, MousePointerClick
} from 'lucide-react';
// import { GA4Stats } from '../types'; // Đảm bảo bạn đã import đúng đường dẫn
// import { GA4_API_URL, fmtDuration, fmtLastUpdated } from '../utils';

// ─── Component GA4Card ───────────────────────────────────────────────────────

export function GA4Card() {
  const [stats, setStats] = useState<any | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [websiteDraft, setWebsiteDraft] = useState('');
  
  // NOTE: Đã bỏ state `days` ở đây vì Backend chỉ trả về data của 30 ngày gần nhất.

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      // Đã bỏ ?days=... vì BE không dùng params này cho route GET
      const res = await fetch('https://thegivecollective-backend.vercel.app/api/v1/ga4-secondary');
      const data = await res.json();

      if (!res.ok) {
        setLoadError(data?.message || `Error ${res.status} loading GA4 stats`);
        setStats(null);
      } else {
        setLoadError(null);
        setStats(data);
        setWebsiteDraft(data.websiteUrl ?? '');
      }
    } catch (error) {
      console.error('Error fetching GA4 stats:', error);
      setLoadError('Server connection error');
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Đã bỏ ?days=... 
      const res = await fetch('https://thegivecollective-backend.vercel.app/api/v1/ga4-secondary/refresh', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setLoadError(null);
        setStats(data);
      } else {
        alert(data.message || 'Failed to refresh GA4 stats');
      }
    } catch {
      alert('Server connection error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSaveWebsite = async () => {
    try {
      const res = await fetch('https://thegivecollective-backend.vercel.app/api/v1/ga4-secondary/website', {
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

  // Hàm format hiển thị số (ví dụ: 1200 -> 1.2K)
  const fmtNum = (n: number) => n.toLocaleString();
  const maxEvents = stats ? Math.max(1, stats.totalKeyEvents) : 1;

  return (
    <div className="relative rounded-2xl border border-slate-100 bg-slate-50/60 p-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Website Analytics (GA4)</h2>
            {/* Hiển thị rõ Time Range cho người dùng biết (Dựa theo Backend) */}
            <span className="px-2.5 py-1 rounded-md bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200">
              Last 30 Days
            </span>
          </div>
          
          {isEditing ? (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={websiteDraft}
                onChange={(e) => setWebsiteDraft(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm w-72 focus:outline-none focus:ring-1 focus:ring-blue-300"
                autoFocus
              />
              <button onClick={handleSaveWebsite} className="text-xs font-medium text-blue-600 hover:text-blue-700">Save</button>
              <button onClick={() => { setIsEditing(false); setWebsiteDraft(stats?.websiteUrl || ''); }} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-2">
              <a href={stats?.websiteUrl || '#'} target="_blank" rel="noreferrer" className="text-lg font-semibold text-blue-600 hover:underline">
                {stats?.websiteUrl || 'Website not set'}
              </a>
              <button onClick={() => setIsEditing(true)} title="Edit" className="text-slate-400 hover:text-slate-600">
                <Pencil size={14} />
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-300 transition-colors"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          {isRefreshing ? 'Updating...' : 'Refresh GA4 Stats'}
        </button>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center text-slate-500 bg-white rounded-xl border border-slate-100">
          Loading GA4 data...
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-red-100 bg-red-50/60 p-6 flex flex-col items-center justify-center gap-3 h-64">
          <AlertTriangle size={32} className="text-red-400" />
          <div className="text-center">
            <p className="text-sm font-medium text-red-700">Failed to load GA4 stats</p>
            <p className="text-xs text-red-500 mt-1">{loadError}</p>
          </div>
          <button onClick={fetchStats} className="mt-2 text-sm font-medium text-red-600 hover:text-red-700 underline">Try again</button>
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
            <StatBox icon={<Eye size={16} className="text-blue-500" />} label="Pageviews" value={fmtNum(stats.pageviews)} />
            <StatBox icon={<Users size={16} className="text-emerald-500" />} label="Users" value={fmtNum(stats.users)} />
            <StatBox icon={<UserPlus size={16} className="text-green-500" />} label="New Users" value={fmtNum(stats.newUsers)} />
            <StatBox icon={<BarChart3 size={16} className="text-purple-500" />} label="Sessions" value={fmtNum(stats.sessions)} />
            <StatBox icon={<TrendingUp size={16} className="text-orange-500" />} label="Bounce Rate" value={`${stats.bounceRate}%`} />
            <StatBox icon={<TrendingUp size={16} className="text-teal-500" />} label="Engage Rate" value={`${stats.engagementRate}%`} />
            <StatBox icon={<Clock size={16} className="text-pink-500" />} label="Avg Duration" value={`${Math.round(stats.avgDuration)}s`} />
            <StatBox icon={<MousePointerClick size={16} className="text-yellow-500" />} label="Events" value={fmtNum(stats.totalKeyEvents)} />
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BreakdownPanel icon={<Globe size={14} className="text-blue-500" />} title="Traffic Source / Medium">
              {(!stats.trafficSources || stats.trafficSources.length === 0) && <EmptyNote />}
              {stats.trafficSources?.map((t: any, i: number) => (
                <BarRow key={i} label={`${t.source} / ${t.medium}`} value={t.sessions} max={Math.max(1, ...stats.trafficSources.map((x: any) => x.sessions))} suffix={`${t.sessions} sessions`} />
              ))}
            </BreakdownPanel>

            <BreakdownPanel icon={<Globe size={14} className="text-emerald-500" />} title="Countries">
              {(!stats.countries || stats.countries.length === 0) && <EmptyNote />}
              {stats.countries?.map((c: any, i: number) => (
                <BarRow key={i} label={c.country} value={c.users} max={Math.max(1, ...stats.countries.map((x: any) => x.users))} suffix={`${c.users} users`} barClassName="bg-emerald-400" />
              ))}
            </BreakdownPanel>

            <BreakdownPanel icon={<Users size={14} className="text-purple-500" />} title="Age" note="Enable Google Signals in GA4 to see this data">
              {(!stats.ageBrackets || stats.ageBrackets.length === 0) && <EmptyNote />}
              {stats.ageBrackets?.map((a: any, i: number) => (
                <BarRow key={i} label={a.age} value={a.users} max={Math.max(1, ...stats.ageBrackets.map((x: any) => x.users))} suffix={`${a.users} users`} barClassName="bg-purple-400" />
              ))}
            </BreakdownPanel>

            <BreakdownPanel icon={<Users size={14} className="text-pink-500" />} title="Gender" note="Enable Google Signals in GA4 to see this data">
              {(!stats.genders || stats.genders.length === 0) && <EmptyNote />}
              {stats.genders?.map((g: any, i: number) => (
                <BarRow key={i} label={g.gender} value={g.users} max={Math.max(1, ...stats.genders.map((x: any) => x.users))} suffix={`${g.users} users`} barClassName="bg-pink-400" />
              ))}
            </BreakdownPanel>

            {/* BẢNG EVENTS VỪA THÊM THEO YÊU CẦU */}
            <BreakdownPanel icon={<MousePointerClick size={14} className="text-yellow-500" />} title="Key Events Breakdown">
              <BarRow label="Total Key Events" value={stats.totalKeyEvents} max={maxEvents} suffix={fmtNum(stats.totalKeyEvents)} barClassName="bg-yellow-400" />
              <BarRow label="Qualify Leads (qualify_lead)" value={stats.qualifyLeads} max={maxEvents} suffix={fmtNum(stats.qualifyLeads)} barClassName="bg-yellow-400" />
              <BarRow label="Close Convert Leads (close_convert_lead)" value={stats.closeConvertLeads} max={maxEvents} suffix={fmtNum(stats.closeConvertLeads)} barClassName="bg-yellow-400" />
              <BarRow label="Purchases (purchase)" value={stats.purchases} max={maxEvents} suffix={fmtNum(stats.purchases)} barClassName="bg-yellow-400" />
            </BreakdownPanel>

            <BreakdownPanel icon={<FileText size={14} className="text-orange-500" />} title="Top Pages">
              {(!stats.topPages || stats.topPages.length === 0) && <EmptyNote />}
              {stats.topPages?.map((p: any, i: number) => (
                <BarRow key={i} label={p.path} value={p.views} max={Math.max(1, ...stats.topPages.map((x: any) => x.views))} suffix={`${p.views} views · ${p.users} users`} barClassName="bg-orange-400" />
              ))}
            </BreakdownPanel>
          </div>

          <p className="mt-4 text-right text-xs text-slate-400">
            Last updated: {stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : 'No data'}
          </p>
        </>
      ) : null}
    </div>
  );
}

// Sub-components nội bộ của GA4Card
function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 px-4 py-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5 whitespace-nowrap">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

function BreakdownPanel({ icon, title, note, className = '', children }: any) {
  return (
    <div className={`rounded-xl bg-white border border-slate-200 p-5 shadow-sm ${className}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{title}</p>
      </div>
      {note && <p className="text-[11px] text-slate-400 mb-3">{note}</p>}
      <div className="space-y-3 mt-4">{children}</div>
    </div>
  );
}

function BarRow({ label, value, max, suffix, barClassName = 'bg-blue-400' }: any) {
  const pct = Math.max(2, Math.round((value / max) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-medium text-slate-700 mb-1.5">
        <span className="truncate max-w-[65%]" title={label}>{label}</span>
        <span className="text-slate-500 whitespace-nowrap">{suffix}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${barClassName}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function EmptyNote() {
  return <p className="text-sm text-slate-400 italic py-2">No data recorded</p>;
}