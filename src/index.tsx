import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import {
  captureAccessTokenFromUrl,
  clearAccessToken,
} from "./auth/accessToken";
import { refreshCsrfToken } from "./auth/csrf";
import { isMinosAuthEnabled } from "./auth/ssoConfig";
import "./styles/index.css";

async function bootstrap() {
  captureAccessTokenFromUrl();

  if (isMinosAuthEnabled()) {
    // Stale SSO tokens in sessionStorage must not suppress CSRF/session auth.
    clearAccessToken();
    try {
      await refreshCsrfToken();
    } catch (err) {
      console.error("CSRF bootstrap failed", err);
    }
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
}

bootstrap();
