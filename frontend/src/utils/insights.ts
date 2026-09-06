// src/utils/insights.ts
// Formatting + normalization helpers shared by the Insights components/hooks.

import type { ContentType, Post } from "../types/insights";

export function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function splitDateTime(dateStr: string): { date: string; time: string } {
  if (!dateStr) return { date: "—", time: "" };
  const [datePart, timePart] = dateStr.split(" ");
  return { date: datePart || "—", time: timePart || "" };
}

// Parse a "YYYY-MM-DD HH:mm" date string (stored in VN time) and shift it
// forward by 1 hour to get the equivalent SGT (Singapore) time.
export function toSgtDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr.replace(" ", "T"));
  if (isNaN(d.getTime())) return null;
  d.setHours(d.getHours() + 1);
  return d;
}

// Format a VN-time date string as a "YYYY-MM-DD HH:mm" SGT string for display.
export function formatSgtDateTime(dateStr: string): string {
  const d = toSgtDate(dateStr);
  if (!d) return dateStr || "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Normalize content type from various backend field/value sources
export function normalizeContentType(raw: any): ContentType {
  const val = String(
    raw?.contentType ??
    raw?.content_type ??
    raw?.mediaType ??
    raw?.media_type ??
    raw?.type ??
    "",
  )
    .toLowerCase()
    .trim();

  if (!val) return "unknown";

  if (["video", "reel", "reels", "short", "shorts"].includes(val))
    return "video";
  if (["image", "photo", "picture", "img"].includes(val)) return "image";
  if (["carousel", "album", "sidecar", "gallery"].includes(val))
    return "carousel";
  if (["story", "stories"].includes(val)) return "story";
  if (["text", "status", "note"].includes(val)) return "text";

  return "unknown";
}

// Accepts either a bare array or a `{ posts: [...] }` envelope, flattens and normalizes it.
export function normalizePosts(raw: any): Post[] {
  let rawArray: any[] = [];
  if (Array.isArray(raw)) {
    rawArray = raw;
  } else if (raw && typeof raw === "object" && Array.isArray(raw.posts)) {
    rawArray = raw.posts;
  }
  const flatDocs = rawArray.flat();

  return flatDocs.map((doc, idx) => ({
    id: doc._id || idx + 1,
    platform: doc.platform || "Unknown",
    title: doc.title || "(No title)",
    views: doc.views || 0,
    likes: doc.likes || 0,
    shares: doc.shares || 0,
    clicks: doc.clicks || 0,
    date: doc.date || "",
    url: doc.url || "",
    contentType: normalizeContentType(doc),
    rawMediaType: doc.rawMediaType || doc.mediaType || doc.media_type || "",
  }));
}

// Per-post CTR only exists for Facebook (post_clicks); Instagram clicks are account-level.
export function getCtr(post: Post): string | null {
  if (post.platform?.toLowerCase() !== "facebook") return null;
  if (!post.clicks || post.views <= 0) return null;
  return ((post.clicks / post.views) * 100).toFixed(1);
}

// Convert a raw value (e.g. "CAROUSEL_ALBUM", "photo", "blog_post") into a readable label,
// no need to match a fixed list — just display whatever value exists.
export function formatTypeLabel(raw: string): string {
  if (!raw) return "Unknown";
  return raw
    .replace(/[_-]/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Get a readable month label (e.g. "Jul 2026") from a VN-time date string
// "YYYY-MM-DD HH:mm", converted to SGT first so the month bucket matches SGT.
export function getMonthLabel(dateStr: string): string | null {
  const d = toSgtDate(dateStr);
  if (!d) return null;
  return d.toLocaleString("en-US", { month: "short", year: "numeric" });
}

// Used as a real-time sort key for month labels (e.g. "Jul 2026" -> timestamp)
export function monthLabelSortKey(label: string): number {
  const d = new Date(`1 ${label}`);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

// Sort key for backend month keys (e.g. "Jan-2022" -> timestamp)
export function monthKeySortKey(key: string): number {
  const d = new Date(`1 ${key}`);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

export function sumViews(posts: Post[]): number {
  return posts.reduce((sum, p) => sum + (Number(p.views) || 0), 0);
}

export function sumClicks(posts: Post[]): number {
  return posts.reduce((sum, p) => sum + (Number(p.clicks) || 0), 0);
}
