// src/api/client.ts
// Single axios instance for all backend calls.

import axios from "axios";

// Optional override for local/staging deployments; retain the current production default.
export const API_BASE_URL = ((import.meta as ImportMeta & {
  env?: { VITE_API_BASE_URL?: string };
}).env?.VITE_API_BASE_URL || "https://thegivecollective-backend.vercel.app/api/v1").replace(/\/+$/, "");

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20_000,
  headers: { Accept: "application/json" },
});
