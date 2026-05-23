import api from "../api";
import { API_ENDPOINTS } from "../api/endpoints";

/**
 * Lightweight auth check against a protected API route.
 * Returns true on 200; 401 means unauthenticated (SSO redirect or Minos login).
 */
export async function verifyApiAuth(): Promise<boolean> {
  try {
    const res = await api.get(API_ENDPOINTS.CHARACTERISTICS, {
      validateStatus: (status) => status === 200 || status === 401,
      skipAuthRedirect: true,
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

export {
  getAccessToken,
  setAccessToken,
  clearAccessToken,
  ACCESS_TOKEN_STORAGE_KEY,
} from "./accessToken";
