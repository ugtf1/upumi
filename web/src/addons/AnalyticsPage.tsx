import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { apiGet, getAuthClaims } from "./api";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

type MeResponse = {
  linked: boolean;
  member?: {
    firstName?: string | null;
    lastName?: string | null;
    status?: string | null;
    goodStanding?: string | null;
    financialGoodStanding?: string | null;
    voter?: string | null;
    insurance?: string | null;
    attendancePct?: string | null;
    joined?: string | null;
  };
  monthlyDues?: { year: number; month: number; present: boolean | null; duesPaid: number | null }[];
};

type SummaryResponse = {
  year: number;
  kpis: { totalMembers: number; totalDues: number };
};

type LedgerSummaryResponse = {
  year: number;
  byType: {
    rowType: string;
    count: number;
    totalAmount: number;
    balanceAmount: number;
    duesPaidAmount: number;
  }[];
  accountBalances?: { title: string; amount: number }[];
  ytd?: { income: number; expense: number; net: number; memberBalance: number; memberDues?: number };
};

type MonthlyReportResponse = {
  year: number;
  month: number;
  periodLabel: string;
  duesPayments: {
    id: string;
    amount: number;
    present: boolean | null;
    member: { firstName?: string | null; lastName?: string | null } | null;
  }[];
  incomeRows: ReportRow[];
  expenseRows: ReportRow[];
  balanceRows: ReportRow[];
};

type ReportRow = {
  id: string;
  rowType?: string | null;
  title?: string | null;
  last?: string | null;
  first?: string | null;
  description?: string | null;
  total?: number | null;
  duesPaidYear?: number | null;
  balanceYear?: number | null;
  monthDueAmount?: number | null;
  raffleUpumi?: number | null;
  raffleUpuaConvention?: number | null;
  sswContribution?: number | null;
  anambraContribution?: number | null;
  upua25Raffle?: number | null;
  monthAmount?: number | null;
};

type MonthlyStatementRow = {
  grouping: string;
  last: string;
  first: string;
  amount: number;
};

