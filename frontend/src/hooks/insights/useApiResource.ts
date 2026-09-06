// src/hooks/insights/useApiResource.ts
// Generic fetch-on-mount hook: one place for loading/error state, cancellation
// and refetch, so every Insights data hook stays a 3-liner.

import { useCallback, useEffect, useState } from "react";
import axios from "axios";

export type ApiResource<T> = {
  data: T;
  loading: boolean;
  error: boolean;
  refetch: () => void;
};

export function useApiResource<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  initialData: T,
  label = "insights",
): ApiResource<T> {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const run = async () => {
      setLoading(true);
      setError(false);
      try {
        const result = await fetcher(controller.signal);
        if (!active) return;
        setData(result);
      } catch (err) {
        // Ignore aborts caused by unmount / refetch.
        if (!active || controller.signal.aborted || axios.isCancel(err)) return;
        console.error(`Error loading ${label}:`, err);
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
  }, [fetcher, label, reloadKey]);

  const refetch = useCallback(() => setReloadKey((key) => key + 1), []);

  return { data, loading, error, refetch };
}
