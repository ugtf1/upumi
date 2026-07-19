import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { IconType } from "react-icons";
import {
  FiCheck,
  FiCreditCard,
  FiDollarSign,
  FiFilter,
  FiHome,
  FiLogOut,
  FiPlus,
  FiSearch,
  FiSettings,
  FiUsers,
  FiX,
  FiMoreVertical,
  FiTrash2,
  FiEdit2,
} from "react-icons/fi";

import { apiGet, apiPost, apiPatch, apiDelete, clearToken } from "./api";
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
  tone: "income" | "expense";
};

type TransactionRow = {
  id: string;
  date: string;
  fullName: string;
  title: string;
  description?: string;
  amount: string;
  status: string;
  rawDate: string;
  rawAmount: number;
  userId?: string;
};

// Shape returned by GET /admin/database/transactions (raw Prisma row).
type TransactionApiRow = {
  id: string;
  userId?: string | null;
  fullName: string;
  title: string;
  description?: string | null;
  amount: string | number;
  date: string;
  createdAt?: string;
};

type UserOption = {
  id: string;
  fullName: string;
};

type TransactionFormState = {
  userId: string;
  fullName: string;
  title: string;
  description: string;
  amount: string;
  paymentDate: string;
};

// Shape returned by GET /admin/database/expenses (raw Prisma row).
type ExpenseApiRow = {
  id: string;
  reason: string;
  title: string;
  amount: string | number;
  date: string;
  createdAt?: string;
};

type ExpenseRow = {
  id: string;
  date: string;
  reason: string;
  title: string;
  amount: string;
  rawDate: string;
  rawAmount: number;
};

type ExpenseFormState = {
  reason: string;
  title: string;
  amount: string;
  date: string;
};

const TRANSACTION_TITLE_OPTIONS = [
  "Raffle",
  "Insurance",
  "Wrapper",
  "UPUA 25 Raffle",
  "Levy",
  "Others",
];

// YEAR_OPTIONS removed (previously [2024, 2025, 2026, 2027]) — unused variable eliminated to satisfy lint rules

