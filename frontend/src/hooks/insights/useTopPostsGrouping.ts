// src/hooks/insights/useTopPostsGrouping.ts
// Content-type filter + per-platform grouping for the Top posts panel.

import { useMemo, useState } from "react";
import {
  CONTENT_TYPE_ORDER,
  TOP_POSTS_PER_PLATFORM,
} from "../../constants/insights";
import type { ContentType, Post } from "../../types/insights";

export function useTopPostsGrouping(posts: Post[], limit = TOP_POSTS_PER_PLATFORM) {
  const [activeContentType, setActiveContentType] = useState<
    ContentType | "all"
  >("all");

  // Content types actually present in the data, used to render the filter chips.
  const availableContentTypes = useMemo(() => {
    const set = new Set<ContentType>();
    posts.forEach((p) => set.add(p.contentType));
    return CONTENT_TYPE_ORDER.filter((t) => set.has(t));
  }, [posts]);

  const filteredPosts = useMemo(() => {
    if (activeContentType === "all") return posts;
    return posts.filter((p) => p.contentType === activeContentType);
  }, [posts, activeContentType]);

  const groupedPosts = useMemo(() => {
    const grouped = filteredPosts.reduce(
      (acc, post) => {
        if (!acc[post.platform]) acc[post.platform] = [];
        acc[post.platform].push(post);
        return acc;
      },
      {} as Record<string, Post[]>,
    );
    // Keep the existing default; Social Dashboard requests 10.
    for (const platform of Object.keys(grouped)) {
      grouped[platform] = grouped[platform].slice(0, limit);
    }
    return grouped;
  }, [filteredPosts, limit]);

  return {
    activeContentType,
    setActiveContentType,
    availableContentTypes,
    groupedPosts,
  };
}
