import axios, { type AxiosInstance } from "axios";
import Cookies from "js-cookie";
import { getAccessToken } from "./auth/accessToken";
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

  client.interceptors.request.use((config) => {
    const accessToken = getAccessToken();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    } else if (minosAuth) {
      const csrf = Cookies.get("csrf_token");
      if (csrf) {
        config.headers["X-CSRFToken"] = csrf;
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
