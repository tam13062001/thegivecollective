// src/pages/Homepage.tsx
// Themed with the same 'signal-atlas' design language as InsightsPage.
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GrowthChart } from "../components/GrowthChart";
import { GA4Card } from "../components/GA4Card";
import { DailyGA4Chart } from "../components/DailyGA4Chart";
import { ChartTooltip } from "../components/common/ChartTooltip";
import { InlineDataState } from "../components/common/InlineDataState";
import { StatCard } from "../components/common/StatCard";
import { HomeTabs } from "../components/home/HomeTabs";
import { PlatformCard } from "../components/home/PlatformCard";
import { ProfileLinkTapsChart } from "../components/home/ProfileLinkTapsChart";
import { SIGNAL_CHART } from "../constants/insights";
import { usePlatformMetrics } from "../hooks/home/usePlatformMetrics";
import { fmtNum } from "../utils/insights";
import type { HomeTabKey } from "../types/home";

const HOME_TABS: { key: HomeTabKey; label: string }[] = [
  { key: "social", label: "Social Media Growth" },
  { key: "ga4", label: "Website Analytics (GA4)" },
  { key: "daily", label: "Daily GA4 Trend" },
  { key: "linkTaps", label: "IG Profile Link Taps" },
];

export default function Homepage() {
  const {
    metrics,
    loading,
    error,
    urlInput,
    setUrlInput,
    isSubmitting,
    addMetric,
    deleteMetric,
  } = usePlatformMetrics();

  const [activeTab, setActiveTab] = useState<HomeTabKey>("social");

  const totalFollowers = useMemo(
    () => metrics.reduce((s, m) => s + (m.followersCount || 0), 0),
    [metrics],
  );
  const totalPosts = useMemo(
    () => metrics.reduce((s, m) => s + (m.postsCount || 0), 0),
    [metrics],
  );
  const totalViews = useMemo(
    () => metrics.reduce((s, m) => s + (m.viewsCount || 0), 0),
    [metrics],
  );

  const viewsChartData = useMemo(
    () =>
      metrics.map((m) => ({
        name: m.platformName,
        views: m.viewsCount || 0,
        posts: m.postsCount || 0,
      })),
    [metrics],
  );

  // GoogleAnalytics is a tracked task, not a "social platform" — exclude it
  // from the connected-platforms count and grid, same as before.
  const connectedPlatforms = useMemo(
    () => metrics.filter((m) => m.platformName !== "GoogleAnalytics"),
    [metrics],
  );

  return (
    <div className="signal-atlas mt-16 min-h-screen bg-signal-ink pb-16 font-signal-body text-signal-text">
      <div className="mx-auto max-w-[1640px] space-y-14 px-4 py-10 sm:space-y-20 sm:px-8 sm:py-14">
        {/* Header */}
        <header className="border-b border-signal-border pb-10 sm:pb-14">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-5 flex items-center gap-3 font-signal-mono text-[10px] uppercase tracking-[0.18em] text-signal-muted sm:text-[11px]">
                <span className="h-0.5 w-8 bg-signal-cyan" aria-hidden="true" />
                Growth at a glance
              </div>
              <h1 className="max-w-3xl font-signal-display text-4xl font-semibold leading-[0.95] tracking-[-0.04em] text-signal-text sm:text-6xl">
                Overview &amp; <span className="text-signal-coral">growth</span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-signal-muted sm:text-lg">
                Track every connected platform, website analytics and
                Instagram link taps in one place.
              </p>
            </div>
            <div className="border-l-2 border-signal-coral pl-4 font-signal-mono text-[10px] uppercase tracking-[0.12em] text-signal-muted sm:max-w-sm">
              <span className="text-signal-text">Connected platforms</span>
              <span className="mx-2 text-signal-slate">•</span>
              {loading ? "Loading..." : `${connectedPlatforms.length} tracked`}
            </div>
          </div>
        </header>

        {/* ── SECTION: Tabs navigation & content ── */}
        <section id="growth-charts" className="space-y-5 sm:space-y-6">
          <HomeTabs tabs={HOME_TABS} active={activeTab} onChange={setActiveTab} />
          <div>
            {activeTab === "social" && <GrowthChart />}
            {activeTab === "ga4" && <GA4Card />}
            {activeTab === "daily" && <DailyGA4Chart />}
            {activeTab === "linkTaps" && <ProfileLinkTapsChart />}
          </div>
        </section>

        <div className="border-t border-signal-border" aria-hidden="true" />

        {/* ── SECTION: Overview stats + charts ── */}
        <section
          id="growth-overview"
          aria-labelledby="growth-overview-heading"
          className="space-y-6 sm:space-y-8"
        >
          <div>
            <h2
              id="growth-overview-heading"
              className="font-signal-display text-2xl font-semibold text-signal-text sm:text-3xl"
            >
              Growth overview
            </h2>
            <p className="mt-1 text-sm text-signal-muted">
              Aggregated totals across all connected platforms.
            </p>
          </div>

          <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-signal-border sm:grid-cols-3 sm:divide-x sm:divide-signal-border">
            <StatCard
              label="Total views"
              value={loading && metrics.length === 0 ? "—" : fmtNum(totalViews)}
              sub={`Total from ${metrics.length} platform${metrics.length === 1 ? "" : "s"}`}
              tone="up"
            />
            <StatCard
              label="Total posts"
              value={loading && metrics.length === 0 ? "—" : fmtNum(totalPosts)}
              sub={`Total from ${metrics.length} platform${metrics.length === 1 ? "" : "s"}`}
              tone="none"
            />
            <StatCard
              label="Total followers"
              value={loading && metrics.length === 0 ? "—" : fmtNum(totalFollowers)}
              sub={`Total from ${metrics.length} platform${metrics.length === 1 ? "" : "s"}`}
              tone="none"
            />
          </div>

          {error && metrics.length === 0 && (
            <InlineDataState
              tone="error"
              title="Couldn’t load platform metrics."
              description="Charts and totals will update once the source is available."
              actionLabel="Try again"
              onAction={() => window.location.reload()}
            />
          )}

          {metrics.length > 0 && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="signal-panel overflow-hidden rounded-2xl border border-signal-border">
                <div className="flex items-center justify-between border-b border-signal-border px-4 py-3 sm:px-5">
                  <span className="font-signal-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-signal-cyan sm:text-[11px]">
                    Views per platform
                  </span>
                  <span className="font-signal-mono text-[10px] text-signal-muted sm:text-xs">
                    {metrics.length} platforms
                  </span>
                </div>
                <div className="p-4">
                  <ResponsiveContainer width="100%" height={190}>
                    <BarChart data={viewsChartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={SIGNAL_CHART.border} vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10, fill: SIGNAL_CHART.muted }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tickFormatter={fmtNum}
                        tick={{ fontSize: 10, fill: SIGNAL_CHART.muted }}
                        tickLine={false}
                        axisLine={false}
                        width={44}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: SIGNAL_CHART.track }} />
                      <Bar dataKey="views" name="Views" radius={[6, 6, 0, 0]} fill={SIGNAL_CHART.cyan} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="signal-panel overflow-hidden rounded-2xl border border-signal-border">
                <div className="flex items-center justify-between border-b border-signal-border px-4 py-3 sm:px-5">
                  <span className="font-signal-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-signal-coral sm:text-[11px]">
                    Posts per platform
                  </span>
                  <span className="font-signal-mono text-[10px] text-signal-muted sm:text-xs">
                    {metrics.length} platforms
                  </span>
                </div>
                <div className="p-4">
                  <ResponsiveContainer width="100%" height={190}>
                    <BarChart data={viewsChartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={SIGNAL_CHART.border} vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10, fill: SIGNAL_CHART.muted }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tickFormatter={fmtNum}
                        tick={{ fontSize: 10, fill: SIGNAL_CHART.muted }}
                        tickLine={false}
                        axisLine={false}
                        width={44}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: SIGNAL_CHART.track }} />
                      <Bar dataKey="posts" name="Posts" radius={[6, 6, 0, 0]} fill={SIGNAL_CHART.coral} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </section>

        <div className="border-t border-signal-border" aria-hidden="true" />

        {/* ── SECTION: Social media performance ── */}
        <section
          id="platforms"
          aria-labelledby="platforms-heading"
          className="space-y-6"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2
                id="platforms-heading"
                className="font-signal-display text-2xl font-semibold text-signal-text sm:text-3xl"
              >
                Social media performance
              </h2>
              <p className="mt-1 text-sm text-signal-muted">
                Connect a new profile or review each platform's latest snapshot.
              </p>
            </div>
            <form onSubmit={addMetric} className="flex w-full gap-2 md:w-auto">
              <input
                type="text"
                placeholder="Enter TikTok, Facebook link..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                aria-label="Platform profile URL"
                className="w-full rounded-lg border border-signal-border bg-signal-surface px-4 py-2 text-sm text-signal-text placeholder:text-signal-muted focus:outline-none focus:ring-1 focus:ring-signal-cyan md:w-72"
                disabled={isSubmitting}
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="whitespace-nowrap rounded-lg bg-signal-cyan px-4 py-2 text-sm font-medium text-signal-ink transition-colors hover:brightness-95 disabled:bg-signal-slate disabled:text-signal-surface"
              >
                {isSubmitting ? "Updating..." : "Update"}
              </button>
            </form>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              label="Total followers"
              value={fmtNum(totalFollowers)}
              sub={`${connectedPlatforms.length} connected platform${connectedPlatforms.length === 1 ? "" : "s"}`}
              tone="none"
            />
            <StatCard
              label="Total posts"
              value={fmtNum(totalPosts)}
              sub={`${connectedPlatforms.length} connected platform${connectedPlatforms.length === 1 ? "" : "s"}`}
              tone="none"
            />
            <StatCard
              label="Total views"
              value={fmtNum(totalViews)}
              sub={`${connectedPlatforms.length} connected platform${connectedPlatforms.length === 1 ? "" : "s"}`}
              tone="up"
            />
            <StatCard
              label="Connected platforms"
              value={String(connectedPlatforms.length)}
              sub="Excludes Google Analytics"
              tone="down"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {connectedPlatforms.map((metric) => (
              <PlatformCard key={metric._id} metric={metric} onDelete={deleteMetric} />
            ))}

            {connectedPlatforms.length === 0 && !loading && (
              <div className="col-span-full">
                <InlineDataState
                  tone="empty"
                  title="No platform data available yet."
                  description="Enter a link above to get started."
                />
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
