import api from "../api";
import { API_ENDPOINTS } from "../api/endpoints";
import { clearAccessToken } from "./accessToken";
import { resetAuthRedirectFlag } from "./unauthorized";
import { redirectToSsoLogout, isMinosAuthEnabled } from "./ssoConfig";

/**
 * End session (F8).
 * - SSO / prod: clear Bearer token and open REACT_APP_SSO_LOGOUT_URL (or login URL).
 * - Minos dev: optional GET /auth/logout, then /auth/login.
 */
export async function performLogout(): Promise<void> {
  clearAccessToken();
  resetAuthRedirectFlag();

  if (!isMinosAuthEnabled()) {
    redirectToSsoLogout();
    return;
  }

  try {
    await api.get(API_ENDPOINTS.LOGOUT, {
      withCredentials: true,
      validateStatus: (status) => status >= 200 && status < 400,
      skipAuthRedirect: true,
    });
  } catch (error) {
    console.error("Logout error:", error);
  }

  window.location.assign("/auth/login");
}
