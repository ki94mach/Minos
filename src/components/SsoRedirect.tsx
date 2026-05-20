import React, { useEffect } from "react";
import { Box, Typography } from "@mui/material";
import { getSsoLoginUrl, redirectToSsoLogin } from "../auth/ssoConfig";

/**
 * Sends the browser to REACT_APP_SSO_LOGIN_URL (production auth entry).
 */
const SsoRedirect: React.FC = () => {
  useEffect(() => {
    redirectToSsoLogin();
  }, []);

  const loginUrl = getSsoLoginUrl();

  if (!loginUrl) {
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
};

export default SsoRedirect;