export default function TransactionPage() {
  const navigate = useNavigate();

  // year state removed — filter UI disabled in this build
  const [search, setSearch] = useState("");
  const [transactionRows, setTransactionRows] = useState<TransactionRow[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState<string | null>(null);
  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>([]);
  const [expLoading, setExpLoading] = useState(true);
  const [expError, setExpError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"Income" | "Expense">("Income");
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isAddTransactionModalOpen, setIsAddTransactionModalOpen] = useState(false);
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [transactionForm, setTransactionForm] = useState<TransactionFormState>({
    userId: "",
    fullName: "",
    title: "",
    description: "",
    amount: "",
    paymentDate: "",
  });
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>({
    reason: "",
    title: "",
    amount: "",
    date: "",
  });
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expenseSaveLoading, setExpenseSaveLoading] = useState(false);
  const [expenseSaveError, setExpenseSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);

  const [openMenuTxId, setOpenMenuTxId] = useState<string | null>(null);
  const [openMenuExpId, setOpenMenuExpId] = useState<string | null>(null);
  const [isDeletePromptOpen, setIsDeletePromptOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: "transaction" | "expense"; id: string; name: string } | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const menuRef = (node: HTMLDivElement | null) => {
    if (!node) return;
    const handler = (e: MouseEvent) => {
      if (!node.contains(e.target as Node)) {
        setOpenMenuTxId(null);
        setOpenMenuExpId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  };

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

  // Fetch the real member list when the modal opens so the name dropdown
  // is always up-to-date with whoever is actually in the database.
  useEffect(() => {
    if (!isAddTransactionModalOpen) return undefined;
    let active = true;

    setUsersLoading(true);
    setUsersError(null);

    apiGet<{ id: string; firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null; userId?: string | null; user?: { id: string } | null }[]>(
      "/admin/members"
    )
      .then((users) => {
        if (!active) return;
        setUserOptions(
          users.map((user) => {
            const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
            // Use user.user.id (the linked User row) for the FK, not the
            // memberRecord's own id. Fall back to userId field if present.
            const linkedUserId = user.user?.id ?? user.userId ?? user.id;
            return { id: linkedUserId, fullName: name || user.email || user.phone || "Unnamed member" };
          })
        );
      })
      .catch((error: Error) => {
        if (!active) return;
        setUsersError(error?.message ?? "Failed to load members");
      })
      .finally(() => {
        if (active) setUsersLoading(false);
      });

    return () => { active = false; };
  }, [isAddTransactionModalOpen]);

  // Fetch all transactions from the database on mount.
  // The generic table route (adminDatabaseRoutes at /api/admin/database)
  // returns every row ordered by createdAt desc — we normalise the raw
  // Prisma shape into the TransactionRow display type here.
  useEffect(() => {
    let active = true;

    setTxLoading(true);
    setTxError(null);

    apiGet<TransactionApiRow[]>("/admin/database/transactions")
      .then((rows) => {
        if (!active) return;
        setTransactionRows(
          rows.map((row) => ({
            id: row.id,
            date: new Date(row.date).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            }),
            fullName: row.fullName,
            title: row.title,
            description: row.description ?? "",
            amount: `$${Number(row.amount).toLocaleString()}`,
            status: "Completed",
            rawDate: row.date,
            rawAmount: Number(row.amount),
            userId: row.userId ?? undefined,
          }))
        );
      })
      .catch((error: Error) => {
        if (!active) return;
        setTxError(error?.message ?? "Failed to load transactions");
      })
      .finally(() => {
        if (active) setTxLoading(false);
      });

    return () => { active = false; };
  }, []);

  // Close Add New dropdown on outside click.
  useEffect(() => {
    if (!isAddMenuOpen) return undefined;
    function onOutside(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setIsAddMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [isAddMenuOpen]);

  // Fetch all expenses on mount.
  useEffect(() => {
    let active = true;
    setExpLoading(true);
    apiGet<ExpenseApiRow[]>("/admin/database/expenses")
      .then((rows) => {
        if (!active) return;
        setExpenseRows(
          rows.map((row) => ({
            id: row.id,
            date: new Date(row.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
            reason: row.reason,
            title: row.title,
            amount: `$${Number(row.amount).toLocaleString()}`,
            rawDate: row.date,
            rawAmount: Number(row.amount),
          }))
        );
      })
      .catch((error: Error) => { if (active) setExpError(error?.message ?? "Failed to load expenses"); })
      .finally(() => { if (active) setExpLoading(false); });
    return () => { active = false; };
  }, []);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transactionRows.filter((row) => {
      if (!query) return true;
      const haystack = `${row.date} ${row.fullName} ${row.title} ${row.amount} ${row.status}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [search, transactionRows]);

  const filteredUserOptions = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return userOptions;
    return userOptions.filter((u) => u.fullName.toLowerCase().includes(query));
  }, [userOptions, userSearch]);

  const visibleExpenseRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return expenseRows.filter((row) => {
      if (!query) return true;
      return `${row.date} ${row.reason} ${row.title} ${row.amount}`.toLowerCase().includes(query);
    });
  }, [search, expenseRows]);

  const incomeTotal = useMemo(() => {
    const total = transactionRows.reduce((sum, row) => sum + Number(row.amount.replace(/[$,]/g, "")), 0);
    return `$${total.toLocaleString()}`;
  }, [transactionRows]);

  const expenseTotal = useMemo(() => {
    const total = expenseRows.reduce((sum, row) => sum + Number(row.amount.replace(/[$,]/g, "")), 0);
    return `$${total.toLocaleString()}`;
  }, [expenseRows]);

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  function resetTransactionForm() {
    setTransactionForm({ userId: "", fullName: "", title: "", description: "", amount: "", paymentDate: "" });
    setUserSearch("");
    setIsUserDropdownOpen(false);
    setSaveError(null);
    setEditingTransactionId(null);
  }

  function handleOpenTransactionModal() {
    setIsAddMenuOpen(false);
    resetTransactionForm();
    setIsAddTransactionModalOpen(true);
  }

  function handleOpenExpenseModal() {
    setIsAddMenuOpen(false);
    setExpenseForm({ reason: "", title: "", amount: "", date: "" });
    setExpenseSaveError(null);
    setEditingExpenseId(null);
    setIsAddExpenseModalOpen(true);
  }

  function handleEditTransaction(row: TransactionRow) {
    setTransactionForm({
      userId: row.userId ?? "",
      fullName: row.fullName,
      title: row.title,
      description: row.description ?? "",
      amount: String(row.rawAmount),
      paymentDate: row.rawDate ? row.rawDate.split("T")[0] : "",
    });
    setUserSearch(row.fullName);
    setEditingTransactionId(row.id);
    setOpenMenuTxId(null);
    setIsAddTransactionModalOpen(true);
  }

  function handleDeleteTransactionPrompt(row: TransactionRow) {
    setItemToDelete({ type: "transaction", id: row.id, name: row.title });
    setOpenMenuTxId(null);
    setIsDeletePromptOpen(true);
  }

  function handleEditExpense(row: ExpenseRow) {
    setExpenseForm({
      reason: row.reason,
      title: row.title,
      amount: String(row.rawAmount),
      date: row.rawDate ? row.rawDate.split("T")[0] : "",
    });
    setEditingExpenseId(row.id);
    setOpenMenuExpId(null);
    setIsAddExpenseModalOpen(true);
  }

  function handleDeleteExpensePrompt(row: ExpenseRow) {
    setItemToDelete({ type: "expense", id: row.id, name: row.title });
    setOpenMenuExpId(null);
    setIsDeletePromptOpen(true);
  }

  async function handleConfirmDelete() {
    if (!itemToDelete) return;
    try {
      const endpoint = itemToDelete.type === "transaction" ? "/admin/database/transactions" : "/admin/database/expenses";
      await apiDelete(`${endpoint}/${itemToDelete.id}`);
      
      if (itemToDelete.type === "transaction") {
        setTransactionRows((prev) => prev.filter((r) => r.id !== itemToDelete.id));
      } else {
        setExpenseRows((prev) => prev.filter((r) => r.id !== itemToDelete.id));
      }
      
      setIsDeletePromptOpen(false);
      setItemToDelete(null);
      setToast("Record deleted successfully");
      window.setTimeout(() => setToast(null), 3000);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Failed to delete record");
      window.setTimeout(() => setToast(null), 3000);
    }
  }

  function handleCloseExpenseModal() {
    setIsAddExpenseModalOpen(false);
    setExpenseSaveError(null);
  }

  function handleExpenseFormChange(field: keyof ExpenseFormState, value: string) {
    setExpenseForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSaveExpense() {
    setExpenseSaveError(null);

    if (!expenseForm.reason.trim()) { setExpenseSaveError("Enter a reason"); return; }
    if (!expenseForm.title.trim()) { setExpenseSaveError("Enter a title"); return; }
    if (!expenseForm.amount.trim()) { setExpenseSaveError("Enter an amount"); return; }
    if (!expenseForm.date.trim()) { setExpenseSaveError("Enter a date"); return; }

    const numericAmount = Number(expenseForm.amount.replace(/[$,]/g, "").trim());
    if (Number.isNaN(numericAmount)) { setExpenseSaveError("Amount must be a number"); return; }

    const parsedDate = new Date(expenseForm.date.trim());
    if (Number.isNaN(parsedDate.getTime())) { setExpenseSaveError("Enter a valid date"); return; }

    setExpenseSaveLoading(true);

    try {
      if (editingExpenseId) {
        await apiPatch<ExpenseApiRow>(`/admin/database/expenses/${editingExpenseId}`, {
          reason: expenseForm.reason.trim(),
          title: expenseForm.title.trim(),
          amount: numericAmount,
          date: parsedDate.toISOString(),
        });
        setExpenseRows((current) => current.map((row) => row.id === editingExpenseId ? {
          id: editingExpenseId,
          date: parsedDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          reason: expenseForm.reason.trim(),
          title: expenseForm.title.trim(),
          amount: `$${numericAmount.toLocaleString()}`,
          rawDate: parsedDate.toISOString(),
          rawAmount: numericAmount,
        } : row));
      } else {
        const saved = await apiPost<ExpenseApiRow>("/admin/database/expenses", {
          reason: expenseForm.reason.trim(),
          title: expenseForm.title.trim(),
          amount: numericAmount,
          date: parsedDate.toISOString(),
        });
        setExpenseRows((current) => [
          {
            id: saved.id ?? `exp-${Date.now()}`,
            date: parsedDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
            reason: expenseForm.reason.trim(),
            title: expenseForm.title.trim(),
            amount: `$${numericAmount.toLocaleString()}`,
            rawDate: parsedDate.toISOString(),
            rawAmount: numericAmount,
          },
          ...current,
        ]);
      }

      setActiveTab("Expense");
      setIsAddExpenseModalOpen(false);
      setToast(`Expense ${editingExpenseId ? 'updated' : 'added'} successfully`);
      window.setTimeout(() => setToast(null), 3000);
    } catch (error) {
      setExpenseSaveError(error instanceof Error ? error.message : "Failed to save expense");
    } finally {
      setExpenseSaveLoading(false);
    }
  }

  function handleCloseTransactionModal() {
    setIsAddTransactionModalOpen(false);
  }

  function handleTransactionFormChange(field: keyof TransactionFormState, value: string) {
    setTransactionForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function handleSelectUser(user: UserOption) {
    setTransactionForm((currentForm) => ({
      ...currentForm,
      userId: user.id,
      fullName: user.fullName,
    }));
    setUserSearch(user.fullName);
    setIsUserDropdownOpen(false);
  }

  function handleFullNameInputChange(value: string) {
    // Typing in the field opens the dropdown and clears any previously
    // selected user — they'll need to pick again from the filtered list.
    setUserSearch(value);
    setTransactionForm((currentForm) => ({ ...currentForm, userId: "", fullName: value }));
    setIsUserDropdownOpen(true);
  }

  async function handleSaveTransaction() {
    const { userId, fullName, title, description, amount, paymentDate } = transactionForm;
    setSaveError(null);

    if (!title.trim()) { setSaveError("Select a title"); return; }
    if (!amount.trim()) { setSaveError("Enter an amount"); return; }
    if (!paymentDate.trim()) { setSaveError("Enter a payment date"); return; }

    const numericAmount = Number(amount.replace(/[$,]/g, "").trim());
    if (Number.isNaN(numericAmount)) { setSaveError("Amount must be a number"); return; }

    // Parse the date — the backend date() helper requires a valid ISO/parseable
    // date string. We pass the ISO form (YYYY-MM-DD) from the <input type="date">.
    const parsedDate = new Date(paymentDate.trim());
    if (Number.isNaN(parsedDate.getTime())) { setSaveError("Enter a valid date"); return; }

    setSaveLoading(true);

    try {
      if (editingTransactionId) {
        await apiPatch<{ id: string; date: string; fullName: string; title: string; amount: string }>(
          `/admin/database/transactions/${editingTransactionId}`,
          {
            ...(userId ? { userId } : {}),
            fullName: fullName.trim(),
            title: title.trim(),
            description: description.trim() || null,
            amount: numericAmount,
            date: parsedDate.toISOString(),
          }
        );
        setTransactionRows((currentRows) => currentRows.map((row) => row.id === editingTransactionId ? {
          id: editingTransactionId,
          date: parsedDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          fullName: fullName.trim(),
          title: title.trim(),
          description: description.trim() || undefined,
          amount: `$${numericAmount.toLocaleString()}`,
          status: "Completed",
          rawDate: parsedDate.toISOString(),
          rawAmount: numericAmount,
          userId: userId || undefined,
        } : row));
      } else {
        const saved = await apiPost<{ id: string; date: string; fullName: string; title: string; amount: string }>(
          "/admin/database/transactions",
          {
            ...(userId ? { userId } : {}),
            fullName: fullName.trim(),
            title: title.trim(),
            description: description.trim() || null,
            amount: numericAmount,
            date: parsedDate.toISOString(),
          }
        );
        setTransactionRows((currentRows) => [
          {
            id: saved.id ?? `tx-${Date.now()}`,
            date: parsedDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
            fullName: fullName.trim(),
            title: title.trim(),
            description: description.trim() || undefined,
            amount: `$${numericAmount.toLocaleString()}`,
            status: "Completed",
            rawDate: parsedDate.toISOString(),
            rawAmount: numericAmount,
            userId: userId || undefined,
          },
          ...currentRows,
        ]);
      }

      setSearch(fullName.trim());
      setIsAddTransactionModalOpen(false);
      setToast(`Transaction ${editingTransactionId ? 'updated' : 'added'} successfully`);
      window.setTimeout(() => setToast(null), 3000);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save transaction");
    } finally {
      setSaveLoading(false);
    }
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

            <div className="transaction-page__add-wrap" ref={addMenuRef}>
              <button
                type="button"
                className="transaction-page__add-button"
                onClick={() => setIsAddMenuOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={isAddMenuOpen}
              >
                <FiPlus size={18} />
                <span>Add New</span>
              </button>

              {isAddMenuOpen && (
                <div className="transaction-page__add-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="transaction-page__add-menu-item"
                    onClick={handleOpenTransactionModal}
                  >
                    Add Transaction
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="transaction-page__add-menu-item"
                    onClick={handleOpenExpenseModal}
                  >
                    Add Expense
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

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
        </section> */}

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
          {([
            { title: "Income", amount: incomeTotal, tone: "income" as const },
            { title: "Expense", amount: expenseTotal, tone: "expense" as const },
          ] as SummaryCard[]).map((card) => (
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
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txLoading ? (
                          <tr><td colSpan={6} className="transaction-page__table-state">Loading transactions...</td></tr>
                        ) : !visibleRows.length ? (
                          <tr><td colSpan={6} className="transaction-page__table-state">
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
                              <td>
                                <div className="member-page__action-wrap" ref={openMenuTxId === row.id ? menuRef : null}>
                                  <button
                                    type="button"
                                    className={[
                                      "member-page__more-button",
                                      openMenuTxId === row.id ? "is-active" : "",
                                    ].filter(Boolean).join(" ")}
                                    aria-label="More actions"
                                    aria-expanded={openMenuTxId === row.id}
                                    aria-haspopup="menu"
                                    onClick={() => setOpenMenuTxId(openMenuTxId === row.id ? null : row.id)}
                                  >
                                    <FiMoreVertical size={22} />
                                  </button>

                                  {openMenuTxId === row.id && (
                                    <div className="member-page__action-menu" role="menu" style={{ right: 0, left: "auto" }}>
                                      <button
                                        type="button"
                                        role="menuitem"
                                        className="member-page__action-item"
                                        onClick={() => handleEditTransaction(row)}
                                      >
                                        <FiEdit2 size={15} />
                                        <span>Edit</span>
                                      </button>
                                      <button
                                        type="button"
                                        role="menuitem"
                                        className="member-page__action-item member-page__action-item--danger"
                                        onClick={() => handleDeleteTransactionPrompt(row)}
                                      >
                                        <FiTrash2 size={15} />
                                        <span>Delete</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>
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
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expLoading ? (
                          <tr><td colSpan={5} className="transaction-page__table-state">Loading expenses...</td></tr>
                        ) : !visibleExpenseRows.length ? (
                          <tr><td colSpan={5} className="transaction-page__table-state">
                            {search.trim() ? "No expenses match your search." : "No expenses recorded yet."}
                          </td></tr>
                        ) : (
                          visibleExpenseRows.map((row) => (
                            <tr key={row.id}>
                              <td>{row.date}</td>
                              <td>{row.reason}</td>
                              <td>{row.title}</td>
                              <td>{row.amount}</td>
                              <td>
                                <div className="member-page__action-wrap" ref={openMenuExpId === row.id ? menuRef : null}>
                                  <button
                                    type="button"
                                    className={[
                                      "member-page__more-button",
                                      openMenuExpId === row.id ? "is-active" : "",
                                    ].filter(Boolean).join(" ")}
                                    aria-label="More actions"
                                    aria-expanded={openMenuExpId === row.id}
                                    aria-haspopup="menu"
                                    onClick={() => setOpenMenuExpId(openMenuExpId === row.id ? null : row.id)}
                                  >
                                    <FiMoreVertical size={22} />
                                  </button>

                                  {openMenuExpId === row.id && (
                                    <div className="member-page__action-menu" role="menu" style={{ right: 0, left: "auto" }}>
                                      <button
                                        type="button"
                                        role="menuitem"
                                        className="member-page__action-item"
                                        onClick={() => handleEditExpense(row)}
                                      >
                                        <FiEdit2 size={15} />
                                        <span>Edit</span>
                                      </button>
                                      <button
                                        type="button"
                                        role="menuitem"
                                        className="member-page__action-item member-page__action-item--danger"
                                        onClick={() => handleDeleteExpensePrompt(row)}
                                      >
                                        <FiTrash2 size={15} />
                                        <span>Delete</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>
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

      {isDeletePromptOpen && itemToDelete && (
        <div className="admin-dashboard__modal" role="dialog" aria-modal="true" aria-labelledby="delete-prompt-modal-title">
          <div className="admin-dashboard__modal-backdrop" onClick={() => setIsDeletePromptOpen(false)} />

          <div className="admin-dashboard__modal-panel">
            <h2 id="delete-prompt-modal-title" className="admin-dashboard__modal-title admin-dashboard__modal-title--danger">
              Delete Record
            </h2>
            <div className="admin-dashboard__modal-section-copy" style={{ marginBottom: "1.5rem" }}>
              <p>Are you sure you want to delete the record for <strong>{itemToDelete.name}</strong>?</p>
              <p>This action cannot be undone.</p>
            </div>

            <div className="admin-dashboard__modal-actions">
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--secondary"
                onClick={() => setIsDeletePromptOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--danger"
                onClick={handleConfirmDelete}
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddTransactionModalOpen && (
        <div className="admin-dashboard__modal" role="dialog" aria-modal="true" aria-labelledby="transaction-modal-title">
          <div className="admin-dashboard__modal-backdrop" onClick={handleCloseTransactionModal} />

          <div className="admin-dashboard__modal-panel transaction-page__modal-panel">
            <h2 id="transaction-modal-title" className="admin-dashboard__modal-title">
              {editingTransactionId ? "Edit Transaction" : "Add Transaction"}
            </h2>

            {(saveError || usersError) && (
              <div className="admin-dashboard__modal-error">{saveError || usersError}</div>
            )}

            <div className="transaction-page__modal-grid">
              {/* ── Full Name — member picker ─────────────────────── */}
              <div className="admin-dashboard__modal-section">
                <label htmlFor="transaction-full-name" className="admin-dashboard__modal-label">
                  Full Name (Optional)
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain transaction-page__name-wrap">
                  <input
                    id="transaction-full-name"
                    value={userSearch}
                    onChange={(event) => handleFullNameInputChange(event.target.value)}
                    onFocus={() => setIsUserDropdownOpen(true)}
                    placeholder="Search member... (Optional)"
                    autoComplete="off"
                    aria-label="Full name"
                    aria-expanded={isUserDropdownOpen}
                    aria-haspopup="listbox"
                  />
                  {userSearch && (
                    <button
                      type="button"
                      className="transaction-page__name-clear"
                      onClick={() => { setUserSearch(""); setTransactionForm((f) => ({ ...f, userId: "", fullName: "" })); setIsUserDropdownOpen(false); }}
                      aria-label="Clear name"
                    >
                      <FiX size={15} />
                    </button>
                  )}

                  {isUserDropdownOpen && (
                    <ul className="transaction-page__name-dropdown" role="listbox" aria-label="Select member">
                      {usersLoading ? (
                        <li className="transaction-page__name-option transaction-page__name-option--info">
                          Loading members...
                        </li>
                      ) : !filteredUserOptions.length ? (
                        <li className="transaction-page__name-option transaction-page__name-option--info">
                          No members found
                        </li>
                      ) : (
                        filteredUserOptions.map((user) => (
                          <li
                            key={user.id}
                            role="option"
                            aria-selected={transactionForm.userId === user.id}
                            className={[
                              "transaction-page__name-option",
                              transactionForm.userId === user.id ? "is-selected" : "",
                            ].filter(Boolean).join(" ")}
                            onMouseDown={(e) => { e.preventDefault(); handleSelectUser(user); }}
                          >
                            <span>{user.fullName}</span>
                            {transactionForm.userId === user.id && <FiCheck size={14} />}
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </div>
              </div>

              {/* ── Title ─────────────────────────────────────────── */}
              <div className="admin-dashboard__modal-section">
                <label htmlFor="transaction-title" className="admin-dashboard__modal-label">
                  Title *
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

              {/* ── Description ───────────────────────────────────── */}
              <div className="admin-dashboard__modal-section">
                <label htmlFor="transaction-description" className="admin-dashboard__modal-label">
                  Description (Optional)
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain">
                  <input
                    id="transaction-description"
                    value={transactionForm.description}
                    onChange={(event) => handleTransactionFormChange("description", event.target.value)}
                    placeholder="Add a note"
                    aria-label="Transaction description"
                  />
                </div>
              </div>

              <div className="admin-dashboard__modal-section">
                <label htmlFor="transaction-amount" className="admin-dashboard__modal-label">
                  Amount *
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain">
                  <input
                    id="transaction-amount"
                    type="number"
                    inputMode="decimal"
                    value={transactionForm.amount}
                    onChange={(event) => handleTransactionFormChange("amount", event.target.value)}
                    placeholder="100"
                    aria-label="Transaction amount"
                  />
                </div>
              </div>

              {/* ── Payment Date ──────────────────────────────────── */}
              <div className="admin-dashboard__modal-section">
                <label htmlFor="transaction-payment-date" className="admin-dashboard__modal-label">
                  Payment Date *
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain">
                  <input
                    id="transaction-payment-date"
                    type="date"
                    value={transactionForm.paymentDate}
                    onChange={(event) => handleTransactionFormChange("paymentDate", event.target.value)}
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
                disabled={saveLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--primary"
                onClick={handleSaveTransaction}
                disabled={
                  !transactionForm.title.trim() ||
                  !transactionForm.amount.toString().trim() ||
                  !transactionForm.paymentDate.trim() ||
                  saveLoading
                }
              >
                {saveLoading ? "Saving..." : (editingTransactionId ? "Save Changes" : "Save Record")}
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddExpenseModalOpen && (
        <div className="admin-dashboard__modal" role="dialog" aria-modal="true" aria-labelledby="expense-modal-title">
          <div className="admin-dashboard__modal-backdrop" onClick={handleCloseExpenseModal} />

          <div className="admin-dashboard__modal-panel transaction-page__modal-panel">
            <h2 id="expense-modal-title" className="admin-dashboard__modal-title">
              {editingExpenseId ? "Edit Expense" : "Add Expense"}
            </h2>

            {expenseSaveError && (
              <div className="admin-dashboard__modal-error">{expenseSaveError}</div>
            )}

            <div className="transaction-page__modal-grid">
              <div className="admin-dashboard__modal-section">
                <label htmlFor="expense-reason" className="admin-dashboard__modal-label">
                  Reason *
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain">
                  <input
                    id="expense-reason"
                    value={expenseForm.reason}
                    onChange={(e) => handleExpenseFormChange("reason", e.target.value)}
                    placeholder="e.g. Hall rental"
                    aria-label="Expense reason"
                  />
                </div>
              </div>

              <div className="admin-dashboard__modal-section">
                <label htmlFor="expense-title" className="admin-dashboard__modal-label">
                  Title *
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain">
                  <input
                    id="expense-title"
                    value={expenseForm.title}
                    onChange={(e) => handleExpenseFormChange("title", e.target.value)}
                    placeholder="e.g. Venue"
                    aria-label="Expense title"
                  />
                </div>
              </div>

              <div className="admin-dashboard__modal-section">
                <label htmlFor="expense-amount" className="admin-dashboard__modal-label">
                  Amount *
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain">
                  <input
                    id="expense-amount"
                    type="number"
                    inputMode="decimal"
                    value={expenseForm.amount}
                    onChange={(e) => handleExpenseFormChange("amount", e.target.value)}
                    placeholder="0"
                    aria-label="Expense amount"
                  />
                </div>
              </div>

              <div className="admin-dashboard__modal-section">
                <label htmlFor="expense-date" className="admin-dashboard__modal-label">
                  Date *
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain">
                  <input
                    id="expense-date"
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) => handleExpenseFormChange("date", e.target.value)}
                    aria-label="Expense date"
                  />
                </div>
              </div>
            </div>

            <div className="admin-dashboard__modal-actions">
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--secondary"
                onClick={handleCloseExpenseModal}
                disabled={expenseSaveLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--primary"
                onClick={handleSaveExpense}
                disabled={
                  !expenseForm.reason.trim() ||
                  !expenseForm.title.trim() ||
                  !expenseForm.amount.toString().trim() ||
                  !expenseForm.date.trim() ||
                  expenseSaveLoading
                }
              >
                {expenseSaveLoading ? "Saving..." : (editingExpenseId ? "Save Changes" : "Save Expense")}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="admin-dashboard__toast" role="status" aria-live="polite">
          <FiCheck size={16} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
