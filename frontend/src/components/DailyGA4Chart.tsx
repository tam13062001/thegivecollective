import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Calendar, BarChart3 } from 'lucide-react';

const API_URL = 'https://thegivecollective-backend.vercel.app/api/v1/ga4-secondary/history';

const RANGES = [
  { label: '7D', days: 7 },
  { label: '14D', days: 14 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
];

const METRICS = [
  { key: 'pageviews', label: 'Pageviews', color: '#3b82f6' },
  { key: 'users', label: 'Users', color: '#10b981' },
  { key: 'newUsers', label: 'New Users', color: '#8b5cf6' },
  { key: 'sessions', label: 'Sessions', color: '#f59e0b' },
  { key: 'totalKeyEvents', label: 'Total Events', color: '#ef4444' },
  { key: 'engagementRate', label: 'Engagement Rate (%)', color: '#06b6d4' },
  { key: 'bounceRate', label: 'Bounce Rate (%)', color: '#f97316' },
];

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtDate(dateString: string) {
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

export function DailyGA4Chart() {
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [metricKey, setMetricKey] = useState<string>('pageviews');

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}?days=${days}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setHistoryData(data);
        else setHistoryData([]);
      })
      .catch((err) => {
        console.error('Failed to fetch GA4 history:', err);
        setError('Failed to load chart data');
      })
      .finally(() => setLoading(false));
  }, [days]);

  // Tính toán các chỉ số tổng quan
  const values = historyData.map(d => d[metricKey] || 0);
  const total = values.reduce((a, b) => a + b, 0);
  const avg = values.length ? total / values.length : 0;
  const max = values.length ? Math.max(...values) : 0;
  const min = values.length ? Math.min(...values) : 0;

  const firstRecord = historyData[0];
  const lastRecord = historyData[historyData.length - 1];
  const startValue = firstRecord ? (firstRecord[metricKey] || 0) : 0;
  const endValue = lastRecord ? (lastRecord[metricKey] || 0) : 0;
  let delta = 0;
  if (startValue > 0) delta = ((endValue - startValue) / startValue) * 100;
  else if (startValue === 0 && endValue > 0) delta = 100;
  const isPositive = delta >= 0;
  const deltaColor = isPositive ? 'text-emerald-600' : 'text-rose-600';

  const metricInfo = METRICS.find(m => m.key === metricKey);
  const chartColor = metricInfo?.color || '#3b82f6';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-signal-panel to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 size={20} className="text-blue-500" />
            <h3 className="text-lg font-bold text-slate-800">Daily Website Metrics</h3>
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {days} days
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={metricKey}
              onChange={(e) => setMetricKey(e.target.value)}
              className="h-8 pl-3 pr-7 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {METRICS.map(m => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
              {RANGES.map(({ label, days: d }) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 h-8 font-medium transition-colors ${
                    days === d
                      ? 'bg-signal-cyan text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {/* {!loading && !error && historyData.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-100">
          <StatBox label="Total" value={fmtNum(total)} />
          <StatBox label="Average" value={fmtNum(avg)} />
          <StatBox label="Highest" value={fmtNum(max)} />
          <StatBox label="Lowest" value={fmtNum(min)} />
        </div>
      )} */}

      {/* Chart Area */}
      <div className="p-4">
        {loading ? (
          <div className="h-72 flex items-center justify-center text-slate-400 bg-signal-track rounded-xl border border-slate-100 animate-pulse">
            Loading chart data...
          </div>
        ) : error ? (
          <div className="h-72 flex flex-col items-center justify-center text-rose-500 bg-signal-panel rounded-xl border border-signal-border">
            <span>{error}</span>
            <button onClick={() => setDays(days)} className="mt-2 text-sm underline hover:text-rose-700">
              Retry
            </button>
          </div>
        ) : historyData.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
            No historical data available for this period.
          </div>
        ) : (
          <>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={fmtDate}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={20}
                  />
                  <YAxis
                    tickFormatter={fmtNum}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                    width={50}
                  />
                  <Tooltip
                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const val = payload[0].value as number;
                      const labelStr = typeof label === 'string' ? label : String(label ?? '');
                      return (
                        <div className="rounded-lg border border-slate-100 bg-white shadow-lg p-3 min-w-[140px]">
                          <p className="text-xs font-medium text-slate-400 mb-1">{fmtDate(labelStr)}</p>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sm text-slate-600">{metricInfo?.label || metricKey}</span>
                            <span className="text-sm font-bold" style={{ color: chartColor }}>
                              {fmtNum(val)}
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey={metricKey}
                    stroke={chartColor}
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorMetric)"
                    activeDot={{ r: 6, fill: chartColor, stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Delta */}
            <div className="mt-4 flex items-center justify-between bg-signal-track rounded-xl px-4 py-3 border border-slate-100">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Calendar size={16} />
                <span>
                  {fmtDate(firstRecord?.date)} → {fmtDate(lastRecord?.date)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-slate-500">Change:</span>
                <span className={`text-lg font-bold ${deltaColor} flex items-center gap-1`}>
                  {isPositive ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                  {Math.abs(delta).toFixed(1)}%
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Component phụ: Stat Box
function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-3 text-center">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-slate-800 mt-0.5">{value}</p>
    </div>
  );
}