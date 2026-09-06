// src/hooks/home/useInstagramLinkTaps.ts
// Daily Instagram profile-link-taps history (website_clicks + profile_links_taps),
// with a selectable day range, matching the RANGES pattern used by the other
// Homepage charts (GrowthChart, GA4Card, DailyGA4Chart).

import { useEffect, useState } from "react";
import axios from "axios";
import { fetchInstagramLinkTapsHistory } from "../../api/home";
import type { LinkTapsDayPoint } from "../../types/home";

export const LINK_TAPS_RANGES = [
  { label: "7D", days: 7 },
  { label: "14D", days: 14 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

export function useInstagramLinkTaps() {
  const [days, setDays] = useState(30);
  const [series, setSeries] = useState<LinkTapsDayPoint[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const run = async () => {
      setLoading(true);
      setError(false);
      try {
        const result = await fetchInstagramLinkTapsHistory(days, controller.signal);
        if (!active) return;
        setSeries(result.series);
        setNote(result.note ?? null);
        // A non-empty series with a warning note (e.g. Meta's `since` window
        // notice) is still usable — only surface the error tone when there's
        // no data to show at all.
        if (result.error && result.series.length === 0) {
          console.warn("[home] Instagram link taps warning:", result.error);
          setError(true);
        }
      } catch (err) {
        if (!active || controller.signal.aborted || axios.isCancel(err)) return;
        console.error("Error loading Instagram link taps history:", err);
        setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    run();
    return () => {
      active = false;
      controller.abort();
    };
  }, [days]);

  return { days, setDays, series, note, loading, error };
}
