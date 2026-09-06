// src/hooks/insights/useInsightsData.ts
// Data hooks for the Insights page. All requests go through the shared axios
// client and the generic useApiResource hook.

import { useEffect, useMemo, useState } from "react";
import {
  fetchAllPosts,
  fetchDemographics,
  fetchInstagramProfileClicks,
  fetchTimeEngagement,
  fetchTimeEngagementMonthly,
  fetchTopPosts,
} from "../../api/insights";
import { REAL_DEMOGRAPHICS_SNAPSHOT } from "../../constants/insights";
import { monthKeySortKey } from "../../utils/insights";
import type {
  Post,
  TimeEngagementData,
  TimeEngagementMonthlyData,
} from "../../types/insights";
import { useApiResource } from "./useApiResource";

const EMPTY_POSTS: Post[] = [];

export function useTopPosts() {
  const { data, loading, error, refetch } = useApiResource(
    fetchTopPosts,
    EMPTY_POSTS,
    "top posts",
  );
  return { topPosts: data, loading, error, refetch };
}

export function useAllPosts() {
  const { data, loading, error, refetch } = useApiResource(
    fetchAllPosts,
    EMPTY_POSTS,
    "all posts",
  );
  return { allPosts: data, loading, error, refetch };
}

export function useDemographics() {
  const { data, loading, error, refetch } = useApiResource(
    fetchDemographics,
    REAL_DEMOGRAPHICS_SNAPSHOT,
    "demographics",
  );
  return { demographics: data, loading, error, refetch };
}

// Instagram clicks only exist at account level (profile links taps).
export function useInstagramProfileClicks() {
  const { data, loading, error, refetch } = useApiResource<number | null>(
    fetchInstagramProfileClicks,
    null,
    "Instagram profile clicks",
  );
  return { profileClicks: data, loading, error, refetch };
}

// Follower activity aggregated by hour (not split by weekday).
export function useTimeEngagement() {
  const { data, loading, error, refetch } =
    useApiResource<TimeEngagementData | null>(
      fetchTimeEngagement,
      null,
      "time-engagement",
    );
  return { dailyData: data, loading, error, refetch };
}

// Follower activity per month -> weekday -> hour, plus the selected-month state.
export function useTimeEngagementMonthly() {
  const { data, loading, error, refetch } =
    useApiResource<TimeEngagementMonthlyData>(
      fetchTimeEngagementMonthly,
      {},
      "time-engagement-monthly",
    );

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  // Months with data, newest first — used to render the month selector tags.
  const availableMonths = useMemo(
    () =>
      Object.keys(data).sort((a, b) => monthKeySortKey(b) - monthKeySortKey(a)),
    [data],
  );

  // Auto-select the most recent month whenever the dataset changes.
  useEffect(() => {
    if (availableMonths.length === 0) {
      setSelectedMonth(null);
      return;
    }
    setSelectedMonth((current) =>
      current && availableMonths.includes(current)
        ? current
        : availableMonths[0],
    );
  }, [availableMonths]);

  return {
    monthlyData: data,
    availableMonths,
    selectedMonth,
    setSelectedMonth,
    loading,
    error,
    refetch,
  };
}
