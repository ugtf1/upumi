import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FiCalendar,
  FiCheck,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiHome,
  FiLogOut,
  FiPlus,
  FiSearch,
  FiSettings,
  FiUsers,
  FiX,
  FiChevronDown,
  FiChevronUp,
  FiTrash2,
  FiMic,
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

import { apiGet, apiPatch, apiPost, clearToken, getMeetings, deleteMeeting, Meeting } from "./api";
import YearlyBalanceManager from "./YearlyBalanceManager";
import MeetingRecorder from "./MeetingRecorder";
import ReportFilterModal from "./ReportFilterModal";
import "./admin-page.scss";
import "./meeting-recorder.scss";


type LedgerSummaryResponse = {
  year: number;
  accountBalances?: { title: string; amount: number }[];
  ytd?: { income: number; expense: number; net: number };
};

type FinancialSnapshot = {
  income: number;
  expense: number;
  businessAccount: number;
  fundraiserAccount: number;
  balances: { label: string; amount: number }[];
};

const MONTHLY_VISUAL_DATA = [
  { month: "Jan", value: 262 },
  { month: "Feb", value: 498 },
  { month: "Mar", value: 355 },
  { month: "Apr", value: 33 },
  { month: "May", value: 83 },
];

const YTD_VISUAL_DATA = [
  { name: "Expense YTD", value: 900, color: "#24a06b" },
  { name: "Income YTD", value: 2039, color: "#145a3d" },
  { name: "Net", value: 1139, color: "#79d28d" },
  { name: "FundRaiser Acct", value: 67, color: "#ff3b30" },
];

const FALLBACK_FINANCIALS: FinancialSnapshot = {
  income: 2039,
  expense: 900,
  businessAccount: 35687,
  fundraiserAccount: 90,
  balances: [
    { label: "Business", amount: 35521 },
    { label: "Fundraiser", amount: 90 },
  ],
};

type HostingScheduleRow = {
  month: string;
  hostingGroup: string;
};

// Shape returned by GET /admin/database/hostingSchedule, mirroring the Prisma
// HostingSchedule model (id, year, month, hostMember).
type HostingScheduleApiRow = {
  id: string;
  year: number;
  month: number;
  hostMember: string;
};

// Lightweight member option used to populate the "add members" picker,
// derived from the real User records in the database.
type HostingMemberOption = {
  id: string;
  name: string;
};

type AdminMemberResponse = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
};

type TransactionApiRow = {
  id: string;
  amount: string | number;
};

type MonthlyDueApiRow = {
  id: string;
  memberRecordId: string;
  year: number;
  month: number;
  duesPaid: string | number;
};

const MONTH_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

function monthLabel(month: number): string {
  return MONTH_OPTIONS.find((option) => option.value === month)?.label ?? String(month);
}

function memberDisplayName(member: AdminMemberResponse): string {
  const fullName = [member.firstName, member.lastName].filter(Boolean).join(" ").trim();
  return fullName || member.email || member.phone || "Unnamed member";
}

const YEAR_OPTIONS = [2024, 2025, 2026, 2027];

const HOSTING_SCHEDULE_ROWS: HostingScheduleRow[] = [
  { month: "January", hostingGroup: "Abada Evi, Abada Otuke, Agbara Onome" },
  { month: "February", hostingGroup: "Abada Evi, Abada Otuke, Agbara Onome, Atori Victoria" },
  { month: "March", hostingGroup: "Abada Evi, Abada Otuke, Agbara Onome" },
  { month: "April", hostingGroup: "Abada Evi, Abada Otuke, Agbara Onome" },
  { month: "May", hostingGroup: "Abada Evi, Abada Otuke, Agbara Onome, George Lovette" },
  { month: "June", hostingGroup: "Abada Evi, Abada Otuke, Agbara Onome" },
  { month: "July", hostingGroup: "Abada Evi, Abada Otuke, Agbara Onome, Warrence Paul" },
  { month: "August", hostingGroup: "Abada Evi, Abada Otuke, Agbara Onome" },
  { month: "September", hostingGroup: "Abada Evi, Abada Otuke, Agbara Onome" },
  { month: "October", hostingGroup: "Abada Evi, Abada Otuke, Agbara Onome" },
  { month: "November", hostingGroup: "Abada Evi, Abada Otuke, Agbara Onome" },
  { month: "December", hostingGroup: "Abada Evi, Abada Otuke, Agbara Onome" },
];

