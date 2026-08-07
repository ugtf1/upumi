import { useEffect, useRef, useState } from "react";
import { FiChevronDown, FiDownload, FiMail, FiPhone, FiUsers, FiUserCheck, FiDollarSign, FiAlertCircle, FiX } from "react-icons/fi";
import { apiGet, getAllMemberYearlyBalances, type MemberYearlyBalanceApiRow } from "./api";

// ── Types ─────────────────────────────────────────────────────────────────────
// Member Filter Report Modal - v2.0.0

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

function labelFor(value: string | null | undefined, fallback = "-") {
  if (!value) return fallback;
  const v = value.trim().toLowerCase();
  if (v === "yes" || v === "good" || v === "active" || v === "true" || v === "1") return "Yes";
  if (v === "no" || v === "bad" || v === "inactive" || v === "false" || v === "0") return "No";
  return value.trim();
}

function badgeColor(value: string): string {
  const v = value.toLowerCase();
  if (v === "yes" || v === "active" || v === "good") return "#22c55e";
  if (v === "no" || v === "inactive" || v === "bad") return "#ef4444";
  return "#64748b";
}

function BadgePill({ value }: { value: string }) {
  const color = badgeColor(value);
  return (
    <span style={{
      padding: "2px 10px",
      borderRadius: "99px",
      fontSize: "0.72rem",
      fontWeight: 600,
      background: `${color}22`,
      color,
      display: "inline-block",
      whiteSpace: "nowrap",
    }}>
      {value}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MemberFilterReportModal({ isOpen, onClose, memberSafe = false }: Props) {
  const [filterStatus, setFilterStatus] = useState<"ALL" | "Active" | "Inactive">("ALL");
  const [filterGoodStanding, setFilterGoodStanding] = useState<"ALL" | "Yes" | "No">("ALL");
  const [filterFinancialGoodStanding, setFilterFinancialGoodStanding] = useState<"ALL" | "Yes" | "No">("ALL");
  const [filterBalanceYear, setFilterBalanceYear] = useState<number | "ALL">("ALL");
  const [filterBalanceMin, setFilterBalanceMin] = useState<string>("");
  const [filterBalanceMax, setFilterBalanceMax] = useState<string>("");

  const [allMembers, setAllMembers] = useState<RawMember[]>([]);
  const [allBalances, setAllBalances] = useState<MemberYearlyBalanceApiRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportRows, setReportRows] = useState<MemberReportRow[] | null>(null);
  const [generated, setGenerated] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

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
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [isOpen, memberSafe]);

  function handleGenerateReport() {
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
        const fgsLabel = labelFor(m.financialGoodStanding);
        const gsLabel = labelFor(m.goodStanding);
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
          goodStanding: gsLabel,
          financialGoodStanding: fgsLabel,
          yearlyBalance,
          outstanding: formatCurrency(outstandingRaw),
          outstandingRaw,
          totalPaid: formatCurrency(totalPaidRaw),
          totalPaidRaw,
          voter: labelFor(m.voter),
          joined: m.joined ? new Date(m.joined).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-",
        };
      })
      .filter((row) => {
        if (filterStatus !== "ALL" && row.status !== filterStatus) return false;
        if (filterGoodStanding !== "ALL") {
          const gsNorm = row.goodStanding.toLowerCase();
          if (filterGoodStanding === "Yes" && gsNorm !== "yes") return false;
          if (filterGoodStanding === "No" && gsNorm !== "no") return false;
        }
        if (filterFinancialGoodStanding !== "ALL") {
          const fgsNorm = row.financialGoodStanding.toLowerCase();
          if (filterFinancialGoodStanding === "Yes" && fgsNorm !== "yes") return false;
          if (filterFinancialGoodStanding === "No" && fgsNorm !== "no") return false;
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
  }

  function handleExportCSV() {
    if (!reportRows) return;
    const headers = ["Member ID", "Name", "Email", "Phone", "Status", "Good Standing", "Financial Good Standing",
      ...(filterBalanceYear !== "ALL" ? [`Balance (${filterBalanceYear})`] : []),
      "Total Paid", "Outstanding", "Voter", "Joined"];
    const rows = reportRows.map((r) => [
      r.memberId, r.name, r.email, r.phone, r.status, r.goodStanding, r.financialGoodStanding,
      ...(filterBalanceYear !== "ALL" ? [r.yearlyBalance !== null ? String(r.yearlyBalance) : "-"] : []),
      r.totalPaid, r.outstanding, r.voter, r.joined,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c)}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `member-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Computed stats
  const activeCount = reportRows?.filter((r) => r.status === "Active").length ?? 0;
  const inactiveCount = reportRows ? reportRows.length - activeCount : 0;
  const goodStandingCount = reportRows?.filter((r) => r.goodStanding.toLowerCase() === "yes").length ?? 0;
  const financialGoodCount = reportRows?.filter((r) => r.financialGoodStanding.toLowerCase() === "yes").length ?? 0;
  const balanceRows = reportRows?.filter((r) => r.yearlyBalance !== null) ?? [];
  const avgBalance = balanceRows.length > 0 ? balanceRows.reduce((s, r) => s + (r.yearlyBalance ?? 0), 0) / balanceRows.length : null;
  const totalPaidSum = reportRows?.reduce((s, r) => s + r.totalPaidRaw, 0) ?? 0;
  const totalOutstandingSum = reportRows?.reduce((s, r) => s + r.outstandingRaw, 0) ?? 0;

  if (!isOpen) return null;

  const sel: React.CSSProperties = {
    border: "none", outline: "none", width: "100%", background: "transparent",
    cursor: "pointer", font: "inherit", height: "100%", appearance: "none", color: "#0f172a",
  };
  const fieldWrap: React.CSSProperties = {
    padding: "0 12px", display: "flex", alignItems: "center", background: "#fff",
    position: "relative", height: "44px", borderRadius: "8px", border: "1.5px solid #e2e8f0",
  };

  const summaryStats = [
    { label: "Total Members", value: reportRows?.length ?? 0, icon: FiUsers, color: "#6366f1" },
    { label: "Active", value: activeCount, icon: FiUserCheck, color: "#22c55e" },
    { label: "Inactive", value: inactiveCount, icon: FiAlertCircle, color: "#ef4444" },
    { label: "Good Standing", value: goodStandingCount, icon: FiUserCheck, color: "#3b82f6" },
    { label: "Financial Good", value: financialGoodCount, icon: FiDollarSign, color: "#f59e0b" },
    ...(avgBalance !== null ? [{ label: `Avg Balance (${filterBalanceYear})`, value: `$${avgBalance.toFixed(0)}`, icon: FiDollarSign, color: "#a78bfa" }] : []),
  ];

  return (
    <div
      ref={overlayRef}
      className="admin-dashboard__modal-overlay"
      style={{ zIndex: 1050 }}
      onMouseDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="admin-dashboard__modal"
        style={{
          width: "min(96vw, 1160px)", maxHeight: "92vh", display: "flex",
          flexDirection: "column", overflowY: "auto",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
          borderRadius: "16px", color: "#f8fafc", boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 28px 16px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700, color: "#f8fafc" }}>Member Report</h2>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#94a3b8" }}>
              Filter and generate detailed member reports with full profile information
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close modal"
            style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "8px", padding: "8px", cursor: "pointer", color: "#94a3b8", display: "flex", alignItems: "center" }}>
            <FiX size={20} />
          </button>
        </div>

        {/* ── Filters ── */}
        <div style={{ padding: "0 28px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
          {/* Member Status */}
          <div>
            <label style={{ display: "block", marginBottom: "6px", fontSize: "0.8rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Member Status</label>
            <div style={fieldWrap}>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)} style={sel}>
                <option value="ALL">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              <FiChevronDown size={14} style={{ position: "absolute", right: "10px", pointerEvents: "none", color: "#64748b" }} />
            </div>
          </div>

          {/* Good Standing */}
          <div>
            <label style={{ display: "block", marginBottom: "6px", fontSize: "0.8rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Good Standing</label>
            <div style={fieldWrap}>
              <select value={filterGoodStanding} onChange={(e) => setFilterGoodStanding(e.target.value as typeof filterGoodStanding)} style={sel}>
                <option value="ALL">All</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
              <FiChevronDown size={14} style={{ position: "absolute", right: "10px", pointerEvents: "none", color: "#64748b" }} />
            </div>
          </div>

          {/* Financial Good Standing */}
          <div>
            <label style={{ display: "block", marginBottom: "6px", fontSize: "0.8rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Financial Good Standing</label>
            <div style={fieldWrap}>
              <select value={filterFinancialGoodStanding} onChange={(e) => setFilterFinancialGoodStanding(e.target.value as typeof filterFinancialGoodStanding)} style={sel}>
                <option value="ALL">All</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
              <FiChevronDown size={14} style={{ position: "absolute", right: "10px", pointerEvents: "none", color: "#64748b" }} />
            </div>
          </div>

          {/* Yearly Balance Year (admin only) */}
          {!memberSafe && (
            <div>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "0.8rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Yearly Balance Year</label>
              <div style={fieldWrap}>
                <select
                  value={filterBalanceYear === "ALL" ? "ALL" : String(filterBalanceYear)}
                  onChange={(e) => setFilterBalanceYear(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
                  style={sel}
                >
                  <option value="ALL">All Years</option>
                  {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <FiChevronDown size={14} style={{ position: "absolute", right: "10px", pointerEvents: "none", color: "#64748b" }} />
              </div>
            </div>
          )}

          {/* Balance Min/Max (admin only, when year selected) */}
          {!memberSafe && filterBalanceYear !== "ALL" && (
            <>
              <div>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "0.8rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Balance Min ($)</label>
                <div style={fieldWrap}>
                  <input type="number" placeholder="Any" value={filterBalanceMin} onChange={(e) => setFilterBalanceMin(e.target.value)}
                    style={{ border: "none", outline: "none", width: "100%", background: "transparent", font: "inherit", color: "#0f172a" }} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "0.8rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Balance Max ($)</label>
                <div style={fieldWrap}>
                  <input type="number" placeholder="Any" value={filterBalanceMax} onChange={(e) => setFilterBalanceMax(e.target.value)}
                    style={{ border: "none", outline: "none", width: "100%", background: "transparent", font: "inherit", color: "#0f172a" }} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Action buttons ── */}
        <div style={{ display: "flex", gap: "12px", padding: "0 28px 20px", flexWrap: "wrap" }}>
          <button type="button" onClick={handleGenerateReport} disabled={loading}
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: "8px", padding: "10px 24px", color: "#fff", fontWeight: 600, fontSize: "0.9rem", cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
            {loading ? "Loading Data…" : "Generate Report"}
          </button>
          <button type="button" onClick={resetFilters}
            style={{ background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.15)", borderRadius: "8px", padding: "10px 20px", color: "#94a3b8", fontWeight: 500, fontSize: "0.9rem", cursor: "pointer" }}>
            Reset Filters
          </button>
          {reportRows && reportRows.length > 0 && (
            <button type="button" onClick={handleExportCSV}
              style={{ background: "rgba(34,197,94,0.15)", border: "1.5px solid rgba(34,197,94,0.3)", borderRadius: "8px", padding: "10px 20px", color: "#4ade80", fontWeight: 500, fontSize: "0.9rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
              <FiDownload size={16} /> Export CSV
            </button>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{ margin: "0 28px 16px", padding: "12px 16px", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", color: "#fca5a5", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "8px" }}>
            <FiAlertCircle size={16} /> {error}
          </div>
        )}

        {/* ── Results ── */}
        {generated && reportRows !== null && (
          <div style={{ padding: "0 28px 28px" }}>

            {/* Summary banner */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "12px", marginBottom: "24px" }}>
              {summaryStats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} style={{
                    background: "rgba(255,255,255,0.06)", borderRadius: "12px", padding: "16px",
                    borderLeft: `3px solid ${stat.color}`, display: "flex", flexDirection: "column", gap: "6px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", color: stat.color }}>
                      <Icon size={14} />
                      <span style={{ fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8" }}>{stat.label}</span>
                    </div>
                    <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#f8fafc", lineHeight: 1 }}>{stat.value}</div>
                  </div>
                );
              })}
            </div>

            {/* Financial totals strip */}
            <div style={{
              display: "flex", gap: "24px", flexWrap: "wrap", marginBottom: "20px",
              padding: "12px 18px", background: "rgba(255,255,255,0.04)", borderRadius: "10px",
              border: "1px solid rgba(255,255,255,0.08)", fontSize: "0.88rem",
            }}>
              <span style={{ color: "#94a3b8" }}>
                Total Paid: <strong style={{ color: "#34d399" }}>{formatCurrency(totalPaidSum)}</strong>
              </span>
              <span style={{ color: "#94a3b8" }}>
                Total Outstanding: <strong style={{ color: "#f87171" }}>{formatCurrency(totalOutstandingSum)}</strong>
              </span>
              <span style={{ color: "#94a3b8" }}>
                Net Balance: <strong style={{ color: totalPaidSum - totalOutstandingSum >= 0 ? "#34d399" : "#f87171" }}>
                  {formatCurrency(totalPaidSum - totalOutstandingSum)}
                </strong>
              </span>
            </div>

            {/* Results table */}
            {reportRows.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px", color: "#64748b", fontSize: "0.95rem" }}>
                No members match the selected filters.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid rgba(255,255,255,0.12)" }}>
                      {[
                        "#", "Member ID", "Name", "Contact", "Status",
                        "Good Standing", "Financial Standing",
                        ...(filterBalanceYear !== "ALL" ? [`Balance (${filterBalanceYear})`] : []),
                        "Total Paid", "Outstanding", "Voter", "Joined",
                      ].map((h) => (
                        <th key={h} style={{
                          padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#94a3b8",
                          fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap",
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((row, idx) => (
                      <tr
                        key={row.id}
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", transition: "background 0.15s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "11px 12px", color: "#475569", fontSize: "0.78rem" }}>{idx + 1}</td>
                        <td style={{ padding: "11px 12px", color: "#a5b4fc", fontWeight: 700, whiteSpace: "nowrap" }}>{row.memberId}</td>
                        <td style={{ padding: "11px 12px", color: "#f8fafc", fontWeight: 600, whiteSpace: "nowrap" }}>{row.name}</td>
                        {/* Contact: email + phone stacked */}
                        <td style={{ padding: "11px 12px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#94a3b8", fontSize: "0.78rem" }}>
                              <FiMail size={11} /> {row.email}
                            </span>
                            {row.phone !== "-" && (
                              <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#64748b", fontSize: "0.75rem" }}>
                                <FiPhone size={11} /> {row.phone}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "11px 12px" }}>
                          <BadgePill value={row.status} />
                        </td>
                        <td style={{ padding: "11px 12px" }}>
                          <BadgePill value={row.goodStanding} />
                        </td>
                        <td style={{ padding: "11px 12px" }}>
                          <BadgePill value={row.financialGoodStanding} />
                        </td>
                        {filterBalanceYear !== "ALL" && (
                          <td style={{ padding: "11px 12px", color: "#a5b4fc", fontWeight: 600 }}>
                            {row.yearlyBalance !== null ? formatCurrency(row.yearlyBalance) : "-"}
                          </td>
                        )}
                        <td style={{ padding: "11px 12px", color: "#34d399", fontWeight: 600 }}>{row.totalPaid}</td>
                        <td style={{ padding: "11px 12px", color: row.outstandingRaw > 0 ? "#f87171" : "#94a3b8", fontWeight: row.outstandingRaw > 0 ? 600 : 400 }}>{row.outstanding}</td>
                        <td style={{ padding: "11px 12px", color: "#94a3b8" }}>
                          <BadgePill value={row.voter} />
                        </td>
                        <td style={{ padding: "11px 12px", color: "#94a3b8", whiteSpace: "nowrap", fontSize: "0.78rem" }}>{row.joined}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "2px solid rgba(255,255,255,0.15)", background: "rgba(99,102,241,0.1)" }}>
                      <td colSpan={3} style={{ padding: "13px 12px", fontWeight: 700, color: "#f8fafc", fontSize: "0.85rem" }}>
                        TOTAL — {reportRows.length} member{reportRows.length !== 1 ? "s" : ""}
                      </td>
                      <td style={{ padding: "13px 12px" }} />
                      <td style={{ padding: "13px 12px" }}>
                        <span style={{ color: "#4ade80", fontWeight: 700, fontSize: "0.82rem" }}>{activeCount} Active</span>
                      </td>
                      <td style={{ padding: "13px 12px" }}>
                        <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: "0.82rem" }}>{goodStandingCount} Good</span>
                      </td>
                      <td style={{ padding: "13px 12px" }}>
                        <span style={{ color: "#fbbf24", fontWeight: 700, fontSize: "0.82rem" }}>{financialGoodCount} Fin. Good</span>
                      </td>
                      {filterBalanceYear !== "ALL" && (
                        <td style={{ padding: "13px 12px", color: "#a5b4fc", fontWeight: 700, fontSize: "0.82rem" }}>
                          {avgBalance !== null ? `Avg: $${avgBalance.toFixed(0)}` : "-"}
                        </td>
                      )}
                      <td style={{ padding: "13px 12px", color: "#34d399", fontWeight: 700 }}>{formatCurrency(totalPaidSum)}</td>
                      <td style={{ padding: "13px 12px", color: "#f87171", fontWeight: 700 }}>{formatCurrency(totalOutstandingSum)}</td>
                      <td colSpan={2} style={{ padding: "13px 12px" }} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
