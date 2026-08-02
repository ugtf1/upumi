import { useState, useEffect } from "react";
import { FiEdit2, FiTrash2, FiCheck, FiX, FiPlus, FiDollarSign } from "react-icons/fi";
import {
  getYearlyBalancesReadOnly,
  saveYearlyBalance,
  deleteYearlyBalance,
  YearlyBalanceApiRow,
} from "./api";

interface YearlyBalanceManagerProps {
  isAdmin?: boolean;
}

export default function YearlyBalanceManager({ isAdmin = false }: YearlyBalanceManagerProps) {
  const [balances, setBalances] = useState<YearlyBalanceApiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // For Admin Edit/Add state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editYear, setEditYear] = useState<number>(new Date().getFullYear());
  const [editBalance, setEditBalance] = useState<string>("");
  const [isAdding, setIsAdding] = useState(false);

  // For Member view state
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear - 1);

  // Dynamically generate years from 2018 to current year
  const YEAR_OPTIONS = Array.from({ length: currentYear - 2018 + 1 }, (_, i) => 2018 + i).reverse();

  useEffect(() => {
    fetchBalances();
  }, []);

  const fetchBalances = async () => {
    try {
      setLoading(true);
      const data = await getYearlyBalancesReadOnly();
      setBalances(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load yearly balances");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editYear || !editBalance) return;
    try {
      setError(null);
      await saveYearlyBalance({
        id: editingId || undefined,
        year: editYear,
        balance: Number(editBalance),
      });
      setIsAdding(false);
      setEditingId(null);
      await fetchBalances();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save balance");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this yearly balance?")) return;
    try {
      setError(null);
      await deleteYearlyBalance(id);
      await fetchBalances();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete balance");
    }
  };

  const startEdit = (row: YearlyBalanceApiRow) => {
    setEditingId(row.id);
    setEditYear(row.year);
    setEditBalance(String(row.balance));
    setIsAdding(false);
  };

  const startAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setEditYear(currentYear);
    setEditBalance("");
  };

  const cancelEdit = () => {
    setIsAdding(false);
    setEditingId(null);
    setError(null);
  };

  if (loading && balances.length === 0) {
    return (
      <div className={isAdmin ? "admin-dashboard__summary-card" : "member-account__card member-account__summary-card"}>
        <div className={isAdmin ? "admin-dashboard__summary-header" : "member-account__summary-head"}>
          <div className={isAdmin ? "admin-dashboard__summary-title" : "member-account__summary-title"}>
            <h2>Yearly Balance</h2>
          </div>
        </div>
        <div className={isAdmin ? "admin-dashboard__summary-value" : "member-account__summary-footer"} style={isAdmin ? { fontSize: "1rem" } : {}}>
          <strong>Loading...</strong>
        </div>
      </div>
    );
  }

  // --- MEMBER VIEW ---
  if (!isAdmin) {
    const selectedBalanceRecord = balances.find(b => b.year === selectedYear);
    const displayBalance = selectedBalanceRecord
      ? `$${Number(selectedBalanceRecord.balance).toLocaleString()}`
      : "No Record";

    return (
      <article className="member-account__card member-account__summary-card">
        <div className="member-account__summary-head">
          <div className="member-account__summary-icon">
            <FiDollarSign size={22} />
          </div>
          <div className="member-account__summary-copy">
            <h2>Yearly Balance</h2>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{
                marginTop: "4px",
                padding: "2px 8px",
                borderRadius: "4px",
                border: "1px solid #cbd5e1",
                fontSize: "0.8rem",
                outline: "none",
                backgroundColor: "#f8fafc",
                color: "#475569",
                fontWeight: 600,
              }}
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="member-account__summary-footer">
          <strong>{displayBalance}</strong>
        </div>
      </article>
    );
  }

  // --- ADMIN VIEW ---
  return (
    <div className="admin-dashboard__summary-card" style={{ gridColumn: "1 / -1", width: "100%", padding: "20px" }}>
      <div className="admin-dashboard__summary-header" style={{ marginBottom: "16px" }}>
        <div className="admin-dashboard__summary-title" style={{ fontSize: "1.1rem", fontWeight: 700 }}>
          Yearly Balance Management
        </div>
        {!isAdding && !editingId && (
          <button
            onClick={startAdd}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "6px 12px", borderRadius: "6px", border: "none",
              backgroundColor: "#2563eb", color: "#fff", cursor: "pointer",
              fontSize: "0.85rem", fontWeight: 600
            }}
          >
            <FiPlus /> Add Balance
          </button>
        )}
      </div>

      {error && (
        <div style={{ color: "#dc2626", fontSize: "0.85rem", marginBottom: "12px" }}>
          {error}
        </div>
      )}

      {(isAdding || editingId) && (
        <div style={{
          display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px",
          padding: "16px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0",
          flexWrap: "wrap"
        }}>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "#64748b", marginBottom: "4px" }}>Year</label>
            <select
              value={editYear}
              onChange={(e) => setEditYear(Number(e.target.value))}
              style={{
                padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1",
                fontSize: "0.9rem", minWidth: "120px", outline: "none"
              }}
            >
              {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "#64748b", marginBottom: "4px" }}>Balance Amount ($)</label>
            <input
              type="number"
              value={editBalance}
              onChange={(e) => setEditBalance(e.target.value)}
              placeholder="e.g. 15000"
              style={{
                padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1",
                fontSize: "0.9rem", outline: "none"
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "8px", alignSelf: "flex-end", marginBottom: "2px", marginLeft: "auto" }}>
            <button
              onClick={cancelEdit}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1",
                backgroundColor: "#fff", color: "#475569", cursor: "pointer", fontWeight: 600
              }}
            >
              <FiX /> Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "8px 12px", borderRadius: "6px", border: "none",
                backgroundColor: "#16a34a", color: "#fff", cursor: "pointer", fontWeight: 600
              }}
            >
              <FiCheck /> Save
            </button>
          </div>
        </div>
      )}

      {balances.length === 0 && !isAdding && (
        <div style={{ color: "#64748b", fontSize: "0.9rem", padding: "12px 0" }}>
          No yearly balances recorded yet.
        </div>
      )}

      {balances.length > 0 && (
        <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {balances.sort((a, b) => b.year - a.year).map((row) => (
            <div key={row.id} style={{
              padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0",
              backgroundColor: editingId === row.id ? "#eff6ff" : "#fff",
              display: "flex", flexDirection: "column", gap: "12px"
            }}>
              <div>
                <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>{row.year} Balance</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#0f172a", marginTop: "4px" }}>
                  ${Number(row.balance).toLocaleString()}
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", paddingTop: "12px", borderTop: "1px solid #e2e8f0" }}>
                <button
                  onClick={() => startEdit(row)}
                  style={{
                    display: "flex", alignItems: "center", gap: "4px", fontSize: "0.75rem",
                    padding: "6px 12px", borderRadius: "4px", border: "none",
                    backgroundColor: "#e0e7ff", color: "#4338ca", cursor: "pointer", fontWeight: 600, flex: 1, justifyContent: "center"
                  }}
                >
                  <FiEdit2 size={12} /> Edit
                </button>
                <button
                  onClick={() => handleDelete(row.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: "4px", fontSize: "0.75rem",
                    padding: "6px 12px", borderRadius: "4px", border: "none",
                    backgroundColor: "#fee2e2", color: "#b91c1c", cursor: "pointer", fontWeight: 600, flex: 1, justifyContent: "center"
                  }}
                >
                  <FiTrash2 size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
