import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { IconType } from "react-icons";
import {
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiCreditCard,
  FiEdit2,
  FiEye,
  FiFilter,
  FiHome,
  FiLogOut,
  FiPlus,
  FiSearch,
  FiSettings,
  FiUsers,
} from "react-icons/fi";

import { clearToken } from "./api";
import { getMemberDetailByMemberId, MEMBER_ROWS } from "./member-data";
import "./admin-page.scss";
import "./member-page.scss";

type NavigationItem = {
  label: string;
  icon: IconType;
  action: () => void;
  tone?: "danger";
};

const PAGE_SIZE = 7;
const PAGE_BUTTONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const VOTE_ROLE_OPTIONS = ["YES", "NO"] as const;

type EditMemberFormState = {
  memberId: string;
  fullName: string;
  email: string;
  attendance: string;
  voteRole: string;
};

export default function MemberPage() {
  const navigate = useNavigate();

  const [memberRows, setMemberRows] = useState(MEMBER_ROWS);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editMemberForm, setEditMemberForm] = useState<EditMemberFormState>({
    memberId: "",
    fullName: "",
    email: "",
    attendance: "",
    voteRole: "",
  });

  useEffect(() => {
    if (!isEditModalOpen) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsEditModalOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isEditModalOpen]);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return memberRows;

    return memberRows.filter((member) => {
      const haystack = [
        member.memberId,
        member.email,
        member.joined,
        member.phoneNumber,
        member.status,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [memberRows, search]);

  const visibleMembers = useMemo(() => {
    if (!filteredMembers.length) return [];

    const startIndex = ((currentPage - 1) * PAGE_SIZE) % filteredMembers.length;
    return filteredMembers.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, filteredMembers]);

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  function handlePageChange(page: number) {
    setCurrentPage(page);
  }

  function handleOpenEditModal(memberId: string) {
    const detail = getMemberDetailByMemberId(memberId);
    setEditMemberForm({
      memberId,
      fullName: detail.name,
      email: detail.email,
      attendance: detail.attendance,
      voteRole: detail.voteRole,
    });
    setIsEditModalOpen(true);
  }

  function handleCloseEditModal() {
    setIsEditModalOpen(false);
  }

  function handleEditMemberChange(field: keyof EditMemberFormState, value: string) {
    setEditMemberForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function handleSaveEditedMember() {
    const fullName = editMemberForm.fullName.trim();
    const email = editMemberForm.email.trim();
    if (!editMemberForm.memberId || !fullName || !email) return;

    setMemberRows((currentRows) =>
      currentRows.map((member) =>
        member.memberId === editMemberForm.memberId
          ? {
              ...member,
              email,
            }
          : member
      )
    );

    setIsEditModalOpen(false);
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

  return (
    <div className="admin-dashboard member-page">
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
        <section className="admin-dashboard__hero member-page__hero">
          <div>
            <h1>Admin Console</h1>
            <p>Pivot-style member details for all signed-in members.</p>
          </div>

          <div className="admin-dashboard__hero-actions member-page__hero-actions">
            <label className="admin-dashboard__search member-page__search">
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setCurrentPage(1);
                }}
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

        <section className="member-page__content">
          <div className="admin-dashboard__section-copy member-page__section-copy">
            <h2>Members</h2>
            <p>Manage all members in your organization</p>
          </div>

          <div className="admin-dashboard__table-shell member-page__table-shell">
            <div className="admin-dashboard__table-wrap member-page__table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Member ID</th>
                    <th>Email</th>
                    <th>Joined</th>
                    <th>Phone number</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!visibleMembers.length ? (
                    <tr>
                      <td colSpan={6} className="admin-dashboard__empty-state">
                        No members match the current search.
                      </td>
                    </tr>
                  ) : (
                    visibleMembers.map((member) => (
                      <tr key={member.id}>
                        <td data-label="Member ID">{member.memberId}</td>
                        <td data-label="Email">{member.email}</td>
                        <td data-label="Joined">{member.joined}</td>
                        <td data-label="Phone number">{member.phoneNumber}</td>
                        <td data-label="Status">
                          <span
                            className={[
                              "admin-dashboard__status-pill",
                              member.status === "Active" ? "is-good" : "is-bad",
                            ].join(" ")}
                          >
                            {member.status}
                          </span>
                        </td>
                        <td data-label="Actions">
                          <div className="member-page__actions">
                            <button
                              type="button"
                              className="member-page__action-link"
                              onClick={() => handleOpenEditModal(member.memberId)}
                            >
                              <FiEdit2 size={14} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              className="member-page__action-link"
                              onClick={() => navigate(`/admin/member/${member.memberId}`)}
                            >
                              <FiEye size={14} />
                              <span>View</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="member-page__pagination">
            <span className="member-page__pagination-copy">{currentPage} of {filteredMembers.length} results</span>

            <div className="member-page__pagination-controls" aria-label="Member table pagination">
              <button
                type="button"
                className="member-page__page-button"
                onClick={() => handlePageChange(currentPage === 1 ? 10 : currentPage - 1)}
                aria-label="Previous page"
              >
                <FiChevronLeft size={18} />
              </button>

              {PAGE_BUTTONS.map((page) => (
                <button
                  key={page}
                  type="button"
                  className={["member-page__page-button", currentPage === page ? "is-active" : ""].filter(Boolean).join(" ")}
                  onClick={() => handlePageChange(page)}
                  aria-current={currentPage === page ? "page" : undefined}
                >
                  {page}
                </button>
              ))}

              <button
                type="button"
                className="member-page__page-button"
                onClick={() => handlePageChange(currentPage === 10 ? 1 : currentPage + 1)}
                aria-label="Next page"
              >
                <FiChevronRight size={18} />
              </button>
            </div>
          </div>
        </section>
      </main>

      {isEditModalOpen && (
        <div className="admin-dashboard__modal" role="dialog" aria-modal="true" aria-labelledby="member-edit-modal-title">
          <div className="admin-dashboard__modal-backdrop" onClick={handleCloseEditModal} />

          <div className="admin-dashboard__modal-panel member-page__modal-panel">
            <div className="member-page__modal-grid">
              <div className="admin-dashboard__modal-section">
                <label htmlFor="member-edit-full-name" className="admin-dashboard__modal-label" id="member-edit-modal-title">
                  Full Name
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-page__modal-input">
                  <input
                    id="member-edit-full-name"
                    value={editMemberForm.fullName}
                    onChange={(event) => handleEditMemberChange("fullName", event.target.value)}
                    placeholder="Agbara Onome"
                    aria-label="Full name"
                  />
                </div>
              </div>

              <div className="admin-dashboard__modal-section">
                <label htmlFor="member-edit-email" className="admin-dashboard__modal-label">
                  Email Address
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-page__modal-input">
                  <input
                    id="member-edit-email"
                    value={editMemberForm.email}
                    onChange={(event) => handleEditMemberChange("email", event.target.value)}
                    placeholder="Andrew.karl@gmail.com"
                    aria-label="Email address"
                  />
                </div>
              </div>

              <div className="admin-dashboard__modal-section">
                <label htmlFor="member-edit-attendance" className="admin-dashboard__modal-label">
                  Member Attendance
                </label>
                <div className="admin-dashboard__modal-input member-page__modal-input">
                  <FiCalendar size={20} />
                  <input
                    id="member-edit-attendance"
                    value={editMemberForm.attendance}
                    onChange={(event) => handleEditMemberChange("attendance", event.target.value)}
                    placeholder="March"
                    aria-label="Member attendance"
                  />
                </div>
              </div>

              <div className="admin-dashboard__modal-section">
                <label htmlFor="member-edit-vote-role" className="admin-dashboard__modal-label">
                  Vote Role
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-page__modal-input member-page__modal-select-wrap">
                  <select
                    id="member-edit-vote-role"
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
                onClick={handleCloseEditModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--primary"
                onClick={handleSaveEditedMember}
                disabled={!editMemberForm.fullName.trim() || !editMemberForm.email.trim()}
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
