import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { IconType } from "react-icons";
import {
  FiCreditCard,
  FiHome,
  FiLogOut,
  FiSearch,
  FiSettings,
  FiUsers,
} from "react-icons/fi";

import { clearToken } from "./api";
import "./admin-page.scss";
import "./settings-page.scss";

type NavigationItem = {
  label: string;
  icon: IconType;
  action: () => void;
  tone?: "danger";
};

type AdminRow = {
  name: string;
  email: string;
  status: "Active" | "Inactive";
};

const ADMIN_ROWS: AdminRow[] = [
  { name: "John Okafor", email: "Admin.John@gmail.com", status: "Active" },
  { name: "Amara Eze", email: "Admin.Amara@gmail.com", status: "Active" },
  { name: "Bola Ade", email: "Admin.Bola@gmail.com", status: "Active" },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"Account Settings" | "Notification Preference">("Account Settings");
  const [preferences, setPreferences] = useState({
    emailNotifications: false,
    activityAlerts: true,
    smsNotifications: true,
    inAppNotifications: true,
  });

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  function handleTogglePreference(key: keyof typeof preferences) {
    setPreferences((current) => ({ ...current, [key]: !current[key] }));
  }

  function handleSavePreferences() {
    // placeholder for save logic
  }

  const primaryNavigationItems: NavigationItem[] = [
    { label: "Dashboard", icon: FiHome, action: () => navigate("/admin") },
    { label: "Transaction", icon: FiCreditCard, action: () => navigate("/admin/transaction") },
    { label: "Member", icon: FiUsers, action: () => navigate("/admin/member") },
  ];

  const secondaryNavigationItems: NavigationItem[] = [
    { label: "Settings", icon: FiSettings, action: () => navigate("/admin/settings") },
    { label: "Logout", icon: FiLogOut, action: handleLogout, tone: "danger" },
  ];

  return (
    <div className="admin-dashboard settings-page">
      <aside className="admin-dashboard__sidebar">
        <div className="admin-dashboard__brand">
          <div className="admin-dashboard__brand-mark">
            <img src="/logo/upu-logo.svg" alt="UPUMI logo" />
          </div>
          <span>UPUMI</span>
        </div>

        <nav className="admin-dashboard__nav" aria-label="Admin navigation">
          {primaryNavigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                className={[
                  "admin-dashboard__nav-item",
                  item.label === "Dashboard" ? "" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={item.action}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="admin-dashboard__profile">
          <div className="admin-dashboard__profile-info">
            <div className="admin-dashboard__profile-avatar" aria-hidden="true">
              A
            </div>
            <div>
              <div className="admin-dashboard__profile-name">Admin</div>
              <div className="admin-dashboard__profile-email">Admin.Ono@gmail.com</div>
            </div>
          </div>
          <div className="admin-dashboard__profile-actions">
            {secondaryNavigationItems.map((item) => {
              const Icon = item.icon;
              const active = item.label === "Settings";
              return (
                <button
                  key={item.label}
                  type="button"
                  className={[
                    "admin-dashboard__nav-item",
                    item.tone === "danger" ? "is-danger" : "",
                    active ? "is-active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={item.action}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <main className="admin-dashboard__main">
        <section className="admin-dashboard__hero settings-page__hero">
          <div>
            <h1>Admin Console</h1>
            <p>Manage user access, security, and notification preferences.</p>
          </div>

          <div className="admin-dashboard__hero-actions settings-page__hero-actions">
            <label className="admin-dashboard__search settings-page__search">
              <FiSearch size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search admin settings..."
                aria-label="Search admin settings"
              />
            </label>
          </div>
        </section>

        <section className="settings-page__tabs" aria-label="Settings tabs">
          {(["Account Settings", "Notification Preference"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={[
                "settings-page__tab",
                activeTab === tab ? "settings-page__tab--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </section>

        <section className="settings-page__content">
          {activeTab === "Account Settings" ? (
            <div className="settings-page__section-grid">
              <div className="settings-page__panel settings-page__panel--table">
                <div className="settings-page__section-header settings-page__section-header--row">
                  <div>
                    <h2>Admin Management</h2>
                    <p>Manage team access and permissions for the admin console.</p>
                  </div>
                  <button type="button" className="settings-page__button settings-page__button--secondary">
                    + Add Admin
                  </button>
                </div>

                <div className="admin-dashboard__table-wrap">
                  <table className="settings-page__table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ADMIN_ROWS.map((row) => (
                        <tr key={row.email}>
                          <td>{row.name}</td>
                          <td>{row.email}</td>
                          <td>
                            <span
                              className={[
                                "admin-dashboard__status-pill",
                                row.status === "Active" ? "is-good" : "is-bad",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td>
                            <div className="settings-page__row-actions">
                              <button type="button" className="settings-page__action-link">
                                Edit
                              </button>
                              <button type="button" className="settings-page__action-link settings-page__action-link--danger">
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="settings-page__panel settings-page__panel--preference">
              <div className="settings-page__section-header">
                <h2>Notification Preference</h2>
                <p>Control how you receive alerts and updates from UPUMI.</p>
              </div>

              <div className="settings-page__toggle-list">
                {(
                  [
                    { label: "Email Notifications", key: "emailNotifications" },
                    { label: "Activity Alerts", key: "activityAlerts" },
                    { label: "SMS Notifications", key: "smsNotifications" },
                    { label: "In-App Notifications", key: "inAppNotifications" },
                  ] as const
                ).map((item) => {
                  const enabled = preferences[item.key];
                  return (
                    <div key={item.key} className="settings-page__toggle-row">
                      <div>
                        <div className="settings-page__toggle-label-title">{item.label}</div>
                        <div className="settings-page__toggle-label-sub">
                          {enabled ? "Enabled" : "Disabled"}
                        </div>
                      </div>
                      <button
                        type="button"
                        className={[
                          "settings-page__toggle",
                          enabled ? "settings-page__toggle--on" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => handleTogglePreference(item.key)}
                        aria-pressed={enabled}
                      >
                        <span className="settings-page__toggle-knob" />
                      </button>
                    </div>
                  );
                })}

                <div className="settings-page__actions settings-page__actions--bottom">
                  <button
                    type="button"
                    className="settings-page__button settings-page__button--primary"
                    onClick={handleSavePreferences}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
