import { useCallback, useEffect, useState } from "react";
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
} from "react-icons/fi";

import { apiGet, apiPatch, clearToken } from "./api";
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
  month: number | "";
  year: number;
  amountPaid: string;
  paymentDate: string;
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
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_OPTIONS = MONTH_NAMES.map((label, index) => ({ value: index + 1, label }));
const YEAR_OPTIONS = [2024, 2025, 2026, 2027];

type ApiMonthlyDue = {
  id: string;
  year: number;
  month: number;
  duesPaid: number;
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

const EMPTY_MEMBER_PROFILE: MemberDetailRecord = {
  memberId: "",
  name: "",
  email: "",
  phoneNumber: "",
  address: "",
  dateJoined: "",
  attendance: "",
  voteRole: "NO",
  monthlyDues: "$0",
  totalPaid: "$0",
  outstanding: "$0",
  status: "Inactive",
  paymentHistory: [],
};

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
  const numeric = Number(value ?? 0);
  return `$${numeric.toLocaleString()}`;
}

function formatDateDisplay(value?: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function normalizeMemberStatus(value?: string | null): MemberStatus {
  return String(value ?? "").trim().toLowerCase() === "active" ? "Active" : "Inactive";
}

function normalizeVoteRole(value?: string | null): string {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized === "YES" ? "YES" : "NO";
}

function mapPaymentHistory(rows: ApiMonthlyDue[] = []): PaymentHistoryRow[] {
  return rows
    .slice()
    .sort((a, b) => (b.year - a.year) || (b.month - a.month))
    .map((row) => {
    const monthName = MONTH_NAMES[Math.max(1, Math.min(12, row.month)) - 1] ?? String(row.month);
    const amountPaid = Number(row.duesPaid ?? 0);
    return {
      id: row.id,
      month: `${monthName} ${row.year}`,
      amountPaid: formatCurrencyAmount(amountPaid),
      status: amountPaid > 0 ? "Paid" : "Unpaid",
      paymentDate: row.createdAt ? formatDateDisplay(row.createdAt) : "-",
    };
  });
}

function mapApiMemberDetail(row: ApiMemberDetail): MemberDetailRecord {
  const firstName = row.firstName?.trim() ?? "";
  const lastName = row.lastName?.trim() ?? "";

  return {
    memberId: row.displayMemberId || row.memberKey || row.id,
    name: [firstName, lastName].filter(Boolean).join(" ") || row.email || "Unnamed member",
    email: row.email || "-",
    phoneNumber: row.phone || "-",
    address: row.address || "",
    dateJoined: formatDateDisplay(row.joined),
    attendance: row.attendancePct || "",
    voteRole: normalizeVoteRole(row.voter),
    monthlyDues: formatCurrencyAmount(row.monthlyDuesAmount),
    totalPaid: formatCurrencyAmount(row.totalPaid),
    outstanding: formatCurrencyAmount(row.outstanding),
    status: normalizeMemberStatus(row.status),
    paymentHistory: mapPaymentHistory(row.monthlyDues),
  };
}

export default function MemberViewPage() {
  const navigate = useNavigate();
  const { memberId = "" } = useParams();
  const [search, setSearch] = useState("");
  const [memberProfile, setMemberProfile] = useState<MemberDetailRecord>(EMPTY_MEMBER_PROFILE);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryRow[]>([]);
  const [monthlyDueRecords, setMonthlyDueRecords] = useState<ApiMonthlyDue[]>([]);
  const [memberLoading, setMemberLoading] = useState(true);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [isEditMemberModalOpen, setIsEditMemberModalOpen] = useState(false);
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState(false);
  const [editMemberForm, setEditMemberForm] = useState<EditMemberFormState>({
    fName: "",
    lName: "",
    email: "",
    phone: "",
    address: "",
    dateJoined: "",
    voteRole: "",
    monthlyDues: "",
    totalPaid: "",
    outstanding: "",
    status: "Active",
  });
  const [editMemberLoading, setEditMemberLoading] = useState(false);
  const [editMemberError, setEditMemberError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [recordPaymentForm, setRecordPaymentForm] = useState<RecordPaymentFormState>({
    month: "",
    year: 2026,
    amountPaid: "",
    paymentDate: "",
  });
  const [recordPaymentLoading, setRecordPaymentLoading] = useState(false);
  const [recordPaymentError, setRecordPaymentError] = useState<string | null>(null);

  const loadMemberDetail = useCallback(async () => {
    if (!memberId) {
      setMemberError("Member ID is missing");
      setMemberLoading(false);
      return;
    }

    setMemberLoading(true);
    setMemberError(null);

    try {
      const row = await apiGet<ApiMemberDetail>(`/admin/members/${memberId}`);
      const profile = mapApiMemberDetail(row);
      setMemberProfile(profile);
      setPaymentHistory(profile.paymentHistory);
      setMonthlyDueRecords(row.monthlyDues ?? []);
    } catch (error) {
      setMemberProfile(EMPTY_MEMBER_PROFILE);
      setPaymentHistory([]);
      setMonthlyDueRecords([]);
      setMemberError(error instanceof Error ? error.message : "Failed to load member");
    } finally {
      setMemberLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    void loadMemberDetail();
  }, [loadMemberDetail]);

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
    setRecordPaymentForm({
      month: "",
      year: 2026,
      amountPaid: "",
      paymentDate: "",
    });
    setRecordPaymentError(null);
  }

  function handleOpenRecordPaymentModal() {
    resetRecordPaymentForm();
    setIsRecordPaymentModalOpen(true);
  }

  function handleCloseRecordPaymentModal() {
    setIsRecordPaymentModalOpen(false);
  }

  function handleRecordPaymentChange(field: keyof RecordPaymentFormState, value: string) {
    if (field === "month") {
      setRecordPaymentForm((currentForm) => ({ ...currentForm, month: value ? Number(value) : "" }));
      return;
    }
    if (field === "year") {
      setRecordPaymentForm((currentForm) => ({ ...currentForm, year: Number(value) }));
      return;
    }
    setRecordPaymentForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  async function handleSaveRecordedPayment() {
    setRecordPaymentError(null);

    const { month, year, amountPaid: rawAmount } = recordPaymentForm;
    if (!month || !year || !rawAmount.trim()) return;

    const duesPaid = Number(rawAmount.replace(/[^0-9.-]/g, ""));
    if (Number.isNaN(duesPaid)) {
      setRecordPaymentError("Enter a valid amount.");
      return;
    }

    setRecordPaymentLoading(true);

    try {
      // MonthlyDue has a @@unique([memberRecordId, year, month]) constraint,
      // so recording a payment for a month that already has an entry should
      // update that row instead of creating a duplicate — mirrors how the
      // hosting schedule's year/month uniqueness is handled on AdminPage.
      const existing = monthlyDueRecords.find((row) => row.year === year && row.month === month);

      if (existing) {
        await apiPatch(`/admin/members/${memberId}/monthly-dues/${existing.id}`, { duesPaid });
      } else {
        await apiPost(`/admin/members/${memberId}/monthly-dues`, { year, month, duesPaid });
      }

      // Re-fetch so payment history, totals, and outstanding balance all
      // reflect whatever the server computed, the same pattern used after
      // editing the member profile and saving the hosting schedule.
      await loadMemberDetail();

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

  const summaryCards: SummaryCard[] = [
    { label: "Monthly Dues", value: memberProfile.monthlyDues },
    { label: "Total Paid", value: memberProfile.totalPaid, tone: "success" },
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
          {memberLoading ? (
            <div className="member-page__empty-state">Loading member details...</div>
          ) : memberError ? (
            <div className="member-page__empty-state">{memberError}</div>
          ) : (
            <>
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
            </div>
          </article>

          <div className="admin-dashboard__section-copy member-page__section-copy">
            <h2>Payment History</h2>
            <p>Record and track dues payments every month</p>
          </div>

          <div className="admin-dashboard__table-shell member-view-page__table-shell">
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
                  {paymentHistory.map((payment) => (
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
                        <button type="button" className="member-view-page__table-action">
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
            </>
          )}
        </section>
      </main>

      {isRecordPaymentModalOpen && (
        <div className="admin-dashboard__modal" role="dialog" aria-modal="true" aria-labelledby="record-payment-modal-title">
          <div className="admin-dashboard__modal-backdrop" onClick={handleCloseRecordPaymentModal} />

          <div className="admin-dashboard__modal-panel member-view-page__modal-panel">
            <div className="admin-dashboard__modal-section">
              <label htmlFor="record-payment-month" className="admin-dashboard__modal-label" id="record-payment-modal-title">
                Month
              </label>
              <div className="admin-dashboard__modal-input member-view-page__modal-input">
                <FiCalendar size={20} />
                <input
                  id="record-payment-month"
                  value={recordPaymentForm.month}
                  onChange={(event) => handleRecordPaymentChange("month", event.target.value)}
                  placeholder="Enter Month"
                  aria-label="Payment month"
                />
              </div>
            </div>

            <div className="admin-dashboard__modal-section">
              <label htmlFor="record-payment-amount" className="admin-dashboard__modal-label">
                Amount Paid
              </label>
              <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input">
                <input
                  id="record-payment-amount"
                  value={recordPaymentForm.amountPaid}
                  onChange={(event) => handleRecordPaymentChange("amountPaid", event.target.value)}
                  placeholder="Enter Amount"
                  aria-label="Amount paid"
                />
              </div>
            </div>

            <div className="admin-dashboard__modal-section">
              <label htmlFor="record-payment-date" className="admin-dashboard__modal-label">
                Payment Date
              </label>
              <div className="admin-dashboard__modal-input member-view-page__modal-input">
                <FiCalendar size={20} />
                <input
                  id="record-payment-date"
                  value={recordPaymentForm.paymentDate}
                  onChange={(event) => handleRecordPaymentChange("paymentDate", event.target.value)}
                  placeholder="29 - 04 - 2024"
                  aria-label="Payment date"
                />
              </div>
            </div>

            <div className="admin-dashboard__modal-actions">
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--secondary"
                onClick={handleCloseRecordPaymentModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--primary"
                onClick={handleSaveRecordedPayment}
                disabled={
                  !recordPaymentForm.month.trim() ||
                  !recordPaymentForm.amountPaid.trim() ||
                  !recordPaymentForm.paymentDate.trim()
                }
              >
                Save Changes
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

      {toast && (
        <div className="admin-dashboard__toast" role="status" aria-live="polite">
          <FiCheck size={16} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
