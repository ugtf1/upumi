import { useEffect, useRef, useState } from "react";
import { FiChevronDown, FiDownload, FiX } from "react-icons/fi";
import { apiGet, getAllMemberYearlyBalances, type MemberYearlyBalanceApiRow } from "./api";

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
  status: string;
  goodStanding: string;
  financialGoodStanding: string;
  yearlyBalance: number | null;
  outstanding: string;
  totalPaid: string;
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
        return {
          id: m.id,
          memberId: m.displayMemberId || m.memberKey || m.id,
          name,
          email: m.email || "-",
          status: statusLabel,
          goodStanding: gsLabel,
          financialGoodStanding: fgsLabel,
          yearlyBalance,
          outstanding: formatCurrency(m.outstanding),
          totalPaid: formatCurrency(m.totalPaid),
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
    const headers = ["Member ID","Name","Email","Status","Good Standing","Financial Good Standing","Yearly Balance","Total Paid","Outstanding","Voter","Joined"];
    const rows = reportRows.map((r) => [
      r.memberId, r.name, r.email, r.status, r.goodStanding, r.financialGoodStanding,
      r.yearlyBalance !== null ? String(r.yearlyBalance) : "-",
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

  const activeCount = reportRows?.filter((r) => r.status === "Active").length ?? 0;
  const goodStandingCount = reportRows?.filter((r) => r.goodStanding.toLowerCase() === "yes").length ?? 0;
  const financialGoodCount = reportRows?.filter((r) => r.financialGoodStanding.toLowerCase() === "yes").length ?? 0;
  const balanceRows = reportRows?.filter((r) => r.yearlyBalance !== null) ?? [];
  const avgBalance = balanceRows.length > 0 ? balanceRows.reduce((s, r) => s + (r.yearlyBalance ?? 0), 0) / balanceRows.length : null;

  if (!isOpen) return null;

  const sel: React.CSSProperties = {
    border: "none", outline: "none", width: "100%", background: "transparent",
    cursor: "pointer", font: "inherit", height: "100%", appearance: "none", color: "#0f172a",
  };
  const fieldWrap: React.CSSProperties = {
    padding: "0 12px", display: "flex", alignItems: "center", background: "#fff",
    position: "relative", height: "44px", borderRadius: "8px", border: "1.5px solid #e2e8f0",
  };

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
          width: "min(96vw, 1080px)", maxHeight: "92vh", display: "flex",
          flexDirection: "column", overflowY: "auto",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
          borderRadius: "16px", color: "#f8fafc", boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 28px 16px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700, color: "#f8fafc" }}>Member Report Filter</h2>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#94a3b8" }}>Filter members by status, good standing, and yearly balance</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close modal"
            style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "8px", padding: "8px", cursor: "pointer", color: "#94a3b8", display: "flex", alignItems: "center" }}>
            <FiX size={20} />
          </button>
        </div>

        {/* Filters */}
        <div style={{ padding: "0 28px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
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

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "12px", padding: "0 28px 20px", flexWrap: "wrap" }}>
          <button type="button" onClick={handleGenerateReport} disabled={loading}
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: "8px", padding: "10px 24px", color: "#fff", fontWeight: 600, fontSize: "0.9rem", cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
            {loading ? "Loading Data..." : "Generate Report"}
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

        {/* Error */}
        {error && (
          <div style={{ margin: "0 28px 16px", padding: "12px 16px", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", color: "#fca5a5", fontSize: "0.85rem" }}>
            {error}
          </div>
        )}

        {/* Summary cards */}
        {generated && reportRows && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px", padding: "0 28px 20px" }}>
            {[
              { label: "Total Members", value: reportRows.length, color: "#6366f1" },
              { label: "Active", value: activeCount, color: "#22c55e" },
              { label: "Good Standing", value: goodStandingCount, color: "#3b82f6" },
              { label: "Financial Good Standing", value: financialGoodCount, color: "#f59e0b" },
              ...(avgBalance !== null ? [{ label: `Avg Balance (${filterBalanceYear})`, value: `$${avgBalance.toFixed(0)}`, color: "#a78bfa" }] : []),
            ].map((card) => (
              <div key={card.label} style={{ background: "rgba(255,255,255,0.06)", borderRadius: "10px", padding: "14px 16px", borderLeft: `3px solid ${card.color}` }}>
                <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#f8fafc" }}>{card.value}</div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "2px" }}>{card.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Results table */}
        {generated && reportRows !== null && (
          <div style={{ padding: "0 28px 28px", overflowX: "auto" }}>
            {reportRows.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#64748b", fontSize: "0.95rem" }}>
                No members match the selected filters.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    {["#","Member ID","Name","Email","Status","Good Standing","Financial Standing",
                      ...(filterBalanceYear !== "ALL" ? [`Balance (${filterBalanceYear})`] : []),
                      "Total Paid","Outstanding","Voter","Joined"].map((h) => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#94a3b8", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportRows.map((row, idx) => (
                    <tr key={row.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", transition: "background 0.15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      <td style={{ padding: "10px 12px", color: "#64748b" }}>{idx + 1}</td>
                      <td style={{ padding: "10px 12px", color: "#a5b4fc", fontWeight: 600 }}>{row.memberId}</td>
                      <td style={{ padding: "10px 12px", color: "#f8fafc", fontWeight: 500, whiteSpace: "nowrap" }}>{row.name}</td>
                      <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{row.email}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ padding: "2px 10px", borderRadius: "99px", fontSize: "0.75rem", fontWeight: 600, background: row.status === "Active" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: row.status === "Active" ? "#4ade80" : "#f87171" }}>
                          {row.status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ padding: "2px 10px", borderRadius: "99px", fontSize: "0.75rem", fontWeight: 600, background: `${badgeColor(row.goodStanding)}20`, color: badgeColor(row.goodStanding) }}>
                          {row.goodStanding}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ padding: "2px 10px", borderRadius: "99px", fontSize: "0.75rem", fontWeight: 600, background: `${badgeColor(row.financialGoodStanding)}20`, color: badgeColor(row.financialGoodStanding) }}>
                          {row.financialGoodStanding}
                        </span>
                      </td>
                      {filterBalanceYear !== "ALL" && (
                        <td style={{ padding: "10px 12px", color: "#a5b4fc", fontWeight: 600 }}>
                          {row.yearlyBalance !== null ? formatCurrency(row.yearlyBalance) : "-"}
                        </td>
                      )}
                      <td style={{ padding: "10px 12px", color: "#34d399" }}>{row.totalPaid}</td>
                      <td style={{ padding: "10px 12px", color: "#f87171" }}>{row.outstanding}</td>
                      <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{row.voter}</td>
                      <td style={{ padding: "10px 12px", color: "#94a3b8", whiteSpace: "nowrap" }}>{row.joined}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid rgba(255,255,255,0.12)", background: "rgba(99,102,241,0.08)" }}>
                    <td colSpan={4} style={{ padding: "12px", fontWeight: 700, color: "#f8fafc", fontSize: "0.85rem" }}>
                      TOTAL — {reportRows.length} member{reportRows.length !== 1 ? "s" : ""}
                    </td>
                    <td style={{ padding: "12px" }}><span style={{ color: "#4ade80", fontWeight: 600 }}>{activeCount} Active</span></td>
                    <td style={{ padding: "12px" }}><span style={{ color: "#3b82f6", fontWeight: 600 }}>{goodStandingCount} Good</span></td>
                    <td style={{ padding: "12px" }}><span style={{ color: "#f59e0b", fontWeight: 600 }}>{financialGoodCount} Fin. Good</span></td>
                    {filterBalanceYear !== "ALL" && (
                      <td style={{ padding: "12px", color: "#a5b4fc", fontWeight: 700 }}>
                        {avgBalance !== null ? `Avg: $${avgBalance.toFixed(0)}` : "-"}
                      </td>
                    )}
                    <td colSpan={4} style={{ padding: "12px" }} />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
