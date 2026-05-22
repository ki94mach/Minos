import axios from "axios";
import Cookies from "js-cookie";
import { API_BASE_URL } from "./api/config";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  xsrfCookieName: "csrf_token",
  xsrfHeaderName: "X-CSRFToken",
});

api.interceptors.request.use((config) => {
  const token = Cookies.get("csrf_token");
  if (token) config.headers["X-CSRFToken"] = token;
  return config;
});

export default api;
export { API_BASE_URL } from "./api/config";
