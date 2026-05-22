import { useNavigate } from "react-router-dom";
import type { IconType } from "react-icons";
import { BsHeartFill } from "react-icons/bs";
import {
  FiDollarSign,
  FiHome,
  FiLogOut,
  FiSettings,
  FiTrendingDown,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";
import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { clearToken } from "./api";
import "./member-account.scss";

type NavigationItem = {
  label: string;
  icon: IconType;
  action: () => void;
  tone?: "default" | "danger";
};

type SummaryCard = {
  title: string;
  subtitle: string;
  value: string;
  delta?: string;
  trend?: "up" | "down";
  icon: IconType;
};

const SUMMARY_CARDS: SummaryCard[] = [
  {
    title: "My Balance",
    subtitle: "This month",
    value: "$560",
    delta: "0.43%",
    trend: "up",
    icon: FiDollarSign,
  },
  {
    title: "Total Paid",
    subtitle: "This month",
    value: "$1,500",
    delta: "0.43%",
    trend: "up",
    icon: FiDollarSign,
  },
  {
    title: "Outstanding",
    subtitle: "This month",
    value: "$65",
    delta: "0.43%",
    trend: "down",
    icon: FiDollarSign,
  },
];

const MONTHLY_BALANCE_DATA = [
  { month: "January", value: 2626 },
  { month: "February", value: 4982 },
  { month: "March", value: 3553 },
  { month: "April", value: 335 },
  { month: "May", value: 835 },
];

const ACCOUNT_ROWS = Array.from({ length: 14 }, () => ({
  hosting: "-",
  fullName: "Agbara Onome",
  balance: "$380",
  duesPaid: "$0",
  financialDS: "NO",
}));

function renderTooltipValue(value: number | string | Array<number | string>) {
  if (Array.isArray(value)) return value.join(", ");
  return typeof value === "number" ? value.toLocaleString() : value;
}

export default function MemberAccount() {
  const navigate = useNavigate();

  const sidebarItems: NavigationItem[] = [
    {
      label: "Community Dashboard",
      icon: FiHome,
      action: () => navigate("/member", { state: { nav: "Community Dashboard", sectionId: "member-dashboard-top" } }),
    },
    {
      label: "Transaction",
      icon: FiDollarSign,
      action: () =>
        navigate("/member/transaction", { state: { nav: "Transaction", sectionId: "member-dashboard-transaction" } }),
    },
    {
      label: "Account",
      icon: FiUsers,
      action: () =>
        navigate("/member/account", { state: { nav: "Account", sectionId: "member-dashboard-membership" } }),
    },
  ];

  const sidebarFooterItems: NavigationItem[] = [
    {
      label: "Settings",
      icon: FiSettings,
      action: () => navigate("/member/settings"),
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

  const topNavigation = [
    { label: "Home", action: () => navigate("/") },
    { label: "About", action: () => navigate("/about") },
    { label: "Events", action: () => navigate("/events") },
    { label: "Alumni", action: () => navigate("/alumni") },
  ];

  return (
    <div className="member-account">
      <aside className="member-account__sidebar">
        <div className="member-account__logo">
          <img src="/logo/upu-logo.svg" alt="UPUMI logo" />
          <span>UPUMI</span>
        </div>

        <div className="member-account__sidebar-body">
          <nav className="member-account__nav" aria-label="Member account navigation">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.label === "Account";

              return (
                <button
                  key={item.label}
                  type="button"
                  className={["member-account__nav-item", isActive ? "is-active" : ""].filter(Boolean).join(" ")}
                  onClick={item.action}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="member-account__sidebar-footer">
            <div className="member-account__sidebar-links">
              {sidebarFooterItems.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.label}
                    type="button"
                    className={[
                      "member-account__nav-item",
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

            <div className="member-account__profile">
              <div className="member-account__profile-avatar" aria-hidden="true">
                M
              </div>
              <div>
                <div className="member-account__profile-name">Member</div>
                <div className="member-account__profile-email">Agbaraono@gmail.com</div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="member-account__workspace">
        {/* <header className="member-account__topbar">
          <nav className="member-account__topnav" aria-label="Main site navigation">
            {topNavigation.map((item) => (
              <button
                key={item.label}
                type="button"
                className={["member-account__topnav-link", item.label === "About" ? "is-active" : ""]
                  .filter(Boolean)
                  .join(" ")}
                onClick={item.action}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="member-account__topbar-actions">
            <button type="button" className="member-account__donate-button">
              <span>DONATE</span>
              <BsHeartFill size={18} />
            </button>
            <button type="button" className="member-account__community-button" onClick={() => navigate("/register")}>
              Join Community
            </button>
          </div>
        </header> */}

        <main className="member-account__content">
          <section className="member-account__stats">
            {SUMMARY_CARDS.map((card) => {
              const Icon = card.icon;
              const TrendIcon = card.trend === "down" ? FiTrendingDown : FiTrendingUp;

              return (
                <article key={card.title} className="member-account__card member-account__summary-card">
                  <div className="member-account__summary-head">
                    <div className="member-account__summary-icon">
                      <Icon size={22} />
                    </div>

                    <div className="member-account__summary-copy">
                      <h2>{card.title}</h2>
                      <p>{card.subtitle}</p>
                    </div>
                  </div>

                  <div className="member-account__summary-footer">
                    <strong>{card.value}</strong>
                    {card.delta ? (
                      <span className={`member-account__trend member-account__trend--${card.trend}`}>
                        {card.delta} <TrendIcon size={14} />
                      </span>
                    ) : null}
                  </div>
                </article>
              );
            })}

            <article className="member-account__card member-account__status-card">
              <h2>Membership Status</h2>
              <button type="button" className="member-account__status-button">
                Active
              </button>
            </article>
          </section>

          <section className="member-account__card member-account__chart-card">
            <div className="member-account__chart-legend">
              <span className="member-account__chart-dot" />
              <span>Monthly Visual</span>
            </div>

            <div className="member-account__chart-shell">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={MONTHLY_BALANCE_DATA} margin={{ top: 34, right: 34, left: 8, bottom: 8 }}>
                  <CartesianGrid stroke="#edf1ee" strokeDasharray="0" vertical={false} />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#a7afb4", fontSize: 14 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 5000]}
                    ticks={[0, 1000, 2000, 3000, 4000, 5000]}
                    tick={{ fill: "#9ea8ad", fontSize: 14 }}
                    dx={-10}
                  />
                  <Tooltip
                    formatter={renderTooltipValue}
                    contentStyle={{
                      borderRadius: 14,
                      border: "1px solid #dfe8e2",
                      boxShadow: "0 16px 32px rgba(16, 27, 20, 0.08)",
                    }}
                  />
                  <Line
                    type="linear"
                    dataKey="value"
                    stroke="#13a594"
                    strokeWidth={3}
                    dot={{ r: 6, fill: "#119c8b", strokeWidth: 0 }}
                    activeDot={{ r: 7, fill: "#119c8b", strokeWidth: 0 }}
                  >
                    <LabelList dataKey="value" position="top" offset={12} fill="#18a294" fontSize={14} />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="member-account__card member-account__table-card">
            <div className="member-account__table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Hosting</th>
                    <th>Full Name</th>
                    <th>Balance</th>
                    <th>2026 dues paid</th>
                    <th>Financial DS</th>
                  </tr>
                </thead>
                <tbody>
                  {ACCOUNT_ROWS.map((row, index) => (
                    <tr key={`${row.fullName}-${index}`}>
                      <td data-label="Hosting">{row.hosting}</td>
                      <td data-label="Full Name" className="member-account__table-name">
                        {row.fullName}
                      </td>
                      <td data-label="Balance">{row.balance}</td>
                      <td data-label="2026 dues paid">{row.duesPaid}</td>
                      <td data-label="Financial DS">
                        <span className="member-account__status-pill">{row.financialDS}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
