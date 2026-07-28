import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { IconType } from "react-icons";
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

import { clearToken, getMemberProfile, getAllTransactionsReadOnly, getAllDuesReadOnly } from "./api";
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

type AllTransactionRow = {
  id: string;
  date: string;
  fullName: string;
  title: string;
  amount: string;
  status: string;
  rawDate: string;
  rawAmount: number;
  isDue?: boolean;
};



const MONTH_OPTIONS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_OPTIONS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const TX_PAGE_SIZE = 10;

export default function MemberAccount() {
  const navigate = useNavigate();

  // Member profile for sidebar / summary cards
  const [memberProfile, setMemberProfile] = useState<MemberProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // All-platform transaction rows
  const [allTxRows, setAllTxRows] = useState<AllTransactionRow[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState<string | null>(null);

  // Pagination
  const [txPage, setTxPage] = useState(1);

  // Fetch member profile on mount (for summary cards + chart)
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
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch ALL platform transactions + dues on mount
  useEffect(() => {
    let active = true;
    setTxLoading(true);
    setTxError(null);

    Promise.all([
      getAllTransactionsReadOnly() as Promise<{ id: string; fullName: string; title: string; amount: string | number; date: string }[]>,
      getAllDuesReadOnly() as Promise<{ id: string; memberRecordId?: string; year?: number; month?: number; duesPaid: string | number; createdAt?: string; member?: { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null } }[]>,
    ])
      .then(([txRows, dueRows]) => {
        if (!active) return;

        const txNorm: AllTransactionRow[] = txRows.map((row) => ({
          id: row.id,
          date: row.date
            ? new Date(row.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
            : "-",
          fullName: row.fullName,
          title: row.title,
          amount: `$${Number(row.amount ?? 0).toLocaleString()}`,
          status: "Completed",
          rawDate: row.date || "",
          rawAmount: Number(row.amount ?? 0),
          isDue: false,
        }));

        const dueNorm: AllTransactionRow[] = dueRows.map((row) => {
          const monthIdx = (row.month ?? 1) - 1;
          const monthName = MONTH_OPTIONS_LONG[monthIdx] ?? String(row.month);
          const fullName = row.member
            ? [row.member.firstName, row.member.lastName].filter(Boolean).join(" ") || row.member.email || "Unnamed member"
            : "Unnamed member";
          return {
            id: row.id,
            date: row.createdAt
              ? new Date(row.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
              : "-",
            fullName,
            title: `Monthly Dues – ${monthName} ${row.year ?? ""}`,
            amount: `$${Number(row.duesPaid ?? 0).toLocaleString()}`,
            status: "Completed",
            rawDate: row.createdAt || "",
            rawAmount: Number(row.duesPaid ?? 0),
            isDue: true,
          };
        });

        const combined = [...txNorm, ...dueNorm].sort(
          (a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime()
        );
        setAllTxRows(combined);
      })
      .catch((err: Error) => {
        if (active) setTxError(err?.message ?? "Failed to load transactions");
      })
      .finally(() => {
        if (active) setTxLoading(false);
      });

    return () => { active = false; };
  }, []);

  // Pagination derived
  const txTotalPages = Math.max(1, Math.ceil(allTxRows.length / TX_PAGE_SIZE));
  const paginatedRows = useMemo(() => {
    const start = (txPage - 1) * TX_PAGE_SIZE;
    return allTxRows.slice(start, start + TX_PAGE_SIZE);
  }, [allTxRows, txPage]);

  // Summary cards from member dues history
  const summaryCards = useMemo<SummaryCard[]>(() => {
    if (!memberProfile?.linked || !memberProfile?.member) {
      return [
        { title: "My Balance", subtitle: "Current", value: "...", delta: "loading", trend: "up", icon: FiDollarSign },
        { title: "Total Paid", subtitle: "This year", value: "...", delta: "loading", trend: "up", icon: FiDollarSign },
        { title: "Outstanding", subtitle: "Due", value: "...", delta: "loading", trend: "down", icon: FiDollarSign },
      ];
    }
    const dues = memberProfile.monthlyDues || [];
    const totalPaid = dues.reduce((sum: number, d: MonthlyDueRecord) => sum + (d.duesPaid ?? 0), 0);
    const currentBalance = dues.length > 0 ? dues[dues.length - 1].duesPaid ?? 0 : 0;
    const outstanding = dues.reduce((sum: number, d: MonthlyDueRecord) => {
      return sum + (d.duesPaid && d.duesPaid > 0 ? 0 : 20);
    }, 0);
    return [
      { title: "My Balance", subtitle: "Current", value: formatCurrency(currentBalance), delta: "0.43%", trend: "up", icon: FiDollarSign },
      { title: "Total Paid", subtitle: "This year", value: formatCurrency(totalPaid), delta: "0.43%", trend: "up", icon: FiDollarSign },
      { title: "Outstanding", subtitle: "Due", value: formatCurrency(outstanding), delta: "0.43%", trend: "down", icon: FiDollarSign },
    ];
  }, [memberProfile]);

  // Monthly chart data
  const monthlyBalanceData = useMemo(() => {
    if (!memberProfile?.linked || !memberProfile?.monthlyDues) return [];
    return memberProfile.monthlyDues.map((d: MonthlyDueRecord) => ({
      month: MONTH_OPTIONS_SHORT[d.month - 1] || `M${d.month}`,
      value: d.duesPaid ?? 0,
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
      action: () => navigate("/member/transaction", { state: { nav: "Transaction", sectionId: "member-dashboard-transaction" } }),
    },
    {
      label: "Account",
      icon: FiUsers,
      action: () => navigate("/member/account", { state: { nav: "Account", sectionId: "member-dashboard-membership" } }),
    },
  ];

  const sidebarFooterItems: NavigationItem[] = [
    { label: "Settings", icon: FiSettings, action: () => navigate("/member/settings") },
    { label: "Logout", icon: FiLogOut, tone: "danger", action: () => { clearToken(); navigate("/login"); } },
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
                    className={["member-account__nav-item", item.tone === "danger" ? "is-danger" : ""].filter(Boolean).join(" ")}
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
        <main className="member-account__content">
          {error && (
            <div style={{ padding: "1rem", backgroundColor: "#fee", color: "#c33", borderRadius: "4px", marginBottom: "1rem" }}>
              Error loading account data: {error}
            </div>
          )}

          {/* Summary cards */}
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
              <button type="button" className="member-account__status-button" disabled>
                {memberProfile?.member?.status || "Loading..."}
              </button>
            </article>
          </section>

          {/* Chart */}
          <section className="member-account__card member-account__chart-card">
            <div className="member-account__chart-legend">
              <span className="member-account__chart-dot" />
              <span>Monthly Dues Paid</span>
            </div>
            <div className="member-account__chart-shell">
              {loading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px" }}>Loading...</div>
              ) : monthlyBalanceData.length === 0 ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px" }}>No dues data available</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyBalanceData} margin={{ top: 34, right: 34, left: 8, bottom: 8 }}>
                    <CartesianGrid stroke="#edf1ee" strokeDasharray="0" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#a7afb4", fontSize: 14 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} domain={[0, "dataMax + 10"]} tick={{ fill: "#9ea8ad", fontSize: 14 }} dx={-10} />
                    <Tooltip
                      formatter={renderTooltipValue}
                      contentStyle={{ borderRadius: 14, border: "1px solid #dfe8e2", boxShadow: "0 16px 32px rgba(16, 27, 20, 0.08)" }}
                    />
                    <Line type="linear" dataKey="value" stroke="#13a594" strokeWidth={3} dot={{ r: 6, fill: "#119c8b", strokeWidth: 0 }} activeDot={{ r: 7, fill: "#119c8b", strokeWidth: 0 }}>
                      <LabelList dataKey="value" position="top" offset={12} fill="#18a294" fontSize={14} />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          {/* All platform transactions table */}
          <section className="member-account__card member-account__table-card">
            <div style={{ marginBottom: "16px" }}>
              <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "#191d1c" }}>Recent Transactions</h2>
              <p style={{ margin: "4px 0 0", color: "#8d8d8b", fontSize: "0.88rem" }}>
                {txLoading ? "Loading..." : `${allTxRows.length} transaction${allTxRows.length !== 1 ? "s" : ""} platform-wide`}
              </p>
            </div>

            {txError && (
              <div style={{ padding: "1rem", backgroundColor: "#fee", color: "#c33", borderRadius: "8px", marginBottom: "1rem" }}>
                {txError}
              </div>
            )}

            <div className="member-account__table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Full Name</th>
                    <th>Title</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {txLoading ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "#8d8d8b" }}>
                        Loading transactions...
                      </td>
                    </tr>
                  ) : allTxRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "#8d8d8b" }}>
                        No transactions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row) => (
                      <tr key={row.id}>
                        <td data-label="Date">{row.date}</td>
                        <td data-label="Full Name" className="member-account__table-name">{row.fullName}</td>
                        <td data-label="Title">
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span>{row.title}</span>
                            {row.isDue && (
                              <span style={{
                                display: "inline-flex", alignItems: "center", padding: "2px 8px",
                                fontSize: "0.75rem", fontWeight: 600, borderRadius: "999px",
                                backgroundColor: "rgba(19, 165, 148, 0.12)", color: "#0f7a6d", whiteSpace: "nowrap",
                              }}>
                                Dues
                              </span>
                            )}
                          </div>
                        </td>
                        <td data-label="Amount">{row.amount}</td>
                        <td data-label="Status">
                          <span style={{
                            display: "inline-flex", alignItems: "center", padding: "4px 12px",
                            borderRadius: "999px", fontSize: "0.82rem", fontWeight: 600,
                            backgroundColor: "#e6f4ea", color: "#137333",
                          }}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!txLoading && txTotalPages > 1 && (
              <div className="transaction-page__pagination" style={{ marginTop: "16px" }}>
                <button
                  type="button"
                  className="transaction-page__page-btn"
                  onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                  disabled={txPage === 1}
                  aria-label="Previous page"
                >
                  ← Prev
                </button>
                <span className="transaction-page__page-info">
                  Page {txPage} of {txTotalPages}
                </span>
                <button
                  type="button"
                  className="transaction-page__page-btn"
                  onClick={() => setTxPage((p) => Math.min(txTotalPages, p + 1))}
                  disabled={txPage === txTotalPages}
                  aria-label="Next page"
                >
                  Next →
                </button>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
