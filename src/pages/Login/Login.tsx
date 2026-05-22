import React, { useEffect , useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { TextField, Button, Typography, Box, Link } from "@mui/material";
import Cookies from "js-cookie";
import api from "../../api";
import { API_ENDPOINTS } from "../../api/endpoints";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(""); 
  const [csrfToken, setCsrfToken] = useState("");

  useEffect(() => {
    api
      .get(API_ENDPOINTS.LOGIN, {
        withCredentials: true,
        responseType: "text",
      })
      .then((res) => {
        const html = res.data;
        const match = html.match(
          /<input[^>]*name="csrf_token"[^>]*value="([^"]+)"[^>]*>/
        );
        if (match && match[1]) {
          const token = match[1];
          setCsrfToken(token);
          Cookies.set("csrf_token", token); 
        } else {
          console.error("CSRF token not found in response HTML.");
        }
      })
      .catch((err) => {
        console.error("Failed to fetch CSRF token:", err);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    const { data } = await api.get("/auth/csrf-token");
    const fresh = data.csrf_token;
    Cookies.set("csrf_token", fresh);
  

    try {
      const response = await api.post(
        API_ENDPOINTS.LOGIN,
        { email, password, csrf_token: fresh  },
        {
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": fresh,
          },
        }
      );

      navigate("/home");
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
