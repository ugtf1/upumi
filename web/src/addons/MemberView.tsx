import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { IconType } from "react-icons";
import {
  FiCalendar,
  FiCheck,
  FiCreditCard,
  FiEdit2,
  FiFilter,
  FiHome,
  FiLogOut,
  FiMail,
  FiPhone,
  FiPlus,
  FiSearch,
  FiSettings,
  FiUsers,
  FiMoreVertical,
  FiTrash2,
} from "react-icons/fi";

import { apiGet, apiPatch, apiPost, apiDelete, clearToken } from "./api";
import { MEMBER_STATUS_OPTIONS, type MemberDetailRecord, type MemberStatus, type PaymentHistoryRow } from "./member-data";
import "./admin-page.scss";
import "./member-page.scss";
import "./member-view-page.scss";

type NavigationItem = {
  label: string;
  icon: IconType;
  action: () => void;
  tone?: "danger";
};

type SummaryCard = {
  label: string;
  value: string;
  tone?: "success" | "danger";
};

type RecordPaymentFormState = {
  year: string;
  month: string;
  duesPaid: string;
};

type RecordAttendanceFormState = {
  year: string;
  month: string;
  status: "present" | "absent" | "";
};

type EditMemberFormState = {
  fName: string;
  lName: string;
  email: string;
  phone: string;
  address: string;
  dateJoined: string;
  voteRole: string;
  monthlyDues: string;
  totalPaid: string;
  outstanding: string;
  status: string;
};

const VOTE_ROLE_OPTIONS = ["YES", "NO"] as const;
const MONTH_OPTIONS = [
  { value: 1, label: "January" }, { value: 2, label: "February" },
  { value: 3, label: "March" }, { value: 4, label: "April" },
  { value: 5, label: "May" }, { value: 6, label: "June" },
  { value: 7, label: "July" }, { value: 8, label: "August" },
  { value: 9, label: "September" }, { value: 10, label: "October" },
  { value: 11, label: "November" }, { value: 12, label: "December" },
];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];
const MONTH_NAMES = MONTH_OPTIONS.map((m) => m.label);

function toNumericInputValue(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "";
  const numeric = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isNaN(numeric) ? "" : String(numeric);
}

function formatCurrencyDisplay(value: string): string {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;
  return `$${numeric.toLocaleString()}`;
}

function formatCurrencyAmount(value?: number | null): string {
  return `$${Number(value ?? 0).toLocaleString()}`;
}

function formatDateDisplay(value?: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

type ApiMonthlyDue = {
  id: string;
  year: number;
  month: number;
  duesPaid: number;
  present?: boolean | null;
  createdAt?: string;
};

type ApiMemberDetail = {
  id: string;
  displayMemberId?: string | null;
  memberKey?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  joined?: string | null;
  voter?: string | null;
  attendancePct?: string | null;
  monthlyDuesAmount?: number | null;
  totalPaid?: number | null;
  outstanding?: number | null;
  status?: string | null;
  monthlyDues?: ApiMonthlyDue[];
};

function mapPaymentHistory(rows: ApiMonthlyDue[] = []): PaymentHistoryRow[] {
  return rows
    .slice()
    .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month)
    .map((row) => {
      const monthName = MONTH_NAMES[Math.max(1, Math.min(12, row.month)) - 1] ?? String(row.month);
      const amount = Number(row.duesPaid ?? 0);
      return {
        id: row.id,
        month: `${monthName} ${row.year}`,
        amountPaid: formatCurrencyAmount(amount),
        status: amount > 0 ? "Paid" : "Unpaid",
        paymentDate: row.createdAt ? formatDateDisplay(row.createdAt) : "-",
        rawAmount: amount,
        year: row.year,
        monthNum: row.month,
      };
    });
}

const EMPTY_PROFILE: MemberDetailRecord = {
  memberId: "", name: "", email: "", phoneNumber: "", address: "",
  dateJoined: "", attendance: "", voteRole: "NO",
  monthlyDues: "$0", totalPaid: "$0", outstanding: "$0",
  status: "Inactive", paymentHistory: [],
};

