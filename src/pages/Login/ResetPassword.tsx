import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Alert,
} from "@mui/material";
import { useSearchParams } from "react-router-dom";

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const isResetMode = !!token;

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    try {
      const csrfToken = (document.getElementById("csrf_token") as HTMLInputElement)?.value;

      const response = await axios.post(
        "/auth/reset-password",
        {
          token,
          password,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken,
          },
        }
      );

      setMessage(response.data.message);
      setSuccess(true);
      setTimeout(() => {
        window.location.href = "/auth/login";
      }, 3000);
    } catch (error: any) {
      setMessage(error.response?.data?.error || "An error occurred.");
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    try {
      const csrfToken = (document.getElementById("csrf_token") as HTMLInputElement)?.value;

      const response = await axios.post(
        "/auth/forgot-password",
        {
          email,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken,
          },
        }
      );

      setMessage(response.data.message);
      setSuccess(true);
    } catch (error: any) {
      setMessage(error.response?.data?.error || "An error occurred.");
    }
  };

  return (
    <Container maxWidth="sm">
      <Box mt={10} p={3} boxShadow={3} bgcolor="#fff" borderRadius={2}>
        <Typography variant="h4" gutterBottom>
          {isResetMode ? "Reset Password" : "Forgot Password"}
        </Typography>

        {message && (
          <Alert severity={success ? "success" : "error"} sx={{ mb: 2 }}>
            {message}
          </Alert>
        )}

        <input type="hidden" id="csrf_token" value="{{ csrf_token() }}" />

        {isResetMode ? (
          <form onSubmit={handleResetSubmit}>
            <TextField
              fullWidth
              type="password"
              label="New Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              margin="normal"
            />
            <TextField
              fullWidth
              type="password"
              label="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              margin="normal"
            />
            <Button fullWidth type="submit" variant="contained" sx={{ mt: 2 }}>
              Reset Password
            </Button>
          </form>
        ) : (
          <form onSubmit={handleForgotSubmit}>
            <TextField
              fullWidth
              type="email"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              margin="normal"
            />
            <Button fullWidth type="submit" variant="contained" sx={{ mt: 2 }}>
              Send Reset Link
            </Button>
          </form>
        )}

        <Typography variant="body2" align="center" mt={3}>
          <a href="/auth/login">Back to Login</a>
        </Typography>
      </Box>
    </Container>
  );
};

export default ResetPassword;