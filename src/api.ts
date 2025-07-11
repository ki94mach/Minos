import axios from "axios";
import Cookies from "js-cookie";

const api = axios.create({
  baseURL: "http://localhost:5000",
  withCredentials: true,
  xsrfCookieName: "csrf_token",   // ➊ tell Axios where to read from
  xsrfHeaderName: "X-CSRFToken",  // ➋ and what header to emit
});

api.interceptors.request.use((config) => {
  // fallback for non‑mutating methods where Axios skips xsrf magic
  const token = Cookies.get("csrf_token");
  if (token) config.headers["X-CSRFToken"] = token;
  return config;
});

export default api;
