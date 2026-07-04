import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
// import type { IconType } from "react-icons";
import {
  FiCreditCard,
  FiDollarSign,
  FiLogOut,
  FiSettings,
  FiUsers,
} from "react-icons/fi";

import { clearToken, getMemberProfile, apiGet } from "./api";
import memberImage from "./upu-logo.svg";
import "./admin-page.scss";
import "./transaction-page.scss";

type ExpenseRow = {
  id: string;
  date: string;
  reason: string;
  title: string;
  amount: string;
};

type TransactionApiRow = {
  id: string;
  userId?: string | null;
  fullName: string;
  title: string;
  amount: string | number;
  date: string;
};

type ExpenseApiRow = {
  id: string;
  reason: string;
  title: string;
  amount: string | number;
  date: string;
};

type DuesApiRow = {
  id: string;
  memberRecordId: string;
  year: number;
  month: number;
  duesPaid: string | number;
  memberRecord?: {
    user?: {
      firstName?: string | null;
      lastName?: string | null;
    } | null;
  } | null;
};

type MemberProfileResponse = {
  member?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null;
};


type TransactionRow = {
  id: string;
  date: string;
  fullName: string;
  title: string;
  amount: string;
  status: string;
};



const MEMBER_ROUTE_CONFIG: Record<string, { path: string; label: string }> = {
  "/member": { path: "/member", label: "Community Dashboard" },
  "/member/transaction": { path: "/member/transaction", label: "Transaction" },
  "/member/account": { path: "/member/account", label: "Account" },
  "/member/settings": { path: "/member/settings", label: "Settings" },
};

// const YEAR_OPTIONS = [2024, 2025, 2026, 2027];
// const COUNT_OPTIONS = ["0", "1", "2", "3"];
// const STATUS_OPTIONS = ["All Members", "Active", "Pending", "Inactive"];

