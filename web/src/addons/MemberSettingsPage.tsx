import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { IconType } from "react-icons";
import { FiCreditCard, FiHome, FiLogOut, FiSettings, FiUsers } from "react-icons/fi";

import { clearToken } from "./api";
import "./admin-page.scss";
import "./member-dashboard.scss";
import "./member-settings-page.scss";
import "./settings-page.scss";

type NavigationItem = {
  label: string;
  icon: IconType;
  action: () => void;
  tone?: "danger";
};

export default function MemberSettingsPage() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("Settings");
  const [profile, setProfile] = useState({
    fullName: "Agbara Onome",
    email: "agbaraonome@gmail.com",
    phone: "+1 234 567 890",
    location: "Lagos, Nigeria",
  });
  const [password, setPassword] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);

  const navigateTo = (path: string, label: string) => {
    setActiveNav(label);
    navigate(path);
  };

  const primaryNavigationItems: NavigationItem[] = [
    {
      label: "Community Dashboard",
      icon: FiHome,
      action: () => navigateTo("/member", "Community Dashboard"),
    },
    {
      label: "Transaction",
      icon: FiCreditCard,
      action: () => navigateTo("/member/transaction", "Transaction"),
    },
    {
      label: "Account",
      icon: FiUsers,
      action: () => navigateTo("/member/account", "Account"),
    },
  ];

  const secondaryNavigationItems: NavigationItem[] = [
    {
      label: "Settings",
      icon: FiSettings,
      action: () => navigateTo("/member/settings", "Settings"),
    },
    {
      label: "Logout",
      icon: FiLogOut,
      tone: "danger",
      action: () => {
        clearToken();
        navigate("/login");
      },
    },
  ];

  const handleProfileChange = (field: keyof typeof profile, value: string) => {
    setProfile((current) => ({ ...current, [field]: value }));
  };

  const handlePasswordChange = (field: keyof typeof password, value: string) => {
    setPassword((current) => ({ ...current, [field]: value }));
  };

  const handleSaveSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Placeholder save logic; form state is managed locally for now.
  };

  return (
    <div className="admin-dashboard member-dashboard member-settings-page">
      <aside className="admin-dashboard__sidebar member-dashboard__sidebar">
        <div className="admin-dashboard__brand">
          <div className="admin-dashboard__brand-mark">
            <img src="/logo/upu-logo.svg" alt="UPUMI logo" />
          </div>
          <span>UPUMI</span>
        </div>

        <nav className="admin-dashboard__nav member-dashboard__nav" aria-label="Member navigation">
          {primaryNavigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.label;

            return (
              <button
                key={item.label}
                type="button"
                className={["admin-dashboard__nav-item", isActive ? "is-active" : ""].filter(Boolean).join(" ")}
                onClick={item.action}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="member-dashboard__sidebar-footer">
          <div className="admin-dashboard__profile-actions member-dashboard__footer-actions">
            {secondaryNavigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.label;

              return (
                <button
                  key={item.label}
                  type="button"
                  className={[
                    "admin-dashboard__nav-item",
                    isActive ? "is-active" : "",
                    item.tone === "danger" ? "is-danger" : "",
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

          <div className="admin-dashboard__profile member-dashboard__profile-card">
            <div className="admin-dashboard__profile-info">
              <div className="admin-dashboard__profile-avatar">
                <img src="/logo/upu-logo.svg" alt="Member profile" />
              </div>
              <div>
                <div className="admin-dashboard__profile-name">Member</div>
                <div className="admin-dashboard__profile-email">agbaraonome@gmail.com</div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="admin-dashboard__main member-dashboard__main">
        <section className="admin-dashboard__hero member-dashboard__hero member-settings-page__hero">
          <div>
            <h1>Settings</h1>
            <p>Manage your member profile, account access, and notification preferences.</p>
          </div>
        </section>

        <form className="member-settings-page__content" onSubmit={handleSaveSettings}>
          <section className="settings-page__panel member-settings-page__panel">
            <div className="settings-page__section-header settings-page__section-header--row">
              <div>
                <h2>Profile Information</h2>
                <p>Keep your personal details up to date for the member community.</p>
              </div>
            </div>

            <div className="settings-page__form-grid member-settings-page__form-grid">
              <label className="settings-page__field">
                <span>Full name</span>
                <input
                  value={profile.fullName}
                  onChange={(event) => handleProfileChange("fullName", event.target.value)}
                  placeholder="Enter full name"
                />
              </label>

              <label className="settings-page__field">
                <span>Email address</span>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(event) => handleProfileChange("email", event.target.value)}
                  placeholder="Enter email address"
                />
              </label>

              <label className="settings-page__field">
                <span>Phone number</span>
                <input
                  value={profile.phone}
                  onChange={(event) => handleProfileChange("phone", event.target.value)}
                  placeholder="Enter phone number"
                />
              </label>

              <label className="settings-page__field">
                <span>Location</span>
                <input
                  value={profile.location}
                  onChange={(event) => handleProfileChange("location", event.target.value)}
                  placeholder="Enter location"
                />
              </label>
            </div>
          </section>

          <section className="settings-page__panel member-settings-page__panel">
            <div className="settings-page__section-header settings-page__section-header--row">
              <div>
                <h2>Security & Preferences</h2>
                <p>Control how you sign in and receive member updates.</p>
              </div>
            </div>

            <div className="settings-page__form-grid member-settings-page__form-grid">
              <label className="settings-page__field">
                <span>Current password</span>
                <input
                  type="password"
                  value={password.current}
                  onChange={(event) => handlePasswordChange("current", event.target.value)}
                  placeholder="Enter current password"
                />
              </label>

              <label className="settings-page__field">
                <span>New password</span>
                <input
                  type="password"
                  value={password.next}
                  onChange={(event) => handlePasswordChange("next", event.target.value)}
                  placeholder="Enter new password"
                />
              </label>

              <label className="settings-page__field">
                <span>Confirm password</span>
                <input
                  type="password"
                  value={password.confirm}
                  onChange={(event) => handlePasswordChange("confirm", event.target.value)}
                  placeholder="Confirm new password"
                />
              </label>

              <div className="member-settings-page__preference-grid">
                <div className="settings-page__field">
                  <span>Email notifications</span>
                  <button
                    type="button"
                    className={[
                      "member-settings-page__toggle",
                      emailNotifications ? "is-active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => setEmailNotifications((current) => !current)}
                  >
                    {emailNotifications ? "Enabled" : "Disabled"}
                  </button>
                </div>

                <div className="settings-page__field">
                  <span>SMS notifications</span>
                  <button
                    type="button"
                    className={[
                      "member-settings-page__toggle",
                      smsNotifications ? "is-active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => setSmsNotifications((current) => !current)}
                  >
                    {smsNotifications ? "Enabled" : "Disabled"}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <div className="settings-page__actions member-settings-page__actions">
            <button type="button" className="settings-page__button settings-page__button--secondary" onClick={() => navigate("/member")}> 
              Cancel
            </button>
            <button type="submit" className="settings-page__button settings-page__button--primary">
              Save changes
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
