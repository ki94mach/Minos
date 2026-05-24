import axios, { type InternalAxiosRequestConfig } from "axios";
import Cookies from "js-cookie";
import { API_BASE_URL } from "../api/config";
import { isMinosAuthEnabled } from "./ssoConfig";

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "X-CSRFToken";

/** Store CSRF token on the SPA origin (localhost:3000). API Set-Cookie on :5000 is not readable here. */
export function setCsrfCookie(token: string): void {
  Cookies.set(CSRF_COOKIE, token);
}

export function getCsrfCookie(): string | undefined {
  return Cookies.get(CSRF_COOKIE);
}

/** Fetch a fresh token from Flask-WTF and mirror it into js-cookie for X-CSRFToken headers. */
export async function refreshCsrfToken(): Promise<string> {
  const { data } = await axios.get<{ csrf_token: string }>(
    `${API_BASE_URL}/auth/csrf-token`,
    { withCredentials: isMinosAuthEnabled() }
  );
  setCsrfCookie(data.csrf_token);
  return data.csrf_token;
}

const MUTATING_METHODS = new Set(["post", "put", "patch", "delete"]);

export function isMutatingMethod(method?: string): boolean {
  return MUTATING_METHODS.has((method ?? "get").toLowerCase());
}

/** Attach CSRF header on mutating API calls (Flask-WTF expects X-CSRFToken). */
export function setCsrfRequestHeader(
  config: InternalAxiosRequestConfig,
  token: string
): void {
  if (!config.headers) {
    config.headers = new axios.AxiosHeaders();
  }
  if (typeof config.headers.set === "function") {
    config.headers.set(CSRF_HEADER, token);
  } else {
    (config.headers as Record<string, string>)[CSRF_HEADER] = token;
  }
}

/** Ensure a CSRF token is available and written to the request. */
export async function ensureCsrfOnRequest(
  config: InternalAxiosRequestConfig
): Promise<void> {
  if (!isMutatingMethod(config.method)) {
    return;
  }
  let token = getCsrfCookie();
  if (!token) {
    token = await refreshCsrfToken();
  }
  setCsrfRequestHeader(config, token);
}
