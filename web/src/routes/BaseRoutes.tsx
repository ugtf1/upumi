import { Routes, Route } from "react-router-dom";

import { About, Alumni, Events, Home } from "../pages";
import AnalyticsPage from "../addons/AnalyticsPage";
import AdminPage from "../addons/AdminPage";
import LoginPage from "../addons/LoginPage";
import PivotMembersPage from "../addons/PivotMembersPage";
import RegisterPage from "../addons/RegisterPage";
import RequireAuth from "../addons/RequireAuth";
import RequireAdmin from "../addons/RequireAdmin";

const BaseRoute = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/events" element={<Events />} />
      <Route path="/alumni" element={<Alumni />} />

      {/* Auth routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Member-only routes */}
      <Route
        path="/analytics"
        element={
          <RequireAuth>
            <AnalyticsPage />
          </RequireAuth>
        }
      />

      <Route
        path="/pivot"
        element={
          <RequireAuth>
            <PivotMembersPage />
          </RequireAuth>
        }
      />

      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminPage />
          </RequireAdmin>
        }
      />

      {/* Optional 404 */}
      {/* <Route path="*" element={<PageNotFound />} /> */}
    </Routes>
  );
};

export default BaseRoute;
