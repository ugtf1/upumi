import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { IconType } from "react-icons";
import { Role } from "./types/Role";
import {
  FiCheck,
  FiCreditCard,
  FiEye,
  FiFilter,
  FiHome,
  FiLogOut,
  FiMoreVertical,
  FiPlus,
  FiSearch,
  FiSettings,
  FiUsers,
  FiX,
} from "react-icons/fi";

import { apiPost, clearToken } from "./api";
import "./admin-page.scss";
import "./member-page.scss";

type NavigationItem = {
  label: string;
  icon: IconType;
  action: () => void;
  tone?: "danger";
};

type MemberListItem = {
  id: string;
  name: string;
  memberId: string;
  email: string;
  joined: string;
  phone: string;
  attendance: string;
  attendancePercent: number;
  voteRole: "Yes" | "NO" | "No";
  voteStatus: "Participated" | "Nil";
};

const MEMBER_LIST: MemberListItem[] = [
  { id: "member-1", name: "Agbara Onome", memberId: "2944", email: "Agbaraonome@gmail.com", joined: "12 Jan 2024", phone: "+234 818 481 9383", attendance: "7/12 Months", attendancePercent: 55, voteRole: "Yes", voteStatus: "Participated" },
  { id: "member-2", name: "Agbara Onome", memberId: "2944", email: "Agbaraonome@gmail.com", joined: "12 Jan 2024", phone: "+234 818 481 9383", attendance: "7/12 Months", attendancePercent: 55, voteRole: "NO", voteStatus: "Nil" },
  { id: "member-3", name: "Agbara Onome", memberId: "2944", email: "Agbaraonome@gmail.com", joined: "12 Jan 2024", phone: "+234 818 481 9383", attendance: "7/12 Months", attendancePercent: 55, voteRole: "No", voteStatus: "Nil" },
  { id: "member-4", name: "Agbara Onome", memberId: "2944", email: "Agbaraonome@gmail.com", joined: "12 Jan 2024", phone: "+234 818 481 9383", attendance: "7/12 Months", attendancePercent: 55, voteRole: "Yes", voteStatus: "Participated" },
  { id: "member-5", name: "Agbara Onome", memberId: "2944", email: "Agbaraonome@gmail.com", joined: "12 Jan 2024", phone: "+234 818 481 9383", attendance: "7/12 Months", attendancePercent: 55, voteRole: "Yes", voteStatus: "Participated" },
  { id: "member-6", name: "Agbara Onome", memberId: "2944", email: "Agbaraonome@gmail.com", joined: "12 Jan 2024", phone: "+234 818 481 9383", attendance: "7/12 Months", attendancePercent: 55, voteRole: "Yes", voteStatus: "Participated" },
  { id: "member-7", name: "Agbara Onome", memberId: "2944", email: "Agbaraonome@gmail.com", joined: "12 Jan 2024", phone: "+234 818 481 9383", attendance: "7/12 Months", attendancePercent: 55, voteRole: "Yes", voteStatus: "Participated" },
  { id: "member-8", name: "Agbara Onome", memberId: "2944", email: "Agbaraonome@gmail.com", joined: "12 Jan 2024", phone: "+234 818 481 9383", attendance: "7/12 Months", attendancePercent: 55, voteRole: "Yes", voteStatus: "Participated" },
  { id: "member-9", name: "Agbara Onome", memberId: "2944", email: "Agbaraonome@gmail.com", joined: "12 Jan 2024", phone: "+234 818 481 9383", attendance: "7/12 Months", attendancePercent: 55, voteRole: "Yes", voteStatus: "Participated" },
  { id: "member-10", name: "Agbara Onome", memberId: "2944", email: "Agbaraonome@gmail.com", joined: "12 Jan 2024", phone: "+234 818 481 9383", attendance: "7/12 Months", attendancePercent: 55, voteRole: "Yes", voteStatus: "Participated" },
  { id: "member-11", name: "Agbara Onome", memberId: "2944", email: "Agbaraonome@gmail.com", joined: "12 Jan 2024", phone: "+234 818 481 9383", attendance: "7/12 Months", attendancePercent: 55, voteRole: "Yes", voteStatus: "Participated" },
  { id: "member-12", name: "Agbara Onome", memberId: "2944", email: "Agbaraonome@gmail.com", joined: "12 Jan 2024", phone: "+234 818 481 9383", attendance: "7/12 Months", attendancePercent: 55, voteRole: "Yes", voteStatus: "Participated" },
];

type AddMemberForm = {
  phone: string;
  email: string;
  fName: string;
  lName: string;
  role: Role;
};

const INITIAL_ADD_MEMBER_FORM: AddMemberForm = {
  phone: "",
  email: "",
  fName: "",
  lName: "",
  role: "MEMBER",
};

