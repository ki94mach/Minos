import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Container,
  Alert,
  Link,
} from "@mui/material";
import api from "../../api";
import { useNavigate, useSearchParams  } from "react-router-dom";
import { API_ENDPOINTS } from "../../api/endpoints";

const PasswordManager: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  console.log("Token:", token);
  const isResetMode = !!token;
  const [mode, setMode] = useState<"forgot" | "reset" | "change">("forgot");

  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

 

  useEffect(() => {
    if (isResetMode) {
      setMode("reset");
    } else {
      setMode("forgot"); // default
    }
  }, [token, isResetMode]);

  const getCSRF = async () => {
    let url = "";
  
    if (mode === "reset" && token) {
      url = API_ENDPOINTS.RESET_PASSWORD;
    } else if (mode === "forgot") {
      url = API_ENDPOINTS.FORGOT_PASSWORD;
    } else if (mode === "change") {
      url = API_ENDPOINTS.CHANGE_PASSWORD;
    }
  
    const res = await api.get(url, {
      withCredentials: true,
      responseType: "text",
    });
  
    const html = res.data;
    const match = html.match(/<input[^>]*name="csrf_token"[^>]*value="([^"]+)"[^>]*>/);
    if (match && match[1]) {
      return match[1]; // CSRF token
    } else {
      throw new Error("CSRF token not found in HTML");
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    try {
      const csrfToken = await getCSRF();

      const response = await api.post(
        API_ENDPOINTS.FORGOT_PASSWORD,
        { email },
        {
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken,
          },
        }
      );

      setMessage(response.data.message);
      setSuccess(true);
    } catch (err: any) {
      setSuccess(false);
      setMessage(err.response?.data?.error || "Something went wrong.");
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    try {
      const csrfToken = await getCSRF();

      const response = await api.post(
        API_ENDPOINTS.RESET_PASSWORD,
        { token, password: newPassword },
        {
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken,
          },
        }
      );

      setSuccess(true);
      setMessage(response.data.message);
      setTimeout(() => navigate("/auth/login"), 3000);
    } catch (err: any) {
      setSuccess(false);
      setMessage(err.response?.data?.error || "Something went wrong.");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    if (newPassword !== confirmPassword) {
      setMessage("New passwords do not match.");
      return;
    }

    try {
      const csrfToken = await getCSRF();

      const response = await api.post(
        API_ENDPOINTS.CHANGE_PASSWORD,
        {
          current_password: currentPassword,
          new_password: newPassword,
        },
        {
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken,
          },
        }
      );

      setSuccess(true);
      setMessage(response.data.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setSuccess(false);
      setMessage(err.response?.data?.error || "Something went wrong.");
    }
  };

  return (
    <Container maxWidth="sm">
      <Box mt={10} p={3} boxShadow={3} bgcolor="#fff" borderRadius={2}>
        <Typography variant="h4" gutterBottom textAlign="center">
          {mode === "forgot"
            ? "Forgot Password"
            : mode === "reset"
            ? "Reset Password"
            : "Change Password"}
        </Typography>

        {message && (
          <Alert severity={success ? "success" : "error"} sx={{ mb: 2 }}>
            {message}
          </Alert>
        )}

        {mode === "forgot" && (
          <form onSubmit={handleForgot}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              margin="normal"
            />
            <Button fullWidth variant="contained" type="submit" sx={{ mt: 2 }}>
              Send Reset Link
            </Button>
          </form>
        )}

        {mode === "reset" && (
          <form onSubmit={handleReset}>
            <TextField
              fullWidth
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              margin="normal"
            />
            <TextField
              fullWidth
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              margin="normal"
            />
            <Button fullWidth variant="contained" type="submit" sx={{ mt: 2 }}>
              Reset Password
            </Button>
          </form>
        )}

        {mode === "change" && (
          <form onSubmit={handleChangePassword}>
            <TextField
              fullWidth
              label="Current Password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              margin="normal"
            />
            <TextField
              fullWidth
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              margin="normal"
            />
            <TextField
              fullWidth
              label="Confirm New Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              margin="normal"
            />
            <Button fullWidth variant="contained" type="submit" sx={{ mt: 2 }}>
              Change Password
            </Button>
          </form>
        )}

        {mode !== "change" && (
          <Typography variant="body2" align="center" mt={3}>
            <Link href="/auth/login" underline="hover">
              Back to Login
            </Link>
          </Typography>
        )}
      </Box>
    </Container>
  );
};

export default PasswordManager;
