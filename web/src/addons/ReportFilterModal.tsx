import React, { useState } from "react";
import { FiX, FiFilter } from "react-icons/fi";
import { getAllDuesReadOnly, getAllTransactionsReadOnly, getHostingSchedule } from "./api";
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
import "./admin-page.scss";

type ReportFilterModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type ReportCategory = "dues" | "transactions" | "hosting";

type ApiMonthlyDue = {
  id: string;
  year: number;
  month: number;
  duesPaid: number;
  createdAt: string;
  member?: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  };
};

type ApiTransactionRow = {
  id: string;
  fullName: string;
  title: string;
  amount: string | number;
  date: string;
};

type HostingScheduleApiRow = {
  id: string;
  year: number;
  month: number;
  hostMember: string;
};

const YEAR_OPTIONS = [2024, 2025, 2026, 2027];
const MONTH_OPTIONS = MONTH_NAMES.map((name: string, i: number) => ({ value: i + 1, label: name }));

function formatCurrency(amount: number | string): string {
  const numeric = Number(amount);
  if (Number.isNaN(numeric)) return "$0";
  return `$${numeric.toLocaleString()}`;
}

export default function ReportFilterModal({ isOpen, onClose }: ReportFilterModalProps) {
  const [category, setCategory] = useState<ReportCategory>("dues");
  
  // Dates for Dues & Transactions
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Month/Year for Hosting
  const [startMonth, setStartMonth] = useState("");
  const [endMonth, setEndMonth] = useState("");
  const [hostingYear, setHostingYear] = useState<number>(new Date().getFullYear());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Result state
  const [resultsDues, setResultsDues] = useState<ApiMonthlyDue[] | null>(null);
  const [resultsTransactions, setResultsTransactions] = useState<ApiTransactionRow[] | null>(null);
  const [resultsHosting, setResultsHosting] = useState<HostingScheduleApiRow[] | null>(null);

  if (!isOpen) return null;

  function resetResults() {
    setResultsDues(null);
    setResultsTransactions(null);
    setResultsHosting(null);
    setError(null);
  }

  async function handleGenerateReport() {
    resetResults();
    setLoading(true);

    try {
      if (category === "dues") {
        if (!startDate || !endDate) throw new Error("Please select both a start and end date.");
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).setHours(23, 59, 59, 999);
        if (start > end) throw new Error("Start date cannot be after end date.");

        const rows = await getAllDuesReadOnly() as ApiMonthlyDue[];
        const filtered = rows.filter(r => {
          if (!r.createdAt) return false;
          const t = new Date(r.createdAt).getTime();
          return t >= start && t <= end && Number(r.duesPaid) > 0; // only paid dues
        });
        setResultsDues(filtered);

      } else if (category === "transactions") {
        if (!startDate || !endDate) throw new Error("Please select both a start and end date.");
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).setHours(23, 59, 59, 999);
        if (start > end) throw new Error("Start date cannot be after end date.");

        const rows = await getAllTransactionsReadOnly() as ApiTransactionRow[];
        const filtered = rows.filter(r => {
          if (!r.date) return false;
          const t = new Date(r.date).getTime();
          return t >= start && t <= end;
        });
        setResultsTransactions(filtered);

      } else if (category === "hosting") {
        if (!startMonth || !endMonth) throw new Error("Please select both start and end months.");
        const sm = Number(startMonth);
        const em = Number(endMonth);
        if (sm > em) throw new Error("Start month cannot be after end month.");

        const rows = await getHostingSchedule() as HostingScheduleApiRow[];
        const filtered = rows.filter(r => {
          return r.year === hostingYear && r.month >= sm && r.month <= em;
        });
        // Sort by month ascending
        filtered.sort((a, b) => a.month - b.month);
        setResultsHosting(filtered);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred generating the report.");
    } finally {
      setLoading(false);
    }
  }

  function handleCategoryChange(c: ReportCategory) {
    setCategory(c);
    resetResults();
  }

  function renderResults() {
    if (loading) {
      return <div className="admin-dashboard__empty-state" style={{ padding: "2rem" }}>Generating report...</div>;
    }

    if (resultsDues) {
      if (resultsDues.length === 0) return <div className="admin-dashboard__empty-state">No dues payments found for this period.</div>;
      
      const total = resultsDues.reduce((sum, r) => sum + Number(r.duesPaid || 0), 0);

      return (
        <div style={{ marginTop: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
            <strong>{resultsDues.length} Records Found</strong>
            <strong>Total: {formatCurrency(total)}</strong>
          </div>
          <div className="admin-dashboard__table-container">
            <table>
              <thead>
                <tr>
                  <th>Member Name</th>
                  <th>For Period</th>
                  <th>Date Paid</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {resultsDues.map((row: ApiMonthlyDue) => {
                  const name = [row.member?.firstName, row.member?.lastName].filter(Boolean).join(" ") || row.member?.email || "Unknown Member";
                  const monthName = MONTH_OPTIONS.find((m: { value: number; label: string }) => m.value === row.month)?.label || String(row.month);
                  return (
                    <tr key={row.id}>
                      <td data-label="Member Name">{name}</td>
                      <td data-label="For Period">{monthName} {row.year}</td>
                      <td data-label="Date Paid">{new Date(row.createdAt).toLocaleDateString()}</td>
                      <td data-label="Amount">{formatCurrency(row.duesPaid)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (resultsTransactions) {
      if (resultsTransactions.length === 0) return <div className="admin-dashboard__empty-state">No transactions found for this period.</div>;
      
      const total = resultsTransactions.reduce((sum, r) => sum + Number(r.amount || 0), 0);

      return (
        <div style={{ marginTop: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
            <strong>{resultsTransactions.length} Records Found</strong>
            <strong>Total: {formatCurrency(total)}</strong>
          </div>
          <div className="admin-dashboard__table-container">
            <table>
              <thead>
                <tr>
                  <th>Name / User</th>
                  <th>Title</th>
                  <th>Date</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {resultsTransactions.map((row: ApiTransactionRow) => (
                  <tr key={row.id}>
                    <td data-label="Name / User">{row.fullName}</td>
                    <td data-label="Title">{row.title}</td>
                    <td data-label="Date">{new Date(row.date).toLocaleDateString()}</td>
                    <td data-label="Amount">{formatCurrency(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (resultsHosting) {
      if (resultsHosting.length === 0) return <div className="admin-dashboard__empty-state">No hosting schedule found for this period.</div>;
      
      return (
        <div style={{ marginTop: "1rem" }}>
          <div style={{ marginBottom: "1rem" }}>
            <strong>{resultsHosting.length} Records Found for {hostingYear}</strong>
          </div>
          <div className="admin-dashboard__table-container">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Hosting Members</th>
                </tr>
              </thead>
              <tbody>
                {resultsHosting.map((row: HostingScheduleApiRow) => {
                  const monthName = MONTH_OPTIONS.find((m: { value: number; label: string }) => m.value === row.month)?.label || String(row.month);
                  return (
                    <tr key={row.id}>
                      <td data-label="Month">{monthName} {row.year}</td>
                      <td data-label="Hosting Members">{row.hostMember || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return null;
  }

  return (
    <div className="admin-dashboard__modal" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
      <div className="admin-dashboard__modal-backdrop" onClick={onClose} />

      <div className="admin-dashboard__modal-panel" style={{ maxWidth: "800px", width: "95%", maxHeight: "90vh", overflowY: "auto" }}>
        <button
          type="button"
          className="admin-dashboard__modal-close"
          onClick={onClose}
          aria-label="Close modal"
        >
          <FiX size={20} />
        </button>

        <h2 id="report-modal-title" className="admin-dashboard__modal-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <FiFilter size={24} /> Generate Report
        </h2>

        {error && <div className="admin-dashboard__modal-error">{error}</div>}

        <div className="transaction-page__modal-grid" style={{ marginBottom: "1.5rem" }}>
          <div className="admin-dashboard__modal-section">
            <label className="admin-dashboard__modal-label">Report Category</label>
            <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input member-view-page__modal-select-wrap">
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value as ReportCategory)}
                className="has-value"
              >
                <option value="dues">Dues Payments</option>
                <option value="transactions">Transactions</option>
                <option value="hosting">Hosting Schedule</option>
              </select>
            </div>
          </div>

          {(category === "dues" || category === "transactions") && (
            <>
              <div className="admin-dashboard__modal-section">
                <label className="admin-dashboard__modal-label">From Date</label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); resetResults(); }}
                  />
                </div>
              </div>
              <div className="admin-dashboard__modal-section">
                <label className="admin-dashboard__modal-label">To Date</label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input">
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); resetResults(); }}
                  />
                </div>
              </div>
            </>
          )}

          {category === "hosting" && (
            <>
              <div className="admin-dashboard__modal-section">
                <label className="admin-dashboard__modal-label">Year</label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input member-view-page__modal-select-wrap">
                  <select
                    value={hostingYear}
                    onChange={(e) => { setHostingYear(Number(e.target.value)); resetResults(); }}
                    className="has-value"
                  >
                    {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div className="admin-dashboard__modal-section">
                <label className="admin-dashboard__modal-label">From Month</label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input member-view-page__modal-select-wrap">
                  <select
                    value={startMonth}
                    onChange={(e) => { setStartMonth(e.target.value); resetResults(); }}
                    className={startMonth ? "has-value" : ""}
                  >
                    <option value="">Select month</option>
                    {MONTH_OPTIONS.map((m: { value: number; label: string }) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="admin-dashboard__modal-section">
                <label className="admin-dashboard__modal-label">To Month</label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input member-view-page__modal-select-wrap">
                  <select
                    value={endMonth}
                    onChange={(e) => { setEndMonth(e.target.value); resetResults(); }}
                    className={endMonth ? "has-value" : ""}
                  >
                    <option value="">Select month</option>
                    {MONTH_OPTIONS.map((m: { value: number; label: string }) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="admin-dashboard__modal-actions" style={{ marginBottom: "1.5rem" }}>
          <button
            type="button"
            className="admin-dashboard__modal-button admin-dashboard__modal-button--primary"
            onClick={handleGenerateReport}
            disabled={loading}
            style={{ width: "100%" }}
          >
            {loading ? "Generating..." : "Generate Report"}
          </button>
        </div>

        {/* Results Area */}
        <div style={{ borderTop: "1px solid var(--admin-border)", paddingTop: "1rem" }}>
          {renderResults()}
        </div>

      </div>
    </div>
  );
}
