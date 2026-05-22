/**
 * API base URL for Axios (C2).
 * Set at build time via REACT_APP_API_URL (CRA embeds env at npm run build).
 */

const DEFAULT_API_BASE_URL = "http://localhost:5000";

/** Normalize base URL: trim and remove trailing slash. */
export function normalizeApiBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/**
 * Resolved API origin used by src/api.ts.
 * Falls back to localhost Flask dev server when env is unset.
 */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.REACT_APP_API_URL;
  if (fromEnv && fromEnv.trim()) {
    return normalizeApiBaseUrl(fromEnv);
  }
  return DEFAULT_API_BASE_URL;
}

export const API_BASE_URL = getApiBaseUrl();
