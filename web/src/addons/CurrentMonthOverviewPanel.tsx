import { useEffect, useState, useMemo } from "react";
import {
  FiCalendar,
  FiEye,
  FiX,
  FiChevronDown,
} from "react-icons/fi";
import { apiGet } from "./api";


type MemberRow = {
  id: string;
  userId?: string | null;
  memberKey?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
};

type DueRow = {
  id: string;
  memberRecordId: string;
  year: number;
  month: number;
  duesPaid: string | number;
  createdAt: string;
  member?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
  };
};

type TransactionRow = {
  id: string;
  userId?: string | null;
  fullName?: string | null;
  title?: string | null;
  description?: string | null;
  amount: string | number;
  date: string;
};

type ExpenseRow = {
  id: string;
  reason?: string | null;
  title?: string | null;
  amount: string | number;
  date: string;
};

type AttendanceRow = {
  id: string;
  year: number;
  month: number;
  usersIn?: string | null;
};

type Props = {
  monthName: string;
  year: number;
  month: number;
  memberSafe?: boolean;
};

const MONTH_OPTIONS = [
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

const CURRENT_CALENDAR_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: CURRENT_CALENDAR_YEAR - 2018 + 2 }, (_, i) => 2018 + i).reverse();

function formatCurrency(amount: number | string | null | undefined): string {
  const numeric = Number(amount ?? 0);
  if (Number.isNaN(numeric)) return "$0";
  const sign = numeric < 0 ? "-" : "";
  return `${sign}$${Math.abs(numeric).toLocaleString()}`;
}

