import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Home from "./pages/Home";
import Characteristics from "./pages/Characteristics";
import Drugs from "./pages/Drugs";
import Patients from "./pages/Patients";
import Treatments from "./pages/Treatments";
import FollowUps from "./pages/Follow-Ups";
import Navbar from "./components/Navbar";

import Login from "./pages/Login/Login";
import Register from "./pages/Login/Register";
import ResetPassword from "./pages/Login/ResetPassword";
import ChangePassword from "./pages/Login/ChangePassword";

const App: React.FC = () => {
  const location = useLocation();
  const hideNavbarRoutes = [
    "/auth/login",
    "/auth/register",
    "/auth/reset-password",
    "/auth/change-password",
  ];
  const shouldHideNavbar = hideNavbarRoutes.includes(location.pathname);

  return (
    <>
      {!shouldHideNavbar && <Navbar />}
      <Routes>
        {/* 🔁 Redirect root URL to /auth/login */}
        <Route path="/" element={<Navigate to="/auth/login" replace />} />

        <Route path="/characteristics" element={<Characteristics />} />
        <Route path="/drugs" element={<Drugs />} />
        <Route path="/patients" element={<Patients />} />
        <Route path="/treatments" element={<Treatments />} />
        <Route path="/follow-ups" element={<FollowUps />} />

        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/register" element={<Register />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />
        <Route path="/auth/change-password" element={<ChangePassword />} />
      </Routes>
    </>
  );
};

export default App;
