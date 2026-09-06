// src/api/client.ts
// Single axios instance for all backend calls.

import axios from "axios";

// NOTE: kept as an explicit absolute default because the dev server has no
// `/api/v1` proxy configured yet — set VITE_API_BASE_URL only once a proxy
// (or a local backend origin) is available.
export const API_BASE_URL = "https://thegivecollective-backend.vercel.app/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20_000,
  headers: { Accept: "application/json" },
});
