import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { IconType } from "react-icons";
// import { BsHeartFill } from "react-icons/bs";
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

import { clearToken, getMemberProfile } from "./api";
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

function formatCurrency(value: number | null | undefined) {
  if (value == null) return "$0";
  const sign = value && value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value ?? 0).toLocaleString()}`;
}

function renderTooltipValue(value: number | string | Array<number | string>) {
  if (Array.isArray(value)) return value.join(", ");
  return typeof value === "number" ? value.toLocaleString() : value;
}

type MonthlyDueRecord = {
  year: number;
  month: number;
  duesPaid?: number | null;
  present?: boolean | null;
};

type MemberProfileResponse = {
  member?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    status?: string | null;
    address?: string | null;
    dateJoined?: string | null;
    voteRole?: string | null;
    financialGoodStanding?: string | null;
  } | null;
  linked?: { userId?: string | null } | null;
  monthlyDues?: MonthlyDueRecord[];
};

export default function MemberAccount() {
  const navigate = useNavigate();

  // Data state
  const [memberProfile, setMemberProfile] = useState<MemberProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch member profile on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const profile = (await getMemberProfile()) as MemberProfileResponse;
        setMemberProfile(profile);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Failed to load account data";
        setError(errMsg);
        console.error("Member profile fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Build summary cards from live data
  const summaryCards = useMemo<SummaryCard[]>(() => {
    if (!memberProfile?.linked || !memberProfile?.member) {
      return [
        {
          title: "My Balance",
          subtitle: "Current",
          value: "...",
          delta: "loading",
          trend: "up",
          icon: FiDollarSign,
        },
        {
          title: "Total Paid",
          subtitle: "This year",
          value: "...",
          delta: "loading",
          trend: "up",
          icon: FiDollarSign,
        },
        {
          title: "Outstanding",
          subtitle: "Due",
          value: "...",
          delta: "loading",
          trend: "down",
          icon: FiDollarSign,
        },
      ];
    }

    const dues = memberProfile.monthlyDues || [];
    const totalPaid = dues.reduce((sum: number, d: MonthlyDueRecord) => sum + (d.duesPaid ?? 0), 0);
    const currentBalance = dues.length > 0 ? dues[dues.length - 1].duesPaid ?? 0 : 0;
    const outstanding = dues.reduce((sum: number, d: MonthlyDueRecord) => {
      return sum + (d.duesPaid && d.duesPaid > 0 ? 0 : 20); // Assuming $20 monthly due
    }, 0);

    return [
      {
        title: "My Balance",
        subtitle: "Current",
        value: formatCurrency(currentBalance),
        delta: "0.43%",
        trend: "up",
        icon: FiDollarSign,
      },
      {
        title: "Total Paid",
        subtitle: "This year",
        value: formatCurrency(totalPaid),
        delta: "0.43%",
        trend: "up",
        icon: FiDollarSign,
      },
      {
        title: "Outstanding",
        subtitle: "Due",
        value: formatCurrency(outstanding),
        delta: "0.43%",
        trend: "down",
        icon: FiDollarSign,
      },
    ];
  }, [memberProfile]);

  // Build monthly balance data from live data
  const monthlyBalanceData = useMemo(() => {
    if (!memberProfile?.linked || !memberProfile?.monthlyDues) {
      return [];
    }

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return memberProfile.monthlyDues.map((d: MonthlyDueRecord) => ({
      month: monthNames[d.month - 1] || `M${d.month}`,
      value: d.duesPaid ?? 0,
    }));
  }, [memberProfile]);

  // Build account rows from member data
  const accountRows: { hosting: string; fullName: string; balance: string; duesPaid: string; financialDS: string }[] = useMemo(() => {
    if (!memberProfile?.linked || !memberProfile?.member) {
      return [];
    }

    const member = memberProfile.member;
    const dues = memberProfile.monthlyDues || [];
    
    return dues.slice(0, 14).map((d: MonthlyDueRecord) => ({
      hosting: d.present ? "Yes" : "No",
      fullName: `${member.firstName || ""} ${member.lastName || ""}`.trim() || "Member",
      balance: formatCurrency(d.duesPaid),
      duesPaid: d.duesPaid ? "$" + d.duesPaid.toFixed(2) : "$0.00",
      financialDS: member.financialGoodStanding === "Yes" ? "YES" : "NO",
    }));
  }, [memberProfile]);

  const memberName = memberProfile?.member
    ? `${memberProfile.member.firstName || ""} ${memberProfile.member.lastName || ""}`.trim() || "Member"
    : "Member";

  const memberEmail = memberProfile?.member?.email || "member@upumi.org";

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
                {memberName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="member-account__profile-name">{memberName}</div>
                <div className="member-account__profile-email">{memberEmail}</div>
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
          {error && (
            <div style={{ padding: "1rem", backgroundColor: "#fee", color: "#c33", borderRadius: "4px", marginBottom: "1rem" }}>
              Error loading account data: {error}
            </div>
          )}
          
          <section className="member-account__stats">
            {summaryCards.map((card) => {
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
                    {card.delta && card.delta !== "loading" ? (
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
              <button
                type="button"
                className="member-account__status-button"
                disabled
              >
                {memberProfile?.member?.status || "Loading..."}
              </button>
            </article>
          </section>

          <section className="member-account__card member-account__chart-card">
            <div className="member-account__chart-legend">
              <span className="member-account__chart-dot" />
              <span>Monthly Dues Paid</span>
            </div>

            <div className="member-account__chart-shell">
              {loading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px" }}>
                  Loading...
                </div>
              ) : monthlyBalanceData.length === 0 ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px" }}>
                  No dues data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyBalanceData} margin={{ top: 34, right: 34, left: 8, bottom: 8 }}>
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
                      domain={[0, "dataMax + 10"]}
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
              )}
            </div>
          </section>

          <section className="member-account__card member-account__table-card">
            <div className="member-account__table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Attendance</th>
                    <th>Full Name</th>
                    <th>Due Amount</th>
                    <th>Amount Paid</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "2rem" }}>
                        Loading...
                      </td>
                    </tr>
                  ) : accountRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "2rem" }}>
                        No dues history available
                      </td>
                    </tr>
                  ) : (
                    accountRows.map((row, index) => (
                      <tr key={`${row.fullName}-${index}`}>
                        <td data-label="Attendance">{row.hosting}</td>
                        <td data-label="Full Name" className="member-account__table-name">
                          {row.fullName}
                        </td>
                        <td data-label="Due Amount">$20</td>
                        <td data-label="Amount Paid">{row.duesPaid}</td>
                        <td data-label="Status">
                          <span className="member-account__status-pill">{row.financialDS}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
