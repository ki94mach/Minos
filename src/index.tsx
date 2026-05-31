import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import App from "./App";
import { theme } from "./theme/theme";
import {
  captureAccessTokenFromUrl,
  clearAccessToken,
} from "./auth/accessToken";
import { refreshCsrfToken } from "./auth/csrf";
import { isMinosAuthEnabled } from "./auth/ssoConfig";
import "./styles/index.css";

/** Benign browser noise when React Flow / MUI resize in the same frame (dev overlay only). */
function suppressBenignResizeObserverError() {
  const isResizeObserverNoise = (message: unknown): boolean =>
    typeof message === "string" && message.includes("ResizeObserver loop");

  window.addEventListener(
    "error",
    (event) => {
      if (isResizeObserverNoise(event.message)) {
        event.stopImmediatePropagation();
      }
    },
    true
  );

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      typeof reason === "string"
        ? reason
        : reason instanceof Error
          ? reason.message
          : "";
    if (isResizeObserverNoise(message)) {
      event.preventDefault();
    }
  });
}

suppressBenignResizeObserverError();

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
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </React.StrictMode>
  );
}

bootstrap();
