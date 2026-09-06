// src/hooks/insights/useEngagementRateGroups.ts
// Filter (platform + month, SGT) → engagement rate → above/below average split
// with pagination state for the engagement comparison panel.

import { useEffect, useMemo, useState } from "react";
import { ENGAGEMENT_PAGE_SIZE } from "../../constants/insights";
import { getMonthLabel, monthLabelSortKey } from "../../utils/insights";
import type { ErRow, Post } from "../../types/insights";

export function useEngagementRateGroups(posts: Post[]) {
  const [selectedPlatform, setSelectedPlatform] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [abovePage, setAbovePage] = useState(1);
  const [belowPage, setBelowPage] = useState(1);

  // Keep every post, including views = 0 (ER becomes 0% → Below Average bucket).
  const availablePlatforms = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => {
      if (p.platform) set.add(p.platform);
    });
    return Array.from(set).sort();
  }, [posts]);

  // There is no "All platforms" option, so auto-select the first platform with
  // data whenever the list changes or the current selection becomes invalid.
  useEffect(() => {
    if (availablePlatforms.length === 0) {
      setSelectedPlatform((current) => (current === "" ? current : ""));
      return;
    }
    setSelectedPlatform((current) =>
      availablePlatforms.includes(current) ? current : availablePlatforms[0],
    );
  }, [availablePlatforms]);

  const platformFilteredPosts = useMemo(() => {
    if (!selectedPlatform) return [];
    return posts.filter((p) => p.platform === selectedPlatform);
  }, [posts, selectedPlatform]);

  // Month list is scoped to the selected platform, in SGT.
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    platformFilteredPosts.forEach((p) => {
      const m = getMonthLabel(p.date);
      if (m) set.add(m);
    });
    return Array.from(set).sort(
      (a, b) => monthLabelSortKey(b) - monthLabelSortKey(a),
    );
  }, [platformFilteredPosts]);

  // Reset the month filter when the platform changes, so we never stay on a
  // month the new platform has no data for.
  useEffect(() => {
    setSelectedMonth("all");
  }, [selectedPlatform]);

  const monthFilteredPosts = useMemo(() => {
    if (selectedMonth === "all") return platformFilteredPosts;
    return platformFilteredPosts.filter(
      (p) => getMonthLabel(p.date) === selectedMonth,
    );
  }, [platformFilteredPosts, selectedMonth]);

  // Avg ER = mean of each post's ER within the filtered set (platform + month, SGT).
  // Not weighted (total likes+shares / total views): a post with views = 0 but
  // likes/shares would skew the denominator and inflate Avg ER far above the
  // per-post ER values actually listed.
  const { avgEr, rows } = useMemo(() => {
    const withEr: ErRow[] = monthFilteredPosts.map((p) => ({
      ...p,
      er: p.views > 0 ? ((p.likes + p.shares) / p.views) * 100 : 0,
    }));

    const avg =
      withEr.length > 0
        ? withEr.reduce((sum, r) => sum + r.er, 0) / withEr.length
        : 0;

    return { avgEr: avg, rows: withEr };
  }, [monthFilteredPosts]);

  const belowAvg = useMemo(
    () => rows.filter((r) => r.er < avgEr).sort((a, b) => a.er - b.er),
    [rows, avgEr],
  );
  const aboveAvg = useMemo(
    () => rows.filter((r) => r.er >= avgEr).sort((a, b) => b.er - a.er),
    [rows, avgEr],
  );

  const abovePageCount = Math.max(
    1,
    Math.ceil(aboveAvg.length / ENGAGEMENT_PAGE_SIZE),
  );
  const belowPageCount = Math.max(
    1,
    Math.ceil(belowAvg.length / ENGAGEMENT_PAGE_SIZE),
  );

  useEffect(() => {
    setAbovePage(1);
    setBelowPage(1);
  }, [selectedPlatform, selectedMonth]);

  useEffect(() => {
    setAbovePage((page) => Math.min(page, abovePageCount));
  }, [abovePageCount]);

  useEffect(() => {
    setBelowPage((page) => Math.min(page, belowPageCount));
  }, [belowPageCount]);

  const visibleAboveAvg = useMemo(
    () =>
      aboveAvg.slice(
        (abovePage - 1) * ENGAGEMENT_PAGE_SIZE,
        abovePage * ENGAGEMENT_PAGE_SIZE,
      ),
    [aboveAvg, abovePage],
  );
  const visibleBelowAvg = useMemo(
    () =>
      belowAvg.slice(
        (belowPage - 1) * ENGAGEMENT_PAGE_SIZE,
        belowPage * ENGAGEMENT_PAGE_SIZE,
      ),
    [belowAvg, belowPage],
  );

  return {
    selectedPlatform,
    setSelectedPlatform,
    selectedMonth,
    setSelectedMonth,
    availablePlatforms,
    availableMonths,
    avgEr,
    rows,
    aboveAvg,
    belowAvg,
    visibleAboveAvg,
    visibleBelowAvg,
    abovePage,
    setAbovePage,
    belowPage,
    setBelowPage,
    abovePageCount,
    belowPageCount,
  };
}
