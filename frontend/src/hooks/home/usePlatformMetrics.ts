// src/hooks/home/usePlatformMetrics.ts
// Platform metrics list + add/delete mutations for the Homepage.

import { useCallback, useState } from "react";
import { apiClient } from "../../api/client";
import { fetchPlatformMetrics } from "../../api/home";
import type { PlatformMetric } from "../../types/home";
import { useApiResource } from "../insights/useApiResource";

const EMPTY_METRICS: PlatformMetric[] = [];

export function usePlatformMetrics() {
  const { data: metrics, loading, error, refetch } = useApiResource(
    fetchPlatformMetrics,
    EMPTY_METRICS,
    "platform metrics",
  );

  const [urlInput, setUrlInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addMetric = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const url = urlInput.trim();
      if (!url) {
        alert("Please enter a URL!");
        return;
      }
      setIsSubmitting(true);
      try {
        await apiClient.post("/tasks", { urls: [url] });
        setUrlInput("");
        refetch();
      } catch (err: any) {
        alert(err?.response?.data?.message || "An error occurred");
      } finally {
        setIsSubmitting(false);
      }
    },
    [urlInput, refetch],
  );

  const deleteMetric = useCallback(
    async (id: string) => {
      if (!window.confirm("Are you sure you want to delete?")) return;
      try {
        await apiClient.delete(`/tasks/${id}`);
        refetch();
      } catch {
        alert("Error connecting to server");
      }
    },
    [refetch],
  );

  return {
    metrics,
    loading,
    error,
    urlInput,
    setUrlInput,
    isSubmitting,
    addMetric,
    deleteMetric,
  };
}
