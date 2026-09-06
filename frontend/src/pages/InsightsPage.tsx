// src/pages/InsightsPage.tsx
// Composition only — data lives in hooks/insights/*, UI in components/insights/*.
import { useMemo } from "react";
import { BestTimeSection } from "../components/insights/BestTimeSection";
import { ContentTypeBreakdownTable } from "../components/insights/ContentTypeBreakdownTable";
import { ContentTypePerformanceCard } from "../components/insights/ContentTypePerformanceCard";
import { CtrComparisonCard } from "../components/insights/CtrComparisonCard";
import { DemographicsCard } from "../components/insights/DemographicsCard";
import { EngagementRateTables } from "../components/insights/EngagementRateTables";
import { InlineDataState } from "../components/insights/InlineDataState";
import { InsightsHeader } from "../components/insights/InsightsHeader";
import { OverviewStats } from "../components/insights/OverviewStats";
import { TopPostsCard } from "../components/insights/TopPostsCard";
import {
  useAllPosts,
  useDemographics,
  useTopPosts,
} from "../hooks/insights/useInsightsData";

export default function InsightsPage() {
  const {
    topPosts,
    loading: topPostsLoading,
    error: topPostsError,
    refetch: refetchTopPosts,
  } = useTopPosts();

  const {
    allPosts,
    loading: allPostsLoading,
    error: allPostsError,
    refetch: refetchAllPosts,
  } = useAllPosts();

  const {
    demographics,
    loading: demoLoading,
    error: demoError,
  } = useDemographics();

  const platformCount = useMemo(
    () => new Set(topPosts.map((p) => p.platform)).size,
    [topPosts],
  );

  const facebookPosts = useMemo(
    () => allPosts.filter((p) => p.platform?.toLowerCase() === "facebook"),
    [allPosts],
  );
  const instagramPosts = useMemo(
    () => allPosts.filter((p) => p.platform?.toLowerCase() === "instagram"),
    [allPosts],
  );

  return (
    <div className="signal-atlas mt-16 min-h-screen bg-signal-ink pb-16 font-signal-body text-signal-text">
      <div className="mx-auto max-w-[1640px] space-y-14 px-4 py-10 sm:space-y-20 sm:px-8 sm:py-14">
        <InsightsHeader />

        {/* ── SECTION 1: Overview ── */}
        <section
          id="briefing"
          aria-labelledby="briefing-heading"
          className="space-y-6 sm:space-y-8"
        >
          <OverviewStats
            posts={topPosts}
            loading={topPostsLoading}
            platformCount={platformCount}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <DemographicsCard
              demographics={demographics}
              loading={demoLoading}
              error={demoError}
            />

            <TopPostsCard
              posts={topPosts}
              loading={topPostsLoading}
              error={topPostsError}
              onRetry={refetchTopPosts}
            />

            {allPostsError && (
              <div className="lg:col-span-12">
                <InlineDataState
                  tone="error"
                  title="Couldn’t load all post history."
                  description="Format and engagement comparisons will update when the source is available."
                  actionLabel="Try again"
                  onAction={refetchAllPosts}
                />
              </div>
            )}

            {/* Content type: chart + detail table side by side on desktop */}
            <div className="grid grid-cols-1 gap-4 lg:col-span-12 xl:grid-cols-2">
              <ContentTypePerformanceCard posts={allPosts} />
              <ContentTypeBreakdownTable
                posts={allPosts}
                loading={allPostsLoading}
              />
            </div>

            {/* CTR: Facebook (post clicks) vs Instagram (profile clicks) */}
            <div className="lg:col-span-12">
              <CtrComparisonCard
                facebookPosts={facebookPosts}
                instagramPosts={instagramPosts}
                loading={allPostsLoading}
              />
            </div>

            <EngagementRateTables
              posts={allPosts}
              loading={allPostsLoading}
            />
          </div>
        </section>

        {/* ── SECTION 2: Best Time to Post ── */}
        <BestTimeSection posts={allPosts} loading={allPostsLoading} />
      </div>
    </div>
  );
}
