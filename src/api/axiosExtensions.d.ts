import "axios";

declare module "axios" {
  export interface AxiosRequestConfig {
    /** When true, a 401 response does not trigger login / SSO redirect (F4). */
    skipAuthRedirect?: boolean;
  }
}
