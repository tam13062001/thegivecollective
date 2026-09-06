// src/api/insights.ts
// Typed API calls for the Insights page. Every call accepts an AbortSignal so
// hooks can cancel in-flight requests on unmount.

import { apiClient } from "./client";
import { REAL_DEMOGRAPHICS_SNAPSHOT } from "../constants/insights";
import { normalizePosts } from "../utils/insights";
import type {
  DemographicRow,
  Post,
  TimeEngagementData,
  TimeEngagementMonthlyData,
} from "../types/insights";

export async function fetchTopPosts(signal: AbortSignal): Promise<Post[]> {
  const { data } = await apiClient.get("/insights/top-posts", { signal });
  return normalizePosts(data);
}

export async function fetchAllPosts(signal: AbortSignal): Promise<Post[]> {
  const { data } = await apiClient.get("/insights/all-posts", { signal });
  return normalizePosts(data);
}

// Falls back to the hard snapshot when the endpoint returns nothing usable,
// so the audience chart never renders empty.
export async function fetchDemographics(
  signal: AbortSignal,
): Promise<DemographicRow[]> {
  const { data } = await apiClient.get<DemographicRow[]>(
    "/insights/demographics",
    { signal },
  );
  return Array.isArray(data) && data.length > 0
    ? data
    : REAL_DEMOGRAPHICS_SNAPSHOT;
}

// Instagram has no per-post clicks — this is the account-level profile clicks total.
// The endpoint can return a usable `profileClicks` value together with a
// non-fatal `error` note (e.g. the `since` param being out of Meta's 2-year
// window), so only treat the response as failed when no number comes back.
export async function fetchInstagramProfileClicks(
  signal: AbortSignal,
): Promise<number> {
  const { data } = await apiClient.get("/insights/instagram/profile-clicks", {
    signal,
  });
  console.log("[insights] Instagram profile clicks response:", data);
  const byMetric = data?.byMetric ?? {};
  const raw =
    data?.profileClicks ??
    (Number(byMetric.website_clicks) || 0) +
    (Number(byMetric.profile_links_taps) || 0);

  const total = Number(raw);
  if (!Number.isFinite(total)) {
    throw new Error(
      String(data?.error || "Invalid Instagram profile clicks response"),
    );
  }

  if (data?.error) {
    console.warn("[insights] Instagram profile clicks warning:", data.error);
  }

  return total;
}

export async function fetchTimeEngagement(
  signal: AbortSignal,
): Promise<TimeEngagementData | null> {
  const { data } = await apiClient.get("/insights/time-engagement", { signal });
  if (!data?.success) throw new Error(data?.message || "Fetch failed");
  return data.data ?? null;
}

export async function fetchTimeEngagementMonthly(
  signal: AbortSignal,
): Promise<TimeEngagementMonthlyData> {
  const { data } = await apiClient.get("/insights/time-engagement-monthly", {
    signal,
  });
  if (!data?.success) throw new Error(data?.message || "Fetch failed");
  return data.data ?? {};
}
