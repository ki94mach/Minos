import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Box, CircularProgress, Typography } from "@mui/material";
import { verifyApiAuth } from "../auth/session";
import {
  getSsoLoginUrl,
  redirectToSsoLogin,
  isMinosAuthEnabled,
} from "../auth/ssoConfig";

type AuthState = "loading" | "authenticated" | "unauthenticated";

type ProtectedRouteProps = {
  children: React.ReactNode;
};

/**
 * Blocks catalog UI until the API accepts the current session (F2).
 * - Minos dev: redirect to /auth/login
 * - SSO prod: redirect to REACT_APP_SSO_LOGIN_URL
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const minosAuth = isMinosAuthEnabled();
  const [authState, setAuthState] = useState<AuthState>("loading");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const ok = await verifyApiAuth();
      if (!cancelled) {
        setAuthState(ok ? "authenticated" : "unauthenticated");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authState === "unauthenticated" && !minosAuth) {
      redirectToSsoLogin();
    }
  }, [authState, minosAuth]);

  if (authState === "loading") {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "40vh",
          gap: 2,
        }}
      >
        <CircularProgress />
        <Typography color="text.secondary">Checking sign-in…</Typography>
      </Box>
    );
  }

  if (authState === "unauthenticated") {
    if (minosAuth) {
      return <Navigate to="/auth/login" replace />;
    }

    if (!getSsoLoginUrl()) {
      return (
        <Box sx={{ p: 4 }}>
          <Typography variant="h6" color="error">
            SSO is not configured
          </Typography>
          <Typography sx={{ mt: 1 }}>
            Set <code>REACT_APP_SSO_LOGIN_URL</code> for production builds.
          </Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ p: 4 }}>
        <Typography>Redirecting to sign in…</Typography>
      </Box>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