export default function MemberPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [addMemberForm, setAddMemberForm] = useState<AddMemberForm>(INITIAL_ADD_MEMBER_FORM);
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  function handleOpenAddMemberModal() {
    setAddMemberForm(INITIAL_ADD_MEMBER_FORM);
    setAddMemberError(null);
    setIsAddMemberModalOpen(true);
  }

  function handleCloseAddMemberModal() {
    setIsAddMemberModalOpen(false);
    setAddMemberError(null);
  }

  async function handleSaveAddMember() {
    setAddMemberError(null);
    setAddMemberLoading(true);

    try {
      const { phone, email, fName, lName, role } = addMemberForm;

      // Validation
      if (!phone.trim()) {
        throw new Error("Phone is required");
      }
      if (!email.trim()) {
        throw new Error("Email is required");
      }
      if (!fName.trim()) {
        throw new Error("First name is required");
      }
      if (!lName.trim()) {
        throw new Error("Last name is required");
      }

      // Call API to create user
      await apiPost("/admin/users", {
        phone: phone.trim(),
        email: email.trim(),
        fName: fName.trim(),
        lName: lName.trim(),
        role,
      });

      // Reset form and close modal
      setAddMemberForm(INITIAL_ADD_MEMBER_FORM);
      setIsAddMemberModalOpen(false);

      // Show success notification
      setToast("Member added successfully");
      window.setTimeout(() => setToast(null), 3000);
    } catch (error) {
      setAddMemberError(error instanceof Error ? error.message : "Failed to add member");
    } finally {
      setAddMemberLoading(false);
    }
  }

  const isAddMemberFormValid =
    addMemberForm.phone.trim() &&
    addMemberForm.email.trim() &&
    addMemberForm.fName.trim() &&
    addMemberForm.lName.trim();

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return MEMBER_LIST;

    return MEMBER_LIST.filter((member) =>
      [
        member.name,
        member.memberId,
        member.email,
        member.joined,
        member.phone,
        member.attendance,
        member.voteRole,
        member.voteStatus,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [search]);

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  function handleViewMember(member: MemberListItem) {
    setOpenActionMenuId(null);
    navigate(`/admin/member/${member.memberId}`);
  }

  useEffect(() => {
    if (!openActionMenuId) return undefined;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest(".member-page__row-actions")) {
        setOpenActionMenuId(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openActionMenuId]);

  const primaryNavigationItems: NavigationItem[] = [
    { label: "Dashboard", icon: FiHome, action: () => navigate("/admin") },
    { label: "Transaction", icon: FiCreditCard, action: () => navigate("/admin/transaction") },
    { label: "Member", icon: FiUsers, action: () => navigate("/admin/member") },
  ];

  const secondaryNavigationItems: NavigationItem[] = [
    { label: "Settings", icon: FiSettings, action: () => navigate("/admin/settings") },
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
                className={["admin-dashboard__nav-item", active ? "is-active" : ""]
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
            <div className="admin-dashboard__profile-avatar">
              <img src="/images/admin-onome.png" alt="" />
            </div>
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

      <main className="admin-dashboard__main member-page__main">
        <section className="admin-dashboard__hero member-page__hero">
          <div className="member-page__hero-copy">
            <h1>Admin Console</h1>
            <p>Pivot-style member details for all signed-in members.</p>
          </div>

          <div className="admin-dashboard__hero-actions member-page__hero-actions">
            <label className="admin-dashboard__search member-page__search">
              <FiSearch size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search member, expense, balance, income....."
                aria-label="Search members"
              />
            </label>

            <button type="button" className="admin-dashboard__icon-button member-page__filter-button" aria-label="Filter members">
              <FiFilter size={18} />
            </button>

            <button type="button" className="member-page__add-button" onClick={handleOpenAddMemberModal}>
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

          <div className="member-page__list" aria-label="Members">
            {!filteredMembers.length ? (
              <div className="member-page__empty-state">No members match the current search.</div>
            ) : (
              filteredMembers.map((member) => (
                <article className="member-page__row" key={member.id}>
                  <div className="member-page__identity">
                    <strong>{member.name}</strong>
                    <span>Member ID - {member.memberId}</span>
                  </div>

                  <div className="member-page__email">
                    <strong>{member.email}</strong>
                    <span>Joined {member.joined}</span>
                  </div>

                  <a className="member-page__phone" href={`tel:${member.phone.replace(/\s+/g, "")}`}>
                    {member.phone}
                  </a>

                  <div className="member-page__attendance-card">
                    <span className="member-page__attendance-title">Monthly Attendance</span>
                    <div className="member-page__attendance-line">
                      <span className="member-page__check member-page__check--green">
                        <FiCheck size={15} />
                      </span>
                      <strong>{member.attendance}</strong>
                    </div>
                    <div className="member-page__progress-row">
                      <span className="member-page__progress-track">
                        <span style={{ width: `${member.attendancePercent}%` }} />
                      </span>
                      <strong>{member.attendancePercent}%</strong>
                    </div>
                  </div>

                  <div className="member-page__vote-card">
                    <span>Vote Role</span>
                    <div className="member-page__vote-line">
                      <span className="member-page__check member-page__check--yellow">
                        <FiCheck size={15} />
                      </span>
                      <strong>{member.voteRole}</strong>
                    </div>
                    <small>{member.voteStatus}</small>
                  </div>

                  <div className="member-page__row-actions">
                    <button
                      type="button"
                      className="member-page__more-button"
                      aria-label={`More actions for ${member.name}`}
                      aria-haspopup="menu"
                      aria-expanded={openActionMenuId === member.id}
                      onClick={() =>
                        setOpenActionMenuId((current) => (current === member.id ? null : member.id))
                      }
                    >
                      <FiMoreVertical size={22} />
                    </button>

                    {openActionMenuId === member.id && (
                      <div className="member-page__action-menu" role="menu">
                        <button
                          type="button"
                          role="menuitem"
                          className="member-page__action-menu-item"
                          onClick={() => handleViewMember(member)}
                        >
                          <FiEye size={16} />
                          <span>View</span>
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </main>

      {isAddMemberModalOpen && (
        <div className="admin-dashboard__modal" role="dialog" aria-modal="true" aria-labelledby="add-member-modal-title">
          <div className="admin-dashboard__modal-backdrop" onClick={handleCloseAddMemberModal} />

          <div className="admin-dashboard__modal-panel">
            <div className="admin-dashboard__modal-header">
              <h2 id="add-member-modal-title">Add New Member</h2>
              <button
                type="button"
                className="admin-dashboard__modal-close"
                onClick={handleCloseAddMemberModal}
                aria-label="Close modal"
              >
                <FiX size={24} />
              </button>
            </div>

            {addMemberError && (
              <div className="admin-dashboard__modal-error">
                {addMemberError}
              </div>
            )}

            <div className="admin-dashboard__modal-section">
              <label htmlFor="add-member-phone" className="admin-dashboard__modal-label">
                Phone *
              </label>
              <input
                id="add-member-phone"
                type="tel"
                value={addMemberForm.phone}
                onChange={(event) => setAddMemberForm({ ...addMemberForm, phone: event.target.value })}
                placeholder="Enter phone number"
                aria-label="Member phone number"
                className="admin-dashboard__modal-input-field"
              />
            </div>

            <div className="admin-dashboard__modal-section">
              <label htmlFor="add-member-email" className="admin-dashboard__modal-label">
                Email *
              </label>
              <input
                id="add-member-email"
                type="email"
                value={addMemberForm.email}
                onChange={(event) => setAddMemberForm({ ...addMemberForm, email: event.target.value })}
                placeholder="Enter email address"
                aria-label="Member email address"
                className="admin-dashboard__modal-input-field"
              />
            </div>

            <div className="admin-dashboard__modal-section">
              <label htmlFor="add-member-fname" className="admin-dashboard__modal-label">
                First Name *
              </label>
              <input
                id="add-member-fname"
                type="text"
                value={addMemberForm.fName}
                onChange={(event) => setAddMemberForm({ ...addMemberForm, fName: event.target.value })}
                placeholder="Enter first name"
                aria-label="Member first name"
                className="admin-dashboard__modal-input-field"
              />
            </div>

            <div className="admin-dashboard__modal-section">
              <label htmlFor="add-member-lname" className="admin-dashboard__modal-label">
                Last Name *
              </label>
              <input
                id="add-member-lname"
                type="text"
                value={addMemberForm.lName}
                onChange={(event) => setAddMemberForm({ ...addMemberForm, lName: event.target.value })}
                placeholder="Enter last name"
                aria-label="Member last name"
                className="admin-dashboard__modal-input-field"
              />
            </div>

            <div className="admin-dashboard__modal-section">
              <label htmlFor="add-member-role" className="admin-dashboard__modal-label">
                Role
              </label>
              <select
                id="add-member-role"
                value={addMemberForm.role}
                onChange={(event) =>
                  setAddMemberForm({ ...addMemberForm, role: event.target.value as Role })
                }
                aria-label="Member role"
                className="admin-dashboard__modal-input-field"
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            <div className="admin-dashboard__modal-actions">
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--secondary"
                onClick={handleCloseAddMemberModal}
                disabled={addMemberLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--primary"
                onClick={handleSaveAddMember}
                disabled={!isAddMemberFormValid || addMemberLoading}
              >
                {addMemberLoading ? "Saving..." : "Save Member"}
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
