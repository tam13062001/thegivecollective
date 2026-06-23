import { useState, useEffect, useId } from 'react';
import {
  AreaChart, Area,
  XAxis, YAxis,
  CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChartPoint {
  date: string;
  views: number;
  posts: number;
  followers?: number;
}

interface Platform {
  taskId: string;
  platformName: string;
  accountHandle: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API = 'https://thegivecollective-backend.vercel.app/api/v1/history';

const RANGES = [
  { label: '7D',  days: 7  },
  { label: '14D', days: 14 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Tooltip ──────────────────────────────────────────────────────────────────

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

// ─── Single Area Chart Panel ───────────────────────────────────────────────────

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

  // Nếu chỉ có 1 điểm, thêm điểm ghost ở đầu để recharts vẽ được đường
  const chartData = data.length === 1
    ? [{ ...data[0], date: '—' }, ...data.map((d) => ({ ...d, date: fmtDate(d.date) }))]
    : data.map((d) => ({ ...d, date: fmtDate(d.date) }));

  const delta = getDelta(data, dataKey);
  const isUp  = delta !== null && delta > 0;
  const isDown = delta !== null && delta < 0;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100 bg-slate-50/60">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{title}</span>
        <span className="text-xs text-slate-400 font-mono">{days} days</span>
      </div>

      {/* Latest value + delta */}
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

      {/* Chart */}
      <div className="px-2 pb-3">
        {data.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-sm text-slate-400">
            Chưa có dữ liệu lịch sử
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

// ─── Main GrowthChart ─────────────────────────────────────────────────────────

export function GrowthChart() {
  const [platforms, setPlatforms]   = useState<Platform[]>([]);
  const [selectedId, setSelectedId] = useState<string>('all');
  const [days, setDays]             = useState(30);
  const [data, setData]             = useState<ChartPoint[]>([]);
  const [loading, setLoading]       = useState(false);

  // Load danh sách platform có lịch sử
  useEffect(() => {
    fetch(`${API}/platforms`)
      .then((r) => r.json())
      .then(setPlatforms)
      .catch(console.error);
  }, []);

  // Load chart data mỗi khi đổi filter
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ days: String(days) });
    if (selectedId !== 'all') params.set('taskId', selectedId);

    fetch(`${API}?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedId, days]);

  const selectedPlatform = platforms.find((p) => p.taskId === selectedId);

  return (
    <section className="space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Daily Growth</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {selectedId === 'all'
              ? 'Tổng hợp tất cả nền tảng'
              : `${selectedPlatform?.platformName} · @${selectedPlatform?.accountHandle}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Platform dropdown */}
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

          {/* Range pills */}
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

      {/* Charts */}
      {loading ? (
        <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
          <svg className="animate-spin w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Đang tải...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartPanel
            title="Views over time"
            data={data}
            dataKey="views"
            color="#10b981"
            days={days}
          />
          <ChartPanel
            title="Posts over time"
            data={data}
            dataKey="posts"
            color="#10b981"
            days={days}
          />
        </div>
      )}

    </section>
  );
}