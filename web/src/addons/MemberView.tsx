import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { IconType } from "react-icons";
import {
  FiCalendar,
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

import { clearToken } from "./api";
import { getMemberDetailByMemberId, type PaymentHistoryRow } from "./member-data";
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
  month: string;
  amountPaid: string;
  paymentDate: string;
};

type EditMemberFormState = {
  fullName: string;
  email: string;
  attendance: string;
  voteRole: string;
};

const VOTE_ROLE_OPTIONS = ["YES", "NO"] as const;

export default function MemberViewPage() {
  const navigate = useNavigate();
  const { memberId = "2944" } = useParams();
  const [search, setSearch] = useState("");
  const [memberProfile, setMemberProfile] = useState(() => getMemberDetailByMemberId(memberId));
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryRow[]>([]);
  const [isEditMemberModalOpen, setIsEditMemberModalOpen] = useState(false);
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState(false);
  const [editMemberForm, setEditMemberForm] = useState<EditMemberFormState>({
    fullName: "",
    email: "",
    attendance: "",
    voteRole: "",
  });
  const [recordPaymentForm, setRecordPaymentForm] = useState<RecordPaymentFormState>({
    month: "",
    amountPaid: "",
    paymentDate: "",
  });

  const memberDetail = useMemo(() => getMemberDetailByMemberId(memberId), [memberId]);

  useEffect(() => {
    setMemberProfile(memberDetail);
    setPaymentHistory(memberDetail.paymentHistory);
  }, [memberDetail]);

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
    setEditMemberForm({
      fullName: memberProfile.name,
      email: memberProfile.email,
      attendance: memberProfile.attendance,
      voteRole: memberProfile.voteRole,
    });
    setIsEditMemberModalOpen(true);
  }

  function handleCloseEditMemberModal() {
    setIsEditMemberModalOpen(false);
  }

  function handleEditMemberChange(field: keyof EditMemberFormState, value: string) {
    setEditMemberForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function handleSaveEditedMember() {
    const fullName = editMemberForm.fullName.trim();
    const email = editMemberForm.email.trim();
    const attendance = editMemberForm.attendance.trim();
    const voteRole = editMemberForm.voteRole.trim();
    if (!fullName || !email || !attendance || !voteRole) return;

    setMemberProfile((currentProfile) => ({
      ...currentProfile,
      name: fullName,
      email,
      attendance,
      voteRole,
    }));
    setIsEditMemberModalOpen(false);
  }

  function resetRecordPaymentForm() {
    setRecordPaymentForm({
      month: "",
      amountPaid: "",
      paymentDate: "",
    });
  }

  function handleOpenRecordPaymentModal() {
    resetRecordPaymentForm();
    setIsRecordPaymentModalOpen(true);
  }

  function handleCloseRecordPaymentModal() {
    setIsRecordPaymentModalOpen(false);
  }

  function handleRecordPaymentChange(field: keyof RecordPaymentFormState, value: string) {
    setRecordPaymentForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function handleSaveRecordedPayment() {
    const month = recordPaymentForm.month.trim();
    const rawAmount = recordPaymentForm.amountPaid.trim();
    const paymentDate = recordPaymentForm.paymentDate.trim();

    if (!month || !rawAmount || !paymentDate) return;

    const amountPaid = rawAmount.startsWith("$") ? rawAmount : `$${rawAmount}`;
    const nextPayment: PaymentHistoryRow = {
      id: `payment-${Date.now()}`,
      month,
      amountPaid,
      status: "Paid",
      paymentDate,
    };

    setPaymentHistory((currentRows) => {
      const existingIndex = currentRows.findIndex((row) => row.month.toLowerCase() === month.toLowerCase());
      if (existingIndex === -1) {
        return [nextPayment, ...currentRows];
      }

      return currentRows.map((row, index) => (index === existingIndex ? nextPayment : row));
    });

    setIsRecordPaymentModalOpen(false);
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

          <div className="admin-dashboard__modal-panel member-view-page__modal-panel">
            <div className="member-view-page__modal-grid">
              <div className="admin-dashboard__modal-section">
                <label htmlFor="member-profile-full-name" className="admin-dashboard__modal-label" id="member-profile-edit-modal-title">
                  Full Name
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input">
                  <input
                    id="member-profile-full-name"
                    value={editMemberForm.fullName}
                    onChange={(event) => handleEditMemberChange("fullName", event.target.value)}
                    placeholder="Agbara Onome"
                    aria-label="Full name"
                  />
                </div>
              </div>

              <div className="admin-dashboard__modal-section">
                <label htmlFor="member-profile-email" className="admin-dashboard__modal-label">
                  Email Address
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input">
                  <input
                    id="member-profile-email"
                    value={editMemberForm.email}
                    onChange={(event) => handleEditMemberChange("email", event.target.value)}
                    placeholder="Andrew.karl@gmail.com"
                    aria-label="Email address"
                  />
                </div>
              </div>

              <div className="admin-dashboard__modal-section">
                <label htmlFor="member-profile-attendance" className="admin-dashboard__modal-label">
                  Member Attendance
                </label>
                <div className="admin-dashboard__modal-input member-view-page__modal-input">
                  <FiCalendar size={20} />
                  <input
                    id="member-profile-attendance"
                    value={editMemberForm.attendance}
                    onChange={(event) => handleEditMemberChange("attendance", event.target.value)}
                    placeholder="March"
                    aria-label="Member attendance"
                  />
                </div>
              </div>

              <div className="admin-dashboard__modal-section">
                <label htmlFor="member-profile-vote-role" className="admin-dashboard__modal-label">
                  Vote Role
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
            </div>

            <div className="admin-dashboard__modal-actions">
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--secondary"
                onClick={handleCloseEditMemberModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--primary"
                onClick={handleSaveEditedMember}
                disabled={
                  !editMemberForm.fullName.trim() ||
                  !editMemberForm.email.trim() ||
                  !editMemberForm.attendance.trim() ||
                  !editMemberForm.voteRole.trim()
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
