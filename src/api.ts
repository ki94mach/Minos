// import axios from "axios";

// const API_BASE_URL = "http://localhost:5000"; // Adjust to match your backend

// export const fetchPrimaryIndications = async (populationId: string) => {
//     try {
//         const response = await axios.get(`${API_BASE_URL}/api/primary_indications/${populationId}`);
//         return response.data.primary_indications;
//     } catch (error) {
//         console.error("Error fetching primary indications:", error);
//         return [];
//     }
// };

// src/api.ts
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
