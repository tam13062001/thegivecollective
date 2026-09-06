// src/hooks/insights/usePostHistoryGrid.ts
// Builds the 7 days x 24 hours (SGT) post-history heatmap from a post list.

import { useMemo } from "react";
import { splitDateTime } from "../../utils/insights";
import type { HeatCell, Post } from "../../types/insights";

export function usePostHistoryGrid(posts: Post[]) {
  return useMemo(() => {
    const g: HeatCell[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ count: 0, totalViews: 0 })),
    );

    for (const post of posts) {
      if (!post.date) continue;
      const { time } = splitDateTime(post.date);
      if (!time) continue;

      const parsed = new Date(post.date.replace(" ", "T"));
      if (isNaN(parsed.getTime())) continue;

      // Add 1 hour to convert to SGT
      parsed.setHours(parsed.getHours() + 1);

      const dayIdx = (parsed.getDay() + 6) % 7;
      const hourIdx = parsed.getHours();

      g[dayIdx][hourIdx].count += 1;
      g[dayIdx][hourIdx].totalViews += post.views || 0;
    }

    let min = Infinity;
    let max = -Infinity;
    let any = false;
    for (const row of g) {
      for (const cell of row) {
        if (cell.count > 0) {
          any = true;
          const avg = cell.totalViews / cell.count;
          if (avg < min) min = avg;
          if (avg > max) max = avg;
        }
      }
    }

    return {
      grid: g,
      minAvg: any ? min : 0,
      maxAvg: any ? max : 0,
      hasData: any,
    };
  }, [posts]);
}
