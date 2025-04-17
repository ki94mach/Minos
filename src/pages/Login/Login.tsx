import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { TextField, Button, Typography, Box, Link } from "@mui/material";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [csrfToken, setCsrfToken] = useState("");

  // useEffect(() => {
  //   // Fetch the CSRF token from the Flask endpoint
  //   axios.get("/auth/csrf-token", { withCredentials: true })
  //     .then(response => {
  //       setCsrfToken(response.data.csrfToken);
  //     })
  //     .catch(error => {
  //       console.error("Error fetching CSRF token:", error);
  //     });
  // }, []);

  useEffect(() => {
    axios.get("http://localhost:5000/auth/csrf-token", { withCredentials: true })
      .then(res => setCsrfToken(res.data.csrfToken))
      .catch(err => console.error("CSRF token fetch failed:", err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    try {
      const api = axios.create({
        baseURL: "http://localhost:5000",
        withCredentials: true,
      });

      const response = await api.post(
        "/auth/login",
        { email, password },
        {
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken || "",
          },
        }
      );

      if (response.data.status === "fail") {
        setMessage(response.data.error);
      } else {
        navigate("/home");
      }
    } catch (error: any) {
      const errMsg = error.response?.data?.error || "An error occurred. Please try again.";
      setMessage(errMsg);
    }
  };

  return (
    <Box
      sx={{
        width: 300,
        margin: "100px auto",
        padding: 3,
        background: "#fff",
        border: "1px solid #ddd",
        borderRadius: "5px",
        textAlign: "center",
      }}
    >
      <Typography variant="h5" gutterBottom>Login</Typography>
      {message && <Typography color="error" sx={{ mb: 2 }}>{message}</Typography>}
      <form onSubmit={handleSubmit}>
        <TextField
          fullWidth
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          sx={{ mb: 2 }}
          required
        />
        <TextField
          fullWidth
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          sx={{ mb: 2 }}
          required
        />
        <Box sx={{ textAlign: "right", mb: 2 }}>
          <Link href="/auth/forgot-password" fontSize={14}>Forgot Password?</Link>
        </Box>
        <Button fullWidth variant="contained" type="submit">Login</Button>
      </form>
      <Typography variant="body2" sx={{ mt: 2 }}>
        Don't have an account? <Link href="/auth/register">Register</Link>
      </Typography>
    </Box>
  );
};

export default Login;
