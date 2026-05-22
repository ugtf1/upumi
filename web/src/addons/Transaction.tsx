import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { IconType } from "react-icons";
import {
  FiCreditCard,
  FiDollarSign,
  FiFilter,
  FiHome,
  FiLogOut,
  FiPlus,
  FiSearch,
  FiSettings,
  FiUsers,
} from "react-icons/fi";

import { clearToken } from "./api";
import "./admin-page.scss";
import "./transaction-page.scss";

type NavigationItem = {
  label: string;
  icon: IconType;
  action: () => void;
  tone?: "danger";
};

type SummaryCard = {
  title: string;
  amount: string;
  delta: string;
  tone: "income" | "expense";
};

type TransactionRow = {
  id: string;
  date: string;
  fullName: string;
  title: string;
  amount: string;
  status: string;
};

type TransactionFormState = {
  fullName: string;
  title: string;
  amount: string;
  paymentDate: string;
};

const TRANSACTION_TITLE_OPTIONS = [
  "Raffle",
  "Insurance",
  "Wrapper",
  "UPUA 25 raffle",
  "Levy",
];

const SUMMARY_CARDS: SummaryCard[] = [
  { title: "Income", amount: "$980", delta: "+50.5%", tone: "income" },
  { title: "Expense", amount: "$240", delta: "+12.5%", tone: "expense" },
];

const TRANSACTION_ROWS: TransactionRow[] = [
  { id: "tx-1", date: "03 Jan 2026", fullName: "Agbara Onome", title: "Raffle", amount: "$303", status: "Completed" },
  { id: "tx-2", date: "03 Jan 2026", fullName: "Agbara Onome", title: "SSW", amount: "$303", status: "Completed" },
  { id: "tx-3", date: "03 Jan 2026", fullName: "Agbara Onome", title: "Raffle", amount: "$303", status: "Completed" },
  { id: "tx-4", date: "03 Jan 2026", fullName: "Agbara Onome", title: "Anamb.", amount: "$303", status: "Completed" },
  { id: "tx-5", date: "03 Jan 2026", fullName: "Agbara Onome", title: "Raffle", amount: "$303", status: "Completed" },
  { id: "tx-6", date: "03 Jan 2026", fullName: "Agbara Onome", title: "Raffle", amount: "$303", status: "Completed" },
  { id: "tx-7", date: "03 Jan 2026", fullName: "Agbara Onome", title: "Raffle", amount: "$303", status: "Completed" },
  { id: "tx-8", date: "03 Jan 2026", fullName: "Agbara Onome", title: "Raffle", amount: "$303", status: "Completed" },
];

const YEAR_OPTIONS = [2024, 2025, 2026, 2027];
const COUNT_OPTIONS = ["0", "1", "2", "3"];
const STATUS_OPTIONS = ["All Members", "Active", "Pending", "Inactive"];