export default function CurrentMonthOverviewPanel({ monthName, year, month, memberSafe = false }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"dues" | "wrapper" | "levy" | "others" | "attendance">("dues");

  // Modal Month & Year filter state (defaults to current month & year passed in props)
  const [selectedMonth, setSelectedMonth] = useState<number>(month);
  const [selectedYear, setSelectedYear] = useState<number>(year);

  useEffect(() => {
    setSelectedMonth(month);
    setSelectedYear(year);
  }, [month, year]);

  // Raw database data arrays
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [allDues, setAllDues] = useState<DueRow[]>([]);
  const [allTransactions, setAllTransactions] = useState<TransactionRow[]>([]);
  const [allExpenses, setAllExpenses] = useState<ExpenseRow[]>([]);
  const [allAttendance, setAllAttendance] = useState<AttendanceRow[]>([]);

  // Fetch current database records
  useEffect(() => {
    let active = true;

    const membersEndpoint = memberSafe ? "/me/members" : "/admin/members";
    const duesEndpoint = memberSafe ? "/members/database/dues" : "/admin/database/dues";
    const txEndpoint = memberSafe ? "/members/database/transactions" : "/admin/database/transactions";
    const expEndpoint = memberSafe ? "/members/database/expenses" : "/admin/database/expenses";
    const attEndpoint = memberSafe ? "/members/database/attendance" : "/admin/database/attendance";

    Promise.all([
      apiGet<MemberRow[]>(membersEndpoint).catch(() => []),
      apiGet<DueRow[]>(duesEndpoint).catch(() => []),
      apiGet<TransactionRow[]>(txEndpoint).catch(() => []),
      apiGet<ExpenseRow[]>(expEndpoint).catch(() => []),
      apiGet<AttendanceRow[]>(attEndpoint).catch(() => []),
    ])
      .then(([membersList, duesList, txList, expList, attList]) => {
        if (!active) return;
        setMembers(membersList);
        setAllDues(duesList);
        setAllTransactions(txList);
        setAllExpenses(expList);
        setAllAttendance(attList);
      });

    return () => {
      active = false;
    };
  }, [memberSafe]);

  // ── Panel Overview Computations (Strictly Current Month) ──
  const curDues = useMemo(() => {
    return allDues.filter((d) => d.year === year && d.month === month && Number(d.duesPaid ?? 0) > 0);
  }, [allDues, year, month]);

  const curTx = useMemo(() => {
    return allTransactions.filter((t) => {
      if (!t.date) return false;
      const d = new Date(t.date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
  }, [allTransactions, year, month]);

  const curExp = useMemo(() => {
    return allExpenses.filter((e) => {
      if (!e.date) return false;
      const d = new Date(e.date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
  }, [allExpenses, year, month]);

  const curDuesTotal = curDues.reduce((sum, d) => sum + Number(d.duesPaid ?? 0), 0);

  const curWrapperTx = curTx.filter((t) => (t.title || "").toLowerCase().includes("wrapper"));
  const curWrapperTotal = curWrapperTx.reduce((sum, t) => sum + Number(t.amount ?? 0), 0);

  const curLevyTx = curTx.filter((t) => (t.title || "").toLowerCase().includes("levy"));
  const curLevyTotal = curLevyTx.reduce((sum, t) => sum + Number(t.amount ?? 0), 0);

  const curOtherTx = curTx.filter((t) => {
    const title = (t.title || "").toLowerCase();
    const isExp = title.includes("expense") || Number(t.amount ?? 0) < 0;
    return !isExp && !title.includes("wrapper") && !title.includes("levy");
  });
  const curOtherTotal = curOtherTx.reduce((sum, t) => sum + Number(t.amount ?? 0), 0);

  const curTxExpTotal = curTx
    .filter((t) => (t.title || "").toLowerCase().includes("expense") || Number(t.amount ?? 0) < 0)
    .reduce((sum, t) => sum + Math.abs(Number(t.amount ?? 0)), 0);

  const curDirectExpTotal = curExp.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);

  const panelRevenue = curDuesTotal + curWrapperTotal + curLevyTotal + curOtherTotal;
  const panelExpenses = curDirectExpTotal + curTxExpTotal;
  const panelBalance = panelRevenue - panelExpenses;

  // ── Modal Filtered Computations (Selected Month & Year) ──
  const modalDues = useMemo(() => {
    return allDues.filter((d) => d.year === selectedYear && d.month === selectedMonth && Number(d.duesPaid ?? 0) > 0);
  }, [allDues, selectedYear, selectedMonth]);

  const modalTx = useMemo(() => {
    return allTransactions.filter((t) => {
      if (!t.date) return false;
      const d = new Date(t.date);
      return d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth;
    });
  }, [allTransactions, selectedYear, selectedMonth]);

  const modalAtt = useMemo(() => {
    return allAttendance.find((a) => a.year === selectedYear && a.month === selectedMonth) ?? null;
  }, [allAttendance, selectedYear, selectedMonth]);

  const modalDuesTotal = modalDues.reduce((sum, d) => sum + Number(d.duesPaid ?? 0), 0);

  const modalWrapperTx = modalTx.filter((t) => (t.title || "").toLowerCase().includes("wrapper"));
  const modalWrapperTotal = modalWrapperTx.reduce((sum, t) => sum + Number(t.amount ?? 0), 0);

  const modalLevyTx = modalTx.filter((t) => (t.title || "").toLowerCase().includes("levy"));
  const modalLevyTotal = modalLevyTx.reduce((sum, t) => sum + Number(t.amount ?? 0), 0);

  const modalOtherTx = modalTx.filter((t) => {
    const title = (t.title || "").toLowerCase();
    const isExp = title.includes("expense") || Number(t.amount ?? 0) < 0;
    return !isExp && !title.includes("wrapper") && !title.includes("levy");
  });
  const modalOtherTotal = modalOtherTx.reduce((sum, t) => sum + Number(t.amount ?? 0), 0);

  // Attendance lists for modal
  const usersInList = String(modalAtt?.usersIn ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const presentMembers = members.filter(
    (m) =>
      usersInList.includes(m.userId || "") ||
      usersInList.includes(m.id) ||
      usersInList.includes(m.memberKey || "") ||
      usersInList.includes(`user.${m.userId}`)
  );

  const absentMembers = members.filter((m) => !presentMembers.some((p) => p.id === m.id));

  // Helper for Member name
  const getMemberName = (mId?: string | null, fallbackName?: string | null) => {
    if (fallbackName && fallbackName.trim()) return fallbackName;
    const found = members.find((m) => m.id === mId || m.userId === mId);
    if (found) {
      const name = [found.firstName, found.lastName].filter(Boolean).join(" ").trim();
      if (name) return name;
      if (found.email) return found.email;
    }
    return fallbackName || "Member";
  };

  const selectedMonthName = MONTH_OPTIONS.find((m) => m.value === selectedMonth)?.label ?? String(selectedMonth);

  return (
    <article className="admin-dashboard__panel" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3 className="admin-dashboard__financial-title" style={{ margin: 0 }}>
          Current Month Overview
          <span style={{ fontSize: "0.8rem", fontWeight: 400, color: "#6b7c75", marginLeft: "8px" }}>
            {monthName} {year}
          </span>
        </h3>
      </div>

      {/* Top 3 Cards (Dues/Revenue, Monthly Expenses, Business Balance) */}
      <div className="admin-dashboard__finance-cards" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "1rem" }}>
        {/* Card 1: Dues / Total Revenue */}
        <div className="admin-dashboard__finance-card" style={{ borderTop: "3px solid #22c55e", padding: "12px 14px" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Dues & Revenue</span>
          <strong style={{ color: "#166d2e", fontSize: "1.2rem", marginTop: "4px" }}>{formatCurrency(panelRevenue)}</strong>
          <span style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "2px" }}>Sum of current month</span>
        </div>

        {/* Card 2: Monthly Expenses */}
        <div className="admin-dashboard__finance-card" style={{ borderTop: "3px solid #ef4444", padding: "12px 14px" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Monthly Expenses</span>
          <strong style={{ color: "#dc2626", fontSize: "1.2rem", marginTop: "4px" }}>{formatCurrency(panelExpenses)}</strong>
          <span style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "2px" }}>Expenses recorded</span>
        </div>

        {/* Card 3: Business Balance */}
        <div className="admin-dashboard__finance-card" style={{ borderTop: "3px solid #f59e0b", padding: "12px 14px" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Business Balance</span>
          <strong style={{ color: panelBalance >= 0 ? "#166d2e" : "#dc2626", fontSize: "1.2rem", marginTop: "4px" }}>
            {formatCurrency(panelBalance)}
          </strong>
          <span style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "2px" }}>Net month balance</span>
        </div>
      </div>

      {/* Snapshot Table Header + View Table CTA */}
      <div className="admin-dashboard__balance-table" style={{ marginTop: "auto", background: "#f8fafc", borderRadius: "12px", padding: "12px", border: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0f172a" }}>Current Month Activity Snapshot</span>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            style={{
              background: "#166d2e",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "4px 12px",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              boxShadow: "0 2px 4px rgba(22, 109, 46, 0.2)",
            }}
          >
            <FiEye size={13} /> View Table
          </button>
        </div>

        {/* Snapshot Rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.82rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
            <span>Monthly Dues ({curDues.length} payments)</span>
            <strong style={{ color: "#166d2e" }}>{formatCurrency(curDuesTotal)}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
            <span>Wrappers & Levies ({curWrapperTx.length + curLevyTx.length} entries)</span>
            <strong style={{ color: "#166d2e" }}>{formatCurrency(curWrapperTotal + curLevyTotal)}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
            <span>Other Income ({curOtherTx.length} entries)</span>
            <strong style={{ color: "#166d2e" }}>{formatCurrency(curOtherTotal)}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
            <span>Expenses ({curExp.length + curTx.filter(t => (t.title||"").toLowerCase().includes("expense")).length} entries)</span>
            <strong style={{ color: "#dc2626" }}>{formatCurrency(panelExpenses)}</strong>
          </div>
        </div>
      </div>

      {/* ── Wide Modal: Activities Table with Month & Year Switcher ── */}
      {isModalOpen && (
        <div className="admin-dashboard__modal" role="dialog" aria-modal="true">
          <div className="report-modal__backdrop" onClick={() => setIsModalOpen(false)} />

          <div
            className="admin-dashboard__modal-panel"
            style={{
              maxWidth: "1000px",
              width: "95%",
              maxHeight: "92vh",
              overflowY: "auto",
              padding: "24px",
              borderRadius: "20px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            {/* Modal Close Button */}
            <button
              type="button"
              className="admin-dashboard__modal-close"
              onClick={() => setIsModalOpen(false)}
              aria-label="Close modal"
              style={{ position: "absolute", top: "16px", right: "16px" }}
            >
              <FiX size={20} />
            </button>

            {/* Modal Title & Month/Year Switcher Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "20px", paddingRight: "40px" }}>
              <h2
                className="admin-dashboard__modal-title"
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1.35rem", margin: 0, color: "#0f172a" }}
              >
                <FiCalendar size={24} style={{ color: "#166d2e" }} />
                Monthly Activities — {selectedMonthName} {selectedYear}
              </h2>

              {/* Month & Year Switcher Controls */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    style={{
                      padding: "6px 28px 6px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      fontWeight: 600,
                      color: "#0f172a",
                      fontSize: "0.88rem",
                      cursor: "pointer",
                      outline: "none",
                      appearance: "none",
                    }}
                  >
                    {MONTH_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <FiChevronDown style={{ position: "absolute", right: "8px", pointerEvents: "none", color: "#64748b" }} />
                </div>

                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    style={{
                      padding: "6px 28px 6px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      fontWeight: 600,
                      color: "#0f172a",
                      fontSize: "0.88rem",
                      cursor: "pointer",
                      outline: "none",
                      appearance: "none",
                    }}
                  >
                    {YEAR_OPTIONS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <FiChevronDown style={{ position: "absolute", right: "8px", pointerEvents: "none", color: "#64748b" }} />
                </div>

                {(selectedMonth !== month || selectedYear !== year) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMonth(month);
                      setSelectedYear(year);
                    }}
                    style={{
                      background: "#f1f5f9",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      padding: "6px 10px",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      color: "#166d2e",
                      cursor: "pointer",
                    }}
                  >
                    Reset Current
                  </button>
                )}
              </div>
            </div>

            {/* Sub-Header Tabs */}
            <div className="report-modal__tabs" style={{ gridTemplateColumns: "repeat(5, 1fr)", marginBottom: "20px" }}>
              <button
                type="button"
                className={`report-modal__tab ${activeTab === "dues" ? "report-modal__tab--active" : ""}`}
                onClick={() => setActiveTab("dues")}
              >
                Monthly Dues ({modalDues.length})
              </button>
              <button
                type="button"
                className={`report-modal__tab ${activeTab === "wrapper" ? "report-modal__tab--active" : ""}`}
                onClick={() => setActiveTab("wrapper")}
              >
                Wrappers ({modalWrapperTx.length})
              </button>
              <button
                type="button"
                className={`report-modal__tab ${activeTab === "levy" ? "report-modal__tab--active" : ""}`}
                onClick={() => setActiveTab("levy")}
              >
                Levies ({modalLevyTx.length})
              </button>
              <button
                type="button"
                className={`report-modal__tab ${activeTab === "others" ? "report-modal__tab--active" : ""}`}
                onClick={() => setActiveTab("others")}
              >
                Other Transactions ({modalOtherTx.length})
              </button>
              <button
                type="button"
                className={`report-modal__tab ${activeTab === "attendance" ? "report-modal__tab--active" : ""}`}
                onClick={() => setActiveTab("attendance")}
              >
                Attendance ({presentMembers.length}/{members.length})
              </button>
            </div>

            {/* Tab 1: Monthly Dues Table */}
            {activeTab === "dues" && (
              <div>
                {modalDues.length === 0 ? (
                  <div className="report-modal__empty-text">No dues payments recorded for {selectedMonthName} {selectedYear}.</div>
                ) : (
                  <div className="admin-dashboard__table-container">
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left" }}>Member Name</th>
                          <th style={{ textAlign: "left" }}>For Period</th>
                          <th style={{ textAlign: "left" }}>Date Paid</th>
                          <th style={{ textAlign: "right" }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalDues.map((d) => {
                          const mName = [d.member?.firstName, d.member?.lastName].filter(Boolean).join(" ") ||
                            getMemberName(d.memberRecordId, d.member?.email);
                          return (
                            <tr key={d.id}>
                              <td style={{ fontWeight: 600, color: "#1e293b" }}>{mName}</td>
                              <td>{selectedMonthName} {d.year}</td>
                              <td>{d.createdAt ? new Date(d.createdAt).toLocaleDateString() : `${d.year}-${d.month}-01`}</td>
                              <td style={{ textAlign: "right", fontWeight: 700, color: "#166d2e" }}>{formatCurrency(d.duesPaid)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: "#f1f5f9", fontWeight: 700, fontSize: "1.05rem", borderTop: "2px solid #cbd5e1" }}>
                          <td colSpan={3} style={{ textAlign: "right", padding: "14px 16px", color: "#0f172a" }}>
                            TOTAL DUES COLLECTED:
                          </td>
                          <td style={{ textAlign: "right", padding: "14px 16px", color: "#166d2e", fontSize: "1.15rem" }}>
                            {formatCurrency(modalDuesTotal)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Wrapper Payments Table */}
            {activeTab === "wrapper" && (
              <div>
                {modalWrapperTx.length === 0 ? (
                  <div className="report-modal__empty-text">No wrapper payments recorded for {selectedMonthName} {selectedYear}.</div>
                ) : (
                  <div className="admin-dashboard__table-container">
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left" }}>Member / Source</th>
                          <th style={{ textAlign: "left" }}>Title</th>
                          <th style={{ textAlign: "left" }}>Description</th>
                          <th style={{ textAlign: "left" }}>Date</th>
                          <th style={{ textAlign: "right" }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalWrapperTx.map((t) => (
                          <tr key={t.id}>
                            <td style={{ fontWeight: 600, color: "#1e293b" }}>{getMemberName(t.userId, t.fullName)}</td>
                            <td style={{ fontWeight: 600 }}>{t.title || "Wrapper"}</td>
                            <td style={{ color: "#475569", fontSize: "0.85rem" }}>{t.description || "-"}</td>
                            <td>{t.date ? new Date(t.date).toLocaleDateString() : "-"}</td>
                            <td style={{ textAlign: "right", fontWeight: 700, color: "#166d2e" }}>{formatCurrency(t.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: "#f1f5f9", fontWeight: 700, fontSize: "1.05rem", borderTop: "2px solid #cbd5e1" }}>
                          <td colSpan={4} style={{ textAlign: "right", padding: "14px 16px", color: "#0f172a" }}>
                            TOTAL WRAPPER PAYMENTS:
                          </td>
                          <td style={{ textAlign: "right", padding: "14px 16px", color: "#166d2e", fontSize: "1.15rem" }}>
                            {formatCurrency(modalWrapperTotal)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Levy Payments Table */}
            {activeTab === "levy" && (
              <div>
                {modalLevyTx.length === 0 ? (
                  <div className="report-modal__empty-text">No levy payments recorded for {selectedMonthName} {selectedYear}.</div>
                ) : (
                  <div className="admin-dashboard__table-container">
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left" }}>Member / Source</th>
                          <th style={{ textAlign: "left" }}>Title</th>
                          <th style={{ textAlign: "left" }}>Description</th>
                          <th style={{ textAlign: "left" }}>Date</th>
                          <th style={{ textAlign: "right" }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalLevyTx.map((t) => (
                          <tr key={t.id}>
                            <td style={{ fontWeight: 600, color: "#1e293b" }}>{getMemberName(t.userId, t.fullName)}</td>
                            <td style={{ fontWeight: 600 }}>{t.title || "Levy"}</td>
                            <td style={{ color: "#475569", fontSize: "0.85rem" }}>{t.description || "-"}</td>
                            <td>{t.date ? new Date(t.date).toLocaleDateString() : "-"}</td>
                            <td style={{ textAlign: "right", fontWeight: 700, color: "#166d2e" }}>{formatCurrency(t.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: "#f1f5f9", fontWeight: 700, fontSize: "1.05rem", borderTop: "2px solid #cbd5e1" }}>
                          <td colSpan={4} style={{ textAlign: "right", padding: "14px 16px", color: "#0f172a" }}>
                            TOTAL LEVY PAYMENTS:
                          </td>
                          <td style={{ textAlign: "right", padding: "14px 16px", color: "#166d2e", fontSize: "1.15rem" }}>
                            {formatCurrency(modalLevyTotal)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Other Transactions Table */}
            {activeTab === "others" && (
              <div>
                {modalOtherTx.length === 0 ? (
                  <div className="report-modal__empty-text">No other transaction entries for {selectedMonthName} {selectedYear}.</div>
                ) : (
                  <div className="admin-dashboard__table-container">
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left" }}>Member / Source</th>
                          <th style={{ textAlign: "left" }}>Title</th>
                          <th style={{ textAlign: "left" }}>Description</th>
                          <th style={{ textAlign: "left" }}>Date</th>
                          <th style={{ textAlign: "right" }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalOtherTx.map((t) => (
                          <tr key={t.id}>
                            <td style={{ fontWeight: 600, color: "#1e293b" }}>{getMemberName(t.userId, t.fullName)}</td>
                            <td style={{ fontWeight: 600 }}>{t.title || "Transaction"}</td>
                            <td style={{ color: "#475569", fontSize: "0.85rem" }}>{t.description || "-"}</td>
                            <td>{t.date ? new Date(t.date).toLocaleDateString() : "-"}</td>
                            <td style={{ textAlign: "right", fontWeight: 700, color: "#166d2e" }}>{formatCurrency(t.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: "#f1f5f9", fontWeight: 700, fontSize: "1.05rem", borderTop: "2px solid #cbd5e1" }}>
                          <td colSpan={4} style={{ textAlign: "right", padding: "14px 16px", color: "#0f172a" }}>
                            TOTAL OTHER TRANSACTIONS:
                          </td>
                          <td style={{ textAlign: "right", padding: "14px 16px", color: "#166d2e", fontSize: "1.15rem" }}>
                            {formatCurrency(modalOtherTotal)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Tab 5: Attendance Table */}
            {activeTab === "attendance" && (
              <div>
                <div className="report-modal__attendance-summary" style={{ marginBottom: "1rem" }}>
                  <div className="report-modal__attendance-summary-stat">
                    <span className="report-modal__attendance-summary-label">Total Members</span>
                    <span className="report-modal__attendance-summary-value">{members.length}</span>
                  </div>
                  <div className="report-modal__attendance-summary-stat">
                    <span className="report-modal__attendance-summary-label">Present</span>
                    <span className="report-modal__attendance-summary-value" style={{ color: "#16a34a" }}>
                      {presentMembers.length}
                    </span>
                  </div>
                  <div className="report-modal__attendance-summary-stat">
                    <span className="report-modal__attendance-summary-label">Absent</span>
                    <span className="report-modal__attendance-summary-value" style={{ color: "#dc2626" }}>
                      {absentMembers.length}
                    </span>
                  </div>
                </div>

                <div className="report-modal__attendance-lists">
                  <div className="report-modal__attendance-list-block report-modal__attendance-list-block--present">
                    <div className="report-modal__attendance-list-header">✅ Present ({presentMembers.length})</div>
                    {presentMembers.length === 0 ? (
                      <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>No present members recorded for {selectedMonthName} {selectedYear}.</div>
                    ) : (
                      presentMembers.map((m) => (
                        <div key={m.id} className="report-modal__attendance-member-item">
                          {[m.firstName, m.lastName].filter(Boolean).join(" ") || m.email || "Member"}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="report-modal__attendance-list-block report-modal__attendance-list-block--absent">
                    <div className="report-modal__attendance-list-header">❌ Absent ({absentMembers.length})</div>
                    {absentMembers.length === 0 ? (
                      <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>All members present!</div>
                    ) : (
                      absentMembers.map((m) => (
                        <div key={m.id} className="report-modal__attendance-member-item">
                          {[m.firstName, m.lastName].filter(Boolean).join(" ") || m.email || "Member"}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