export default function MemberTransaction() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeNav, setActiveNav] = useState("Community Dashboard");

  // const MEMBER_NAV_ITEMS: NavigationItem[] = [
  //   {
  //     label: "Community Dashboard",
  //     icon: FiUsers,
  //     action: () => navigate("/member", { state: { nav: "Community Dashboard" } }),
  //   },
  //   {
  //     label: "Transaction",
  //     icon: FiCreditCard,
  //     action: () => navigate("/member/transaction", { state: { nav: "Transaction" } }),
  //   },
  //   {
  //     label: "Account",
  //     icon: FiUsers,
  //     action: () => navigate("/member/account", { state: { nav: "Account" } }),
  //   },
  // ];

  useEffect(() => {
    const routeConfig = MEMBER_ROUTE_CONFIG[location.pathname] ?? MEMBER_ROUTE_CONFIG["/member"];
    const state = location.state as { nav?: string } | null;
    const nextLabel = state?.nav ?? routeConfig.label;
    setActiveNav(nextLabel);
    if (state) navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  // const [year, setYear] = useState(2026);
  const [search, setSearch] = useState("");
  const [transactionRows, setTransactionRows] = useState<TransactionRow[]>([]);
  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [expLoading, setExpLoading] = useState(true);
  const [txError, setTxError] = useState<string | null>(null);
  const [expError, setExpError] = useState<string | null>(null);
  const [memberProfile, setMemberProfile] = useState<MemberProfileResponse | null>(null);

  // Fetch member profile + all transactions + all dues
  useEffect(() => {
    const fetchData = async () => {
      try {
        setTxLoading(true);
        setTxError(null);

        const [profile, allTransactions, allDues] = await Promise.all([
          getMemberProfile() as Promise<MemberProfileResponse>,
          apiGet<TransactionApiRow[]>("/admin/database/transactions").catch(() => [] as TransactionApiRow[]),
          apiGet<DuesApiRow[]>("/admin/database/dues").catch(() => [] as DuesApiRow[]),
        ]);

        setMemberProfile(profile);

        const memberName = profile?.member
          ? `${profile.member.firstName ?? ""} ${profile.member.lastName ?? ""}`.trim() || "Member"
          : "Member";

        const txRows: TransactionRow[] = allTransactions.map((tx) => ({
          id: tx.id,
          date: tx.date
            ? new Date(tx.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
            : "-",
          fullName: tx.fullName || memberName,
          title: tx.title,
          amount: `$${Number(tx.amount ?? 0).toLocaleString()}`,
          status: "Completed",
        }));

        const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        // Build dues rows from ALL members' dues records
        const dueRows: TransactionRow[] = allDues
          .filter((d) => Number(d.duesPaid ?? 0) > 0)
          .map((d) => {
            const firstName = d.memberRecord?.user?.firstName ?? "";
            const lastName = d.memberRecord?.user?.lastName ?? "";
            const dueMemberName = `${firstName} ${lastName}`.trim() || "Member";
            return {
              id: `dues-${d.id}`,
              date: `${monthNames[(d.month ?? 1) - 1] ?? ""} ${d.year}`,
              fullName: dueMemberName,
              title: "Monthly Dues",
              amount: `$${Number(d.duesPaid ?? 0).toLocaleString()}`,
              status: "Paid",
            };
          });

        setTransactionRows([...txRows, ...dueRows]);
      } catch (err) {
        setTxError(err instanceof Error ? err.message : "Failed to load transactions");
      } finally {
        setTxLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch all expenses
  useEffect(() => {
    let active = true;
    setExpLoading(true);
    apiGet<ExpenseApiRow[]>("/admin/database/expenses")
      .then((rows) => {
        if (!active) return;
        setExpenseRows(
          rows.map((row) => ({
            id: row.id,
            date: row.date
              ? new Date(row.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
              : "-",
            reason: row.reason,
            title: row.title,
            amount: `$${Number(row.amount ?? 0).toLocaleString()}`,
          }))
        );
      })
      .catch((err: Error) => { if (active) setExpError(err?.message ?? "Failed to load expenses"); })
      .finally(() => { if (active) setExpLoading(false); });
    return () => { active = false; };
  }, []);

  const [activeTab, setActiveTab] = useState<"Income" | "Expense">("Income");

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transactionRows.filter((row) => {
      if (!query) return true;
      return `${row.date} ${row.fullName} ${row.title} ${row.amount} ${row.status}`.toLowerCase().includes(query);
    });
  }, [search, transactionRows]);

  const visibleExpenseRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return expenseRows.filter((row) => {
      if (!query) return true;
      return `${row.date} ${row.reason} ${row.title} ${row.amount}`.toLowerCase().includes(query);
    });
  }, [search, expenseRows]);

  const incomeTotal = useMemo(() => {
    const total = transactionRows.reduce((sum, r) => sum + Number(r.amount.replace(/[$,]/g, "")), 0);
    return `$${total.toLocaleString()}`;
  }, [transactionRows]);

  const expenseTotal = useMemo(() => {
    const total = expenseRows.reduce((sum, r) => sum + Number(r.amount.replace(/[$,]/g, "")), 0);
    return `$${total.toLocaleString()}`;
  }, [expenseRows]);

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  return (
    <div className="admin-dashboard transaction-page">
      <aside className="admin-dashboard__sidebar member-dashboard__sidebar">
        <div className="admin-dashboard__brand">
          <div className="admin-dashboard__brand-mark">
            <img src="/logo/upu-logo.svg" alt="UPUMI logo" />
          </div>
          <span>UPUMI</span>
        </div>

        <nav className="admin-dashboard__nav member-dashboard__nav" aria-label="Member navigation">
          {[
            { label: "Community Dashboard", icon: FiUsers, path: "/member" },
            { label: "Transaction", icon: FiCreditCard, path: "/member/transaction" },
            { label: "Account", icon: FiUsers, path: "/member/account" },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.label;

            return (
              <button
                key={item.label}
                type="button"
                className={["admin-dashboard__nav-item", isActive ? "is-active" : ""].filter(Boolean).join(" ")}
                onClick={() => navigate(item.path, { state: { nav: item.label } })}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="member-dashboard__sidebar-footer">
          <div className="admin-dashboard__profile-actions member-dashboard__footer-actions">
            <button
              type="button"
              className={["admin-dashboard__nav-item", activeNav === "Settings" ? "is-active" : ""].filter(Boolean).join(" ")}
              onClick={() => navigate("/member/settings", { state: { nav: "Settings" } })}
            >
              <FiSettings size={18} />
              <span>Settings</span>
            </button>

            <button
              type="button"
              className={["admin-dashboard__nav-item", "is-danger"].filter(Boolean).join(" ")}
              onClick={handleLogout}
            >
              <FiLogOut size={18} />
              <span>Logout</span>
            </button>
          </div>

          <div className="admin-dashboard__profile member-dashboard__profile-card">
            <div className="admin-dashboard__profile-info">
              <div className="admin-dashboard__profile-avatar">
                <img src={memberImage} alt="Member profile" />
              </div>
              <div>
                <div className="admin-dashboard__profile-name">
                  {memberProfile?.member
                    ? `${memberProfile.member.firstName || ""} ${memberProfile.member.lastName || ""}`.trim() || "Member"
                    : "Member"}
                </div>
                <div className="admin-dashboard__profile-email">
                  {memberProfile?.member?.email || "member@upumi.org"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="admin-dashboard__main">
        {/* <section className="admin-dashboard__hero">
          <div>
            <h1>Admin Console</h1>
            <p>Pivot-style member details for all signed-in members.</p>
          </div>

          <div className="admin-dashboard__hero-actions">
            <label className="admin-dashboard__search transaction-page__search">
              <FiSearch size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search member, expense, balance, income..."
                aria-label="Search transactions"
              />
            </label>

            <button type="button" className="admin-dashboard__icon-button" aria-label="Filter transactions">
              <FiFilter size={18} />
            </button>

            <button type="button" className="transaction-page__add-button" onClick={handleOpenTransactionModal}>
              <FiPlus size={18} />
              <span>Add New</span>
            </button>
          </div>
        </section> */}

        {/* <section className="admin-dashboard__filter-bar transaction-page__filter-panel">
          <div className="transaction-page__filter-row">
            <label className="transaction-page__field transaction-page__field--year">
              <span>Year</span>
              <select value={year} onChange={(event) => setYear(Number(event.target.value))} aria-label="Select transaction year">
                {YEAR_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="admin-dashboard__table-search transaction-page__table-search transaction-page__field--url">
              <FiSearch size={18} />
              <input
                type="url"
                value={sheetUrl}
                onChange={(event) => setSheetUrl(event.target.value)}
                placeholder="Google sheet URL (Optional override)"
                aria-label="Google Sheet URL"
              />
            </label>

            <label className="transaction-page__field transaction-page__Field--count">
              <span className="transaction-page__sr-only">Member count</span>
              <select value={memberCount} onChange={(event) => setMemberCount(event.target.value)} aria-label="Select member count">
                {COUNT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="transaction-page__field transaction-page__field--status">
              <span className="transaction-page__sr-only">Member status</span>
              <select value={memberStatus} onChange={(event) => setMemberStatus(event.target.value)} aria-label="Select member status">
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <div className="transaction-page__file-picker">
              <label className="transaction-page__choose-file">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(event) => setSelectedFileName(event.target.files?.[0]?.name || "No file chosen")}
                />
                <span>Choose File</span>
              </label>
              <span className="transaction-page__file-name">{selectedFileName}</span>
            </div>

            <button type="button" className="transaction-page__action-button transaction-page__action-button--green">
              Import CSV
            </button>
          </div>
        </section> */}

        <section className="transaction-page__tools">
        </section>

        <section className="admin-dashboard__stats transaction-page__summary">
          {([
            { title: "Income", amount: incomeTotal, tone: "income" as const },
            { title: "Expense", amount: expenseTotal, tone: "expense" as const },
          ]).map((card) => (
            <article key={card.title} className="admin-dashboard__stat-card transaction-page__summary-card">
              <div className="transaction-page__summary-head">
                <div className="admin-dashboard__stat-icon transaction-page__summary-icon">
                  <FiDollarSign size={20} />
                </div>
              </div>
              <div className="admin-dashboard__stat-copy transaction-page__summary-copy">
                <h2>{card.title}</h2>
                <strong className={card.tone === "expense" ? "is-expense" : ""}>{card.amount}</strong>
              </div>
            </article>
          ))}
        </section>

        <section className="transaction-page__table-section">
          <div className="transaction-page__tabs">
            {(["Income", "Expense"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                className={["transaction-page__tab", activeTab === tab ? "is-active" : ""].filter(Boolean).join(" ")}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "Income" ? (
            <>
              <div className="transaction-page__section-copy">
                <h2>Recent Transactions</h2>
                <p>{txLoading ? "Loading..." : `${visibleRows.length} transaction${visibleRows.length !== 1 ? "s" : ""}`}</p>
              </div>

              <div className="admin-dashboard__table-shell transaction-page__table-shell">
                {txError ? (
                  <div className="admin-dashboard__modal-error">{txError}</div>
                ) : (
                  <div className="admin-dashboard__table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Full Name</th>
                          <th>Title</th>
                          <th>Amount</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txLoading ? (
                          <tr><td colSpan={5} className="transaction-page__table-state">Loading transactions...</td></tr>
                        ) : !visibleRows.length ? (
                          <tr><td colSpan={5} className="transaction-page__table-state">
                            {search.trim() ? "No transactions match your search." : "No transactions recorded yet."}
                          </td></tr>
                        ) : (
                          visibleRows.map((row) => (
                            <tr key={row.id}>
                              <td>{row.date}</td>
                              <td>{row.fullName}</td>
                              <td>{row.title}</td>
                              <td>{row.amount}</td>
                              <td><span className="transaction-page__status">{row.status}</span></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="transaction-page__section-copy">
                <h2>Recent Expenses</h2>
                <p>{expLoading ? "Loading..." : `${visibleExpenseRows.length} expense${visibleExpenseRows.length !== 1 ? "s" : ""}`}</p>
              </div>

              <div className="admin-dashboard__table-shell transaction-page__table-shell">
                {expError ? (
                  <div className="admin-dashboard__modal-error">{expError}</div>
                ) : (
                  <div className="admin-dashboard__table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Reason</th>
                          <th>Title</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expLoading ? (
                          <tr><td colSpan={4} className="transaction-page__table-state">Loading expenses...</td></tr>
                        ) : !visibleExpenseRows.length ? (
                          <tr><td colSpan={4} className="transaction-page__table-state">
                            {search.trim() ? "No expenses match your search." : "No expenses recorded yet."}
                          </td></tr>
                        ) : (
                          visibleExpenseRows.map((row) => (
                            <tr key={row.id}>
                              <td>{row.date}</td>
                              <td>{row.reason}</td>
                              <td>{row.title}</td>
                              <td>{row.amount}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
