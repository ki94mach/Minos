import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Link,
  TextField,
  Typography,
} from "@mui/material";
import Cookies from "js-cookie";

const Register: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [csrfToken, setCsrfToken] = useState("");

  function setCookie(name: string, value: string, days = 1) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${value}; expires=${expires}; path=/`;
  }

  // useEffect(() => {
  //   // This triggers Flask to set CSRF cookie automatically
  //   axios.get("http://localhost:5000/auth/register", {
  //     withCredentials: true,
  //   }).catch(err => {
  //     console.error("Failed to initiate CSRF flow:", err);
  //   });
  // }, []);

  
    useEffect(() => {
      axios.get("http://localhost:5000/auth/register", {
        withCredentials: true,
        responseType: "text",
      })
        .then(res => {
        const html = res.data;
        const match = html.match(
          /<input[^>]*name="csrf_token"[^>]*value="([^"]+)"[^>]*>/
        );
        if (match && match[1]) {
          const token = match[1];
          console.log("Extracted CSRF Token:", token);
          setCsrfToken(token);
          setCookie("csrf_token", token);
          // Cookies.set("csrf_token", token);
          // document.cookie = `csrf_token=${token}; path=/`;
          
        }
        else {
          console.error("CSRF token not found in HTML.");
          console.warn("CSRF token not found in response. Proceeding without it.");
        } 
        })
        .catch(err => {
          console.error("GET Error:", err.response || err.message);
          // console.error("Failed to get CSRF token", err);
        });
    }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    try {
      const token = Cookies.get("csrf_token") || csrfToken;
      console.log("Using CSRF Token:", token);
      
      await axios.post(
        "http://localhost:5000/auth/register",
        { email, password, csrf_token: token, },
        {
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": token,
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
      <Typography variant="h5" gutterBottom>
        Register
      </Typography>
      {message && (
        <Typography color="error" sx={{ mb: 2 }}>
          {message}
        </Typography>
      )}
      <form onSubmit={handleSubmit}>
        <TextField
          fullWidth
          label="Email"
          type="email"
          sx={{ mb: 2 }}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextField
          fullWidth
          label="Password"
          type="password"
          sx={{ mb: 1 }}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Typography
          variant="caption"
          sx={{ textAlign: "left", display: "block", mb: 2, color: "#666" }}
        >
          Password must meet at least 3 of these 4 criteria:
          <br />- At least 12 characters long
          <br />- Contains uppercase and lowercase letters
          <br />- Includes at least one number
          <br />- Has at least one special character
          <br />(Minimum length: 8 characters)
        </Typography>
        <TextField
          fullWidth
          label="Confirm Password"
          type="password"
          sx={{ mb: 2 }}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <Button fullWidth variant="contained" type="submit">
          Register
        </Button>
      </form>
      <Typography variant="body2" sx={{ mt: 2 }}>
        Already have an account? <Link href="/auth/login">Log in</Link>
      </Typography>
    </Box>
  );
};

export default Register;
