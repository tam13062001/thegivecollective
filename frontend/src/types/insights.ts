// src/types/insights.ts
// Shared types for the Insights page (posts, demographics, time-engagement, charts).

// Content type of a post
export type ContentType =
  | "video"
  | "image"
  | "carousel"
  | "text"
  | "story"
  | "unknown";

export type Post = {
  id: string | number;
  platform: string;
  title: string;
  views: number;
  likes: number;
  shares: number;
  clicks?: number;
  date: string;
  url?: string;
  contentType: ContentType;
  rawMediaType?: string;
};

export type DemographicRow = {
  age: string;
  female: number;
  male: number;
  undisclosed: number;
};

export type TimeEngagementHour = {
  pt_hour: number;
  vn_hour: number;
  followers_online: number;
};

export type TimeEngagementData = {
  recommended_vn_times: string[];
  top_hours_detail: TimeEngagementHour[];
  full_day_stats: TimeEngagementHour[];
};

export type PlatformKey = "tiktok" | "facebook" | "instagram" | "youtube";

export type TimeEngagementMonthlyDayStat = {
  top3_vn_times: string[];
  full_day_stats: { vn_hour: number; followers_online: number }[];
};

// monthKey (e.g. "Jan-2022") -> VN weekday label (e.g. "Thứ 2") -> stat
export type TimeEngagementMonthlyData = Record<
  string,
  Record<string, TimeEngagementMonthlyDayStat>
>;

export type PlatformTheme = {
  accent: string;
  soft: string;
  marker: string;
  heatColors: readonly string[];
};

// One cell of the 7 days x 24 hours post-history heatmap
export type HeatCell = { count: number; totalViews: number };

// A post enriched with its engagement rate (%)
export type ErRow = Post & { er: number };

export type ContentTypeRow = {
  key: string;
  label: string;
  count: number;
  totalViews: number;
  avgViews: number;
  avgLikes: number;
  avgShares: number;
  engagementRate: string;
  platforms: string[];
};

// One bar of the Facebook vs Instagram CTR chart
export type CtrDatum = {
  platform: string;
  label: string;
  ctr: number;
  clicks: number;
  views: number;
  postCount: number;
  color: string;
  note: string;
};

export type StatTone = "up" | "down" | "none";