function formatCurrency(value: number | null | undefined) {
  if (value == null) return "$0";
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString()}`;
}

function getAccountAmount(
  accounts: { title: string; amount: number }[] | undefined,
  title: string,
  fallback: number
) {
  const match = (accounts ?? []).find((entry) => entry.title.trim().toLowerCase() === title.toLowerCase());
  return match?.amount ?? fallback;
}

function renderTooltipValue(value: number | string | Array<number | string>) {
  if (Array.isArray(value)) return value.join(", ");
  return typeof value === "number" ? value.toLocaleString() : value;
}

export default function AdminPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [ledgerSummary, setLedgerSummary] = useState<LedgerSummaryResponse | null>(null);
  const [totalMembers, setTotalMembers] = useState<number | null>(null);
  const [activeMembers, setActiveMembers] = useState<number | null>(null);
  const [totalRevenue, setTotalRevenue] = useState<number | null>(null);
  const [pendingPayment, setPendingPayment] = useState<number | null>(null);
  const [currentMonthDues, setCurrentMonthDues] = useState<number | null>(null);
  const [paidThisMonthCount, setPaidThisMonthCount] = useState<number | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [year, setYear] = useState(2026);
  const [hostingScheduleRows, setHostingScheduleRows] = useState<HostingScheduleApiRow[]>([]);
  const [hostingScheduleLoaded, setHostingScheduleLoaded] = useState(false);
  const [scheduleSearch, setScheduleSearch] = useState("");
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleMonth, setScheduleMonth] = useState<number | "">("");
  const [scheduleYear, setScheduleYear] = useState(year);
  const [scheduleMemberIds, setScheduleMemberIds] = useState<string[]>([]);
  const [scheduleMemberSearch, setScheduleMemberSearch] = useState("");
  const [memberOptions, setMemberOptions] = useState<HostingMemberOption[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [expandedTranscriptId, setExpandedTranscriptId] = useState<string | null>(null);

  const fetchMeetingsList = async () => {
    try {
      setMeetingsLoading(true);
      const data = await getMeetings();
      setMeetings(data);
    } catch {
      // Ignore or log error
    } finally {
      setMeetingsLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetingsList();
  }, []);

  const handleDeleteMeeting = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this meeting summary?")) return;
    try {
      await deleteMeeting(id);
      setMeetings((prev) => prev.filter((m) => m.id !== id));
      setToast("Meeting summary deleted successfully");
      window.setTimeout(() => setToast(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete meeting";
      console.error("[deleteMeeting] error:", err);
      alert(`Failed to delete meeting: ${msg}`);
    }
  };


  // Fetch stat card data in parallel on mount.
  useEffect(() => {
    let active = true;
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // 1. Total + Active members
    apiGet<AdminMemberResponse[]>("/admin/members")
      .then((members) => {
        if (!active) return;
        setTotalMembers(members.length);
        setActiveMembers(members.filter((m) => String(m.status ?? "").toLowerCase() === "active").length);
      })
      .catch(() => {});

    // 2. Total Revenue = sum of all transactions + all monthly dues paid
    Promise.all([
      apiGet<TransactionApiRow[]>("/admin/database/transactions"),
      apiGet<MonthlyDueApiRow[]>("/admin/database/dues"),
    ])
      .then(([transactions, dues]) => {
        if (!active) return;
        const txSum = transactions.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
        const duesSum = dues.reduce((sum, r) => sum + Number(r.duesPaid ?? 0), 0);
        setTotalRevenue(txSum + duesSum);
        // Current-month dues collected
        const monthDues = dues
          .filter((d) => d.year === currentYear && d.month === currentMonth && Number(d.duesPaid) > 0)
          .reduce((sum, d) => sum + Number(d.duesPaid ?? 0), 0);
        setCurrentMonthDues(monthDues);
        const paidCount = new Set(
          dues
            .filter((d) => d.year === currentYear && d.month === currentMonth && Number(d.duesPaid) > 0)
            .map((d) => d.memberRecordId)
        ).size;
        setPaidThisMonthCount(paidCount);
      })
      .catch(() => {});

    // 3. Pending = members who have NOT paid dues for the current month/year.
    // We fetch every MonthlyDue row, count members with a duesPaid > 0 entry
    // for the current month, then multiply the unpaid count by the standard
    // monthly dues ($20 default) to get the expected-but-missing amount.
    Promise.all([
      apiGet<AdminMemberResponse[]>("/admin/members"),
      apiGet<MonthlyDueApiRow[]>("/admin/database/dues"),
    ])
      .then(([members, dues]) => {
        if (!active) return;
        const activeCount = members.filter((m) => String(m.status ?? "").toLowerCase() === "active").length;
        const paidThisMonth = new Set(
          dues
            .filter((d) => d.year === currentYear && d.month === currentMonth && Number(d.duesPaid) > 0)
            .map((d) => d.memberRecordId)
        ).size;
        const unpaidCount = Math.max(0, activeCount - paidThisMonth);
        // Standard monthly dues amount — adjust if your org uses a different default.
        const STANDARD_DUES = 20;
        setPendingPayment(unpaidCount * STANDARD_DUES);
      })
      .catch(() => {});

    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErr(null);

    const month = new Date().getMonth() + 1;

    apiGet<LedgerSummaryResponse>(`/analytics/ledger-summary?year=${year}&month=${month}`)
      .then((ledgerRes) => {
        if (!active) return;
        setLedgerSummary(ledgerRes);
      })
      .catch((error: Error) => {
        if (!active) return;
        setErr(error?.message ?? "Failed to load admin dashboard data");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [year]);

  useEffect(() => {
    const state = location.state as { sectionId?: string; nav?: string } | null;
    const sectionId = state?.sectionId;
    if (!sectionId) return;

    const frame = window.requestAnimationFrame(() => {
      if (state.nav) setActiveNav(state.nav);
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      navigate(location.pathname, { replace: true, state: null });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (!isScheduleModalOpen) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsScheduleModalOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isScheduleModalOpen]);

  useEffect(() => {
    let active = true;

    apiGet<HostingScheduleApiRow[]>("/admin/database/hostingSchedule")
      .then((rows) => {
        if (!active) return;
        setHostingScheduleRows(rows);
        setHostingScheduleLoaded(true);
      })
      .catch(() => {
        // Leave hostingScheduleLoaded false; the table falls back to the
        // placeholder rows below if the endpoint isn't reachable.
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isScheduleModalOpen) return undefined;
    let active = true;

    setMembersLoading(true);
    setMembersError(null);

    apiGet<AdminMemberResponse[]>("/admin/members")
      .then((members) => {
        if (!active) return;
        setMemberOptions(members.map((member) => ({ id: member.id, name: memberDisplayName(member) })));
      })
      .catch((error: Error) => {
        if (!active) return;
        setMembersError(error?.message ?? "Failed to load members");
      })
      .finally(() => {
        if (!active) return;
        setMembersLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isScheduleModalOpen]);

  const scheduleRows = useMemo(() => {
    if (!hostingScheduleLoaded) return HOSTING_SCHEDULE_ROWS;

    return hostingScheduleRows
      .filter((row) => row.year === year)
      .slice()
      .sort((a, b) => a.month - b.month)
      .map((row) => ({ month: monthLabel(row.month), hostingGroup: row.hostMember }));
  }, [hostingScheduleRows, hostingScheduleLoaded, year]);

  const filteredScheduleRows = useMemo(() => {
    const query = scheduleSearch.trim().toLowerCase();
    return scheduleRows.filter((row) => {
      if (!query) return true;
      const haystack = `${row.month} ${row.hostingGroup}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [scheduleRows, scheduleSearch]);

  const filteredMemberOptions = useMemo(() => {
    const query = scheduleMemberSearch.trim().toLowerCase();
    if (!query) return memberOptions;
    return memberOptions.filter((member) => member.name.toLowerCase().includes(query));
  }, [memberOptions, scheduleMemberSearch]);

  const financialSnapshot = useMemo<FinancialSnapshot>(() => {
    const income = Math.abs(Number(ledgerSummary?.ytd?.income ?? FALLBACK_FINANCIALS.income));
    const expense = Math.abs(Number(ledgerSummary?.ytd?.expense ?? FALLBACK_FINANCIALS.expense));
    const businessAccount = getAccountAmount(
      ledgerSummary?.accountBalances,
      "business",
      FALLBACK_FINANCIALS.businessAccount
    );
    const fundraiserAccount = getAccountAmount(
      ledgerSummary?.accountBalances,
      "fundraiser",
      FALLBACK_FINANCIALS.fundraiserAccount
    );

    return {
      income,
      expense,
      businessAccount,
      fundraiserAccount,
      balances: [
        {
          label: "Business",
          amount: getAccountAmount(
            ledgerSummary?.accountBalances,
            "business",
            FALLBACK_FINANCIALS.balances[0].amount
          ),
        },
        {
          label: "Fundraiser",
          amount: getAccountAmount(
            ledgerSummary?.accountBalances,
            "fundraiser",
            FALLBACK_FINANCIALS.balances[1].amount
          ),
        },
      ],
    };
  }, [ledgerSummary]);

  const adminDisplayName = "Admin";
  const adminEmail = "Admin.Ono@gmail.com";

  function scrollToSection(sectionId: string, label: string) {
    setActiveNav(label);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  function resetScheduleModalForm() {
    setScheduleMonth("");
    setScheduleYear(year);
    setScheduleMemberIds([]);
    setScheduleMemberSearch("");
    setScheduleError(null);
  }

  function handleOpenScheduleModal() {
    resetScheduleModalForm();
    setIsScheduleModalOpen(true);
  }

  function handleCloseScheduleModal() {
    setIsScheduleModalOpen(false);
  }

  function toggleScheduleMember(memberId: string) {
    setScheduleMemberIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]
    );
  }

  async function handleSaveSchedule() {
    setScheduleError(null);

    if (!scheduleMonth) {
      setScheduleError("Select a month");
      return;
    }
    if (!scheduleMemberIds.length) {
      setScheduleError("Add at least one member");
      return;
    }

    const hostMember = scheduleMemberIds
      .map((id) => memberOptions.find((member) => member.id === id)?.name)
      .filter(Boolean)
      .join(", ");

    setScheduleSaving(true);

    try {
      // HostingSchedule has @@unique([year, month]) in the schema, and the
      // generic table route only exposes plain create (POST) + update-by-id
      // (PATCH /:table/:id) — there's no upsert-by-year-month on the
      // backend. So we look for an existing row for this year/month
      // ourselves and PATCH it if found, otherwise POST a new one.
      const existing = hostingScheduleRows.find(
        (row) => row.year === scheduleYear && row.month === scheduleMonth
      );

      if (existing) {
        await apiPatch(`/admin/database/hostingSchedule/${existing.id}`, { hostMember });
      } else {
        await apiPost("/admin/database/hostingSchedule", {
          year: scheduleYear,
          month: scheduleMonth,
          hostMember,
        });
      }

      // Re-fetch so the table reflects the save immediately.
      const refreshed = await apiGet<HostingScheduleApiRow[]>("/admin/database/hostingSchedule");
      setHostingScheduleRows(refreshed);
      setHostingScheduleLoaded(true);

      if (scheduleYear === year) {
        setScheduleSearch(monthLabel(scheduleMonth));
      }

      setIsScheduleModalOpen(false);
      setToast("Hosting schedule saved successfully");
      window.setTimeout(() => setToast(null), 3000);
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : "Failed to save hosting schedule");
    } finally {
      setScheduleSaving(false);
    }
  }

  const primaryNavigationItems = [
    { label: "Dashboard", icon: FiHome, action: () => scrollToSection("admin-dashboard-top", "Dashboard") },
    {
      label: "Transaction",
      icon: FiCreditCard,
      action: () => navigate("/admin/transaction"),
    },
    { label: "Member", icon: FiUsers, action: () => navigate("/admin/member") },
  ];

  const secondaryNavigationItems = [
    { label: "Settings", icon: FiSettings, action: () => navigate("/admin/settings") },
    { label: "Logout", icon: FiLogOut, action: handleLogout, tone: "danger" },
  ];

  return (
    <div className="admin-dashboard">
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
            const active = activeNav === item.label;
            return (
              <button
                key={item.label}
                type="button"
                className={[
                  "admin-dashboard__nav-item",
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
        </nav>

        <div className="admin-dashboard__profile">
          <div className="admin-dashboard__profile-info">
            <div className="admin-dashboard__profile-avatar" aria-hidden="true">A</div>
            <div>
              <div className="admin-dashboard__profile-name">{adminDisplayName}</div>
              <div className="admin-dashboard__profile-email">{adminEmail}</div>
            </div>
          </div>
          <div className="admin-dashboard__profile-actions">
            {secondaryNavigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  className={[
                    "admin-dashboard__nav-item",
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
        </div>
      </aside>

      <main className="admin-dashboard__main">

        {err && <div className="admin-dashboard__alert admin-dashboard__alert--error">{err}</div>}
        {loading && <div className="admin-dashboard__alert">Loading live dashboard data...</div>}

        <section className="admin-dashboard__stats">
          {([
            {
              title: "Total Members",
              subtitle: "All registered members",
              value: totalMembers === null ? "—" : totalMembers.toLocaleString(),
              icon: FiUsers,
            },
            {
              title: "Active Members",
              subtitle: "Currently active",
              value: activeMembers === null ? "—" : activeMembers.toLocaleString(),
              icon: FiUsers,
            },
            {
              title: "Total Revenue",
              subtitle: "Transactions + dues paid",
              value: totalRevenue === null ? "—" : `$${totalRevenue.toLocaleString()}`,
              icon: FiDollarSign,
            },
            {
              title: "Pending Payment",
              subtitle: `Expected dues — ${new Date().toLocaleString("default", { month: "long" })} ${new Date().getFullYear()}`,
              value: pendingPayment === null ? "—" : `$${pendingPayment.toLocaleString()}`,
              icon: FiClock,
            },
          ] as { title: string; subtitle: string; value: string; icon: React.ComponentType<{ size?: number }> }[]).map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.title} className="admin-dashboard__stat-card">
                <div className="admin-dashboard__stat-icon">
                  <Icon size={20} />
                </div>
                <div className="admin-dashboard__stat-copy">
                  <h2>{card.title}</h2>
                  <p>{card.subtitle}</p>
                  <div className="admin-dashboard__stat-footer">
                    <strong>{card.value}</strong>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="admin-dashboard__charts" id="admin-dashboard-yearly">
          <YearlyBalanceManager isAdmin={true} />
        </section>

        <section className="admin-dashboard__charts" id="admin-dashboard-transaction">
          <article className="admin-dashboard__panel">
            <div className="admin-dashboard__panel-head">
              <span className="admin-dashboard__panel-dot" />
              <h3>Monthly Visual</h3>
            </div>
            <div className="admin-dashboard__chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={MONTHLY_VISUAL_DATA} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#dfe8e3" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} stroke="#7f8d86" />
                  <YAxis tickLine={false} axisLine={false} stroke="#7f8d86" />
                  <Tooltip formatter={renderTooltipValue} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#1ba389"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#1ba389" }}
                    activeDot={{ r: 6 }}
                  >
                    <LabelList dataKey="value" position="top" fill="#1ba389" fontSize={12} />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="admin-dashboard__panel">
            <div className="admin-dashboard__panel-head">
              <span className="admin-dashboard__panel-dot" />
              <h3>YTD Visual</h3>
            </div>
            <div className="admin-dashboard__pie-layout">
              <div className="admin-dashboard__pie-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={YTD_VISUAL_DATA}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={0}
                      outerRadius={110}
                      paddingAngle={2}
                    >
                      {YTD_VISUAL_DATA.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number | string | Array<number | string>) =>
                        formatCurrency(Number(Array.isArray(value) ? value[0] : value))
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="admin-dashboard__legend">
                {YTD_VISUAL_DATA.map((entry) => {
                  const total = YTD_VISUAL_DATA.reduce((sum, item) => sum + item.value, 0);
                  const percent = ((entry.value / total) * 100).toFixed(1);
                  return (
                    <div key={entry.name} className="admin-dashboard__legend-item">
                      <span className="admin-dashboard__legend-swatch" style={{ backgroundColor: entry.color }} />
                      <span>
                        {entry.name}: {entry.value} ({percent}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </article>
        </section>

        <section className="admin-dashboard__financial-grid" id="admin-dashboard-settings">
          <FinancialPanel snapshot={financialSnapshot} />
          <CurrentMonthPanel
            monthName={new Date().toLocaleString("default", { month: "long" })}
            year={new Date().getFullYear()}
            paidCount={paidThisMonthCount}
            unpaidCount={pendingPayment !== null && paidThisMonthCount !== null && activeMembers !== null
              ? Math.max(0, activeMembers - paidThisMonthCount)
              : null}
            duesCollected={currentMonthDues}
            pendingAmount={pendingPayment}
            businessBalance={financialSnapshot.businessAccount}
            activeMembers={activeMembers}
          />
        </section>

        <section className="admin-dashboard__schedule">
          <div className="admin-dashboard__schedule-head">
            <div className="admin-dashboard__section-copy">
              <h2>Hosting Schedule</h2>
              <p>View and manage the monthly hosting groups</p>
            </div>

            <button type="button" className="admin-dashboard__schedule-button" onClick={handleOpenScheduleModal}>
              <FiPlus size={18} />
              <span>Add Schedule</span>
            </button>
          </div>

          <div className="admin-dashboard__schedule-tools">
            <label className="admin-dashboard__schedule-year">
              <FiCalendar size={20} />
              <select
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
                aria-label="Select hosting schedule year"
              >
                {YEAR_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="admin-dashboard__search admin-dashboard__schedule-search">
              <input
                value={scheduleSearch}
                onChange={(event) => setScheduleSearch(event.target.value)}
                placeholder="Search member or month....."
                aria-label="Search hosting schedule"
              />
              <FiSearch size={18} />
            </label>
          </div>

          <div className="admin-dashboard__table-shell admin-dashboard__schedule-table-shell">
            <div className="admin-dashboard__table-wrap admin-dashboard__schedule-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Hosting group</th>
                  </tr>
                </thead>
                <tbody>
                  {!filteredScheduleRows.length ? (
                    <tr>
                      <td colSpan={2} className="admin-dashboard__empty-state">
                        No hosting schedule rows match the current search.
                      </td>
                    </tr>
                  ) : (
                    filteredScheduleRows.map((row) => (
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

        <section className="admin-dashboard__panel" style={{ marginTop: "2rem" }}>
          <div className="admin-dashboard__schedule-head">
            <div className="admin-dashboard__section-copy">
              <h2>Meeting Summaries</h2>
              <p>AI-generated structured summaries from live recorded meetings</p>
            </div>
          </div>

          <div className="meeting-feed">
            {meetingsLoading && <p style={{ color: "#6b7c75" }}>Loading meeting summaries...</p>}
            {!meetingsLoading && meetings.length === 0 ? (
              <div className="meeting-feed__empty">
                <FiMic size={32} color="#1ba389" />
                <p>No meeting recordings yet. Tap the bottom-right microphone button to start recording.</p>
              </div>
            ) : (
              meetings.map((m) => {
                const isExpanded = expandedTranscriptId === m.id;
                const formattedDate = new Date(m.date).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <article key={m.id} className="meeting-feed__card">
                    <div className="meeting-feed__card-header">
                      <div>
                        <h4>{m.title}</h4>
                        <div className="meeting-feed__meta">
                          <FiClock size={14} />
                          <span>{formattedDate}</span>
                        </div>
                      </div>
                      <div className="meeting-feed__card-actions">
                        <button
                          type="button"
                          className="btn-delete"
                          onClick={() => handleDeleteMeeting(m.id)}
                          title="Delete meeting summary"
                        >
                          <FiTrash2 size={14} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>

                    <div className="meeting-feed__card-summary">
                      <div style={{ whiteSpace: "pre-wrap" }}>{m.summary}</div>
                    </div>

                    <button
                      type="button"
                      className="meeting-feed__card-transcript-toggle"
                      onClick={() => setExpandedTranscriptId(isExpanded ? null : m.id)}
                    >
                      <span>{isExpanded ? "Hide Full Transcript" : "View Full Transcript"}</span>
                      {isExpanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                    </button>

                    {isExpanded && (
                      <div className="meeting-feed__card-transcript">
                        {m.transcription}
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>
      </main>


      {isScheduleModalOpen && (
        <div className="admin-dashboard__modal" role="dialog" aria-modal="true" aria-labelledby="schedule-modal-title">
          <div className="admin-dashboard__modal-backdrop" onClick={handleCloseScheduleModal} />

          <div className="admin-dashboard__modal-panel admin-dashboard__modal-panel--wide">
            <h2 id="schedule-modal-title" className="admin-dashboard__modal-title">
              Add Hosting Schedule
            </h2>

            {scheduleError && <div className="admin-dashboard__modal-error">{scheduleError}</div>}
            {membersError && <div className="admin-dashboard__modal-error">{membersError}</div>}

            <div className="admin-dashboard__modal-grid admin-dashboard__modal-grid--cols-2">
              <div className="admin-dashboard__modal-section">
                <label htmlFor="schedule-month-select" className="admin-dashboard__modal-label">
                  Month *
                </label>

                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--month admin-dashboard__modal-select-wrap">
                  <FiCalendar size={22} />
                  <select
                    id="schedule-month-select"
                    value={scheduleMonth}
                    onChange={(event) => setScheduleMonth(event.target.value ? Number(event.target.value) : "")}
                    aria-label="Select schedule month"
                    className={scheduleMonth ? "has-value" : ""}
                  >
                    <option value="">Select month</option>
                    {MONTH_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="admin-dashboard__modal-section">
                <label htmlFor="schedule-year-select" className="admin-dashboard__modal-label">
                  Year *
                </label>

                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--month admin-dashboard__modal-select-wrap">
                  <FiCalendar size={22} />
                  <select
                    id="schedule-year-select"
                    value={scheduleYear}
                    onChange={(event) => setScheduleYear(Number(event.target.value))}
                    aria-label="Select schedule year"
                    className="has-value"
                  >
                    {YEAR_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="admin-dashboard__modal-section">
              <div className="admin-dashboard__modal-label">
                Add members {scheduleMonth ? `to ${monthLabel(scheduleMonth)} ${scheduleYear}` : ""}
              </div>

              <label className="admin-dashboard__search admin-dashboard__modal-member-search">
                <FiSearch size={16} />
                <input
                  value={scheduleMemberSearch}
                  onChange={(event) => setScheduleMemberSearch(event.target.value)}
                  placeholder="Search members....."
                  aria-label="Search members to add"
                />
              </label>

              <div className="admin-dashboard__modal-member-list">
                {membersLoading ? (
                  <div className="admin-dashboard__modal-member-empty">Loading members...</div>
                ) : !filteredMemberOptions.length ? (
                  <div className="admin-dashboard__modal-member-empty">No members found.</div>
                ) : (
                  filteredMemberOptions.map((member) => {
                    const isSelected = scheduleMemberIds.includes(member.id);
                    return (
                      <button
                        type="button"
                        key={member.id}
                        className={[
                          "admin-dashboard__modal-member-row",
                          isSelected ? "is-selected" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => toggleScheduleMember(member.id)}
                        aria-pressed={isSelected}
                      >
                        <span>{member.name}</span>
                        {isSelected ? <FiCheck size={16} /> : <FiPlus size={16} />}
                      </button>
                    );
                  })
                )}
              </div>

              {!!scheduleMemberIds.length && (
                <div className="admin-dashboard__modal-chip-area">
                  {scheduleMemberIds.map((id) => {
                    const member = memberOptions.find((entry) => entry.id === id);
                    const label = member?.name ?? id;
                    return (
                      <div key={id} className="admin-dashboard__modal-chip">
                        <span>{label}</span>
                        <button
                          type="button"
                          className="admin-dashboard__modal-chip-remove"
                          onClick={() => toggleScheduleMember(id)}
                          aria-label={`Remove ${label}`}
                        >
                          <FiX size={18} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="admin-dashboard__modal-actions">
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--secondary"
                onClick={handleCloseScheduleModal}
                disabled={scheduleSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--primary"
                onClick={handleSaveSchedule}
                disabled={!scheduleMonth || !scheduleMemberIds.length || scheduleSaving}
              >
                {scheduleSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="admin-dashboard__toast" role="status" aria-live="polite">
          <FiCheck size={16} />
          <span>{toast}</span>
        </div>
      )}

      <MeetingRecorder onMeetingSaved={fetchMeetingsList} />
      <ReportFilterModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} />
    </div>
  );
}

function FinancialPanel({ snapshot }: { snapshot: FinancialSnapshot }) {
  const cards = [
    { label: "Income YTD", value: formatCurrency(snapshot.income) },
    { label: "Expenses YTD", value: formatCurrency(snapshot.expense) },
    { label: "Business Account", value: formatCurrency(snapshot.businessAccount) },
    { label: "Fundraiser Account", value: formatCurrency(snapshot.fundraiserAccount) },
  ];

  return (
    <article className="admin-dashboard__panel">
      <h3 className="admin-dashboard__financial-title">Year-to-date financial summary</h3>

      <div className="admin-dashboard__finance-cards">
        {cards.map((card) => (
          <div key={card.label} className="admin-dashboard__finance-card">
            <span>{card.label}</span>
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

type CurrentMonthPanelProps = {
  monthName: string;
  year: number;
  paidCount: number | null;
  unpaidCount: number | null;
  duesCollected: number | null;
  pendingAmount: number | null;
  businessBalance: number;
  activeMembers: number | null;
};

function CurrentMonthPanel({
  monthName, year, paidCount, unpaidCount, duesCollected, pendingAmount, businessBalance, activeMembers,
}: CurrentMonthPanelProps) {
  const paidPct = paidCount !== null && activeMembers ? Math.round((paidCount / activeMembers) * 100) : null;

  const stats = [
    {
      label: "Dues Collected",
      value: duesCollected === null ? "—" : formatCurrency(duesCollected),
      color: "#22c55e",
      sub: "This month",
    },
    {
      label: "Members Paid",
      value: paidCount === null ? "—" : `${paidCount}${activeMembers ? ` / ${activeMembers}` : ""}`,
      color: "#6366f1",
      sub: paidPct !== null ? `${paidPct}% compliance` : "Active members",
    },
    {
      label: "Unpaid Members",
      value: unpaidCount === null ? "—" : String(unpaidCount),
      color: unpaidCount ? "#ef4444" : "#22c55e",
      sub: pendingAmount !== null ? `${formatCurrency(pendingAmount)} pending` : "Outstanding",
    },
    {
      label: "Business Balance",
      value: formatCurrency(businessBalance),
      color: "#f59e0b",
      sub: "Current snapshot",
    },
  ];

  return (
    <article className="admin-dashboard__panel">
      <h3 className="admin-dashboard__financial-title">
        Current Month Overview
        <span style={{ fontSize: "0.8rem", fontWeight: 400, color: "#6b7c75", marginLeft: "8px" }}>
          {monthName} {year}
        </span>
      </h3>

      <div className="admin-dashboard__finance-cards">
        {stats.map((s) => (
          <div key={s.label} className="admin-dashboard__finance-card" style={{ borderTop: `3px solid ${s.color}` }}>
            <span>{s.label}</span>
            <strong style={{ color: s.color, fontSize: "1.15rem" }}>{s.value}</strong>
            <span style={{ fontSize: "0.75rem", color: "#9aafa9", marginTop: "2px" }}>{s.sub}</span>
          </div>
        ))}
      </div>

      {paidPct !== null && (
        <div className="admin-dashboard__balance-table">
          <div className="admin-dashboard__balance-head">
            <span>Dues Compliance</span>
            <span>{paidPct}%</span>
          </div>
          <div style={{ padding: "8px 0" }}>
            <div style={{
              height: "8px", background: "#dfe8e3", borderRadius: "99px", overflow: "hidden",
            }}>
              <div style={{
                height: "100%", width: `${paidPct}%`,
                background: paidPct >= 75 ? "#22c55e" : paidPct >= 50 ? "#f59e0b" : "#ef4444",
                borderRadius: "99px", transition: "width 0.6s ease",
              }} />
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