export default function MemberViewPage() {
  const navigate = useNavigate();
  const { memberId = "" } = useParams();
  const [search, setSearch] = useState("");
  const [memberProfile, setMemberProfile] = useState<MemberDetailRecord>(EMPTY_PROFILE);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryRow[]>([]);
  const [memberLoading, setMemberLoading] = useState(true);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [isEditMemberModalOpen, setIsEditMemberModalOpen] = useState(false);
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState(false);
  const [editMemberForm, setEditMemberForm] = useState<EditMemberFormState>({
    fName: "", lName: "", email: "", phone: "", address: "",
    dateJoined: "", voteRole: "", monthlyDues: "", totalPaid: "",
    outstanding: "", status: "Active",
  });
  const [editMemberLoading, setEditMemberLoading] = useState(false);
  const [editMemberError, setEditMemberError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [recordPaymentForm, setRecordPaymentForm] = useState<RecordPaymentFormState>({
    year: String(CURRENT_YEAR),
    month: "",
    duesPaid: "",
  });
  const [recordPaymentLoading, setRecordPaymentLoading] = useState(false);
  const [recordPaymentError, setRecordPaymentError] = useState<string | null>(null);
  const [isRecordAttendanceModalOpen, setIsRecordAttendanceModalOpen] = useState(false);
  const [attendanceForm, setAttendanceForm] = useState<RecordAttendanceFormState>({
    year: String(CURRENT_YEAR),
    month: "",
    status: "",
  });
  const [recordAttendanceLoading, setRecordAttendanceLoading] = useState(false);
  const [recordAttendanceError, setRecordAttendanceError] = useState<string | null>(null);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isDeletePaymentPromptOpen, setIsDeletePaymentPromptOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<PaymentHistoryRow | null>(null);

  const menuRef = (node: HTMLDivElement | null) => {
    if (!node) return;
    const handler = (e: MouseEvent) => {
      if (!node.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  };

  // Fetch member detail + payment history from the database on mount.
  useEffect(() => {
    let active = true;
    if (!memberId) {
      setMemberError("Member ID is missing");
      setMemberLoading(false);
      return undefined;
    }

    setMemberLoading(true);
    setMemberError(null);

    apiGet<ApiMemberDetail>(`/admin/members/${memberId}`)
      .then((row) => {
        if (!active) return;
        const firstName = row.firstName?.trim() ?? "";
        const lastName = row.lastName?.trim() ?? "";
        const profile: MemberDetailRecord = {
          memberId: row.displayMemberId || row.memberKey || row.id,
          name: [firstName, lastName].filter(Boolean).join(" ") || row.email || "Unnamed member",
          email: row.email || "-",
          phoneNumber: row.phone || "-",
          address: row.address || "",
          dateJoined: formatDateDisplay(row.joined),
          attendance: row.attendancePct || "",
          voteRole: String(row.voter ?? "").trim().toUpperCase() === "YES" ? "YES" : "NO",
          monthlyDues: formatCurrencyAmount(row.monthlyDuesAmount),
          totalPaid: formatCurrencyAmount(row.totalPaid),
          outstanding: formatCurrencyAmount(row.outstanding),
          status: String(row.status ?? "").trim().toLowerCase() === "active" ? "Active" : "Inactive",
          paymentHistory: mapPaymentHistory(row.monthlyDues),
        };
        setMemberProfile(profile);
        setPaymentHistory(profile.paymentHistory);
      })
      .catch((error: Error) => {
        if (!active) return;
        setMemberError(error?.message ?? "Failed to load member");
      })
      .finally(() => {
        if (active) setMemberLoading(false);
      });

    return () => { active = false; };
  }, [memberId]);

  useEffect(() => {
    if (!isEditMemberModalOpen && !isRecordPaymentModalOpen) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsEditMemberModalOpen(false);
        setIsRecordPaymentModalOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isEditMemberModalOpen, isRecordPaymentModalOpen]);

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  function handleOpenEditMemberModal() {
    const [fName = "", ...rest] = memberProfile.name.trim().split(" ");
    const lName = rest.join(" ");

    setEditMemberForm({
      fName,
      lName,
      email: memberProfile.email,
      phone: memberProfile.phoneNumber,
      address: memberProfile.address,
      dateJoined: memberProfile.dateJoined,
      voteRole: memberProfile.voteRole,
      monthlyDues: toNumericInputValue(memberProfile.monthlyDues),
      totalPaid: toNumericInputValue(memberProfile.totalPaid),
      outstanding: toNumericInputValue(memberProfile.outstanding),
      status: memberProfile.status,
    });
    setEditMemberError(null);
    setIsEditMemberModalOpen(true);
  }

  function handleCloseEditMemberModal() {
    setIsEditMemberModalOpen(false);
    setEditMemberError(null);
  }

  function handleEditMemberChange(field: keyof EditMemberFormState, value: string) {
    setEditMemberForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  async function handleSaveEditedMember() {
    setEditMemberError(null);
    setEditMemberLoading(true);

    try {
      const fName = editMemberForm.fName.trim();
      const lName = editMemberForm.lName.trim();
      const email = editMemberForm.email.trim();
      const phone = editMemberForm.phone.trim();
      const address = editMemberForm.address.trim();
      const dateJoined = editMemberForm.dateJoined.trim();
      const voteRole = editMemberForm.voteRole.trim();
      const status = editMemberForm.status.trim();

      // Validation
      if (!fName) {
        throw new Error("First name is required");
      }
      if (!lName) {
        throw new Error("Last name is required");
      }
      if (!email) {
        throw new Error("Email is required");
      }
      if (!phone) {
        throw new Error("Phone is required");
      }
      if (!voteRole) {
        throw new Error("Vote role is required");
      }
      if (!status) {
        throw new Error("Status is required");
      }

      const monthlyDues = Number(editMemberForm.monthlyDues);
      const totalPaid = Number(editMemberForm.totalPaid);
      const outstanding = Number(editMemberForm.outstanding);

      if (Number.isNaN(monthlyDues)) {
        throw new Error("Monthly dues must be a number");
      }
      if (Number.isNaN(totalPaid)) {
        throw new Error("Total paid must be a number");
      }
      if (Number.isNaN(outstanding)) {
        throw new Error("Outstanding must be a number");
      }

      // PATCH /admin/members/:id — defined in admin.ts, handles both
      // MemberRecord rows and user. prefixed virtual ids.
      await apiPatch(`/admin/members/${memberId}`, {
        fName,
        lName,
        email,
        phone,
        address,
        dateJoined: dateJoined || null,
        voteRole,
        monthlyDues,
        totalPaid,
        outstanding,
        status,
      });

      // Reflect the update locally so the UI doesn't need a full refetch
      setMemberProfile((currentProfile) => ({
        ...currentProfile,
        name: `${fName} ${lName}`.trim(),
        email,
        phoneNumber: phone,
        address,
        dateJoined,
        voteRole,
        monthlyDues: formatCurrencyDisplay(editMemberForm.monthlyDues),
        totalPaid: formatCurrencyDisplay(editMemberForm.totalPaid),
        outstanding: formatCurrencyDisplay(editMemberForm.outstanding),
        status: status as MemberStatus,
      }));

      setIsEditMemberModalOpen(false);

      // Show success notification
      setToast("Member updated successfully");
      window.setTimeout(() => setToast(null), 3000);
    } catch (error) {
      setEditMemberError(error instanceof Error ? error.message : "Failed to update member");
    } finally {
      setEditMemberLoading(false);
    }
  }

  const isEditMemberFormValid =
    editMemberForm.fName.trim() &&
    editMemberForm.lName.trim() &&
    editMemberForm.email.trim() &&
    editMemberForm.phone.trim() &&
    editMemberForm.voteRole.trim() &&
    editMemberForm.status.trim() &&
    editMemberForm.monthlyDues.trim() !== "" &&
    editMemberForm.totalPaid.trim() !== "" &&
    editMemberForm.outstanding.trim() !== "";

  function resetRecordPaymentForm() {
    setRecordPaymentForm({ year: String(CURRENT_YEAR), month: "", duesPaid: "" });
    setRecordPaymentError(null);
  }

  function handleOpenRecordPaymentModal() {
    resetRecordPaymentForm();
    setIsRecordPaymentModalOpen(true);
  }

  function handleOpenRecordAttendanceModal() {
    setAttendanceForm({ year: String(CURRENT_YEAR), month: "", status: "" });
    setRecordAttendanceError(null);
    setIsRecordAttendanceModalOpen(true);
  }

  function handleCloseRecordAttendanceModal() {
    setIsRecordAttendanceModalOpen(false);
    setRecordAttendanceError(null);
  }

  function handleAttendanceFormChange(field: keyof RecordAttendanceFormState, value: string) {
    setAttendanceForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSaveAttendance() {
    setRecordAttendanceError(null);

    if (!attendanceForm.month) { setRecordAttendanceError("Select a month"); return; }
    if (!attendanceForm.status) { setRecordAttendanceError("Select a status"); return; }

    setRecordAttendanceLoading(true);

    try {
      await apiPost(`/admin/members/${memberId}/attendance`, {
        year: Number(attendanceForm.year),
        month: Number(attendanceForm.month),
        status: attendanceForm.status,
      });

      setIsRecordAttendanceModalOpen(false);
      setToast(
        attendanceForm.status === "present"
          ? "Attendance marked as present"
          : "Attendance marked as absent"
      );
      window.setTimeout(() => setToast(null), 3000);
    } catch (error) {
      setRecordAttendanceError(error instanceof Error ? error.message : "Failed to record attendance");
    } finally {
      setRecordAttendanceLoading(false);
    }
  }

  function handleCloseRecordPaymentModal() {
    setIsRecordPaymentModalOpen(false);
    setRecordPaymentError(null);
  }

  function handleEditPayment(payment: PaymentHistoryRow) {
    setRecordPaymentForm({
      year: payment.year ? String(payment.year) : String(CURRENT_YEAR),
      month: payment.monthNum ? String(payment.monthNum) : "",
      duesPaid: payment.rawAmount !== undefined ? String(payment.rawAmount) : "",
    });
    setRecordPaymentError(null);
    setOpenMenuId(null);
    setIsRecordPaymentModalOpen(true);
  }

  function handleDeletePaymentPrompt(payment: PaymentHistoryRow) {
    setPaymentToDelete(payment);
    setOpenMenuId(null);
    setIsDeletePaymentPromptOpen(true);
  }

  async function handleConfirmDeletePayment() {
    if (!paymentToDelete) return;
    try {
      await apiDelete(`/admin/members/${memberId}/monthly-dues/${paymentToDelete.id}`);
      setPaymentHistory((current) => current.filter((p) => p.id !== paymentToDelete.id));
      setIsDeletePaymentPromptOpen(false);
      setPaymentToDelete(null);
      setToast("Payment deleted successfully");
      window.setTimeout(() => setToast(null), 3000);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Failed to delete payment");
      window.setTimeout(() => setToast(null), 3000);
    }
  }

  function handleRecordPaymentChange(field: keyof RecordPaymentFormState, value: string) {
    setRecordPaymentForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  async function handleSaveRecordedPayment() {
    setRecordPaymentError(null);

    const year = Number(recordPaymentForm.year);
    const month = Number(recordPaymentForm.month);
    const duesPaid = Number(recordPaymentForm.duesPaid);

    if (!recordPaymentForm.month) { setRecordPaymentError("Select a month"); return; }
    if (!recordPaymentForm.duesPaid.trim()) { setRecordPaymentError("Enter an amount"); return; }
    if (Number.isNaN(duesPaid) || duesPaid < 0) { setRecordPaymentError("Amount must be a valid number"); return; }

    setRecordPaymentLoading(true);

    try {
      // POST to the new /admin/members/:id/monthly-dues route.
      // The memberId from the URL IS the MemberRecord.id the backend expects.
      const saved = await apiPost<ApiMonthlyDue>(
        `/admin/members/${memberId}/monthly-dues`,
        { year, month, duesPaid }
      );

      // Build the display row from the saved record and upsert into local state.
      const monthName = MONTH_OPTIONS.find((m) => m.value === month)?.label ?? String(month);
      const newRow: PaymentHistoryRow = {
        id: saved.id,
        month: `${monthName} ${year}`,
        amountPaid: formatCurrencyAmount(saved.duesPaid),
        status: saved.duesPaid > 0 ? "Paid" : "Unpaid",
        paymentDate: saved.createdAt ? formatDateDisplay(saved.createdAt) : formatDateDisplay(new Date().toISOString()),
      };

      setPaymentHistory((current) => {
        const existingIndex = current.findIndex((row) => row.id === saved.id || row.month === newRow.month);
        if (existingIndex === -1) return [newRow, ...current];
        return current.map((row, i) => (i === existingIndex ? newRow : row));
      });

      setIsRecordPaymentModalOpen(false);
      setToast("Payment recorded successfully");
      window.setTimeout(() => setToast(null), 3000);
    } catch (error) {
      setRecordPaymentError(error instanceof Error ? error.message : "Failed to record payment");
    } finally {
      setRecordPaymentLoading(false);
    }
  }

  const primaryNavigationItems: NavigationItem[] = [
    { label: "Dashboard", icon: FiHome, action: () => navigate("/admin") },
    { label: "Transaction", icon: FiCreditCard, action: () => navigate("/admin/transaction") },
    { label: "Member", icon: FiUsers, action: () => navigate("/admin/member") },
  ];

  const secondaryNavigationItems: NavigationItem[] = [
    {
      label: "Settings",
      icon: FiSettings,
      action: () => navigate("/admin/settings"),
    },
    { label: "Logout", icon: FiLogOut, action: handleLogout, tone: "danger" },
  ];

  const totalPaidFromHistory = paymentHistory.reduce((sum, row) => {
    const numeric = Number(row.amountPaid.replace(/[$,]/g, ""));
    return sum + (Number.isNaN(numeric) ? 0 : numeric);
  }, 0);

  const summaryCards: SummaryCard[] = [
    { label: "Monthly Dues", value: memberProfile.monthlyDues },
    { label: "Total Paid", value: `$${totalPaidFromHistory.toLocaleString()}`, tone: "success" },
    { label: "Outstanding", value: memberProfile.outstanding, tone: "danger" },
  ];

  return (
    <div className="admin-dashboard member-page member-view-page">
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
            const active = item.label === "Member";

            return (
              <button
                key={item.label}
                type="button"
                className={["admin-dashboard__nav-item", active ? "is-active" : ""].filter(Boolean).join(" ")}
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
            <div className="admin-dashboard__profile-avatar" aria-hidden="true">A</div>
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
                  className={["admin-dashboard__nav-item", item.tone === "danger" ? "is-danger" : ""].filter(Boolean).join(" ")}
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
        <section className="admin-dashboard__hero member-page__hero">
          <div>
            <h1>Admin Console</h1>
            <p>Pivot-style member details for all signed-in members.</p>
          </div>

          <div className="admin-dashboard__hero-actions member-page__hero-actions">
            <label className="admin-dashboard__search member-page__search">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search member, expense, balance, income....."
                aria-label="Search members"
              />
              <FiSearch size={18} />
            </label>

            <button type="button" className="admin-dashboard__icon-button" aria-label="Filter members">
              <FiFilter size={18} />
            </button>

            <button type="button" className="member-page__add-button">
              <FiPlus size={18} />
              <span>Add New</span>
            </button>
          </div>
        </section>

        <section className="member-view-page__content">
          <div className="admin-dashboard__section-copy member-page__section-copy">
            <h2>Member Details</h2>
            <p>Manage all members in your organization</p>
          </div>

          <article className="member-view-page__details-card">
            <div className="member-view-page__details-main">
              <div className="member-view-page__identity">
                <span className="member-view-page__eyebrow">Member ID {memberProfile.memberId}</span>
                <h3>{memberProfile.name}</h3>

                <div className="member-view-page__contact-list">
                  <div className="member-view-page__contact-item">
                    <FiMail size={18} />
                    <div>
                      <span className="member-view-page__contact-label">Email</span>
                      <strong>{memberProfile.email}</strong>
                    </div>
                  </div>
                  <div className="member-view-page__contact-item">
                    <FiPhone size={18} />
                    <div>
                      <span className="member-view-page__contact-label">Phone</span>
                      <strong>{memberProfile.phoneNumber}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="member-view-page__summary-grid">
                {summaryCards.map((card) => (
                  <div key={card.label} className="member-view-page__summary-card">
                    <span>{card.label}</span>
                    <strong className={card.tone ? `is-${card.tone}` : ""}>{card.value}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="member-view-page__action-row">
              <button type="button" className="member-view-page__outline-button" onClick={handleOpenEditMemberModal}>
                <FiEdit2 size={16} />
                <span>Edit Member</span>
              </button>
              <button type="button" className="member-view-page__outline-button" onClick={handleOpenRecordPaymentModal}>
                <FiCreditCard size={16} />
                <span>Record Payment</span>
              </button>
              <button type="button" className="member-view-page__outline-button" onClick={handleOpenRecordAttendanceModal}>
                <FiCalendar size={16} />
                <span>Record Attendance</span>
              </button>
            </div>
          </article>

          <div className="admin-dashboard__section-copy member-page__section-copy">
            <h2>Payment History</h2>
            <p>
              {memberLoading
                ? "Loading..."
                : `${paymentHistory.length} payment record${paymentHistory.length !== 1 ? "s" : ""}`}
            </p>
          </div>

          <div className="admin-dashboard__table-shell member-view-page__table-shell">
            {memberError ? (
              <div className="admin-dashboard__modal-error">{memberError}</div>
            ) : (
              <div className="admin-dashboard__table-wrap member-view-page__table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Amount Paid</th>
                      <th>Status</th>
                      <th>Payment Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberLoading ? (
                      <tr>
                        <td colSpan={5} className="member-view-page__table-state">
                          Loading payment history...
                        </td>
                      </tr>
                    ) : !paymentHistory.length ? (
                      <tr>
                        <td colSpan={5} className="member-view-page__table-state">
                          No payments recorded yet.
                        </td>
                      </tr>
                    ) : (
                      paymentHistory.map((payment) => (
                        <tr key={payment.id}>
                          <td data-label="Month">{payment.month}</td>
                          <td data-label="Amount Paid">{payment.amountPaid}</td>
                          <td data-label="Status">
                            <span
                              className={[
                                "admin-dashboard__status-pill",
                                payment.status === "Paid" ? "is-good" : "is-bad",
                              ].join(" ")}
                            >
                              {payment.status}
                            </span>
                          </td>
                          <td data-label="Payment Date">{payment.paymentDate}</td>
                          <td data-label="Action">
                            <div className="member-page__action-wrap" ref={openMenuId === payment.id ? menuRef : null}>
                              <button
                                type="button"
                                className={[
                                  "member-page__more-button",
                                  openMenuId === payment.id ? "is-active" : "",
                                ].filter(Boolean).join(" ")}
                                aria-label="More actions"
                                aria-expanded={openMenuId === payment.id}
                                aria-haspopup="menu"
                                onClick={() => setOpenMenuId(openMenuId === payment.id ? null : payment.id)}
                              >
                                <FiMoreVertical size={22} />
                              </button>

                              {openMenuId === payment.id && (
                                <div className="member-page__action-menu" role="menu">
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="member-page__action-item"
                                    onClick={() => handleEditPayment(payment)}
                                  >
                                    <FiEdit2 size={15} />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="member-page__action-item member-page__action-item--danger"
                                    onClick={() => handleDeletePaymentPrompt(payment)}
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
        </section>
      </main>

      {isRecordPaymentModalOpen && (
        <div className="admin-dashboard__modal" role="dialog" aria-modal="true" aria-labelledby="record-payment-modal-title">
          <div className="admin-dashboard__modal-backdrop" onClick={handleCloseRecordPaymentModal} />

          <div className="admin-dashboard__modal-panel member-view-page__modal-panel">
            <h2 id="record-payment-modal-title" className="admin-dashboard__modal-title">
              Record Payment
            </h2>

            {recordPaymentError && (
              <div className="admin-dashboard__modal-error">{recordPaymentError}</div>
            )}

            <div className="member-view-page__modal-grid">
              <div className="admin-dashboard__modal-section">
                <label htmlFor="record-payment-year" className="admin-dashboard__modal-label">
                  Year *
                </label>
                <div className="admin-dashboard__modal-input member-view-page__modal-input member-view-page__modal-select-wrap">
                  <FiCalendar size={20} />
                  <select
                    id="record-payment-year"
                    value={recordPaymentForm.year}
                    onChange={(event) => handleRecordPaymentChange("year", event.target.value)}
                    aria-label="Payment year"
                    className="has-value"
                  >
                    {YEAR_OPTIONS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="admin-dashboard__modal-section">
                <label htmlFor="record-payment-month" className="admin-dashboard__modal-label">
                  Month *
                </label>
                <div className="admin-dashboard__modal-input member-view-page__modal-input member-view-page__modal-select-wrap">
                  <FiCalendar size={20} />
                  <select
                    id="record-payment-month"
                    value={recordPaymentForm.month}
                    onChange={(event) => handleRecordPaymentChange("month", event.target.value)}
                    aria-label="Payment month"
                    className={recordPaymentForm.month ? "has-value" : ""}
                  >
                    <option value="">Select month</option>
                    {MONTH_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="admin-dashboard__modal-section">
              <label htmlFor="record-payment-amount" className="admin-dashboard__modal-label">
                Amount Paid *
              </label>
              <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input">
                <input
                  id="record-payment-amount"
                  type="number"
                  inputMode="decimal"
                  value={recordPaymentForm.duesPaid}
                  onChange={(event) => handleRecordPaymentChange("duesPaid", event.target.value)}
                  placeholder="20"
                  aria-label="Amount paid"
                />
              </div>
            </div>

            <div className="admin-dashboard__modal-actions">
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--secondary"
                onClick={handleCloseRecordPaymentModal}
                disabled={recordPaymentLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--primary"
                onClick={handleSaveRecordedPayment}
                disabled={
                  !recordPaymentForm.month ||
                  !recordPaymentForm.duesPaid.trim() ||
                  recordPaymentLoading
                }
              >
                {recordPaymentLoading ? "Saving..." : "Save Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeletePaymentPromptOpen && paymentToDelete && (
        <div className="admin-dashboard__modal" role="dialog" aria-modal="true" aria-labelledby="delete-payment-modal-title">
          <div className="admin-dashboard__modal-backdrop" onClick={() => setIsDeletePaymentPromptOpen(false)} />

          <div className="admin-dashboard__modal-panel">
            <h2 id="delete-payment-modal-title" className="admin-dashboard__modal-title admin-dashboard__modal-title--danger">
              Delete Payment Record
            </h2>
            <div className="admin-dashboard__modal-section-copy" style={{ marginBottom: "1.5rem" }}>
              <p>Are you sure you want to delete the payment record for <strong>{paymentToDelete.month}</strong>?</p>
              <p>This action cannot be undone.</p>
            </div>

            <div className="admin-dashboard__modal-actions">
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--secondary"
                onClick={() => setIsDeletePaymentPromptOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--danger"
                onClick={handleConfirmDeletePayment}
              >
                Delete Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditMemberModalOpen && (
        <div className="admin-dashboard__modal" role="dialog" aria-modal="true" aria-labelledby="member-profile-edit-modal-title">
          <div className="admin-dashboard__modal-backdrop" onClick={handleCloseEditMemberModal} />

          <div className="admin-dashboard__modal-panel member-view-page__modal-panel member-view-page__modal-panel--wide">
            {editMemberError && (
              <div className="admin-dashboard__modal-error">
                {editMemberError}
              </div>
            )}

            <div className="member-view-page__modal-grid member-view-page__modal-grid--cols-3">
              <div className="admin-dashboard__modal-section">
                <label htmlFor="member-profile-fname" className="admin-dashboard__modal-label" id="member-profile-edit-modal-title">
                  First Name *
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input">
                  <input
                    id="member-profile-fname"
                    value={editMemberForm.fName}
                    onChange={(event) => handleEditMemberChange("fName", event.target.value)}
                    placeholder="Agbara"
                    aria-label="First name"
                  />
                </div>
              </div>

              <div className="admin-dashboard__modal-section">
                <label htmlFor="member-profile-lname" className="admin-dashboard__modal-label">
                  Last Name *
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input">
                  <input
                    id="member-profile-lname"
                    value={editMemberForm.lName}
                    onChange={(event) => handleEditMemberChange("lName", event.target.value)}
                    placeholder="Onome"
                    aria-label="Last name"
                  />
                </div>
              </div>

              <div className="admin-dashboard__modal-section">
                <label htmlFor="member-profile-email" className="admin-dashboard__modal-label">
                  Email Address *
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input">
                  <FiMail size={20} />
                  <input
                    id="member-profile-email"
                    type="email"
                    value={editMemberForm.email}
                    onChange={(event) => handleEditMemberChange("email", event.target.value)}
                    placeholder="Andrew.karl@gmail.com"
                    aria-label="Email address"
                  />
                </div>
              </div>

              <div className="admin-dashboard__modal-section">
                <label htmlFor="member-profile-phone" className="admin-dashboard__modal-label">
                  Phone *
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input">
                  <FiPhone size={20} />
                  <input
                    id="member-profile-phone"
                    type="tel"
                    value={editMemberForm.phone}
                    onChange={(event) => handleEditMemberChange("phone", event.target.value)}
                    placeholder="+234 818 481 9383"
                    aria-label="Phone number"
                  />
                </div>
              </div>

              <div className="admin-dashboard__modal-section">
                <label htmlFor="member-profile-address" className="admin-dashboard__modal-label">
                  Address
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input">
                  <input
                    id="member-profile-address"
                    value={editMemberForm.address}
                    onChange={(event) => handleEditMemberChange("address", event.target.value)}
                    placeholder="Enter address"
                    aria-label="Address"
                  />
                </div>
              </div>

              <div className="admin-dashboard__modal-section">
                <label htmlFor="member-profile-vote-role" className="admin-dashboard__modal-label">
                  Vote Role *
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input member-view-page__modal-select-wrap">
                  <select
                    id="member-profile-vote-role"
                    value={editMemberForm.voteRole}
                    onChange={(event) => handleEditMemberChange("voteRole", event.target.value)}
                    aria-label="Vote role"
                    className={editMemberForm.voteRole ? "has-value" : ""}
                  >
                    <option value="">Select</option>
                    {VOTE_ROLE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="admin-dashboard__modal-section">
                <label htmlFor="member-profile-date-joined" className="admin-dashboard__modal-label">
                  Date Joined
                </label>
                <div className="admin-dashboard__modal-input member-view-page__modal-input">
                  <FiCalendar size={20} />
                  <input
                    id="member-profile-date-joined"
                    value={editMemberForm.dateJoined}
                    onChange={(event) => handleEditMemberChange("dateJoined", event.target.value)}
                    placeholder="12 Jan 2024"
                    aria-label="Date joined"
                  />
                </div>
              </div>

              <div className="admin-dashboard__modal-section">
                <label htmlFor="member-profile-status" className="admin-dashboard__modal-label">
                  Status *
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input member-view-page__modal-select-wrap">
                  <select
                    id="member-profile-status"
                    value={editMemberForm.status}
                    onChange={(event) => handleEditMemberChange("status", event.target.value)}
                    aria-label="Status"
                    className={editMemberForm.status ? "has-value" : ""}
                  >
                    {MEMBER_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="admin-dashboard__modal-section">
                <label htmlFor="member-profile-monthly-dues" className="admin-dashboard__modal-label">
                  Monthly Dues *
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input">
                  <input
                    id="member-profile-monthly-dues"
                    type="number"
                    inputMode="decimal"
                    value={editMemberForm.monthlyDues}
                    onChange={(event) => handleEditMemberChange("monthlyDues", event.target.value)}
                    placeholder="0"
                    aria-label="Monthly dues"
                  />
                </div>
              </div>

              <div className="admin-dashboard__modal-section">
                <label htmlFor="member-profile-total-paid" className="admin-dashboard__modal-label">
                  Total Paid *
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input">
                  <input
                    id="member-profile-total-paid"
                    type="number"
                    inputMode="decimal"
                    value={editMemberForm.totalPaid}
                    onChange={(event) => handleEditMemberChange("totalPaid", event.target.value)}
                    placeholder="0"
                    aria-label="Total paid"
                  />
                </div>
              </div>

              <div className="admin-dashboard__modal-section">
                <label htmlFor="member-profile-outstanding" className="admin-dashboard__modal-label">
                  Outstanding *
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input">
                  <input
                    id="member-profile-outstanding"
                    type="number"
                    inputMode="decimal"
                    value={editMemberForm.outstanding}
                    onChange={(event) => handleEditMemberChange("outstanding", event.target.value)}
                    placeholder="0"
                    aria-label="Outstanding"
                  />
                </div>
              </div>
            </div>

            <div className="admin-dashboard__modal-actions">
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--secondary"
                onClick={handleCloseEditMemberModal}
                disabled={editMemberLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--primary"
                onClick={handleSaveEditedMember}
                disabled={!isEditMemberFormValid || editMemberLoading}
              >
                {editMemberLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isRecordAttendanceModalOpen && (
        <div className="admin-dashboard__modal" role="dialog" aria-modal="true" aria-labelledby="record-attendance-modal-title">
          <div className="admin-dashboard__modal-backdrop" onClick={handleCloseRecordAttendanceModal} />

          <div className="admin-dashboard__modal-panel member-view-page__modal-panel">
            <h2 id="record-attendance-modal-title" className="admin-dashboard__modal-title">
              Record Attendance
            </h2>

            {recordAttendanceError && (
              <div className="admin-dashboard__modal-error">{recordAttendanceError}</div>
            )}

            <div className="member-view-page__modal-grid">
              <div className="admin-dashboard__modal-section">
                <label htmlFor="attendance-year" className="admin-dashboard__modal-label">
                  Year *
                </label>
                <div className="admin-dashboard__modal-input member-view-page__modal-input member-view-page__modal-select-wrap">
                  <FiCalendar size={20} />
                  <select
                    id="attendance-year"
                    value={attendanceForm.year}
                    onChange={(e) => handleAttendanceFormChange("year", e.target.value)}
                    aria-label="Attendance year"
                    className="has-value"
                  >
                    {YEAR_OPTIONS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="admin-dashboard__modal-section">
                <label htmlFor="attendance-month" className="admin-dashboard__modal-label">
                  Month *
                </label>
                <div className="admin-dashboard__modal-input member-view-page__modal-input member-view-page__modal-select-wrap">
                  <FiCalendar size={20} />
                  <select
                    id="attendance-month"
                    value={attendanceForm.month}
                    onChange={(e) => handleAttendanceFormChange("month", e.target.value)}
                    aria-label="Attendance month"
                    className={attendanceForm.month ? "has-value" : ""}
                  >
                    <option value="">Select month</option>
                    {MONTH_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="admin-dashboard__modal-section">
              <label htmlFor="attendance-status" className="admin-dashboard__modal-label">
                Status *
              </label>
              <div className="admin-dashboard__modal-input member-view-page__modal-input member-view-page__modal-select-wrap">
                <select
                  id="attendance-status"
                  value={attendanceForm.status}
                  onChange={(e) => handleAttendanceFormChange("status", e.target.value)}
                  aria-label="Attendance status"
                  className={attendanceForm.status ? "has-value" : ""}
                >
                  <option value="">Select status</option>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                </select>
              </div>
            </div>

            <div className="admin-dashboard__modal-actions">
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--secondary"
                onClick={handleCloseRecordAttendanceModal}
                disabled={recordAttendanceLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--primary"
                onClick={handleSaveAttendance}
                disabled={!attendanceForm.month || !attendanceForm.status || recordAttendanceLoading}
              >
                {recordAttendanceLoading ? "Saving..." : "Save Attendance"}
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
