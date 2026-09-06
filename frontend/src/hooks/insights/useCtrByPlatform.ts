// src/hooks/insights/useCtrByPlatform.ts
// CTR comparison data: Facebook uses post-level clicks, Instagram uses
// account-level profile clicks (no per-post clicks exist on IG).

import { useMemo } from "react";
import { PLATFORM_THEMES } from "../../constants/insights";
import { sumClicks, sumViews } from "../../utils/insights";
import type { CtrDatum, Post } from "../../types/insights";
import { useInstagramProfileClicks } from "./useInsightsData";

export function useCtrByPlatform(
  facebookPosts: Post[],
  instagramPosts: Post[],
) {
  const { profileClicks, loading, error } = useInstagramProfileClicks();

  const data = useMemo<CtrDatum[]>(() => {
    const fbViews = sumViews(facebookPosts);
    const fbClicks = sumClicks(facebookPosts);

    const igViews = sumViews(instagramPosts);
    const igClicks = Number(profileClicks) || 0;

    const rows: CtrDatum[] = [
      {
        platform: "facebook",
        label: "Facebook",
        ctr: fbViews > 0 ? (fbClicks / fbViews) * 100 : 0,
        clicks: fbClicks,
        views: fbViews,
        postCount: facebookPosts.length,
        color: PLATFORM_THEMES.facebook.accent,
        note: "Sum of post clicks ÷ sum of post views.",
      },
      {
        platform: "instagram",
        label: "Instagram",
        ctr: igViews > 0 ? (igClicks / igViews) * 100 : 0,
        clicks: igClicks,
        views: igViews,
        postCount: instagramPosts.length,
        color: PLATFORM_THEMES.instagram.accent,
        note: "Account-level profile clicks ÷ sum of post views.",
      },
    ];

    return rows.filter((r) => r.views > 0 || r.clicks > 0);
  }, [facebookPosts, instagramPosts, profileClicks]);

  return { data, igLoading: loading, igError: error };
}
