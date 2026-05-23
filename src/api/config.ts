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

if (
  process.env.NODE_ENV === "production" &&
  /localhost|127\.0\.0\.1/.test(API_BASE_URL)
) {
  console.error(
    "[Minos] Production bundle is using a localhost API URL. " +
      "Rebuild with REACT_APP_API_URL set in .env.production (see docs/DEVELOPMENT.md F10)."
  );
}
