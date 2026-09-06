// src/constants/insights.ts
// Design tokens, labels and static snapshots used across the Insights page.

import type {
  ContentType,
  DemographicRow,
  PlatformKey,
  PlatformTheme,
} from "../types/insights";

// Map display day labels (EN, shared with post-history grid) -> backend response keys (VN)
export const VN_WEEKDAY_MAP: Record<string, string> = {
  Mon: "Thứ 2",
  Tue: "Thứ 3",
  Wed: "Thứ 4",
  Thu: "Thứ 5",
  Fri: "Thứ 6",
  Sat: "Thứ 7",
  Sun: "Chủ Nhật",
};

export const REAL_DEMOGRAPHICS_SNAPSHOT: DemographicRow[] = [
  { age: "13-17", female: 8, male: 6, undisclosed: 10 },
  { age: "18-24", female: 33, male: 25, undisclosed: 30 },
  { age: "25-34", female: 62, male: 48, undisclosed: 26 },
  { age: "35-44", female: 61, male: 35, undisclosed: 16 },
  { age: "45-54", female: 22, male: 11, undisclosed: 7 },
  { age: "55-64", female: 13, male: 4, undisclosed: 1 },
  { age: "65+", female: 1, male: 2, undisclosed: 1 },
];

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const HOUR_LABELS = Array.from({ length: 12 }, (_, i) => i * 2);

export const PLATFORM_TABS: { key: PlatformKey; label: string }[] = [
  { key: "tiktok", label: "TikTok" },
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "youtube", label: "YouTube" },
];

// Display metadata for each content type
export const CONTENT_TYPE_META: Record<ContentType, { label: string }> = {
  video: { label: "Video" },
  image: { label: "Image" },
  carousel: { label: "Carousel" },
  story: { label: "Story" },
  text: { label: "Text" },
  unknown: { label: "Other" },
};

export const CONTENT_TYPE_ORDER: ContentType[] = [
  "video",
  "image",
  "carousel",
  "story",
  "text",
  "unknown",
];

const BRAND_HEAT_COLORS = [
  "#fffafc",
  "#eff9f6",
  "#d9f0eb",
  "#bfe3dc",
  "#98d2c6",
  "#6fc0b2",
  "#2a9d8f",
  "#1c766e",
] as const;

const BRAND_PINK_HEAT_COLORS = [
  "#fffafc",
  "#fff0f4",
  "#fddde7",
  "#f9c2d2",
  "#f5a4bb",
  "#f27698",
  "#d95f82",
  "#b94769",
] as const;

export const PLATFORM_THEMES: Record<PlatformKey, PlatformTheme> = {
  tiktok: {
    accent: "#173f3d",
    soft: "#e8f4f1",
    marker: "#f27698",
    heatColors: BRAND_HEAT_COLORS,
  },
  facebook: {
    accent: "#2a9d8f",
    soft: "#e8f4f1",
    marker: "#f27698",
    heatColors: BRAND_HEAT_COLORS,
  },
  instagram: {
    accent: "#f27698",
    soft: "#fff5f7",
    marker: "#2a9d8f",
    heatColors: BRAND_PINK_HEAT_COLORS,
  },
  youtube: {
    accent: "#2a9d8f",
    soft: "#e8f4f1",
    marker: "#f27698",
    heatColors: BRAND_HEAT_COLORS,
  },
};

export const SIGNAL_CHART = {
  // Brand colors sampled visually from The Give Collective logo.
  ink: "#fffafc",
  panel: "#ffffff",
  surface: "#ffffff",
  track: "#e8f4f1",
  text: "#173f3d",
  muted: "#6c807d",
  border: "#d7e8e3",
  cyan: "#2a9d8f",
  coral: "#f27698",
  amber: "#e6aa55",
  slate: "#86a09b",
  female: "#f27698",
  male: "#2a9d8f",
  undisclosed: "#bfd8d2",
} as const;

export const TOP_POSTS_PER_PLATFORM = 5;
export const ENGAGEMENT_PAGE_SIZE = 10;
