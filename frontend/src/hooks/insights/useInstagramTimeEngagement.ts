// src/hooks/insights/useInstagramTimeEngagement.ts
// Instagram best-time data: monthly 7x24 follower-activity grid (VN -> SGT),
// per-cell post counts, and the hour-aggregated single row.

import { useMemo } from "react";
import { VN_WEEKDAY_MAP, WEEKDAY_LABELS } from "../../constants/insights";
import type {
  Post,
  TimeEngagementData,
  TimeEngagementMonthlyData,
} from "../../types/insights";

// Map "dayIdx-hourIdx" -> number of posts in that weekday + hour (SGT) for the selected month.
function buildPostCountByCell(posts: Post[], selectedMonth: string | null) {
  const map = new Map<string, number>();
  if (!selectedMonth) return map;

  const [monShort, yearStr] = selectedMonth.split("-");
  const refDate = new Date(`1 ${monShort} ${yearStr}`);
  const targetMonth = refDate.getMonth();
  const targetYear = refDate.getFullYear();

  for (const p of posts) {
    if (!p.date) continue;
    const parts = p.date.trim().split(/\s+/);
    if (parts.length < 2) continue;

    const dPart = parts[0];
    const tPart = parts[1].length === 5 ? parts[1] : parts[1].padStart(5, "0");

    // Treat the stored VN wall-clock time as UTC so the +1h SGT shift stays
    // independent of the viewer's local timezone.
    const vnLogicalDate = new Date(`${dPart}T${tPart}:00Z`);
    if (isNaN(vnLogicalDate.getTime())) continue;

    if (
      vnLogicalDate.getUTCMonth() !== targetMonth ||
      vnLogicalDate.getUTCFullYear() !== targetYear
    ) {
      continue;
    }

    const sgtLogicalDate = new Date(vnLogicalDate.getTime() + 3600 * 1000);
    const dayIdx = (sgtLogicalDate.getUTCDay() + 6) % 7;
    const hourIdx = sgtLogicalDate.getUTCHours();

    const key = `${dayIdx}-${hourIdx}`;
    map.set(key, (map.get(key) || 0) + 1);
  }

  return map;
}

export function useInstagramMonthlyGrid(
  monthlyData: TimeEngagementMonthlyData,
  selectedMonth: string | null,
  posts: Post[],
) {
  const monthStat = selectedMonth ? monthlyData?.[selectedMonth] : undefined;

  const postCountByCell = useMemo(
    () => buildPostCountByCell(posts, selectedMonth),
    [posts, selectedMonth],
  );

  // 7-day x 24-hour grid from the selected month's data, converting VN -> SGT
  return useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () =>
      new Array(24).fill(0),
    );
    const postCountGrid: number[][] = Array.from({ length: 7 }, () =>
      new Array(24).fill(0),
    );

    let min = Infinity;
    let max = -Infinity;
    let any = false;

    WEEKDAY_LABELS.forEach((label, dayIdx) => {
      const vnKey = VN_WEEKDAY_MAP[label];
      const dayStat = monthStat?.[vnKey];
      if (!dayStat) return;

      for (const h of dayStat.full_day_stats || []) {
        if (h.vn_hour < 0 || h.vn_hour >= 24) continue;

        const sgtHour = (h.vn_hour + 1) % 24;
        const targetDayIdx = h.vn_hour === 23 ? (dayIdx + 1) % 7 : dayIdx;

        grid[targetDayIdx][sgtHour] = h.followers_online;
        any = true;
        if (h.followers_online < min) min = h.followers_online;
        if (h.followers_online > max) max = h.followers_online;
      }
    });

    // Fill in actual post counts for ALL cells present in postCountByCell
    // (not just cells with followers_online data, since a post may fall into
    // an hour without online_followers data)
    postCountByCell.forEach((count, key) => {
      const [dStr, hStr] = key.split("-");
      postCountGrid[Number(dStr)][Number(hStr)] = count;
    });

    return {
      grid,
      min: any ? min : 0,
      max: any ? max : 0,
      hasData: any,
      postCountGrid,
    };
  }, [monthStat, postCountByCell]);
}

// Single 24-hour row from the hour-aggregated API, converted to SGT.
export function useInstagramDailyRow(dailyData: TimeEngagementData | null) {
  return useMemo(() => {
    const hourly = new Array(24).fill(0);
    let any = false;

    for (const h of dailyData?.full_day_stats || []) {
      if (h.vn_hour >= 0 && h.vn_hour < 24) {
        const sgtHour = (h.vn_hour + 1) % 24;
        hourly[sgtHour] = h.followers_online;
        any = true;
      }
    }

    let min = Infinity;
    let max = -Infinity;
    for (const v of hourly) {
      if (v < min) min = v;
      if (v > max) max = v;
    }

    const recommendedHours = new Set(
      (dailyData?.recommended_vn_times || []).map((t) => {
        const vnHour = Number(t.split(":")[0]);
        return (vnHour + 1) % 24;
      }),
    );

    const recommendedSgtTimes = (dailyData?.recommended_vn_times || []).map(
      (t) => {
        const vnHour = Number(t.split(":")[0]);
        if (isNaN(vnHour)) return t;
        const sgtHour = (vnHour + 1) % 24;
        return `${String(sgtHour).padStart(2, "0")}:00`;
      },
    );

    return {
      row: hourly,
      min: any ? min : 0,
      max: any ? max : 0,
      hasData: any,
      recommendedHours,
      recommendedSgtTimes,
    };
  }, [dailyData]);
}
