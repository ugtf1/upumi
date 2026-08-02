import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { IconType } from "react-icons";
import {
  FiCalendar,
  FiCheckCircle,
  FiDollarSign,
  FiHome,
  FiLogOut,
  FiSettings,
  FiTrendingDown,
  FiTrendingUp,
  FiUserCheck,
  FiUsers,
  FiXCircle,
} from "react-icons/fi";

import {
  clearToken,
  getMemberProfile,
  getAllTransactionsReadOnly,
  getAllDuesReadOnly,
  getHostingSchedule,
  getAllAttendanceReadOnly,
  getMemberYearlyBalances,
  type MemberYearlyBalanceApiRow,
} from "./api";
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
    address?: string | null;
    whatsapp?: string | null;
    facebook?: string | null;
    insurance?: string | null;
    status?: string | null;
    dateJoined?: string | null;
    voteRole?: string | null;
    goodStanding?: string | null;
    financialGoodStanding?: string | null;
    attendancePct?: string | null;
    attendanceCount?: number | null;
    totalMeetings?: number | null;
    monthlyDuesAmount?: number | null;
    totalPaid?: number | null;
    outstanding?: number | null;
  } | null;
  linked?: { userId?: string | null; memberRecordId?: string | null; memberKey?: string | null; displayMemberId?: string | null } | null;
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

type DueApiRow = {
  id: string;
  memberRecordId?: string;
  year?: number;
  month?: number;
  duesPaid: string | number;
  createdAt?: string;
  member?: { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null };
};

type HostingApiRow = {
  id: string;
  year: number;
  month: number;
  hostMember: string;
};

