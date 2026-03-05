import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { apiGet, apiPatch, apiPost, getToken } from "./api";

type MemberRow = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  status?: string | null;
  userId?: string | null;
};

type WorkbookRow = {
  id: string;
  sourceYear?: number | null;
  rowOrder: number;
  rowType?: string | null;
  hosting?: string | null;
  title?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  rawJson?: Record<string, unknown>;
};

type WorkbookRowsResponse = {
  rows: WorkbookRow[];
  columns?: string[];
};

function moneyFrom(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s === "-") return null;
  const n = Number(s.replace(/\$/g, "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function fmtMoney(v: number | null | undefined) {
  if (v == null) return "—";
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString()}`;
}

export default function AdminPage() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [workbookRows, setWorkbookRows] = useState<WorkbookRow[]>([]);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [csvText, setCsvText] = useState("");
  const [year, setYear] = useState<number>(2025);
  const [rowTypeFilter, setRowTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const [linkMemberId, setLinkMemberId] = useState("");
  const [linkUserEmail, setLinkUserEmail] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<WorkbookRow>>({});
  const [newRow, setNewRow] = useState({
    rowType: "Member",
    hosting: "",
    lastName: "",
    firstName: "",
    title: "",
  });
  const [newColumn, setNewColumn] = useState({
    columnKey: "",
    defaultValue: "",
    rowType: "all",
  });
  const [sheetUrl, setSheetUrl] = useState<string>(
    String((import.meta as any)?.env?.VITE_GOOGLE_SHEET_URL ?? "").trim()
  );
  const [sheetGid, setSheetGid] = useState<string>(
    String((import.meta as any)?.env?.VITE_GOOGLE_SHEET_GID ?? "0").trim() || "0"
  );
  const [sheetTab, setSheetTab] = useState<string>(
    String((import.meta as any)?.env?.VITE_GOOGLE_SHEET_TAB ?? "member_status").trim() || "member_status"
  );
  const [selectedEditColumn, setSelectedEditColumn] = useState<string>("Total");

  async function loadAll() {
    setLoading(true);
    setErr(null);
    try {
      const [m, w] = await Promise.all([
        apiGet<MemberRow[]>("/admin/members"),
        apiGet<WorkbookRowsResponse>(`/admin/workbook-rows?year=${year}`),
      ]);
      setMembers(m);
      setWorkbookRows(w.rows ?? []);
      setAvailableColumns(w.columns ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [year]);

  async function onImport() {
    setMsg(null);
    setErr(null);
    try {
      const res = await apiPost<{ imported: number; skipped: number }>("/admin/import-members", { csvText, year });
      setMsg(`Imported ${res.imported}, skipped ${res.skipped}`);
      await loadAll();
    } catch (e: any) {
      setErr(e?.message ?? "Import failed");
    }
  }

  async function onSyncGoogleSheet() {
    setMsg(null);
    setErr(null);
    try {
      const payload: Record<string, unknown> = { year };
      if (sheetUrl.trim()) payload.sheetUrl = sheetUrl.trim();
      if (sheetGid.trim()) payload.gid = sheetGid.trim();
      if (sheetTab.trim()) payload.sheetTab = sheetTab.trim();

      const res = await apiPost<{ workbookRows: number; importedMembers: number; duesRows: number }>("/admin/sync-google-sheet", payload);
      setMsg(`Google Sheet sync complete: ${res.workbookRows} rows, ${res.importedMembers} members, ${res.duesRows} dues rows`);
      await loadAll();
    } catch (e: any) {
      setErr(e?.message ?? "Google Sheet sync failed");
    }
  }

  async function onLink() {
    setMsg(null);
    setErr(null);
    try {
      const res = await apiPost<{ id: string }>("/admin/link-member", { memberRecordId: linkMemberId, userEmail: linkUserEmail });
      setMsg(`Linked member ${res.id}`);
      await loadAll();
    } catch (e: any) {
      setErr(e?.message ?? "Link failed");
    }
  }

  async function onCsvFile(file: File) {
    const text = await file.text();
    setCsvText(text);
  }

  async function saveRowEdit() {
    if (!editId) return;
    setMsg(null);
    setErr(null);
    try {
      await apiPatch(`/admin/workbook-rows/${editId}`, {
        rowType: editDraft.rowType,
        hosting: editDraft.hosting,
        title: editDraft.title,
        firstName: editDraft.firstName,
        lastName: editDraft.lastName,
        rawJson:
          selectedEditColumn.trim() && editDraft.rawJson
            ? {
                [selectedEditColumn]: (editDraft.rawJson as any)[selectedEditColumn] ?? "",
              }
            : undefined,
      });
      setMsg("Row updated");
      setEditId(null);
      setEditDraft({});
      await loadAll();
    } catch (e: any) {
      setErr(e?.message ?? "Update failed");
    }
  }

  async function addWorkbookRow() {
    setMsg(null);
    setErr(null);
    try {
      await apiPost("/admin/workbook-rows", {
        year,
        rowType: newRow.rowType,
        hosting: newRow.hosting,
        title: newRow.title,
        firstName: newRow.firstName,
        lastName: newRow.lastName,
      });
      setMsg("Workbook row added");
      setNewRow({ rowType: "Member", hosting: "", lastName: "", firstName: "", title: "" });
      await loadAll();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to add row");
    }
  }

  async function addWorkbookColumn() {
    setMsg(null);
    setErr(null);
    try {
      const res = await apiPost<{ updatedRows: number; columnKey: string }>("/admin/workbook-columns", {
        year,
        columnKey: newColumn.columnKey,
        defaultValue: newColumn.defaultValue,
        rowType: newColumn.rowType,
      });
      setMsg(`Column "${res.columnKey}" applied to ${res.updatedRows} rows`);
      setNewColumn((p) => ({ ...p, columnKey: "", defaultValue: "" }));
      await loadAll();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to add column");
    }
  }

  async function exportCsv() {
    setErr(null);
    try {
      const token = getToken();
      const res = await fetch(`/api/admin/export-workbook.csv?year=${year}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `upumi-workbook-${year}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setErr(e?.message ?? "Export failed");
    }
  }

  const rowTypeSummary = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of workbookRows) {
      const k = (r.rowType ?? "Unknown").trim() || "Unknown";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [workbookRows]);

  const rowTypesForFilter = useMemo(() => {
    const s = new Set<string>();
    for (const r of workbookRows) if (r.rowType) s.add(r.rowType);
    return ["all", ...Array.from(s).sort((a, b) => a.localeCompare(b))];
  }, [workbookRows]);

  const memberRows = useMemo(
    () => workbookRows.filter((r) => String(r.rowType ?? "").toLowerCase() === "member"),
    [workbookRows]
  );
  const otherIncomeRows = useMemo(
    () => workbookRows.filter((r) => String(r.rowType ?? "").toLowerCase().includes("other income")),
    [workbookRows]
  );
  const expenseRows = useMemo(
    () => workbookRows.filter((r) => String(r.rowType ?? "").toLowerCase().includes("expense")),
    [workbookRows]
  );
  const balanceRows = useMemo(
    () => workbookRows.filter((r) => String(r.rowType ?? "").toLowerCase().includes("balance")),
    [workbookRows]
  );

  const columnOptions = useMemo(() => {
    const fallback = ["Total", `${year} balance`, `${year} dues paid`];
    return Array.from(new Set([...fallback, ...availableColumns])).sort((a, b) => a.localeCompare(b));
  }, [availableColumns, year]);

  useEffect(() => {
    if (!selectedEditColumn || !columnOptions.includes(selectedEditColumn)) {
      setSelectedEditColumn(columnOptions[0] ?? "Total");
    }
  }, [columnOptions, selectedEditColumn]);

  function rowFinancialAmount(r: WorkbookRow) {
    const rowType = String(r.rowType ?? "").toLowerCase();
    if (rowType.includes("balance")) {
      return moneyFrom(r.rawJson?.[`${year} balance`]) ?? moneyFrom(r.rawJson?.Total);
    }
    if (selectedEditColumn) {
      const selected = moneyFrom(r.rawJson?.[selectedEditColumn]);
      if (selected != null) return selected;
    }
    return moneyFrom(r.rawJson?.Total);
  }

  function rowHasVisibleData(r: WorkbookRow) {
    const amount = rowFinancialAmount(r);
    const item = String(r.rawJson?.First ?? r.rawJson?.Title ?? r.firstName ?? "").trim();
    const host = String(r.rawJson?.Hosting ?? r.hosting ?? "").trim();
    return (amount != null && amount !== 0) || !!item || !!host;
  }

  const filteredOtherIncomeRows = useMemo(
    () => otherIncomeRows.filter((r) => rowHasVisibleData(r) && (rowFinancialAmount(r) ?? 0) !== 0),
    [otherIncomeRows, year, selectedEditColumn]
  );
  const filteredExpenseRows = useMemo(
    () => expenseRows.filter((r) => rowHasVisibleData(r) && (rowFinancialAmount(r) ?? 0) !== 0),
    [expenseRows, year, selectedEditColumn]
  );
  const filteredBalanceRows = useMemo(
    () =>
      balanceRows.filter((r) => {
        const amount = rowFinancialAmount(r);
        if (amount == null || amount === 0) return false;
        const last = String(r.rawJson?.Last ?? r.lastName ?? "").trim().toLowerCase();
        const title = String(r.rawJson?.Title ?? r.title ?? "").trim().toLowerCase();
        const first = String(r.rawJson?.First ?? r.firstName ?? "").trim().toLowerCase();
        return last === "account" || title === "account" || first === "account";
      }),
    [balanceRows, year, selectedEditColumn]
  );
  const ledgerAggregate = useMemo(() => {
    const total = (rows: WorkbookRow[]) => rows.reduce((sum, r) => sum + Number(rowFinancialAmount(r) ?? 0), 0);
    return {
      otherIncome: { rows: filteredOtherIncomeRows.length, total: total(filteredOtherIncomeRows) },
      expense: { rows: filteredExpenseRows.length, total: total(filteredExpenseRows) },
      balance: { rows: filteredBalanceRows.length, total: total(filteredBalanceRows) },
    };
  }, [filteredOtherIncomeRows, filteredExpenseRows, filteredBalanceRows, year, selectedEditColumn]);

  const editableRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workbookRows.filter((r) => {
      if (rowTypeFilter !== "all" && String(r.rowType ?? "").toLowerCase() !== rowTypeFilter.toLowerCase()) {
        return false;
      }
      if (!q) return true;
      return [r.rowType, r.hosting, r.firstName, r.lastName, r.title]
        .map((v) => String(v ?? "").toLowerCase())
        .join(" ")
        .includes(q);
    });
  }, [workbookRows, rowTypeFilter, search]);

  return (
    <div style={{ padding: 16, maxWidth: 1300, margin: "0 auto", color: "#111" }}>
      <h2 style={{ fontSize: 28, marginBottom: 8 }}>Admin Console</h2>
      <p style={{ color: "#444", marginBottom: 12 }}>
        Import workbook rows, group by data type, edit rows inline, and export for sharing.
      </p>

      {err && <div style={errorBox}>{err}</div>}
      {msg && <div style={okBox}>{msg}</div>}

      <section style={card}>
        <h3 style={{ marginTop: 0 }}>Import Workbook CSV</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
          <label>
            Year{" "}
            <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 100, padding: 6 }} />
          </label>
          <input
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            placeholder="Google Sheet URL (optional override)"
            style={{ minWidth: 360, padding: 6 }}
          />
          <input
            value={sheetGid}
            onChange={(e) => setSheetGid(e.target.value)}
            placeholder="gid"
            style={{ width: 90, padding: 6 }}
          />
          <input
            value={sheetTab}
            onChange={(e) => setSheetTab(e.target.value)}
            placeholder="Sheet tab name (default: member_status)"
            style={{ minWidth: 230, padding: 6 }}
          />
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onCsvFile(f);
            }}
          />
          <button onClick={() => void onImport()} disabled={!csvText.trim()} style={btn}>Import CSV</button>
          <button onClick={() => void onSyncGoogleSheet()} style={btn}>Sync Google Sheet</button>
          <button onClick={() => void loadAll()} disabled={loading} style={btn}>Refresh</button>
          <button onClick={() => void exportCsv()} style={btn}>Export Spreadsheet (CSV)</button>
          <button onClick={() => window.print()} style={btn}>Print / Save PDF</button>
        </div>
        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          rows={6}
          placeholder="Paste CSV here or choose a file..."
          style={{ width: "100%", fontFamily: "monospace", fontSize: 12, padding: 10 }}
        />
      </section>

      <section style={card}>
        <h3 style={{ marginTop: 0 }}>Link Member Record to User</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
          <input placeholder="Member record ID" value={linkMemberId} onChange={(e) => setLinkMemberId(e.target.value)} style={{ padding: 8 }} />
          <input placeholder="member@example.com" value={linkUserEmail} onChange={(e) => setLinkUserEmail(e.target.value)} style={{ padding: 8 }} />
          <button onClick={() => void onLink()} disabled={!linkMemberId || !linkUserEmail} style={btn}>Link</button>
        </div>
      </section>

      <section style={card}>
        <h3 style={{ marginTop: 0 }}>Workbook Row Type Summary</h3>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {rowTypeSummary.map(([k, v]) => (
            <div key={k} style={{ border: "1px solid #e2e2e2", borderRadius: 8, padding: "8px 10px", background: "#fafafa" }}>
              <strong>{k}</strong>: {v}
            </div>
          ))}
          {!rowTypeSummary.length && <div>No workbook rows loaded yet.</div>}
        </div>
      </section>

      <section style={card}>
        <h3 style={{ marginTop: 0 }}>Members (from Status = Member)</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
            <thead>
              <tr style={{ textAlign: "left", background: "#f7f7f7" }}>
                <th style={th}>Hosting</th>
                <th style={th}>Last</th>
                <th style={th}>First</th>
                <th style={th}>Total (dues owed)</th>
                <th style={th}>Financial GS</th>
                <th style={th}>Good Standing</th>
                <th style={th}>Insurance</th>
                <th style={th}>Raffle UPUMI</th>
                <th style={th}>Raffle UPUA</th>
              </tr>
            </thead>
            <tbody>
              {memberRows.map((r) => (
                <tr key={r.id}>
                  <td style={td}>{String(r.rawJson?.Hosting ?? r.hosting ?? "—")}</td>
                  <td style={td}>{String(r.rawJson?.Last ?? r.lastName ?? "—")}</td>
                  <td style={td}>{String(r.rawJson?.First ?? r.firstName ?? "—")}</td>
                  <td style={td}>{fmtMoney(moneyFrom(r.rawJson?.Total))}</td>
                  <td style={td}>{String(r.rawJson?.["Financial GoodStanding"] ?? "—")}</td>
                  <td style={td}>{String(r.rawJson?.GoodStanding ?? "—")}</td>
                  <td style={td}>{String(r.rawJson?.["Insurance?"] ?? "—")}</td>
                  <td style={td}>{fmtMoney(moneyFrom(r.rawJson?.["Raffle tix UPUMI fundraiser"]))}</td>
                  <td style={td}>{fmtMoney(moneyFrom(r.rawJson?.["Raffle tix UPUA convention"]))}</td>
                </tr>
              ))}
              {!memberRows.length && (
                <tr><td style={td} colSpan={9}>No member rows loaded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section style={card}>
        <h3 style={{ marginTop: 0 }}>Other Income (Status = other income)</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr style={{ textAlign: "left", background: "#f7f7f7" }}>
                <th style={th}>Item</th>
                <th style={th}>Hosting</th>
                <th style={th}>Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredOtherIncomeRows.map((r) => (
                <tr key={r.id}>
                  <td style={td}>{String(r.rawJson?.First ?? r.rawJson?.Title ?? "—")}</td>
                  <td style={td}>{String(r.rawJson?.Hosting ?? "—")}</td>
                  <td style={td}>{fmtMoney(rowFinancialAmount(r))}</td>
                </tr>
              ))}
              {!filteredOtherIncomeRows.length && (
                <tr><td style={td} colSpan={3}>No other income rows.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section style={card}>
        <h3 style={{ marginTop: 0 }}>Expenses & Balances (aggregated ledger)</h3>
        <div style={{ overflowX: "auto", marginBottom: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
            <thead>
              <tr style={{ textAlign: "left", background: "#f7f7f7" }}>
                <th style={th}>Type</th>
                <th style={th}>Rows</th>
                <th style={th}>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={td}>other income</td><td style={td}>{ledgerAggregate.otherIncome.rows}</td><td style={td}>{fmtMoney(ledgerAggregate.otherIncome.total)}</td></tr>
              <tr><td style={td}>expense</td><td style={td}>{ledgerAggregate.expense.rows}</td><td style={td}>{fmtMoney(ledgerAggregate.expense.total)}</td></tr>
              <tr><td style={td}>balance</td><td style={td}>{ledgerAggregate.balance.rows}</td><td style={td}>{fmtMoney(ledgerAggregate.balance.total)}</td></tr>
            </tbody>
          </table>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
            <thead>
              <tr style={{ textAlign: "left", background: "#f7f7f7" }}>
                <th style={th}>Type</th>
                <th style={th}>Item</th>
                <th style={th}>Hosting</th>
                <th style={th}>Total</th>
              </tr>
            </thead>
            <tbody>
              {[...filteredExpenseRows, ...filteredBalanceRows].map((r) => (
                <tr key={r.id}>
                  <td style={td}>{String(r.rowType ?? "—")}</td>
                  <td style={td}>{String(r.rawJson?.First ?? r.rawJson?.Title ?? r.firstName ?? "—")}</td>
                  <td style={td}>{String(r.rawJson?.Hosting ?? "—")}</td>
                  <td style={td}>{fmtMoney(rowFinancialAmount(r))}</td>
                </tr>
              ))}
              {!filteredExpenseRows.length && !filteredBalanceRows.length && (
                <tr><td style={td} colSpan={4}>No expense or balance rows.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Editable Workbook Rows</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={rowTypeFilter} onChange={(e) => setRowTypeFilter(e.target.value)} style={{ padding: 6 }}>
              {rowTypesForFilter.map((r) => (
                <option key={r} value={r}>{r === "all" ? "All row types" : r}</option>
              ))}
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rows..."
              style={{ padding: 6, minWidth: 220 }}
            />
            <button onClick={() => void loadAll()} style={btn}>Apply</button>
          </div>
        </div>

        <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: 10, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>Editable value column:</div>
            <select value={selectedEditColumn} onChange={(e) => setSelectedEditColumn(e.target.value)} style={{ padding: 6, minWidth: 220 }}>
              {columnOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Add Row</div>
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr 1fr 1fr auto", gap: 8 }}>
            <input
              value={newRow.rowType}
              onChange={(e) => setNewRow((p) => ({ ...p, rowType: e.target.value }))}
              placeholder="Type (Member/expense/etc)"
              style={{ padding: 6 }}
            />
            <input
              value={newRow.hosting}
              onChange={(e) => setNewRow((p) => ({ ...p, hosting: e.target.value }))}
              placeholder="Hosting (e.g., May 2027)"
              style={{ padding: 6 }}
            />
            <input
              value={newRow.lastName}
              onChange={(e) => setNewRow((p) => ({ ...p, lastName: e.target.value }))}
              placeholder="Last"
              style={{ padding: 6 }}
            />
            <input
              value={newRow.firstName}
              onChange={(e) => setNewRow((p) => ({ ...p, firstName: e.target.value }))}
              placeholder="First"
              style={{ padding: 6 }}
            />
            <input
              value={newRow.title}
              onChange={(e) => setNewRow((p) => ({ ...p, title: e.target.value }))}
              placeholder="Title"
              style={{ padding: 6 }}
            />
            <button
              onClick={() => void addWorkbookRow()}
              style={btn}
              disabled={!newRow.rowType.trim()}
            >
              Add Row
            </button>
          </div>
        </div>

        <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: 10, marginBottom: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Add / Update Column (bulk)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8 }}>
            <input
              value={newColumn.columnKey}
              onChange={(e) => setNewColumn((p) => ({ ...p, columnKey: e.target.value }))}
              placeholder="Column name (e.g., Dec$)"
              style={{ padding: 6 }}
            />
            <input
              value={newColumn.defaultValue}
              onChange={(e) => setNewColumn((p) => ({ ...p, defaultValue: e.target.value }))}
              placeholder="Default value"
              style={{ padding: 6 }}
            />
            <select
              value={newColumn.rowType}
              onChange={(e) => setNewColumn((p) => ({ ...p, rowType: e.target.value }))}
              style={{ padding: 6 }}
            >
              {rowTypesForFilter.map((r) => (
                <option key={r} value={r}>
                  {r === "all" ? "All row types" : r}
                </option>
              ))}
            </select>
            <button
              onClick={() => void addWorkbookColumn()}
              style={btn}
              disabled={!newColumn.columnKey.trim()}
            >
              Apply Column
            </button>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
            <thead>
              <tr style={{ background: "#f3f5f7", textAlign: "left" }}>
                <th style={th}>Type</th>
                <th style={th}>Hosting</th>
                <th style={th}>Last</th>
                <th style={th}>First</th>
                <th style={th}>Title</th>
                <th style={th}>{selectedEditColumn || "Column value"}</th>
                <th style={th}>Order</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {editableRows.map((r) => {
                const editing = editId === r.id;
                const val = (k: keyof WorkbookRow) => (editing ? (editDraft[k] as string | undefined) ?? "" : String(r[k] ?? ""));
                return (
                  <tr key={r.id}>
                    <td style={td}><input value={val("rowType")} onChange={(e) => setEditDraft((p) => ({ ...p, rowType: e.target.value }))} disabled={!editing} style={cellInput(editing)} /></td>
                    <td style={td}><input value={val("hosting")} onChange={(e) => setEditDraft((p) => ({ ...p, hosting: e.target.value }))} disabled={!editing} style={cellInput(editing)} /></td>
                    <td style={td}><input value={val("lastName")} onChange={(e) => setEditDraft((p) => ({ ...p, lastName: e.target.value }))} disabled={!editing} style={cellInput(editing)} /></td>
                    <td style={td}><input value={val("firstName")} onChange={(e) => setEditDraft((p) => ({ ...p, firstName: e.target.value }))} disabled={!editing} style={cellInput(editing)} /></td>
                    <td style={td}><input value={val("title")} onChange={(e) => setEditDraft((p) => ({ ...p, title: e.target.value }))} disabled={!editing} style={cellInput(editing)} /></td>
                    <td style={td}>
                      <input
                        value={editing ? String((editDraft.rawJson as any)?.[selectedEditColumn] ?? "") : String(r.rawJson?.[selectedEditColumn] ?? "")}
                        onChange={(e) =>
                          setEditDraft((p) => ({
                            ...p,
                            rawJson: {
                              ...((p.rawJson as Record<string, unknown>) ?? r.rawJson ?? {}),
                              [selectedEditColumn]: e.target.value,
                            },
                          }))
                        }
                        disabled={!editing}
                        style={cellInput(editing)}
                      />
                    </td>
                    <td style={td}>{r.rowOrder}</td>
                    <td style={td}>
                      {!editing ? (
                        <button
                          style={btn}
                          onClick={() => {
                            setEditId(r.id);
                            setEditDraft({
                              rowType: r.rowType ?? "",
                              hosting: r.hosting ?? "",
                              title: r.title ?? "",
                              firstName: r.firstName ?? "",
                              lastName: r.lastName ?? "",
                            });
                          }}
                        >
                          Edit
                        </button>
                      ) : (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button style={btn} onClick={() => void saveRowEdit()}>Save</button>
                          <button style={btn} onClick={() => { setEditId(null); setEditDraft({}); }}>Cancel</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!editableRows.length && (
                <tr><td style={td} colSpan={8}>No workbook rows found for this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section style={card}>
        <h3 style={{ marginTop: 0 }}>Auth-linked users ({members.length})</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr style={{ textAlign: "left", background: "#f7f7f7" }}>
                <th style={th}>Name</th>
                <th style={th}>Linked</th>
                <th style={th}>Record ID</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td style={td}>{`${m.firstName ?? ""} ${m.lastName ?? ""}`.trim() || "—"}</td>
                  <td style={td}>{m.userId ? "Yes" : "No"}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{m.id}</td>
                </tr>
              ))}
              {!members.length && (
                <tr><td style={td} colSpan={3}>No users yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const card: CSSProperties = {
  background: "#fff",
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: 12,
  marginBottom: 12,
};
const btn: CSSProperties = { padding: "8px 10px", cursor: "pointer" };
const th: CSSProperties = { padding: "8px 10px", borderBottom: "1px solid #ddd", whiteSpace: "nowrap" };
const td: CSSProperties = { padding: "8px 10px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" };
const errorBox: CSSProperties = { border: "1px solid #f1aaaa", background: "#fff3f3", padding: 12, marginBottom: 12 };
const okBox: CSSProperties = { border: "1px solid #aad2aa", background: "#f3fff3", padding: 12, marginBottom: 12 };

function cellInput(editing: boolean): CSSProperties {
  return {
    padding: 6,
    minWidth: 120,
    border: editing ? "1px solid #c8c8c8" : "1px solid transparent",
    background: editing ? "#fff" : "transparent",
  };
}
