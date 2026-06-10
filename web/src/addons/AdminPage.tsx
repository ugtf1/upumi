import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { IconType } from "react-icons";
import {
  FiBell,
  FiCalendar,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiFilter,
  FiHome,
  FiLogOut,
  FiPlus,
  FiSearch,
  FiSettings,
  FiTrendingDown,
  FiTrendingUp,
  FiUsers,
  FiX,
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

import { apiGet, apiPost, clearToken } from "./api";
import "./admin-page.scss";

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

type SummaryCardData = {
  title: string;
  subtitle: string;
  value: string;
  delta: string;
  trend: "up" | "down";
  icon: IconType;
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

const SUMMARY_CARDS: SummaryCardData[] = [
  {
    title: "Total Members",
    subtitle: "This month",
    value: "109",
    delta: "0.43%",
    trend: "up",
    icon: FiUsers,
  },
  {
    title: "Active Members",
    subtitle: "This month",
    value: "90",
    delta: "0.43%",
    trend: "up",
    icon: FiUsers,
  },
  {
    title: "Total Revenue",
    subtitle: "This month",
    value: "$10,265",
    delta: "0.43%",
    trend: "up",
    icon: FiDollarSign,
  },
  {
    title: "Pending Payment",
    subtitle: "This month",
    value: "$165",
    delta: "0.98%",
    trend: "down",
    icon: FiClock,
  },
];

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

const DEFAULT_SCHEDULE_MEMBERS = [
  "Agbara Onome",
  "Abada Evi",
  "Abada Otuke",
  "Atori Victoria",
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
  const [year, setYear] = useState(2026);
  const [search, setSearch] = useState("");
  const [scheduleRows, setScheduleRows] = useState(HOSTING_SCHEDULE_ROWS);
  const [scheduleSearch, setScheduleSearch] = useState("");
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleMonthInput, setScheduleMonthInput] = useState("");
  const [scheduleMembers, setScheduleMembers] = useState(DEFAULT_SCHEDULE_MEMBERS);
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [addMemberForm, setAddMemberForm] = useState({
    phone: "",
    email: "",
    fName: "",
    lName: "",
    role: "MEMBER" as const,
  });
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [addMemberError, setAddMemberError] = useState<string | null>(null);

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

  const filteredScheduleRows = useMemo(() => {
    const query = scheduleSearch.trim().toLowerCase();
    return scheduleRows.filter((row) => {
      if (!query) return true;
      const haystack = `${row.month} ${row.hostingGroup}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [scheduleRows, scheduleSearch]);

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
    setScheduleMonthInput("");
    setScheduleMembers(DEFAULT_SCHEDULE_MEMBERS);
  }

  function handleOpenScheduleModal() {
    resetScheduleModalForm();
    setIsScheduleModalOpen(true);
  }

  function handleCloseScheduleModal() {
    setIsScheduleModalOpen(false);
  }

  function handleRemoveScheduleMember(memberName: string) {
    setScheduleMembers((currentMembers) => currentMembers.filter((member) => member !== memberName));
  }

  function handleSaveSchedule() {
    const month = scheduleMonthInput.trim();
    if (!month || !scheduleMembers.length) return;

    const hostingGroup = scheduleMembers.join(", ");

    setScheduleRows((currentRows) => {
      const existingIndex = currentRows.findIndex((row) => row.month.toLowerCase() === month.toLowerCase());
      if (existingIndex === -1) {
        return [{ month, hostingGroup }, ...currentRows];
      }

      return currentRows.map((row, index) => (index === existingIndex ? { month, hostingGroup } : row));
    });

    setScheduleSearch(month);
    setIsScheduleModalOpen(false);
  }

  function handleOpenAddMemberModal() {
    setAddMemberForm({
      phone: "",
      email: "",
      fName: "",
      lName: "",
      role: "MEMBER",
    });
    setAddMemberError(null);
    setIsAddMemberModalOpen(true);
  }

  function handleCloseAddMemberModal() {
    setIsAddMemberModalOpen(false);
    setAddMemberError(null);
  }

  async function handleSaveAddMember() {
    setAddMemberError(null);
    setAddMemberLoading(true);

    try {
      const { phone, email, fName, lName, role } = addMemberForm;

      // Validation
      if (!phone.trim()) {
        throw new Error("Phone is required");
      }
      if (!email.trim()) {
        throw new Error("Email is required");
      }
      if (!fName.trim()) {
        throw new Error("First name is required");
      }
      if (!lName.trim()) {
        throw new Error("Last name is required");
      }

      // Call API to create user
      await apiPost("/admin/users", {
        phone: phone.trim(),
        email: email.trim(),
        fName: fName.trim(),
        lName: lName.trim(),
        role,
      });

      // Reset form and close modal
      setAddMemberForm({
        phone: "",
        email: "",
        fName: "",
        lName: "",
        role: "MEMBER",
      });
      setIsAddMemberModalOpen(false);
    } catch (error) {
      setAddMemberError(error instanceof Error ? error.message : "Failed to add member");
    } finally {
      setAddMemberLoading(false);
    }
  }

  const isAddMemberFormValid = 
    addMemberForm.phone.trim() &&
    addMemberForm.email.trim() &&
    addMemberForm.fName.trim() &&
    addMemberForm.lName.trim();

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
        <section className="admin-dashboard__hero" id="admin-dashboard-top">
          <div>
            <h1>Admin Console</h1>
            <p>Pivot-style member details for all signed-in members.</p>
          </div>

          <div className="admin-dashboard__hero-actions">
            <label className="admin-dashboard__search">
              <FiSearch size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search member, expense, balance, income..."
                aria-label="Search members"
              />
            </label>

            <button type="button" className="admin-dashboard__icon-button" aria-label="Filter dashboard">
              <FiFilter size={18} />
            </button>
            <button type="button" className="admin-dashboard__icon-button" aria-label="Notifications">
              <FiBell size={18} />
            </button>
          </div>
        </section>

        {err && <div className="admin-dashboard__alert admin-dashboard__alert--error">{err}</div>}
        {loading && <div className="admin-dashboard__alert">Loading live dashboard data...</div>}

        <section className="admin-dashboard__stats">
          {SUMMARY_CARDS.map((card) => {
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
                    <span className={`admin-dashboard__trend admin-dashboard__trend--${card.trend}`}>
                      {card.delta} {card.trend === "up" ? <FiTrendingUp size={14} /> : <FiTrendingDown size={14} />}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
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
          {[0, 1].map((panelIndex) => (
            <FinancialPanel key={panelIndex} snapshot={financialSnapshot} />
          ))}
        </section>

        <section className="admin-dashboard__schedule" id="admin-dashboard-members">
          <div className="admin-dashboard__schedule-head">
            <div className="admin-dashboard__section-copy">
              <h2>Members</h2>
              <p>Manage and add new members to the system</p>
            </div>

            <button type="button" className="admin-dashboard__schedule-button" onClick={handleOpenAddMemberModal}>
              <FiPlus size={18} />
              <span>Add Member</span>
            </button>
          </div>
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
      </main>

      {isScheduleModalOpen && (
        <div className="admin-dashboard__modal" role="dialog" aria-modal="true" aria-labelledby="schedule-modal-title">
          <div className="admin-dashboard__modal-backdrop" onClick={handleCloseScheduleModal} />

          <div className="admin-dashboard__modal-panel">
            <div className="admin-dashboard__modal-section">
              <label htmlFor="schedule-month-input" className="admin-dashboard__modal-label" id="schedule-modal-title">
                Month
              </label>

              <div className="admin-dashboard__modal-input admin-dashboard__modal-input--month">
                <FiCalendar size={22} />
                <input
                  id="schedule-month-input"
                  value={scheduleMonthInput}
                  onChange={(event) => setScheduleMonthInput(event.target.value)}
                  placeholder="Enter Month"
                  aria-label="Enter schedule month"
                />
              </div>
            </div>

            <div className="admin-dashboard__modal-section">
              <div className="admin-dashboard__modal-label">Add members</div>

              <div className="admin-dashboard__modal-chip-area">
                {scheduleMembers.map((member) => (
                  <div key={member} className="admin-dashboard__modal-chip">
                    <span>{member}</span>
                    <button
                      type="button"
                      className="admin-dashboard__modal-chip-remove"
                      onClick={() => handleRemoveScheduleMember(member)}
                      aria-label={`Remove ${member}`}
                    >
                      <FiX size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-dashboard__modal-actions">
              <button type="button" className="admin-dashboard__modal-button admin-dashboard__modal-button--secondary" onClick={handleCloseScheduleModal}>
                Cancel
              </button>
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--primary"
                onClick={handleSaveSchedule}
                disabled={!scheduleMonthInput.trim() || !scheduleMembers.length}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddMemberModalOpen && (
        <div className="admin-dashboard__modal" role="dialog" aria-modal="true" aria-labelledby="add-member-modal-title">
          <div className="admin-dashboard__modal-backdrop" onClick={handleCloseAddMemberModal} />

          <div className="admin-dashboard__modal-panel">
            <div className="admin-dashboard__modal-header">
              <h2 id="add-member-modal-title">Add New Member</h2>
              <button
                type="button"
                className="admin-dashboard__modal-close"
                onClick={handleCloseAddMemberModal}
                aria-label="Close modal"
              >
                <FiX size={24} />
              </button>
            </div>

            {addMemberError && (
              <div className="admin-dashboard__modal-error">
                {addMemberError}
              </div>
            )}

            <div className="admin-dashboard__modal-section">
              <label htmlFor="add-member-phone" className="admin-dashboard__modal-label">
                Phone *
              </label>
              <input
                id="add-member-phone"
                type="tel"
                value={addMemberForm.phone}
                onChange={(event) => setAddMemberForm({ ...addMemberForm, phone: event.target.value })}
                placeholder="Enter phone number"
                aria-label="Member phone number"
                className="admin-dashboard__modal-input-field"
              />
            </div>

            <div className="admin-dashboard__modal-section">
              <label htmlFor="add-member-email" className="admin-dashboard__modal-label">
                Email *
              </label>
              <input
                id="add-member-email"
                type="email"
                value={addMemberForm.email}
                onChange={(event) => setAddMemberForm({ ...addMemberForm, email: event.target.value })}
                placeholder="Enter email address"
                aria-label="Member email address"
                className="admin-dashboard__modal-input-field"
              />
            </div>

            <div className="admin-dashboard__modal-section">
              <label htmlFor="add-member-fname" className="admin-dashboard__modal-label">
                First Name *
              </label>
              <input
                id="add-member-fname"
                type="text"
                value={addMemberForm.fName}
                onChange={(event) => setAddMemberForm({ ...addMemberForm, fName: event.target.value })}
                placeholder="Enter first name"
                aria-label="Member first name"
                className="admin-dashboard__modal-input-field"
              />
            </div>

            <div className="admin-dashboard__modal-section">
              <label htmlFor="add-member-lname" className="admin-dashboard__modal-label">
                Last Name *
              </label>
              <input
                id="add-member-lname"
                type="text"
                value={addMemberForm.lName}
                onChange={(event) => setAddMemberForm({ ...addMemberForm, lName: event.target.value })}
                placeholder="Enter last name"
                aria-label="Member last name"
                className="admin-dashboard__modal-input-field"
              />
            </div>

            <div className="admin-dashboard__modal-section">
              <label htmlFor="add-member-role" className="admin-dashboard__modal-label">
                Role
              </label>
              <select
                id="add-member-role"
                value={addMemberForm.role}
                onChange={(event) => setAddMemberForm({ ...addMemberForm, role: event.target.value as "ADMIN" | "MEMBER" })}
                aria-label="Member role"
                className="admin-dashboard__modal-input-field"
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            <div className="admin-dashboard__modal-actions">
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--secondary"
                onClick={handleCloseAddMemberModal}
                disabled={addMemberLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--primary"
                onClick={handleSaveAddMember}
                disabled={!isAddMemberFormValid || addMemberLoading}
              >
                {addMemberLoading ? "Saving..." : "Save Member"}
              </button>
            </div>
          </div>
        </div>
      )}
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
