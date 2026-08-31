import { Fragment, useEffect, useMemo, useState, type CSSProperties } from "react";
import { apiGet } from "./api";

type PivotRow = {
  id: string;
  rowType: string;
  hosting: string | null;
  last: string | null;
  first: string | null;
  duesPaidYear: number | null;
  balanceYear: number | null;
  financialGoodStanding: string | null;
};

type PivotResponse = { year: number; rows: PivotRow[] };

type MemberDetail = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  status?: string | null;
  updatedAt?: string;
  rawJson?: Record<string, unknown>;
};

function money(v: number | null | undefined) {
  if (v == null) return "—";
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString()}`;
}

function renderScheduledHosting(val: string | null | undefined) {
  if (!val || val === "None" || val === "-" || val === "—") {
    return <span style={{ color: "#94a3b8", fontWeight: 400 }}>{val || "—"}</span>;
  }
  return (
    <span style={{ color: "#e11d48", fontWeight: 800, textShadow: "0 0 1px rgba(225, 29, 72, 0.2)" }}>
      {val}
    </span>
  );
}

export default function PivotMembersPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<PivotRow[]>([]);
  const [filter, setFilter] = useState("");
  const [hostingFilter, setHostingFilter] = useState("all");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [collapsedHosts, setCollapsedHosts] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErr(null);
    apiGet<PivotResponse>(`/analytics/pivot-members?year=${year}`)
      .then((res) => {
        if (!active) return;
        setRows(res.rows ?? []);
      })
      .catch((e: any) => {
        if (!active) return;
        setErr(e?.message ?? "Failed to load pivot rows");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [year]);

  const hostingOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.hosting) set.add(r.hosting);
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return rows.filter((r) => {
      if (String(r.rowType ?? "").toLowerCase() !== "member") return false;
      if (hostingFilter !== "all" && (r.hosting ?? "") !== hostingFilter) return false;
      if (!q) return true;
      const hay = [
        r.first ?? "",
        r.last ?? "",
        r.hosting ?? "",
        r.rowType ?? "",
        r.financialGoodStanding ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, filter, hostingFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, PivotRow[]>();
    for (const r of filtered) {
      const host = (r.hosting ?? "—").trim() || "—";
      if (!map.has(host)) map.set(host, []);
      map.get(host)!.push(r);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  async function openDetails(id: string) {
    setDetailLoading(true);
    setErr(null);
    try {
      const res = await apiGet<MemberDetail>(`/analytics/member-details/${id}`);
      setDetail(res);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load member details");
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 1300, margin: "0 auto", color: "#111" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 28, marginBottom: 4 }}>Membership Status</h2>
          <div style={{ color: "#444" }}>
            Pivot-style member table for all signed-in members. Click a name for full workbook-row details.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label>
            Year{" "}
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ padding: 6 }}>
              {[2024, 2025, 2026].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label>
            Hosting{" "}
            <select value={hostingFilter} onChange={(e) => setHostingFilter(e.target.value)} style={{ padding: 6, minWidth: 180 }}>
              {hostingOptions.map((h) => (
                <option key={h} value={h}>
                  {h === "all" ? "All" : h}
                </option>
              ))}
            </select>
          </label>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search name / hosting / status"
            style={{ padding: 6, minWidth: 220 }}
          />
        </div>
      </div>

      {err && <div style={{ marginTop: 12, background: "#fff3f3", border: "1px solid #e6b0b0", padding: 10 }}>{err}</div>}

      <div style={{ marginTop: 12, background: "#fff", border: "1px solid #ddd", borderRadius: 10, padding: 10 }}>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1200 }}>
              <thead>
                <tr style={{ background: "#eef1f5", textAlign: "left" }}>
                  <th style={th}>Hosting</th>
                  <th style={th}>Last</th>
                  <th style={th}>First</th>
                  <th style={th}>{year} dues paid</th>
                  <th style={th}>Balance</th>
                  <th style={th}>Financial GS</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(([host, hostRows]) => {
                  const isCollapsed = !!collapsedHosts[host];
                  return (
                    <Fragment key={`group-wrap-${host}`}>
                      <tr style={{ background: "#f4f6f8" }}>
                        <td style={{ ...td, fontWeight: 700 }}>
                          <button
                            type="button"
                            onClick={() =>
                              setCollapsedHosts((prev) => ({
                                ...prev,
                                [host]: !prev[host],
                              }))
                            }
                            style={{
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                              marginRight: 6,
                              color: "#0b6b43",
                              fontWeight: 700,
                            }}
                            title={isCollapsed ? "Expand group" : "Collapse group"}
                          >
                            {isCollapsed ? "+" : "-"}
                          </button>
                          {host}
                        </td>
                        <td style={td} colSpan={5}>
                          {hostRows.length} member{hostRows.length === 1 ? "" : "s"}
                        </td>
                      </tr>
                      {!isCollapsed &&
                        hostRows.map((r) => {
                          const negative = (r.balanceYear ?? 0) < 0;
                          return (
                            <tr key={r.id}>
                              <td style={td}>{renderScheduledHosting(r.hosting)}</td>
                              <td style={td}>
                                <button
                                  type="button"
                                  onClick={() => void openDetails(r.id)}
                                  style={{ border: "none", background: "none", color: "#0b6b43", cursor: "pointer", padding: 0 }}
                                  title="Open member details"
                                >
                                  {r.last ?? "—"}
                                </button>
                              </td>
                              <td style={td}>{r.first ?? "—"}</td>
                              <td style={tdMoney}>{money(r.duesPaidYear)}</td>
                              <td
                                style={{
                                  ...tdMoney,
                                  background: negative ? "#ffe7e7" : undefined,
                                  color: negative ? "#9c1c1c" : undefined,
                                }}
                              >
                                {money(r.balanceYear)}
                              </td>
                              <td style={td}>{r.financialGoodStanding ?? "—"}</td>
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })}
                {!filtered.length && (
                  <tr>
                    <td style={td} colSpan={6}>
                      No rows match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(detailLoading || detail) && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setDetail(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", width: "min(900px, 95vw)", maxHeight: "85vh", overflow: "auto", borderRadius: 10, padding: 14 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>
                {detailLoading
                  ? "Loading member details..."
                  : `${detail?.lastName ?? ""} ${detail?.firstName ?? ""}`.trim() || "Member Details"}
              </h3>
              <button type="button" onClick={() => setDetail(null)} style={{ padding: "6px 10px" }}>
                Close
              </button>
            </div>
            {!detailLoading && detail && (
              <>
                <div style={{ marginBottom: 8, color: "#555" }}>
                  status: {detail.status ?? "—"}
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f7f7f7", textAlign: "left" }}>
                        <th style={th}>Column</th>
                        <th style={th}>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(detail.rawJson ?? {}).map(([k, v]) => (
                        <tr key={k}>
                          <td style={{ ...td, fontWeight: 600, whiteSpace: "nowrap" }}>{k}</td>
                          <td style={td}>{String(v ?? "") || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const th: CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid #d7d7d7",
  whiteSpace: "nowrap",
};

const td: CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid #eee",
  whiteSpace: "nowrap",
};

const tdMoney: CSSProperties = {
  ...td,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};
