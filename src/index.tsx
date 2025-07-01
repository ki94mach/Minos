import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import api from "./api";
import "./styles/index.css"


(async function bootstrapCsrf() {
  try {
    await api.get("/auth/csrf-token");   // sets both cookie & header
  } catch (err) {
    console.error("CSRF bootstrap failed", err);
  }
})();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
