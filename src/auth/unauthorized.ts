import { clearAccessToken } from "./accessToken";
import { redirectToSsoLogin, useMinosAuthPages } from "./ssoConfig";

let redirectInProgress = false;

/** Reset for tests; avoids blocking subsequent redirects in the same session. */
export function resetAuthRedirectFlag(): void {
  redirectInProgress = false;
}

/**
 * Single redirect on API 401 (F4). Skips Minos auth pages to avoid login-form loops.
 */
export function handleUnauthorizedApi(): void {
  if (redirectInProgress) {
    return;
  }

  if (useMinosAuthPages()) {
    if (window.location.pathname.startsWith("/auth/")) {
      return;
    }
    redirectInProgress = true;
    clearAccessToken();
    window.location.assign("/auth/login");
    return;
  }

  redirectInProgress = true;
  clearAccessToken();
  redirectToSsoLogin();
}
