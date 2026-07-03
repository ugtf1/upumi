import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { IconType } from "react-icons";
import {
  FiBell,
  FiCalendar,
  FiChevronDown,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiFilter,
  FiHome,
  FiLogOut,
  FiSearch,
  FiSettings,
  FiTrendingDown,
  FiTrendingUp,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import {
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { clearToken, getLedgerSummary, getAnalyticsSummary, getMonthlyReport, getHostingSchedule, getMemberProfile } from "./api";
import memberImage from "./upu-logo.svg";
import "./admin-page.scss";
import "./member-dashboard.scss";

type SummaryCardData = {
  title: string;
  subtitle: string;
  value: string;
  delta: string;
  trend: "up" | "down";
  icon: IconType;
};

type FinancialSnapshot = {
  income: number;
  expense: number;
  businessAccount: number;
  fundraiserAccount: number;
  balances: { label: string; amount: number }[];
};

type HostingScheduleRow = {
  month: string;
  hostingGroup: string;
};

type MemberRouteConfig = {
  path: string;
  label: string;
  sectionId: string;
};

const MEMBER_ROUTE_CONFIG: Record<string, MemberRouteConfig> = {
  "/member": {
    path: "/member",
    label: "Community Dashboard",
    sectionId: "member-dashboard-top",
  },
  "/member/transaction": {
    path: "/member/transaction",
    label: "Transaction",
    sectionId: "member-dashboard-transaction",
  },
  "/member/account": {
    path: "/member/account",
    label: "Account",
    sectionId: "member-dashboard-membership",
  },
  "/member/settings": {
    path: "/member/settings",
    label: "Settings",
    sectionId: "member-dashboard-financials",
  },
};

function formatCurrency(value: number | null | undefined) {
  if (value == null) return "$0";
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString()}`;
}

function renderTooltipValue(value: number | string | Array<number | string>) {
  if (Array.isArray(value)) return value.join(", ");
  return typeof value === "number" ? value.toLocaleString() : value;
}

export default function MemberDashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeNav, setActiveNav] = useState("Community Dashboard");
  const [headerSearch, setHeaderSearch] = useState("");
  const [membershipSearch, setMembershipSearch] = useState("");
  const [scheduleSearch, setScheduleSearch] = useState("");

type AnalyticsData = {
  kpis?: {
    totalMembers?: number;
    totalDues?: number;
  };
  membershipMix?: { status: string; count: number }[];
  duesByMonth?: { month: number; total: number }[];
};

type LedgerData = {
  ytd?: {
    income?: number;
    expense?: number;
  };
  accountBalances?: { title?: string; amount?: number }[];
};

type HostingScheduleApiRow = {
  month?: number;
  hostMember?: string;
};

type MemberProfileData = {
  member?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null;
};


  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [ledgerData, setLedgerData] = useState<LedgerData | null>(null);
  const [hostingRows, setHostingRows] = useState<HostingScheduleRow[]>([]);
  const [memberProfile, setMemberProfile] = useState<MemberProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const [analytics, ledger, , schedule, profile] = await Promise.all([
          getAnalyticsSummary(currentYear) as Promise<AnalyticsData>,
          getLedgerSummary(currentYear) as Promise<LedgerData>,
          getMonthlyReport(currentYear, currentMonth),
          getHostingSchedule().catch(() => [] as HostingScheduleApiRow[]),
          getMemberProfile().catch(() => null) as Promise<MemberProfileData | null>,
        ]);
        
        setAnalyticsData(analytics);
        setLedgerData(ledger);
        setMemberProfile(profile);

        const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        setHostingRows(
          (schedule as HostingScheduleApiRow[])
            .slice()
            .sort((a, b) => (a.month ?? 0) - (b.month ?? 0))
            .map((row) => ({
              month: MONTH_NAMES[(row.month ?? 1) - 1] ?? String(row.month),
              hostingGroup: row.hostMember ?? "",
            }))
        );
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Failed to load dashboard data";
        setError(errMsg);
        console.error("Dashboard data fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentYear, currentMonth]);

  useEffect(() => {
    const routeConfig = MEMBER_ROUTE_CONFIG[location.pathname] ?? MEMBER_ROUTE_CONFIG["/member"];
    const state = location.state as { nav?: string; sectionId?: string } | null;
    const nextLabel = state?.nav ?? routeConfig.label;
    const nextSectionId = state?.sectionId ?? routeConfig.sectionId;

    setActiveNav(nextLabel);

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(nextSectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });

      if (state) {
        navigate(location.pathname, { replace: true, state: null });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname, location.state, navigate]);

  // Build summary cards from live data
  const summaryCards = useMemo<SummaryCardData[]>(() => {
    if (!analyticsData || !ledgerData) {
      return [
        {
          title: "Total Members",
          subtitle: "This year",
          value: "...",
          delta: "loading",
          trend: "up",
          icon: FiUsers,
        },
        {
          title: "Active Members",
          subtitle: "This year",
          value: "...",
          delta: "loading",
          trend: "up",
          icon: FiUserCheck,
        },
        {
          title: "Total Revenue",
          subtitle: "YTD",
          value: "...",
          delta: "loading",
          trend: "up",
          icon: FiDollarSign,
        },
        {
          title: "Member Dues Paid",
          subtitle: "This year",
          value: "...",
          delta: "loading",
          trend: "up",
          icon: FiClock,
        },
      ];
    }

    const activeCount = analyticsData.membershipMix?.find((m) => m.status === "Active")?.count ?? 0;
    const totalMembers = analyticsData.kpis?.totalMembers ?? 0;
    const totalDues = analyticsData.kpis?.totalDues ?? 0;
    const ytdIncome = ledgerData.ytd?.income ?? 0;

    return [
      {
        title: "Total Members",
        subtitle: "This year",
        value: String(totalMembers),
        delta: "0.43%",
        trend: "up",
        icon: FiUsers,
      },
      {
        title: "Active Members",
        subtitle: "This year",
        value: String(activeCount),
        delta: "0.43%",
        trend: "up",
        icon: FiUserCheck,
      },
      {
        title: "Total Revenue",
        subtitle: "YTD",
        value: formatCurrency(ytdIncome),
        delta: "0.43%",
        trend: "up",
        icon: FiDollarSign,
      },
      {
        title: "Member Dues Paid",
        subtitle: "This year",
        value: formatCurrency(totalDues),
        delta: "0.98%",
        trend: "up",
        icon: FiClock,
      },
    ];
  }, [analyticsData, ledgerData]);

  // Build financial snapshot from live data
  const financialSnapshot = useMemo<FinancialSnapshot>(() => {
    if (!ledgerData) {
      return {
        income: 0,
        expense: 0,
        businessAccount: 0,
        fundraiserAccount: 0,
        balances: [],
      };
    }

    const income = ledgerData.ytd?.income ?? 0;
    const expense = ledgerData.ytd?.expense ?? 0;
    const balances = ledgerData.accountBalances ?? [];

    return {
      income,
      expense,
      businessAccount: balances.find((b) => b.title?.includes("Business"))?.amount ?? 0,
      fundraiserAccount: balances.find((b) => b.title?.includes("Fundraiser"))?.amount ?? 0,
      balances: balances.map((b) => ({ label: b.title ?? "", amount: b.amount ?? 0 })),
    };
  }, [ledgerData]);

  // Build YTD visual data from live data
  const ytdVisualData = useMemo(() => {
    if (!ledgerData) {
      return [
        { name: "Income YTD", value: 0, color: "#249b69" },
        { name: "Expense YTD", value: 0, color: "#145a3d" },
        { name: "Net", value: 0, color: "#76d08b" },
      ];
    }

    const income = ledgerData.ytd?.income ?? 0;
    const expense = ledgerData.ytd?.expense ?? 0;
    const net = income - expense;

    return [
      { name: "Income YTD", value: Math.abs(income), color: "#249b69" },
      { name: "Expense YTD", value: Math.abs(expense), color: "#145a3d" },
      { name: "Net", value: Math.max(0, net), color: "#76d08b" },
    ];
  }, [ledgerData]);

  // Build monthly visual data from live data
  const monthlyVisualData = useMemo(() => {
    if (!analyticsData || !analyticsData.duesByMonth) {
      return [];
    }

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return analyticsData.duesByMonth.slice(0, 5).map((m) => ({
      month: monthNames[m.month - 1] || `M${m.month}`,
      value: m.total,
    }));
  }, [analyticsData]);

  const scheduleRows = useMemo(() => {
    const query = `${membershipSearch} ${scheduleSearch}`.trim().toLowerCase();
    return hostingRows.filter((row) => {
      if (!query) return true;
      return `${row.month} ${row.hostingGroup}`.toLowerCase().includes(query);
    });
  }, [membershipSearch, scheduleSearch, hostingRows]);

  const pieLegend = useMemo(() => {
    const total = ytdVisualData.reduce((sum, item) => sum + item.value, 0);
    return ytdVisualData.map((entry) => ({
      ...entry,
      percentage: total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0.0",
    }));
  }, [ytdVisualData]);

  const primaryNavigationItems: { label: string; icon: IconType; action: () => void }[] = [
    {
      label: "Community Dashboard",
      icon: FiHome,
      action: () =>
        navigate("/member", {
          state: { nav: "Community Dashboard", sectionId: "member-dashboard-top" },
        }),
    },
    {
      label: "Transaction",
      icon: FiCreditCard,
      action: () =>
        navigate("/member/transaction", {
          state: { nav: "Transaction", sectionId: "member-dashboard-transaction" },
        }),
    },
    {
      label: "Account",
      icon: FiUsers,
      action: () =>
        navigate("/member/account", {
          state: { nav: "Account", sectionId: "member-dashboard-membership" },
        }),
    },
  ];

  const secondaryNavigationItems = [
    {
      label: "Settings",
      icon: FiSettings,
      action: () =>
        navigate("/member/settings", {
          state: { nav: "Settings", sectionId: "member-dashboard-financials" },
        }),
    },
    {
      label: "Logout",
      icon: FiLogOut,
      action: () => {
        clearToken();
        navigate("/login");
      },
      tone: "danger" as const,
    },
  ];

  return (
    <div className="admin-dashboard member-dashboard">
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

              return (
                <button
                  key={item.label}
                  type="button"
                  className={[
                    "admin-dashboard__nav-item",
                    activeNav === item.label ? "is-active" : "",
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
                <img src={memberImage} alt="Member profile" />
              </div>
              <div>
                <div className="admin-dashboard__profile-name">
                  {memberProfile?.member
                    ? `${memberProfile.member.firstName ?? ""} ${memberProfile.member.lastName ?? ""}`.trim() || "Member"
                    : "Member"}
                </div>
                <div className="admin-dashboard__profile-email">
                  {memberProfile?.member?.email ?? ""}
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="admin-dashboard__main member-dashboard__main">
        <section className="admin-dashboard__hero member-dashboard__hero" id="member-dashboard-top">
          <div>
            <h1>Community Dashboard</h1>
            <p>Pivot-style member details for all signed-in members.</p>
          </div>

          <div className="admin-dashboard__hero-actions member-dashboard__hero-actions">
            <label className="admin-dashboard__search member-dashboard__search">
              <input
                value={headerSearch}
                onChange={(event) => setHeaderSearch(event.target.value)}
                placeholder="Search member, expense, balance, income...."
                aria-label="Search dashboard"
              />
              <FiSearch size={18} />
            </label>

            <button type="button" className="admin-dashboard__icon-button" aria-label="Filter dashboard">
              <FiFilter size={18} />
            </button>
            <button type="button" className="admin-dashboard__icon-button" aria-label="Notifications">
              <FiBell size={18} />
            </button>
          </div>
        </section>

        <section className="admin-dashboard__stats member-dashboard__stats">
          {error && (
            <div style={{ gridColumn: "1 / -1", padding: "1rem", backgroundColor: "#fee", color: "#c33", borderRadius: "4px" }}>
              Error loading dashboard: {error}
            </div>
          )}
          {summaryCards.map((card) => {
            const Icon = card.icon;

            return (
              <article key={card.title} className="admin-dashboard__stat-card member-dashboard__stat-card">
                <div className="admin-dashboard__stat-icon">
                  <Icon size={20} />
                </div>

                <div className="admin-dashboard__stat-copy">
                  <h2>{card.title}</h2>
                  <p>{card.subtitle}</p>
                  <div className="admin-dashboard__stat-footer">
                    <strong>{card.value}</strong>
                    <span className={`admin-dashboard__trend admin-dashboard__trend--${card.trend}`}>
                      {card.delta} {card.trend === "up" ? <FiTrendingUp size={14} /> : <FiTrendingDown size={14} />}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="admin-dashboard__charts member-dashboard__charts" id="member-dashboard-transaction">
          <article className="admin-dashboard__panel member-dashboard__panel">
            <div className="admin-dashboard__panel-head">
              <span className="admin-dashboard__panel-dot" />
              <h3>Monthly Visual</h3>
            </div>

            <div className="admin-dashboard__chart-wrap member-dashboard__chart-wrap">
              {loading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px" }}>Loading...</div>
              ) : monthlyVisualData.length === 0 ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px" }}>No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyVisualData} margin={{ top: 18, right: 18, left: -14, bottom: 8 }}>
                    <CartesianGrid stroke="#dfe8e3" strokeDasharray="0" vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} stroke="#9aa59f" />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      stroke="#9aa59f"
                      domain={[0, "dataMax + 100"]}
                    />
                    <Tooltip formatter={renderTooltipValue} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#1aa892"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#1aa892", strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    >
                      <LabelList dataKey="value" position="top" fill="#1aa892" fontSize={12} />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </article>

          <article className="admin-dashboard__panel member-dashboard__panel">
            <div className="admin-dashboard__panel-head">
              <span className="admin-dashboard__panel-dot" />
              <h3>YTD Visual</h3>
            </div>

            <div className="admin-dashboard__pie-layout member-dashboard__pie-layout">
              <div className="admin-dashboard__pie-wrap member-dashboard__pie-wrap">
                {loading || ytdVisualData.length === 0 ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px" }}>
                    {loading ? "Loading..." : "No data"}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={ytdVisualData} dataKey="value" nameKey="name" innerRadius={0} outerRadius={98}>
                        {ytdVisualData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number | string | Array<number | string>) =>
                          formatCurrency(Number(Array.isArray(value) ? value[0] : value))
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="admin-dashboard__legend member-dashboard__legend">
                {pieLegend.map((entry) => (
                  <div key={entry.name} className="admin-dashboard__legend-item">
                    <span className="admin-dashboard__legend-swatch" style={{ backgroundColor: entry.color }} />
                    <span>
                      {entry.name}: {formatCurrency(entry.value)} ({entry.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </section>

        <section
          className="admin-dashboard__financial-grid member-dashboard__financial-grid"
          id="member-dashboard-financials"
        >
          {[0, 1].map((panelIndex) => (
            <FinancialPanel key={panelIndex} snapshot={financialSnapshot} />
          ))}
        </section>

        <section className="member-dashboard__membership" id="member-dashboard-membership">
          <div className="member-dashboard__section-copy">
            <h2>Membership Status</h2>
            <p>Pivot-style member table for all signed-in members. Click a name for full workbook-row details.</p>
          </div>

          <div className="member-dashboard__membership-toolbar">
            <div className="member-dashboard__filter-group">
              <span className="member-dashboard__filter-label">Year</span>
              <button type="button" className="member-dashboard__filter-pill" aria-label="Year filter set to 2026">
                <span>2026</span>
                <FiChevronDown size={16} />
              </button>
            </div>

            <div className="member-dashboard__filter-group">
              <span className="member-dashboard__filter-label">Hosting</span>
              <button
                type="button"
                className="member-dashboard__filter-pill"
                aria-label="Hosting filter set to January"
              >
                <span>January</span>
                <FiChevronDown size={16} />
              </button>
            </div>

            <label className="member-dashboard__filter-search" aria-label="Search membership status">
              <FiSearch size={18} />
              <input
                value={membershipSearch}
                onChange={(event) => setMembershipSearch(event.target.value)}
                placeholder="Search Name, hosting, status"
              />
            </label>
          </div>
        </section>

        <section className="admin-dashboard__panel member-dashboard__schedule-panel">
          <div className="admin-dashboard__schedule-head">
            <div className="admin-dashboard__section-copy member-dashboard__section-copy">
              <h2>Hosting Schedule</h2>
              <p>View and manage the monthly hosting groups</p>
            </div>
          </div>

          <div className="admin-dashboard__schedule-tools member-dashboard__schedule-tools">
            <label className="admin-dashboard__schedule-year member-dashboard__schedule-year">
              <FiCalendar size={20} />
              <select defaultValue="2026" aria-label="Hosting schedule year">
                <option value="2026">2026</option>
              </select>
            </label>

            <label className="admin-dashboard__search admin-dashboard__schedule-search member-dashboard__schedule-search">
              <input
                value={scheduleSearch}
                onChange={(event) => setScheduleSearch(event.target.value)}
                placeholder="Search member or month....."
                aria-label="Search hosting schedule"
              />
              <FiSearch size={18} />
            </label>
          </div>

          <div className="admin-dashboard__table-shell admin-dashboard__schedule-table-shell member-dashboard__table-shell">
            <div className="admin-dashboard__table-wrap admin-dashboard__schedule-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Hosting group</th>
                  </tr>
                </thead>
                <tbody>
                  {!scheduleRows.length ? (
                    <tr>
                      <td colSpan={2} className="admin-dashboard__empty-state">
                        No hosting schedule rows match the current search.
                      </td>
                    </tr>
                  ) : (
                    scheduleRows.map((row) => (
                      <tr key={row.month}>
                        <td data-label="Month">{row.month}</td>
                        <td data-label="Hosting group">{row.hostingGroup}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function FinancialPanel({ snapshot }: { snapshot: FinancialSnapshot }) {
  const cards = [
    { label: "Income YTD", value: formatCurrency(snapshot.income) },
    { label: "Expense YTD", value: formatCurrency(snapshot.expense) },
    { label: "Business Account", value: formatCurrency(snapshot.businessAccount) },
    { label: "Fundraiser Account", value: formatCurrency(snapshot.fundraiserAccount) },
  ];

  return (
    <article className="admin-dashboard__panel member-dashboard__panel">
      <h3 className="admin-dashboard__financial-title">Year-to-date financial summary</h3>

      <div className="admin-dashboard__finance-cards member-dashboard__finance-cards">
        {cards.map((card) => (
          <div key={card.label} className="admin-dashboard__finance-card member-dashboard__finance-card">
            <span className="member-dashboard__finance-label">
              <FiDollarSign size={12} />
              {card.label}
            </span>
            <strong>{card.value}</strong>
          </div>
        ))}
      </div>

      <div className="admin-dashboard__balance-table">
        <div className="admin-dashboard__balance-head">
          <span>Account</span>
          <span>Balance</span>
        </div>

        {snapshot.balances.map((balance) => (
          <div key={balance.label} className="admin-dashboard__balance-row">
            <span>{balance.label}</span>
            <strong>{formatCurrency(balance.amount)}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}
