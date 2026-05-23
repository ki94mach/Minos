/** sessionStorage key for SSO access token (set after IdP redirect or SDK). */
export const ACCESS_TOKEN_STORAGE_KEY = "minos_access_token";

export function getAccessToken(): string | null {
  const token = sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)?.trim();
  return token || null;
}

export function setAccessToken(token: string): void {
  sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token.trim());
}

export function clearAccessToken(): void {
  sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}

/**
 * Persist token from IdP redirect (query or hash). Strips token params from the URL.
 * Returns true if a token was captured.
 */
export function captureAccessTokenFromUrl(): boolean {
  const fromSearch = new URLSearchParams(window.location.search);
  const fromHash = new URLSearchParams(
    window.location.hash.replace(/^#/, "")
  );
  const token =
    fromSearch.get("access_token") ||
    fromSearch.get("token") ||
    fromHash.get("access_token") ||
    fromHash.get("token");

  if (!token?.trim()) {
    return false;
  }

  setAccessToken(token);

  const url = new URL(window.location.href);
  url.searchParams.delete("access_token");
  url.searchParams.delete("token");
  url.hash = "";
  window.history.replaceState(
    {},
    document.title,
    url.pathname + url.search
  );

  return true;
}
