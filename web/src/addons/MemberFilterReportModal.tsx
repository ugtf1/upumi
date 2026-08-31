import { useEffect, useState } from "react";
import {
  FiX,
  FiFilter,
  FiChevronDown,
  FiDownload,
  FiAlertCircle,
  FiUsers,
} from "react-icons/fi";
import { apiGet, getAllMemberYearlyBalances, type MemberYearlyBalanceApiRow } from "./api";
import "./admin-page.scss";
import "./report-filter-modal.scss";

// ── Types ─────────────────────────────────────────────────────────────────────

type RawMember = {
  id: string;
  displayMemberId?: string | null;
  memberKey?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  joined?: string | null;
  status?: string | null;
  goodStanding?: string | null;
  financialGoodStanding?: string | null;
  balance?: number | null;
  attendancePct?: string | null;
  monthlyDuesAmount?: number | null;
  totalPaid?: number | null;
  outstanding?: number | null;
  voter?: string | null;
};

type MemberReportRow = {
  id: string;
  memberId: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  goodStanding: string;
  financialGoodStanding: string;
  yearlyBalance: number | null;
  outstanding: string;
  outstandingRaw: number;
  totalPaid: string;
  totalPaidRaw: number;
  voter: string;
  joined: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  /** When true, uses the member-safe endpoint (member role) */
  memberSafe?: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 2018 + 1 }, (_, i) => 2018 + i).reverse();

function formatCurrency(value: number | null | undefined) {
  if (value == null) return "-";
  return `$${Number(value).toLocaleString()}`;
}