type AttendanceApiRow = {
  id: string;
  year: number;
  month: number;
  usersIn: string;
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
  const [error, setError] = useState<string | null>(null);

  // All-platform transaction rows (filtered strictly for this member)
  const [allTxRows, setAllTxRows] = useState<AllTransactionRow[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState<string | null>(null);

  // Hosting & Attendance
  const [hostingSchedule, setHostingSchedule] = useState<HostingApiRow[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceApiRow[]>([]);
  const [attendanceYear, setAttendanceYear] = useState<number>(new Date().getFullYear());

  // Pagination
  const [txPage, setTxPage] = useState(1);

  // Member Yearly Balance
  const myb_YEAR_OPTIONS = Array.from({ length: new Date().getFullYear() - 2018 + 1 }, (_, i) => 2018 + i).reverse();
  const [mybBalances, setMybBalances] = useState<MemberYearlyBalanceApiRow[]>([]);
  const [mybSelectedYear, setMybSelectedYear] = useState<number>(new Date().getFullYear() - 1);
  const [mybLoading, setMybLoading] = useState(false);

  // Fetch member profile on mount (for summary cards + chart)
  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        const profile = (await getMemberProfile()) as MemberProfileResponse;
        setMemberProfile(profile);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Failed to load account data";
        setError(errMsg);
      }
    };
    fetchData();
  }, []);

  // Fetch this member's own yearly balances
  useEffect(() => {
    let active = true;
    setMybLoading(true);
    getMemberYearlyBalances()
      .then((rows) => { if (active) setMybBalances(rows || []); })
      .catch(() => { if (active) setMybBalances([]); })
      .finally(() => { if (active) setMybLoading(false); });
    return () => { active = false; };
  }, []);

  // Member identifiers derived from profile
  const memberUserId = memberProfile?.linked?.userId ?? null;
  const memberRecordId = memberProfile?.linked?.memberRecordId ?? null;
  const memberKey = memberProfile?.linked?.memberKey ?? null;
  const memberFullName = memberProfile?.member
    ? `${memberProfile.member.firstName ?? ""} ${memberProfile.member.lastName ?? ""}`.toLowerCase().trim()
    : "";

  useEffect(() => {
    let active = true;
    setTxLoading(true);
    setTxError(null);

    Promise.all([
      getAllTransactionsReadOnly() as Promise<{ id: string; userId?: string | null; fullName: string; title: string; amount: string | number; date: string }[]>,
      getAllDuesReadOnly() as Promise<DueApiRow[]>,
      getHostingSchedule().catch(() => []) as Promise<HostingApiRow[]>,
      getAllAttendanceReadOnly().catch(() => []) as Promise<AttendanceApiRow[]>,
    ])
      .then(([txRows, dueRows, hostingData, attendanceData]) => {
        if (!active) return;

        setHostingSchedule(hostingData || []);
        setAttendanceRows(attendanceData || []);

        // 1. Only show transactions strictly belonging to this member
        const txNorm: AllTransactionRow[] = txRows
          .filter((row) => {
            if (memberUserId && row.userId === memberUserId) return true;
            if (memberFullName && row.fullName?.toLowerCase().includes(memberFullName)) return true;
            return false;
          })
          .map((row) => ({
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
            isDue: row.title.toLowerCase().includes("due"),
          }));

        // 2. Filter dues to only show records belonging to this member
        const memberDueRows = dueRows.filter((row) => {
          if (memberRecordId && row.memberRecordId === memberRecordId) return true;
          if (memberKey && row.memberRecordId === memberKey) return true;
          const dueName = row.member
            ? [row.member.firstName, row.member.lastName].filter(Boolean).join(" ").toLowerCase()
            : "";
          if (memberFullName && dueName && dueName === memberFullName) return true;
          return false;
        });

        const dueNorm: AllTransactionRow[] = memberDueRows.map((row) => {
          const monthIdx = (row.month ?? 1) - 1;
          const monthName = MONTH_OPTIONS_LONG[monthIdx] ?? String(row.month);
          const fullName = memberProfile?.member
            ? `${memberProfile.member.firstName ?? ""} ${memberProfile.member.lastName ?? ""}`.trim() || "Member"
            : "Member";
          return {
            id: row.id,
            date: row.createdAt
              ? new Date(row.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
              : "-",
            fullName,
            title: `Monthly Dues \u2013 ${monthName} ${row.year ?? ""}`,
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
  }, [memberUserId, memberRecordId, memberKey, memberFullName, memberProfile]);

  // Pagination derived
  const txTotalPages = Math.max(1, Math.ceil(allTxRows.length / TX_PAGE_SIZE));
  const paginatedRows = useMemo(() => {
    const start = (txPage - 1) * TX_PAGE_SIZE;
    return allTxRows.slice(start, start + TX_PAGE_SIZE);
  }, [allTxRows, txPage]);

  // Summary cards — Total Paid sums all dues entries from both Transaction page and MemberView page
  const summaryCards = useMemo<SummaryCard[]>(() => {
    if (!memberProfile?.member) {
      return [
        { title: "My Balance", subtitle: "Current", value: "...", delta: "loading", trend: "up", icon: FiDollarSign },
        { title: "Total Paid", subtitle: "Monthly Dues", value: "...", delta: "loading", trend: "up", icon: FiDollarSign },
        { title: "Meetings Attended", subtitle: "Database Attendance", value: "...", delta: "loading", trend: "up", icon: FiUserCheck },
        { title: "Outstanding", subtitle: "Due", value: "...", delta: "loading", trend: "down", icon: FiDollarSign },
      ];
    }
    const dues = memberProfile.monthlyDues || [];
    // Sum duesPaid from MonthlyDue records (canonical source)
    const totalPaidFromDues = dues.reduce((sum: number, d: MonthlyDueRecord) => sum + (d.duesPaid ?? 0), 0);
    // Also sum dues transactions from the transactions table
    const totalPaidFromTxDues = allTxRows
      .filter((r) => r.isDue)
      .reduce((sum, r) => sum + r.rawAmount, 0);
    // Use whichever is larger (avoids double counting when both point to same MonthlyDue)
    const unifiedTotalPaid = Math.max(totalPaidFromDues, totalPaidFromTxDues, memberProfile.member.totalPaid ?? 0);
    const currentBalance = dues.length > 0 ? dues[dues.length - 1].duesPaid ?? 0 : 0;
    const outstanding = Math.max(0, (dues.length * 20) - unifiedTotalPaid);

    const count = memberProfile.member.attendanceCount ?? 0;
    const totalM = memberProfile.member.totalMeetings ?? 0;
    const pct = memberProfile.member.attendancePct ?? "0";

    return [
      { title: "My Balance", subtitle: "Current", value: formatCurrency(currentBalance), delta: "Current", trend: "up", icon: FiDollarSign },
      { title: "Total Paid", subtitle: "All Dues (Unified)", value: formatCurrency(unifiedTotalPaid), delta: "All Sources", trend: "up", icon: FiDollarSign },
      { title: "Meetings Attended", subtitle: `${pct}% Attendance Rate`, value: `${count} / ${totalM}`, delta: `${pct}%`, trend: "up", icon: FiUserCheck },
      { title: "Outstanding", subtitle: "Dues Balance", value: formatCurrency(outstanding), delta: "Balance", trend: "down", icon: FiDollarSign },
    ];
  }, [memberProfile, allTxRows]);


  // Build attendance map for selected year from live database records
  const memberAttendanceMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const att of attendanceRows) {
      if (att.year !== attendanceYear) continue;
      const usersInList = String(att.usersIn ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
      const isPresent =
        (memberUserId && usersInList.includes(memberUserId.toLowerCase())) ||
        (memberRecordId && usersInList.includes(memberRecordId.toLowerCase())) ||
        (memberKey && usersInList.includes(memberKey.toLowerCase())) ||
        (memberFullName.length > 0 && usersInList.some((u) => u.includes(memberFullName) || memberFullName.includes(u)));
      map.set(`${att.year}-${att.month}`, isPresent);
    }
    return map;
  }, [attendanceRows, attendanceYear, memberUserId, memberRecordId, memberKey, memberFullName]);

  // Filter hosting records assigned to this member
  const memberHostingSchedule = useMemo(() => {
    return hostingSchedule.filter((h) => {
      const hostLower = (h.hostMember || "").toLowerCase();
      if (memberFullName && hostLower.includes(memberFullName)) return true;
      if (memberKey && hostLower.includes((memberKey || "").toLowerCase())) return true;
      return false;
    });
  }, [hostingSchedule, memberFullName, memberKey]);

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

          {/* Member profile info card */}
          {memberProfile?.member && (
            <section className="member-account__profile-card">
              <div className="member-account__profile-card-header">
                <div className="member-account__profile-avatar" aria-hidden="true" style={{ width: "48px", height: "48px", fontSize: "1.4rem" }}>
                  {memberName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="member-account__profile-name" style={{ fontSize: "1.1rem" }}>{memberName}</div>
                  <div className="member-account__profile-email">
                    {memberProfile.linked?.displayMemberId ? `ID: ${memberProfile.linked.displayMemberId} · ` : ""}
                    {memberProfile.member.status || "Active"}
                  </div>
                </div>
              </div>
              <div className="member-account__profile-info-grid">
                {memberProfile.member.email && (
                  <div className="member-account__profile-info-item">
                    <span className="member-account__profile-info-label">Email</span>
                    <span className="member-account__profile-info-value">{memberProfile.member.email}</span>
                  </div>
                )}
                {memberProfile.member.phone && (
                  <div className="member-account__profile-info-item">
                    <span className="member-account__profile-info-label">Phone</span>
                    <span className="member-account__profile-info-value">{memberProfile.member.phone}</span>
                  </div>
                )}
                {memberProfile.member.whatsapp && (
                  <div className="member-account__profile-info-item">
                    <span className="member-account__profile-info-label">WhatsApp</span>
                    <span className="member-account__profile-info-value">{memberProfile.member.whatsapp}</span>
                  </div>
                )}
                {memberProfile.member.facebook && (
                  <div className="member-account__profile-info-item">
                    <span className="member-account__profile-info-label">Facebook</span>
                    <span className="member-account__profile-info-value">{memberProfile.member.facebook}</span>
                  </div>
                )}
                {memberProfile.member.address && (
                  <div className="member-account__profile-info-item">
                    <span className="member-account__profile-info-label">Address</span>
                    <span className="member-account__profile-info-value">{memberProfile.member.address}</span>
                  </div>
                )}
                {memberProfile.member.dateJoined && (
                  <div className="member-account__profile-info-item">
                    <span className="member-account__profile-info-label">Joined</span>
                    <span className="member-account__profile-info-value">
                      {new Date(memberProfile.member.dateJoined).toLocaleDateString(undefined, { year: "numeric", month: "long" })}
                    </span>
                  </div>
                )}
                {memberProfile.member.voteRole && (
                  <div className="member-account__profile-info-item">
                    <span className="member-account__profile-info-label">Voter Status</span>
                    <span className="member-account__profile-info-value">{memberProfile.member.voteRole}</span>
                  </div>
                )}
                {memberProfile.member.goodStanding && (
                  <div className="member-account__profile-info-item">
                    <span className="member-account__profile-info-label">Good Standing</span>
                    <span className="member-account__profile-info-value">{memberProfile.member.goodStanding}</span>
                  </div>
                )}
                {memberProfile.member.financialGoodStanding && (
                  <div className="member-account__profile-info-item">
                    <span className="member-account__profile-info-label">Financial Standing</span>
                    <span className="member-account__profile-info-value">{memberProfile.member.financialGoodStanding}</span>
                  </div>
                )}
                {memberProfile.member.insurance && (
                  <div className="member-account__profile-info-item">
                    <span className="member-account__profile-info-label">Insurance</span>
                    <span className="member-account__profile-info-value">{memberProfile.member.insurance}</span>
                  </div>
                )}
                {memberProfile.member.totalMeetings != null ? (
                  <div className="member-account__profile-info-item">
                    <span className="member-account__profile-info-label">Live Attendance</span>
                    <span className="member-account__profile-info-value">
                      {memberProfile.member.attendanceCount ?? 0} / {memberProfile.member.totalMeetings} Meetings ({memberProfile.member.attendancePct ?? 0}%)
                    </span>
                  </div>
                ) : memberProfile.member.attendancePct ? (
                  <div className="member-account__profile-info-item">
                    <span className="member-account__profile-info-label">Attendance</span>
                    <span className="member-account__profile-info-value">{memberProfile.member.attendancePct}%</span>
                  </div>
                ) : null}
              </div>
            </section>
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

            {/* Member Yearly Balance (read-only, member's own records) */}
            <article className="member-account__card member-account__summary-card">
              <div className="member-account__summary-head">
                <div className="member-account__summary-icon">
                  <FiDollarSign size={22} />
                </div>
                <div className="member-account__summary-copy">
                  <h2>My Yearly Balance</h2>
                  <select
                    value={mybSelectedYear}
                    onChange={(e) => setMybSelectedYear(Number(e.target.value))}
                    style={{
                      marginTop: "4px", padding: "2px 8px", borderRadius: "4px",
                      border: "1px solid #cbd5e1", fontSize: "0.8rem", outline: "none",
                      backgroundColor: "#f8fafc", color: "#475569", fontWeight: 600,
                    }}
                  >
                    {myb_YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div className="member-account__summary-footer">
                {mybLoading ? (
                  <strong style={{ color: "#94a3b8" }}>Loading...</strong>
                ) : (() => {
                  const rec = mybBalances.find(b => b.year === mybSelectedYear);
                  return rec
                    ? <strong>${Number(rec.balance).toLocaleString()}</strong>
                    : <strong style={{ color: "#94a3b8" }}>No Record</strong>;
                })()}
              </div>
            </article>

            <article className="member-account__card member-account__status-card">
              <h2>Membership Status</h2>
              <button type="button" className="member-account__status-button" disabled>
                {memberProfile?.member?.status || "Loading..."}
              </button>
            </article>
          </section>

          {/* ── Hosting & Attendance Records Section ─────────────────────────── */}
          <section className="member-account__card" style={{ padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "#191d1c" }}>My Hosting &amp; Attendance Records</h2>
                <p style={{ margin: "4px 0 0", color: "#8d8d8b", fontSize: "0.88rem" }}>Live records read directly from the database</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "#64748b" }}>Year:</span>
                <select
                  value={attendanceYear}
                  onChange={(e) => setAttendanceYear(Number(e.target.value))}
                  style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", backgroundColor: "#f8fafc", fontSize: "0.9rem", fontWeight: 600, color: "#334155" }}
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Monthly Attendance Grid */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#334155", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <FiUserCheck size={18} color="#10b981" />
                <span>Monthly Meeting Attendance ({attendanceYear})</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(78px, 1fr))", gap: "10px" }}>
                {MONTH_OPTIONS_SHORT.map((mShort, idx) => {
                  const mNum = idx + 1;
                  const key = `${attendanceYear}-${mNum}`;
                  const isPresentInDb = memberAttendanceMap.get(key) === true;
                  const profileDue = memberProfile?.monthlyDues?.find((d) => d.year === attendanceYear && d.month === mNum);
                  const isPresent = isPresentInDb || profileDue?.present === true;
                  return (
                    <div key={mShort} style={{ padding: "10px 6px", borderRadius: "10px", textAlign: "center", border: isPresent ? "1px solid #a7f3d0" : "1px solid #e2e8f0", backgroundColor: isPresent ? "#ecfdf5" : "#f8fafc" }}>
                      <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b" }}>{mShort}</div>
                      <div style={{ margin: "6px 0", display: "flex", justifyContent: "center" }}>
                        {isPresent ? <FiCheckCircle size={20} color="#059669" /> : <FiXCircle size={20} color="#94a3b8" />}
                      </div>
                      <span style={{ fontSize: "0.7rem", fontWeight: 600, color: isPresent ? "#047857" : "#64748b" }}>
                        {isPresent ? "Present" : "Absent"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hosting Schedule */}
            <div>
              <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#334155", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <FiCalendar size={18} color="#0284c7" />
                <span>Hosting Schedule Assignments</span>
              </div>
              {memberHostingSchedule.length === 0 ? (
                <div style={{ padding: "16px", borderRadius: "10px", backgroundColor: "#f8fafc", border: "1px dashed #cbd5e1", color: "#64748b", fontSize: "0.9rem", textAlign: "center" }}>
                  No hosting assignments found for your account.
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
                  {memberHostingSchedule.map((h) => (
                    <div key={h.id} style={{ padding: "14px", borderRadius: "12px", border: "1px solid #bae6fd", backgroundColor: "#f0f9ff", display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "38px", height: "38px", borderRadius: "10px", backgroundColor: "#0284c7", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>
                        <FiCalendar size={20} />
                      </div>
                      <div>
                        <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0369a1" }}>
                          {MONTH_OPTIONS_LONG[h.month - 1]} {h.year}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "#0c4a6e", marginTop: "2px" }}>Group: {h.hostMember}</div>
                        <span style={{ display: "inline-block", marginTop: "4px", padding: "2px 8px", borderRadius: "999px", backgroundColor: "#0284c7", color: "#fff", fontSize: "0.7rem", fontWeight: 700 }}>
                          Your Hosting Month
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* All platform transactions table */}
          <section className="member-account__card member-account__table-card">
            <div style={{ marginBottom: "16px" }}>
              <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "#191d1c" }}>My Recent Transactions</h2>
              <p style={{ margin: "4px 0 0", color: "#8d8d8b", fontSize: "0.88rem" }}>
                {txLoading ? "Loading..." : `${allTxRows.length} transaction${allTxRows.length !== 1 ? "s" : ""} recorded for you — all categories`}
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
                    <th>Title / Category</th>
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
