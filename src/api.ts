import axios, { type AxiosInstance } from "axios";
import { getAccessToken } from "./auth/accessToken";
import { ensureCsrfOnRequest } from "./auth/csrf";
import { handleUnauthorizedApi } from "./auth/unauthorized";
import { isMinosAuthEnabled } from "./auth/ssoConfig";
import { API_BASE_URL } from "./api/config";

function createApiClient(): AxiosInstance {
  const minosAuth = isMinosAuthEnabled();

  const client = axios.create({
    baseURL: API_BASE_URL,
    // Bearer SSO (S1): no cookies on /api/*. Legacy Minos login uses session + CSRF.
    withCredentials: minosAuth,
    ...(minosAuth
      ? {
          xsrfCookieName: "csrf_token",
          xsrfHeaderName: "X-CSRFToken",
        }
      : {}),
  });

  client.interceptors.request.use(async (config) => {
    // Legacy Minos login uses session cookies + CSRF, not Bearer.
    const accessToken = minosAuth ? null : getAccessToken();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    // /api/* is CSRF-exempt; /auth/* still needs the token when using Minos login UI.
    if (minosAuth) {
      try {
        await ensureCsrfOnRequest(config);
      } catch {
        // Non-fatal for /api; required for POST /auth/login, etc.
      }
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => {
      if (
        response.status === 401 &&
        !response.config.skipAuthRedirect
      ) {
        handleUnauthorizedApi();
      }
      return response;
    },
    (error) => {
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 401 &&
        !error.config?.skipAuthRedirect
      ) {
        handleUnauthorizedApi();
      }
      return Promise.reject(error);
    }
  );

  return client;
}

const api = createApiClient();

export default api;
export { API_BASE_URL } from "./api/config";