function normaliseLabel(value: string | null | undefined): string {
  if (!value) return "No";
  const v = value.trim().toLowerCase();
  if (v === "yes" || v === "good" || v === "active" || v === "true" || v === "1") return "Yes";
  if (v === "no" || v === "bad" || v === "inactive" || v === "false" || v === "0") return "No";
  return value.trim();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MemberFilterReportModal({ isOpen, onClose, memberSafe = false }: Props) {
  // Filters
  const [filterStatus, setFilterStatus] = useState<"ALL" | "Active" | "Inactive">("ALL");
  const [filterGoodStanding, setFilterGoodStanding] = useState<"ALL" | "Yes" | "No">("ALL");
  const [filterFinancialGoodStanding, setFilterFinancialGoodStanding] = useState<"ALL" | "Yes" | "No">("ALL");
  const [filterBalanceYear, setFilterBalanceYear] = useState<number | "ALL">("ALL");
  const [filterBalanceMin, setFilterBalanceMin] = useState<string>("");
  const [filterBalanceMax, setFilterBalanceMax] = useState<string>("");

  // Data
  const [allMembers, setAllMembers] = useState<RawMember[]>([]);
  const [allBalances, setAllBalances] = useState<MemberYearlyBalanceApiRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportRows, setReportRows] = useState<MemberReportRow[] | null>(null);
  const [generated, setGenerated] = useState(false);

  // Load member list when opened
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);
    setError(null);
    setReportRows(null);
    setGenerated(false);

    const memberEndpoint = memberSafe ? "/me/members" : "/admin/members";
    const balanceFn = memberSafe
      ? () => Promise.resolve([] as MemberYearlyBalanceApiRow[])
      : getAllMemberYearlyBalances;

    Promise.all([apiGet<RawMember[]>(memberEndpoint), balanceFn()])
      .then(([members, balances]) => {
        if (!active) return;
        setAllMembers(members);
        setAllBalances(balances);
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err.message ?? "Failed to load member data");
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [isOpen, memberSafe]);

  // ── Report generation ──────────────────────────────────────────────────────

  function handleGenerateReport() {
    setError(null);

    const balanceLookup = new Map<string, number>();
    if (filterBalanceYear !== "ALL") {
      allBalances
        .filter((b) => b.year === filterBalanceYear)
        .forEach((b) => { balanceLookup.set(b.memberRecordId, Number(b.balance)); });
    }

    const rows: MemberReportRow[] = allMembers
      .map((m): MemberReportRow => {
        const name = [m.firstName, m.lastName].filter(Boolean).join(" ").trim() || m.email || "Unnamed";
        const statusLabel = String(m.status ?? "").trim().toLowerCase() === "active" ? "Active" : "Inactive";
        const yearlyBalance = filterBalanceYear !== "ALL" ? (balanceLookup.get(m.id) ?? null) : null;
        const outstandingRaw = Number(m.outstanding ?? 0);
        const totalPaidRaw = Number(m.totalPaid ?? 0);
        return {
          id: m.id,
          memberId: m.displayMemberId || m.memberKey || m.id,
          name,
          email: m.email || "-",
          phone: m.phone || "-",
          status: statusLabel,
          goodStanding: normaliseLabel(m.goodStanding),
          financialGoodStanding: Number(m.balance ?? yearlyBalance ?? 0) <= -240 ? "No" : normaliseLabel(m.financialGoodStanding),
          yearlyBalance,
          outstanding: formatCurrency(outstandingRaw),
          outstandingRaw,
          totalPaid: formatCurrency(totalPaidRaw),
          totalPaidRaw,
          voter: normaliseLabel(m.voter),
          joined: m.joined
            ? new Date(m.joined).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
            : "-",
        };
      })
      .filter((row) => {
        if (filterStatus !== "ALL" && row.status !== filterStatus) return false;
        if (filterGoodStanding !== "ALL") {
          if (filterGoodStanding === "Yes" && row.goodStanding !== "Yes") return false;
          if (filterGoodStanding === "No" && row.goodStanding !== "No") return false;
        }
        if (filterFinancialGoodStanding !== "ALL") {
          if (filterFinancialGoodStanding === "Yes" && row.financialGoodStanding !== "Yes") return false;
          if (filterFinancialGoodStanding === "No" && row.financialGoodStanding !== "No") return false;
        }
        if (filterBalanceYear !== "ALL" && row.yearlyBalance !== null) {
          const min = filterBalanceMin !== "" ? Number(filterBalanceMin) : null;
          const max = filterBalanceMax !== "" ? Number(filterBalanceMax) : null;
          if (min !== null && row.yearlyBalance < min) return false;
          if (max !== null && row.yearlyBalance > max) return false;
        }
        return true;
      });

    setReportRows(rows);
    setGenerated(true);
  }

  function resetFilters() {
    setFilterStatus("ALL");
    setFilterGoodStanding("ALL");
    setFilterFinancialGoodStanding("ALL");
    setFilterBalanceYear("ALL");
    setFilterBalanceMin("");
    setFilterBalanceMax("");
    setReportRows(null);
    setGenerated(false);
    setError(null);
  }

  function handleExportCSV() {
    if (!reportRows) return;
    const headers = [
      "Name", "Status", "Financial Good Standing",
      ...(filterBalanceYear !== "ALL" ? [`Balance (${filterBalanceYear})`] : []),
      "Voter",
    ];
    const csvRows = reportRows.map((r) => [
      r.name, r.status, r.financialGoodStanding,
      ...(filterBalanceYear !== "ALL" ? [r.yearlyBalance !== null ? String(r.yearlyBalance) : "-"] : []),
      r.voter,
    ]);
    const csv = [headers, ...csvRows]
      .map((row) => row.map((c) => `"${String(c)}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `member-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Computed stats ─────────────────────────────────────────────────────────

  const activeCount = reportRows?.filter((r) => r.status === "Active").length ?? 0;
  const goodStandingCount = reportRows?.filter((r) => r.goodStanding === "Yes").length ?? 0;
  const financialGoodCount = reportRows?.filter((r) => r.financialGoodStanding === "Yes").length ?? 0;
  const balanceRows = reportRows?.filter((r) => r.yearlyBalance !== null) ?? [];
  const avgBalance = balanceRows.length > 0
    ? balanceRows.reduce((s, r) => s + (r.yearlyBalance ?? 0), 0) / balanceRows.length
    : null;

  // ── Shared input style (matches ReportFilterModal) ─────────────────────────

  const selectInnerStyle: React.CSSProperties = {
    border: "none", outline: "none", width: "100%", background: "transparent",
    cursor: "pointer", font: "inherit", height: "100%", appearance: "none", color: "#0f172a",
  };

  if (!isOpen) return null;

  return (
    <div
      className="admin-dashboard__modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-report-modal-title"
    >
      {/* Backdrop — identical to ReportFilterModal */}
      <div className="report-modal__backdrop" onClick={onClose} />

      {/* Panel — identical outer shell to ReportFilterModal */}
      <div
        className="admin-dashboard__modal-panel"
        style={{
          maxWidth: "920px",
          width: "95%",
          maxHeight: "92vh",
          overflowY: "auto",
          display: "block",
          padding: "24px",
          borderRadius: "20px",
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
        }}
      >
        {/* Close button */}
        <button
          type="button"
          className="admin-dashboard__modal-close"
          onClick={onClose}
          aria-label="Close modal"
          style={{ position: "absolute", top: "16px", right: "16px" }}
        >
          <FiX size={20} />
        </button>

        {/* Title */}
        <h2
          id="member-report-modal-title"
          className="admin-dashboard__modal-title"
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1.4rem", marginBottom: "24px", color: "#0f172a" }}
        >
          <FiFilter size={24} style={{ color: "#166d2e" }} />
          Member Report
        </h2>

        {/* Error */}
        {error && (
          <div className="admin-dashboard__modal-error" style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <FiAlertCircle /> {error}
          </div>
        )}

        {/* ── Filter Panel (same background/border/radius as ReportFilterModal) ── */}
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
              alignItems: "end",
            }}
          >
            {/* Member Status */}
            <div className="admin-dashboard__modal-section">
              <label className="admin-dashboard__modal-label">Member Status</label>
              <div
                className="admin-dashboard__modal-input-field"
                style={{ padding: "0 12px", display: "flex", alignItems: "center", background: "#fff", position: "relative" }}
              >
                <select
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value as typeof filterStatus); setGenerated(false); }}
                  style={selectInnerStyle}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
                <FiChevronDown style={{ position: "absolute", right: "12px", pointerEvents: "none", color: "#64748b" }} />
              </div>
            </div>

            {/* Good Standing */}
            <div className="admin-dashboard__modal-section">
              <label className="admin-dashboard__modal-label">Good Standing</label>
              <div
                className="admin-dashboard__modal-input-field"
                style={{ padding: "0 12px", display: "flex", alignItems: "center", background: "#fff", position: "relative" }}
              >
                <select
                  value={filterGoodStanding}
                  onChange={(e) => { setFilterGoodStanding(e.target.value as typeof filterGoodStanding); setGenerated(false); }}
                  style={selectInnerStyle}
                >
                  <option value="ALL">All</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
                <FiChevronDown style={{ position: "absolute", right: "12px", pointerEvents: "none", color: "#64748b" }} />
              </div>
            </div>

            {/* Financial Good Standing */}
            <div className="admin-dashboard__modal-section">
              <label className="admin-dashboard__modal-label">Financial Good Standing</label>
              <div
                className="admin-dashboard__modal-input-field"
                style={{ padding: "0 12px", display: "flex", alignItems: "center", background: "#fff", position: "relative" }}
              >
                <select
                  value={filterFinancialGoodStanding}
                  onChange={(e) => { setFilterFinancialGoodStanding(e.target.value as typeof filterFinancialGoodStanding); setGenerated(false); }}
                  style={selectInnerStyle}
                >
                  <option value="ALL">All</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
                <FiChevronDown style={{ position: "absolute", right: "12px", pointerEvents: "none", color: "#64748b" }} />
              </div>
            </div>

            {/* Yearly Balance Year — admin only */}
            {!memberSafe && (
              <div className="admin-dashboard__modal-section">
                <label className="admin-dashboard__modal-label">Yearly Balance Year</label>
                <div
                  className="admin-dashboard__modal-input-field"
                  style={{ padding: "0 12px", display: "flex", alignItems: "center", background: "#fff", position: "relative" }}
                >
                  <select
                    value={filterBalanceYear === "ALL" ? "ALL" : String(filterBalanceYear)}
                    onChange={(e) => { setFilterBalanceYear(e.target.value === "ALL" ? "ALL" : Number(e.target.value)); setGenerated(false); }}
                    style={selectInnerStyle}
                  >
                    <option value="ALL">All Years</option>
                    {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <FiChevronDown style={{ position: "absolute", right: "12px", pointerEvents: "none", color: "#64748b" }} />
                </div>
              </div>
            )}

            {/* Balance Min / Max — admin only, only when a year is selected */}
            {!memberSafe && filterBalanceYear !== "ALL" && (
              <>
                <div className="admin-dashboard__modal-section">
                  <label className="admin-dashboard__modal-label">Balance Min ($)</label>
                  <div
                    className="admin-dashboard__modal-input-field"
                    style={{ padding: "0 12px", display: "flex", alignItems: "center", background: "#fff" }}
                  >
                    <input
                      type="number"
                      placeholder="Any"
                      value={filterBalanceMin}
                      onChange={(e) => { setFilterBalanceMin(e.target.value); setGenerated(false); }}
                      style={{ border: "none", outline: "none", width: "100%", background: "transparent", font: "inherit", color: "#0f172a" }}
                    />
                  </div>
                </div>
                <div className="admin-dashboard__modal-section">
                  <label className="admin-dashboard__modal-label">Balance Max ($)</label>
                  <div
                    className="admin-dashboard__modal-input-field"
                    style={{ padding: "0 12px", display: "flex", alignItems: "center", background: "#fff" }}
                  >
                    <input
                      type="number"
                      placeholder="Any"
                      value={filterBalanceMax}
                      onChange={(e) => { setFilterBalanceMax(e.target.value); setGenerated(false); }}
                      style={{ border: "none", outline: "none", width: "100%", background: "transparent", font: "inherit", color: "#0f172a" }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Generate button — same class as ReportFilterModal */}
            <div className="admin-dashboard__modal-section">
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--primary"
                onClick={handleGenerateReport}
                disabled={loading}
                style={{ width: "100%", minHeight: "44px", borderRadius: "12px" }}
              >
                {loading ? "Loading…" : "Generate"}
              </button>
            </div>

            {/* Reset + Export — on same row as generate (always visible once generated) */}
            {generated && (
              <>
                <div className="admin-dashboard__modal-section">
                  <button
                    type="button"
                    className="admin-dashboard__modal-button admin-dashboard__modal-button--secondary"
                    onClick={resetFilters}
                    style={{ width: "100%", minHeight: "44px", borderRadius: "12px" }}
                  >
                    Reset Filters
                  </button>
                </div>
                {reportRows && reportRows.length > 0 && (
                  <div className="admin-dashboard__modal-section">
                    <button
                      type="button"
                      className="admin-dashboard__modal-button admin-dashboard__modal-button--secondary"
                      onClick={handleExportCSV}
                      style={{ width: "100%", minHeight: "44px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                    >
                      <FiDownload size={15} /> Export CSV
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Results Area (below a divider, same pattern as ReportFilterModal) ── */}
        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}>
          {renderResults()}
        </div>
      </div>
    </div>
  );

  // ── Render Results ─────────────────────────────────────────────────────────

  function renderResults() {
    if (loading) {
      return (
        <div
          className="admin-dashboard__empty-state"
          style={{ padding: "3rem 1rem", display: "flex", flexDirection: "column", gap: "1rem", alignItems: "center" }}
        >
          <div
            className="admin-dashboard__modal-input-field"
            style={{ border: "none", animation: "pulse 1.5s infinite", width: "120px", height: "4px", background: "#166d2e", borderRadius: "2px" }}
          />
          <span style={{ color: "#64748b", fontWeight: 600 }}>Loading member data…</span>
        </div>
      );
    }

    if (!generated || reportRows === null) return null;

    if (reportRows.length === 0) {
      return (
        <div className="report-modal__empty-text">
          No members match the selected filters.
        </div>
      );
    }

    // ── Summary banner (uses same attendance-summary style from report-filter-modal.scss) ──
    const summaryItems = [
      { label: "Total Members", value: reportRows.length },
      { label: "Active", value: activeCount },
      { label: "Good Standing", value: goodStandingCount },
      { label: "Financial Good Standing", value: financialGoodCount },
      ...(avgBalance !== null ? [{ label: `Avg Balance (${filterBalanceYear})`, value: `$${avgBalance.toFixed(0)}` }] : []),
    ];

    return (
      <div style={{ marginTop: "1rem" }}>

        {/* ── Summary banner — matches attendance summary style ── */}
        <div
          className="report-modal__attendance-summary"
          style={{ gridTemplateColumns: `repeat(${summaryItems.length}, 1fr)`, marginBottom: "1.25rem" }}
        >
          {summaryItems.map((s) => (
            <div key={s.label} className="report-modal__attendance-summary-stat">
              <span className="report-modal__attendance-summary-label">{s.label}</span>
              <span className="report-modal__attendance-summary-value">{s.value}</span>
            </div>
          ))}
        </div>

        {/* ── Record count + financial totals strip ── */}
        <div
          style={{
            display: "flex", justifyContent: "space-between", flexWrap: "wrap",
            gap: "8px", marginBottom: "1.25rem", paddingInline: "4px", alignItems: "center",
          }}
        >
          <span style={{ fontSize: "0.95rem", color: "#475569" }}>
            Found <strong>{reportRows.length}</strong> member{reportRows.length !== 1 ? "s" : ""}
          </span>
          <div style={{ display: "flex", gap: "16px", fontSize: "1rem", flexWrap: "wrap" }}>
          </div>
        </div>

        {/* ── Main table — same container class as ReportFilterModal ── */}
        <div className="admin-dashboard__table-container">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>#</th>
                <th style={{ textAlign: "left" }}>Name</th>
                <th style={{ textAlign: "left" }}>Status</th>
                <th style={{ textAlign: "left" }}>Financial Standing</th>
                {filterBalanceYear !== "ALL" && (
                  <th style={{ textAlign: "right" }}>Balance ({filterBalanceYear})</th>
                )}
                <th style={{ textAlign: "left" }}>Voter</th>
              </tr>
            </thead>

            <tbody>
              {reportRows.map((row, idx) => (
                <tr key={row.id}>
                  <td data-label="#" style={{ color: "#94a3b8", fontSize: "0.8rem" }}>{idx + 1}</td>

                  <td data-label="Name" style={{ fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap" }}>
                    {row.name}
                  </td>

                  {/* Status pill */}
                  <td data-label="Status">
                    <span
                      className={`admin-dashboard__status-pill ${row.status === "Active" ? "is-good" : "is-bad"}`}
                      style={{ fontSize: "0.78rem", padding: "3px 8px" }}
                    >
                      {row.status}
                    </span>
                  </td>

                  {/* Financial Good Standing pill */}
                  <td data-label="Financial Standing">
                    <span
                      className={`admin-dashboard__status-pill ${row.financialGoodStanding === "Yes" ? "is-good" : "is-bad"}`}
                      style={{ fontSize: "0.78rem", padding: "3px 8px" }}
                    >
                      {row.financialGoodStanding}
                    </span>
                  </td>

                  {filterBalanceYear !== "ALL" && (
                    <td data-label={`Balance (${filterBalanceYear})`} style={{ textAlign: "right", fontWeight: 600, color: "#166d2e" }}>
                      {row.yearlyBalance !== null ? formatCurrency(row.yearlyBalance) : "-"}
                    </td>
                  )}

                  {/* Voter pill */}
                  <td data-label="Voter">
                    <span
                      className={`admin-dashboard__status-pill ${row.voter === "Yes" ? "is-good" : "is-neutral"}`}
                      style={{ fontSize: "0.78rem", padding: "3px 8px" }}
                    >
                      {row.voter}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>

            {/* ── Totals footer (same style as ReportFilterModal) ── */}
            <tfoot>
              <tr style={{ background: "#f1f5f9", fontWeight: 700, fontSize: "1.05rem", borderTop: "2px solid #cbd5e1" }}>
                <td colSpan={2} style={{ padding: "14px 16px", color: "#0f172a" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <FiUsers size={14} /> {reportRows.length} member{reportRows.length !== 1 ? "s" : ""}
                  </span>
                </td>
                <td style={{ padding: "14px 16px", color: "#475569", fontSize: "0.85rem" }}>
                  {activeCount} active
                </td>
                <td colSpan={filterBalanceYear !== "ALL" ? 3 : 2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }
}
