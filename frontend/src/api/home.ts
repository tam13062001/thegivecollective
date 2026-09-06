// src/api/home.ts
// Typed API calls for the Homepage. Every call accepts an AbortSignal so
// hooks can cancel in-flight requests on unmount.

import { apiClient } from "./client";
import type { LinkTapsDayPoint, PlatformMetric } from "../types/home";

export async function fetchPlatformMetrics(
  signal: AbortSignal,
): Promise<PlatformMetric[]> {
  const { data } = await apiClient.get("/tasks", { signal });
  return Array.isArray(data) ? data : [];
}

// Instagram has no per-post clicks — website_clicks + profile_links_taps are
// account-level metrics, returned here as a best-effort daily series (see
// backend note on `end_time` day-boundary assumptions).
export async function fetchInstagramLinkTapsHistory(
  days: number,
  signal: AbortSignal,
): Promise<{ series: LinkTapsDayPoint[]; note?: string; error?: string | null }> {
  const { data } = await apiClient.get("/insights/instagram/profile-clicks/history", {
    params: { days },
    signal,
  });
  return {
    series: Array.isArray(data?.data) ? data.data : [],
    note: data?.note,
    error: data?.error ?? null,
  };
}
