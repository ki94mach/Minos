import React, { useState } from "react";
import axios from "axios";
import {
  Box,
  Button,
  TextField,
  Typography,
  Link,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

const ChangePassword: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setMessage("New passwords do not match.");
      return;
    }

    try {
      const csrfToken = (document.querySelector("meta[name='csrf-token']") as HTMLMetaElement)?.content;

      const res = await axios.post(
        "/auth/change-password",
        {
          current_password: currentPassword,
          new_password: newPassword,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken || "",
          },
        }
      );

      setMessage(res.data.message);
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      const errMsg = error.response?.data?.error || "An error occurred. Please try again.";
      setMessage(errMsg);
      setSuccess(false);
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
      <Typography variant="h5" gutterBottom>Change Password</Typography>
      {message && (
        <Typography sx={{ color: success ? "green" : "red", mb: 2 }}>
          {message}
        </Typography>
      )}
      <form onSubmit={handleSubmit}>
        <TextField
          fullWidth
          type="password"
          label="Current Password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          sx={{ mb: 2 }}
          required
        />
        <TextField
          fullWidth
          type="password"
          label="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          sx={{ mb: 1 }}
          required
        />
        <Typography
          variant="caption"
          sx={{ textAlign: "left", display: "block", mb: 2, color: "#666" }}
        >
          Password must meet at least 3 of these 4 criteria:
          <br />- 12+ characters
          <br />- Upper & lowercase letters
          <br />- At least 1 number
          <br />- At least 1 special character
        </Typography>
        <TextField
          fullWidth
          type="password"
          label="Confirm New Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          sx={{ mb: 2 }}
          required
        />
        <Button fullWidth variant="contained" type="submit">Change Password</Button>
      </form>
      <Typography variant="body2" sx={{ mt: 2 }}>
        <Link onClick={() => navigate("/api/characteristics")} style={{ cursor: "pointer" }}>
          Back to Dashboard
        </Link>
      </Typography>
    </Box>
  );
};

export default ChangePassword;