const PIE_COLORS = ["#0b6b43", "#2e9d6f", "#6bc59b", "#f4b544", "#d46939", "#6f8bdc", "#9c7bd5"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function money(v: number | null | undefined) {
  if (v == null) return "—";
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString()}`;
}

function toTitleCase(v: string) {
  return v
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function cleanName(last?: string | null, first?: string | null) {
  return {
    last: String(last ?? "").trim() || "—",
    first: String(first ?? "").trim() || "—",
  };
}

function rowActivityAmount(r: ReportRow) {
  if (r.monthAmount != null && r.monthAmount !== 0) return Number(r.monthAmount);
  return (
    Number(r.total ?? 0) +
    Number(r.monthDueAmount ?? 0) +
    Number(r.raffleUpumi ?? 0) +
    Number(r.raffleUpuaConvention ?? 0) +
    Number(r.sswContribution ?? 0) +
    Number(r.anambraContribution ?? 0) +
    Number(r.upua25Raffle ?? 0)
  );
}

function cardStyle(): CSSProperties {
  return { background: "#fff", border: "1px solid #ddd", borderRadius: 10, padding: 14 };
}

export default function AnalyticsPage() {
  const claims = getAuthClaims();
  const [year, setYear] = useState(new Date().getFullYear());
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);

  const [me, setMe] = useState<MeResponse | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [ledgerSummary, setLedgerSummary] = useState<LedgerSummaryResponse | null>(null);
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReportResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setErr(null);

    (async () => {
      try {
        const [meRes, summaryRes, ledgerRes, reportRes] = await Promise.all([
          apiGet<MeResponse>(`/analytics/me?year=${year}`),
          apiGet<SummaryResponse>(`/analytics/summary?year=${year}`),
          apiGet<LedgerSummaryResponse>(`/analytics/ledger-summary?year=${year}`),
          apiGet<MonthlyReportResponse>(`/analytics/monthly-report?year=${year}&month=${reportMonth}`),
        ]);
        if (!active) return;

        setMe(meRes);
        setSummary(summaryRes);
        setLedgerSummary(ledgerRes);
        setMonthlyReport(reportRes);
      } catch (e: any) {
        if (!active) return;
        setErr(e?.message ?? "Failed to load dashboard data");
      }
    })();

    return () => {
      active = false;
    };
  }, [year, reportMonth]);

  const myDuesPaidTotal = useMemo(
    () => (me?.monthlyDues ?? []).reduce((sum, d) => sum + Number(d.duesPaid ?? 0), 0),
    [me]
  );

  const ytdPie = useMemo(() => {
    return [
      { name: "Income YTD", value: Math.abs(Number(ledgerSummary?.ytd?.income ?? 0)) },
      { name: "Expense YTD", value: Math.abs(Number(ledgerSummary?.ytd?.expense ?? 0)) },
      { name: "Net", value: Math.abs(Number(ledgerSummary?.ytd?.net ?? 0)) },
    ]
      .filter((r) => r.value > 0);
  }, [ledgerSummary]);

  const monthlyStatementRows = useMemo<MonthlyStatementRow[]>(() => {
    if (!monthlyReport) return [];

    const rows: MonthlyStatementRow[] = [];

    for (const r of monthlyReport.balanceRows ?? []) {
      const amount = Number(r.monthAmount ?? r.total ?? r.balanceYear ?? 0);
      if (!amount) continue;
      rows.push({
        grouping: "Balance",
        last: String(r.last || r.title || "Account").trim() || "Account",
        first: String(r.first || r.description || "—").trim() || "—",
        amount,
      });
    }

    for (const r of monthlyReport.expenseRows ?? []) {
      const amount = Math.abs(Number(r.monthAmount ?? r.total ?? rowActivityAmount(r)));
      if (!amount) continue;
      rows.push({
        grouping: "Expense",
        last: String(r.last || r.title || "Payments").trim() || "Payments",
        first: String(r.first || r.description || "—").trim() || "—",
        amount,
      });
    }

    for (const d of monthlyReport.duesPayments ?? []) {
      const amt = Number(d.amount ?? 0);
      if (!amt) continue;
      const name = cleanName(d.member?.lastName, d.member?.firstName);
      rows.push({
        grouping: "Member",
        last: name.last,
        first: name.first,
        amount: amt,
      });
    }

    for (const r of monthlyReport.incomeRows ?? []) {
      const amount = rowActivityAmount(r);
      if (!amount) continue;
      rows.push({
        grouping: "Income",
        last: String(r.last || r.title || "Other income").trim() || "Other income",
        first: String(r.first || r.description || "—").trim() || "—",
        amount,
      });
    }

    const order: Record<string, number> = { Balance: 1, Expense: 2, Member: 3, Income: 4 };
    return rows.sort((a, b) => {
      const oa = order[a.grouping] ?? 99;
      const ob = order[b.grouping] ?? 99;
      if (oa !== ob) return oa - ob;
      const lastCmp = a.last.localeCompare(b.last);
      if (lastCmp !== 0) return lastCmp;
      return a.first.localeCompare(b.first);
    });
  }, [monthlyReport]);

  const monthlyPie = useMemo(() => {
    const duesTotal = (monthlyReport?.duesPayments ?? []).reduce((s, d) => s + Number(d.amount ?? 0), 0);
    const incomeTotal = (monthlyReport?.incomeRows ?? []).reduce((s, r) => s + Math.max(0, rowActivityAmount(r)), 0);
    const expenseTotal = (monthlyReport?.expenseRows ?? []).reduce((s, r) => s + Math.abs(rowActivityAmount(r)), 0);
    const balanceTotal = (monthlyReport?.balanceRows ?? []).reduce((s, r) => s + Math.abs(Number(r.monthAmount ?? r.total ?? r.balanceYear ?? 0)), 0);

    return [
      { name: "Member dues", value: duesTotal },
      { name: "Other income", value: incomeTotal },
      { name: "Expenses", value: expenseTotal },
      { name: "Balances", value: balanceTotal },
    ].filter((x) => x.value > 0);
  }, [monthlyReport]);

  const amountColTitle = `${MONTHS[reportMonth - 1] ?? "Month"}$`;

  return (
    <div style={{ padding: 16, maxWidth: 1400, margin: "0 auto", color: "#111" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 28 }}>Dashboard</h2>
          <div style={{ color: "#444", marginTop: 4 }}>Signed in {claims?.role ? `as ${claims.role}` : ""}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label>
            Year{" "}
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ padding: 6 }}>
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label>
            Monthly report{" "}
            <select value={reportMonth} onChange={(e) => setReportMonth(Number(e.target.value))} style={{ padding: 6 }}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {err && <div style={{ background: "#fff3f3", border: "1px solid #e6b0b0", padding: 10, marginBottom: 12 }}>{err}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 12 }}>
        <StatCard label="Members" value={summary?.kpis.totalMembers ?? 0} />
        <StatCard label={`${year} dues total`} value={money(summary?.kpis.totalDues)} />
        <StatCard label="My account link" value={me?.linked ? "Linked" : "Not linked"} />
        <StatCard label={`My dues paid (${year})`} value={money(myDuesPaidTotal)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 12, marginBottom: 12 }}>
        <section style={cardStyle()}>
          <h3 style={{ marginTop: 0 }}>Year-to-date financial summary</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8, marginBottom: 10 }}>
            <Field label="Income YTD (dues + other income)" value={money(ledgerSummary?.ytd?.income ?? 0)} />
            <Field label="Expense YTD" value={money(ledgerSummary?.ytd?.expense ?? 0)} />
            <Field label="Net (P&L)" value={money(ledgerSummary?.ytd?.net ?? 0)} />
            <Field label="Member Balance YTD" value={money(ledgerSummary?.ytd?.memberBalance ?? 0)} />
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
              <thead>
                <tr style={{ background: "#f2f4f6", textAlign: "left" }}>
                  <th style={th}>Account</th>
                  <th style={thRight}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {(ledgerSummary?.accountBalances ?? []).map((r) => (
                  <tr key={r.title}>
                    <td style={td}>{toTitleCase(r.title)}</td>
                    <td style={tdRight}>{money(r.amount)}</td>
                  </tr>
                ))}
                {!(ledgerSummary?.accountBalances ?? []).length && (
                  <tr>
                    <td style={td} colSpan={2}>
                      No account balances found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section style={cardStyle()}>
          <h3 style={{ marginTop: 0 }}>YTD visual</h3>
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={ytdPie} dataKey="value" nameKey="name" outerRadius={110}>
                  {ytdPie.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => money(Number(value))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 12 }}>
        <section style={cardStyle()}>
          <h3 style={{ marginTop: 0 }}>Monthly report: {monthlyReport?.periodLabel ?? `${MONTHS[reportMonth - 1]} ${year}`}</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead>
                <tr style={{ background: "#f2f4f6", textAlign: "left" }}>
                  <th style={th}>Grouping</th>
                  <th style={th}>Last</th>
                  <th style={th}>First</th>
                  <th style={thRight}>{amountColTitle}</th>
                </tr>
              </thead>
              <tbody>
                {monthlyStatementRows.map((r, i) => (
                  <tr key={`${r.grouping}-${r.last}-${r.first}-${i}`}>
                    <td style={td}>{r.grouping}</td>
                    <td style={td}>{r.last}</td>
                    <td style={td}>{r.first}</td>
                    <td style={tdRight}>{money(r.amount)}</td>
                  </tr>
                ))}
                {!monthlyStatementRows.length && (
                  <tr>
                    <td style={td} colSpan={4}>
                      No monthly rows found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section style={cardStyle()}>
          <h3 style={{ marginTop: 0 }}>Monthly visual</h3>
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={monthlyPie} dataKey="value" nameKey="name" outerRadius={110}>
                  {monthlyPie.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => money(Number(value))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={cardStyle()}>
      <div style={{ fontSize: 12, color: "#666" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{String(value)}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 8 }}>
      <div style={{ fontSize: 12, color: "#666" }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

const th: CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid #ddd",
  whiteSpace: "nowrap",
};

const thRight: CSSProperties = {
  ...th,
  textAlign: "right",
};

const td: CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid #eee",
};

const tdRight: CSSProperties = {
  ...td,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};
