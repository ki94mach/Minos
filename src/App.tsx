import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Home from "./pages/Home";
import Characteristics from "./pages/Characteristics";
import Drugs from "./pages/Drugs";
import Patients from "./pages/Patients";
import Treatments from "./pages/Treatments";
import FollowUps from "./pages/Follow-Ups";
import Navbar from "./components/Navbar";
import SsoRedirect from "./components/SsoRedirect";
import Login from "./pages/Login/Login";
import Register from "./pages/Login/Register";
import PasswordManager from "./pages/Login/PasswordManager";
import { useMinosAuthPages } from "./auth/ssoConfig";

const minosAuthRoutes = [
  "/auth/login",
  "/auth/register",
  "/auth/reset-password",
  "/auth/change-password",
  "/auth/forgot-password",
];

const RootRedirect: React.FC = () => {
  if (useMinosAuthPages()) {
    return <Navigate to="/auth/login" replace />;
  }
  return <Navigate to="/home" replace />;
};

const App: React.FC = () => {
  const location = useLocation();
  const showMinosAuth = useMinosAuthPages();
  const shouldHideNavbar =
    showMinosAuth && minosAuthRoutes.includes(location.pathname);

  return (
    <>
      {!shouldHideNavbar && <Navbar />}
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/home" element={<Home />} />
        <Route path="/characteristics" element={<Characteristics />} />
        <Route path="/drugs" element={<Drugs />} />
        <Route path="/patients/:rootId?" element={<Patients />} />
        <Route path="/treatments" element={<Treatments />} />
        <Route path="/follow-ups" element={<FollowUps />} />

        {showMinosAuth ? (
          <>
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/register" element={<Register />} />
            <Route path="/auth/reset-password" element={<PasswordManager />} />
            <Route path="/auth/change-password" element={<PasswordManager />} />
            <Route path="/auth/forgot-password" element={<PasswordManager />} />
          </>
        ) : (
          <Route path="/auth/*" element={<SsoRedirect />} />
        )}
      </Routes>
    </>
  );
};

export default App;
