/**
 * SSO vs legacy Minos auth routing (S5).
 *
 * Production builds (npm run build) use REACT_APP_SSO_LOGIN_URL.
 * Development keeps /auth/login unless REACT_APP_USE_MINOS_AUTH is forced off.
 */

export function isProductionBuild(): boolean {
  return process.env.NODE_ENV === "production";
}

/** True when Minos login/register/password routes are available. */
export function isMinosAuthEnabled(): boolean {
  const flag = process.env.REACT_APP_USE_MINOS_AUTH?.trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return !isProductionBuild();
}

export function getSsoLoginUrl(): string | undefined {
  const url = process.env.REACT_APP_SSO_LOGIN_URL?.trim();
  return url || undefined;
}

export function getSsoLogoutUrl(): string | undefined {
  const url = process.env.REACT_APP_SSO_LOGOUT_URL?.trim();
  return url || getSsoLoginUrl();
}

/** Full-page redirect to corporate IdP (S5 / F2 / F4). */
export function redirectToSsoLogin(): void {
  const url = getSsoLoginUrl();
  if (url) {
    window.location.assign(url);
    return;
  }
  console.error(
    "REACT_APP_SSO_LOGIN_URL is not set; cannot redirect to SSO login."
  );
}

/** IdP end-session (F8). Uses REACT_APP_SSO_LOGOUT_URL, else login URL. */
export function redirectToSsoLogout(): void {
  const url = getSsoLogoutUrl();
  if (url) {
    window.location.assign(url);
    return;
  }
  console.warn(
    "REACT_APP_SSO_LOGOUT_URL is not set; falling back to SSO login URL."
  );
  redirectToSsoLogin();
}
