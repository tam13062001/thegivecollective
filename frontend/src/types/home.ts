// src/types/home.ts
// Shared types for the Homepage (platform metrics, IG link-taps history).

export interface PlatformMetric {
  _id: string;
  platformName: string;
  accountHandle: string;
  profileUrl: string;
  followersCount: number;
  postsCount: number;
  viewsCount: number;
}

export type HomeTabKey = "social" | "ga4" | "daily" | "linkTaps";

export type LinkTapsDayPoint = {
  date: string;
  websiteClicks: number;
  profileLinksTaps: number;
  total: number;
};
