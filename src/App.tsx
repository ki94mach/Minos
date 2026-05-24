import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Home from "./pages/Home";
import Characteristics from "./pages/Characteristics";
import Drugs from "./pages/Drugs";
import Patients from "./pages/Patients";
import Treatments from "./pages/Treatments";
import FollowUps from "./pages/Follow-Ups";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import SsoRedirect from "./components/SsoRedirect";
import Login from "./pages/Login/Login";
import Register from "./pages/Login/Register";
import PasswordManager from "./pages/Login/PasswordManager";
import { isMinosAuthEnabled } from "./auth/ssoConfig";

const minosAuthRoutes = [
  "/auth/login",
  "/auth/register",
  "/auth/reset-password",
  "/auth/change-password",
  "/auth/forgot-password",
];

const RootRedirect: React.FC = () => {
  if (isMinosAuthEnabled()) {
    return <Navigate to="/auth/login" replace />;
  }
  return <Navigate to="/home" replace />;
};

const App: React.FC = () => {
  const location = useLocation();
  const showMinosAuth = isMinosAuthEnabled();
  const shouldHideNavbar =
    showMinosAuth && minosAuthRoutes.includes(location.pathname);

  const routes = (
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/characteristics"
          element={
            <ProtectedRoute>
              <Characteristics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/drugs"
          element={
            <ProtectedRoute>
              <Drugs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:rootId?"
          element={
            <ProtectedRoute>
              <Patients />
            </ProtectedRoute>
          }
        />
        <Route
          path="/treatments"
          element={
            <ProtectedRoute>
              <Treatments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/follow-ups"
          element={
            <ProtectedRoute>
              <FollowUps />
            </ProtectedRoute>
          }
        />

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
  );

  if (shouldHideNavbar) {
    return routes;
  }

  return <AppLayout>{routes}</AppLayout>;
};

export default App;
