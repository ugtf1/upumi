import { Routes, Route } from "react-router-dom";

import { About, Alumni, Events, Home } from "../pages";
import AnalyticsPage from "../addons/AnalyticsPage";
import AdminPage from "../addons/AdminPage";
import MemberDashboard from "../addons/MemberDashboard";
import MemberAccount from "../addons/MemberAccount";
import MemberTransaction from "../addons/MemberTransaction";
import LoginPage from "../addons/LoginPage";
import MemberPage from "../addons/Member";
import MemberViewPage from "../addons/MemberView";
import PivotMembersPage from "../addons/PivotMembersPage";
import RegisterPage from "../addons/RegisterPage";
import RequireAuth from "../addons/RequireAuth";
import RequireAdmin from "../addons/RequireAdmin";
import SettingsPage from "../addons/SettingsPage";
import TransactionPage from "../addons/Transaction";

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

      <Route
        path="/member"
        element={
          <RequireAuth>
            <MemberDashboard />
          </RequireAuth>
        }
      />

      <Route
        path="/member/transaction"
        element={
          <RequireAuth>
            <MemberTransaction />
          </RequireAuth>
        }
      />

      <Route
        path="/member/account"
        element={
          <RequireAuth>
            <MemberAccount />
          </RequireAuth>
        }
      />

      <Route
        path="/member/settings"
        element={
          <RequireAuth>
            <MemberDashboard />
          </RequireAuth>
        }
      />

      <Route
        path="/admin/settings"
        element={
          <RequireAdmin>
            <SettingsPage />
          </RequireAdmin>
        }
      />

      <Route
        path="/admin/transaction"
        element={
          <RequireAdmin>
            <TransactionPage />
          </RequireAdmin>
        }
      />

      <Route
        path="/admin/member"
        element={
          <RequireAdmin>
            <MemberPage />
          </RequireAdmin>
        }
      />

      <Route
        path="/admin/member/:memberId"
        element={
          <RequireAdmin>
            <MemberViewPage />
          </RequireAdmin>
        }
      />

      {/* Optional 404 */}
      {/* <Route path="*" element={<PageNotFound />} /> */}
    </Routes>
  );
};

export default BaseRoute;