export default function TransactionPage() {
  const navigate = useNavigate();

  const [year, setYear] = useState(2026);
  const [search, setSearch] = useState("");
  const [transactionRows, setTransactionRows] = useState(TRANSACTION_ROWS);
  const [sheetUrl, setSheetUrl] = useState("");
  const [memberCount, setMemberCount] = useState("0");
  const [memberStatus, setMemberStatus] = useState("All Members");
  const [activeTab, setActiveTab] = useState<"Income" | "Expense">("Income");
  const [selectedFileName, setSelectedFileName] = useState("No file chosen");
  const [isAddTransactionModalOpen, setIsAddTransactionModalOpen] = useState(false);
  const [transactionForm, setTransactionForm] = useState<TransactionFormState>({
    fullName: "",
    title: "",
    amount: "",
    paymentDate: "",
  });

  useEffect(() => {
    if (!isAddTransactionModalOpen) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsAddTransactionModalOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAddTransactionModalOpen]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transactionRows.filter((row) => {
      if (!query) return true;
      const haystack = `${row.date} ${row.fullName} ${row.title} ${row.amount} ${row.status}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [search, transactionRows]);

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  function resetTransactionForm() {
    setTransactionForm({
      fullName: "",
      title: "",
      amount: "",
      paymentDate: "",
    });
  }

  function handleOpenTransactionModal() {
    resetTransactionForm();
    setIsAddTransactionModalOpen(true);
  }

  function handleCloseTransactionModal() {
    setIsAddTransactionModalOpen(false);
  }

  function handleTransactionFormChange(field: keyof TransactionFormState, value: string) {
    setTransactionForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function handleSaveTransaction() {
    const { fullName, title, amount, paymentDate } = transactionForm;
    if (!fullName.trim() || !title.trim() || !amount.trim() || !paymentDate.trim()) return;

    setTransactionRows((currentRows) => [
      {
        id: `tx-${Date.now()}`,
        date: paymentDate.trim(),
        fullName: fullName.trim(),
        title: title.trim(),
        amount: amount.trim(),
        status: "Completed",
      },
      ...currentRows,
    ]);

    setSearch(fullName.trim());
    setIsAddTransactionModalOpen(false);
  }

  const primaryNavigationItems: NavigationItem[] = [
    { label: "Dashboard", icon: FiHome, action: () => navigate("/admin") },
    { label: "Transaction", icon: FiCreditCard, action: () => navigate("/admin/transaction") },
    {
      label: "Member",
      icon: FiUsers,
      action: () => navigate("/admin/member"),
    },
  ];

  const secondaryNavigationItems: NavigationItem[] = [
    {
      label: "Settings",
      icon: FiSettings,
      action: () => navigate("/admin/settings"),
    },
    { label: "Logout", icon: FiLogOut, action: handleLogout, tone: "danger" },
  ];

  return (
    <div className="admin-dashboard transaction-page">
      <aside className="admin-dashboard__sidebar">
        <div className="admin-dashboard__brand">
          <div className="admin-dashboard__brand-mark">
            <img src="/logo/upu-logo.svg" alt="UPUMI logo" />
          </div>
          <span>UPUMI</span>
        </div>

        <nav className="admin-dashboard__nav" aria-label="Admin navigation">
          {primaryNavigationItems.map((item) => {
            const Icon = item.icon;
            const active = item.label === "Transaction";

            return (
              <button
                key={item.label}
                type="button"
                className={[
                  "admin-dashboard__nav-item",
                  active ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={item.action}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="admin-dashboard__profile">
          <div className="admin-dashboard__profile-info">
            <div className="admin-dashboard__profile-avatar transaction-page__profile-avatar" aria-hidden="true">A</div>
            <div>
              <div className="admin-dashboard__profile-name">Admin</div>
              <div className="admin-dashboard__profile-email">Admin.Ono@gmail.com</div>
            </div>
          </div>
          <div className="admin-dashboard__profile-actions">
            {secondaryNavigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  className={[
                    "admin-dashboard__nav-item",
                    item.tone === "danger" ? "is-danger" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={item.action}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <main className="admin-dashboard__main">
        <section className="admin-dashboard__hero">
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
        </section>

        <section className="admin-dashboard__filter-bar transaction-page__filter-panel">
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

            <label className="transaction-page__field transaction-page__field--count">
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
        </section>

        <section className="transaction-page__tools">
          {/* <div className="transaction-page__csv-dropzone">
            <span>Paste CSV here or choose a file</span>
          </div> */}

          {/* <div className="transaction-page__tool-actions">
            <button type="button" className="transaction-page__action-button transaction-page__action-button--gold">
              Syn Google Sheet
            </button>
            <button type="button" className="transaction-page__action-button transaction-page__action-button--gold">
              <FiRefreshCw size={16} />
              <span>Refresh</span>
            </button>
            <button type="button" className="transaction-page__action-button transaction-page__action-button--gold">
              Export Spreadsheet CSV
            </button>
            <button type="button" className="transaction-page__action-button transaction-page__action-button--gold">
              <FiFileText size={16} />
              <span>Print/Save CSV</span>
            </button>
          </div> */}
        </section>

        <section className="admin-dashboard__stats transaction-page__summary">
          {SUMMARY_CARDS.map((card) => (
            <article key={card.title} className="admin-dashboard__stat-card transaction-page__summary-card">
              <div className="transaction-page__summary-head">
                <div className="admin-dashboard__stat-icon transaction-page__summary-icon">
                  <FiDollarSign size={20} />
                </div>
                <span className={`transaction-page__summary-delta is-${card.tone}`}>{card.delta}</span>
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

          <div className="transaction-page__section-copy">
            <h2>Recent Transaction</h2>
            <p>View Most Recent Transaction</p>
          </div>

          <div className="admin-dashboard__table-shell transaction-page__table-shell">
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
                  {visibleRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.date}</td>
                      <td>{row.fullName}</td>
                      <td>{row.title}</td>
                      <td>{row.amount}</td>
                      <td>
                        <span className="transaction-page__status">{row.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {isAddTransactionModalOpen && (
        <div className="admin-dashboard__modal" role="dialog" aria-modal="true" aria-labelledby="transaction-modal-title">
          <div className="admin-dashboard__modal-backdrop" onClick={handleCloseTransactionModal} />

          <div className="admin-dashboard__modal-panel transaction-page__modal-panel">
            <div className="transaction-page__modal-grid">
              <div className="admin-dashboard__modal-section">
                <label htmlFor="transaction-full-name" className="admin-dashboard__modal-label" id="transaction-modal-title">
                  Full Name
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain">
                  <input
                    id="transaction-full-name"
                    value={transactionForm.fullName}
                    onChange={(event) => handleTransactionFormChange("fullName", event.target.value)}
                    placeholder="Mrs. Abada Evi"
                    aria-label="Full name"
                  />
                </div>
              </div>

              <div className="admin-dashboard__modal-section">
                <label htmlFor="transaction-title" className="admin-dashboard__modal-label">
                  Title
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain transaction-page__modal-select-wrap">
                  <select
                    id="transaction-title"
                    value={transactionForm.title}
                    onChange={(event) => handleTransactionFormChange("title", event.target.value)}
                    aria-label="Transaction title"
                    className={transactionForm.title ? "has-value" : ""}
                  >
                    <option value="">Select</option>
                    {TRANSACTION_TITLE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="admin-dashboard__modal-section">
                <label htmlFor="transaction-amount" className="admin-dashboard__modal-label">
                  Amount
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain">
                  <input
                    id="transaction-amount"
                    value={transactionForm.amount}
                    onChange={(event) => handleTransactionFormChange("amount", event.target.value)}
                    placeholder="$100"
                    aria-label="Transaction amount"
                  />
                </div>
              </div>

              <div className="admin-dashboard__modal-section">
                <label htmlFor="transaction-payment-date" className="admin-dashboard__modal-label">
                  Payment date
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain">
                  <input
                    id="transaction-payment-date"
                    value={transactionForm.paymentDate}
                    onChange={(event) => handleTransactionFormChange("paymentDate", event.target.value)}
                    placeholder="08 Jan 2026"
                    aria-label="Payment date"
                  />
                </div>
              </div>
            </div>

            <div className="admin-dashboard__modal-actions">
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--secondary"
                onClick={handleCloseTransactionModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--primary"
                onClick={handleSaveTransaction}
                disabled={
                  !transactionForm.fullName.trim() ||
                  !transactionForm.title.trim() ||
                  !transactionForm.amount.trim() ||
                  !transactionForm.paymentDate.trim()
                }
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
