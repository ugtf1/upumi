import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { IconType } from "react-icons";
import { Role } from "./types/Role";
import {
  FiCheck,
  FiCheckCircle,
  FiCreditCard,
  FiEye,
  FiFilter,
  FiHome,
  FiLogOut,
  FiMoreVertical,
  FiPlus,
  FiSearch,
  FiSettings,
  FiTrash2,
  FiUsers,
  FiX,
  FiXCircle,
} from "react-icons/fi";

import { apiGet, apiPost, clearToken } from "./api";
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
  voteRole: string;
  voteStatus: string;
};

type AttendanceRow = {
  id: string;
  year: number;
  month: number;
  usersIn: string;
};

const MONTHS = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];

const CURRENT_YEAR = new Date().getFullYear();

type ApiMember = {
  id: string;
  displayMemberId?: string | null;
  memberKey?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  joined?: string | null;
  attendancePct?: string | null;
  voter?: string | null;
};

function mapApiMember(m: ApiMember): MemberListItem {
  const name = [m.firstName, m.lastName].filter(Boolean).join(" ").trim() || m.email || "Unnamed";
  const pctRaw = Number(String(m.attendancePct ?? "0").replace(/[^0-9.]/g, ""));
  const attendancePercent = Number.isNaN(pctRaw) ? 0 : Math.min(100, pctRaw);
  const presentMonths = Math.round(attendancePercent / 10);
  const voteRole = String(m.voter ?? "").trim().toUpperCase() === "YES" ? "Yes" : "No";
  return {
    id: m.id,
    name,
    memberId: m.displayMemberId || m.memberKey || m.id,
    email: m.email || "-",
    joined: m.joined ? new Date(m.joined).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-",
    phone: m.phone || "-",
    attendance: `${presentMonths}/12 Months`,
    attendancePercent,
    voteRole,
    voteStatus: voteRole === "Yes" ? "Participated" : "Nil",
  };
}

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
  const [members, setMembers] = useState<MemberListItem[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [hoveredMemberId, setHoveredMemberId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MemberListItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [addMemberForm, setAddMemberForm] = useState<AddMemberForm>(INITIAL_ADD_MEMBER_FORM);
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    apiGet<ApiMember[]>("/admin/members")
      .then((rows) => { if (active) setMembers(rows.map(mapApiMember)); })
      .catch(() => {})
      .finally(() => { if (active) setMembersLoading(false); });
    return () => { active = false; };
  }, []);

  // Fetch all attendance records so the hover popover can show which months
  // each member was present without an extra request per member.
  useEffect(() => {
    let active = true;
    apiGet<AttendanceRow[]>("/admin/database/attendance")
      .then((rows) => { if (active) setAttendanceRows(rows); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // Close the action dropdown when the admin clicks anywhere outside it.
  useEffect(() => {
    if (!openMenuId) return undefined;
    function onOutsideClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [openMenuId]);

  // Returns a 12-element boolean array (index 0 = January) indicating
  // whether the member was present in each month of CURRENT_YEAR.
  function getMemberMonthlyAttendance(memberId: string): boolean[] {
    const thisYearRows = attendanceRows.filter((row) => row.year === CURRENT_YEAR);
    return MONTHS.map((_, index) => {
      const monthNum = index + 1;
      const row = thisYearRows.find((r) => r.month === monthNum);
      if (!row) return false;
      const ids = row.usersIn.split(",").map((s) => s.trim()).filter(Boolean);
      return ids.includes(memberId);
    });
  }

  function handleViewMember(member: MemberListItem) {
    setOpenMenuId(null);
    navigate(`/admin/member/${member.id}`);
  }

  function handleDeletePrompt(member: MemberListItem) {
    setOpenMenuId(null);
    setDeleteTarget(member);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      // The generic adminDatabaseRoutes plugin handles DELETE /:table/:id
      // and is mounted at /api/admin/database — so deleting a user is:
      // DELETE /api/admin/database/users/:id
      const { API_BASE, getToken } = await import("./api");
      const token = getToken();
      await fetch(`${API_BASE}/admin/database/users/${deleteTarget.id}`, {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      setMembers((current) => current.filter((m) => m.id !== deleteTarget.id));
      setToast(`${deleteTarget.name} has been removed`);
    } catch {
      setToast("Failed to delete member — please try again");
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
      window.setTimeout(() => setToast(null), 3000);
    }
  }

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
    if (!query) return members;

    return members.filter((member) =>
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
  }, [search, members]);

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

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
            {membersLoading ? (
              <div className="member-page__empty-state">Loading members...</div>
            ) : !filteredMembers.length ? (
              <div className="member-page__empty-state">
                {search.trim() ? "No members match the current search." : "No members found."}
              </div>
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

                    <div className="member-page__attendance-card"
                    onMouseEnter={() => setHoveredMemberId(member.id)}
                    onMouseLeave={() => setHoveredMemberId(null)}
                  >
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
                    </div>

                    {hoveredMemberId === member.id && (
                      <div className="member-page__attendance-popup">
                        <p className="member-page__attendance-popup-year">{CURRENT_YEAR}</p>
                        <ul className="member-page__attendance-popup-list">
                          {MONTHS.map((monthName, index) => {
                            const presence = getMemberMonthlyAttendance(member.id);
                            const isPresent = presence[index];
                            return (
                              <li
                                key={monthName}
                                className={[
                                  "member-page__attendance-popup-row",
                                  isPresent ? "is-present" : "is-absent",
                                ].join(" ")}
                              >
                                <span>{monthName}</span>
                                {isPresent
                                  ? <FiCheckCircle size={18} className="member-page__attendance-popup-icon member-page__attendance-popup-icon--present" />
                                  : <FiXCircle size={18} className="member-page__attendance-popup-icon member-page__attendance-popup-icon--absent" />
                                }
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
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

                  <div
                    className="member-page__action-wrap"
                    ref={openMenuId === member.id ? menuRef : null}
                  >
                    <button
                      type="button"
                      className={[
                        "member-page__more-button",
                        openMenuId === member.id ? "is-active" : "",
                      ].filter(Boolean).join(" ")}
                      aria-label={`More actions for ${member.name}`}
                      aria-expanded={openMenuId === member.id}
                      aria-haspopup="menu"
                      onClick={() => setOpenMenuId(openMenuId === member.id ? null : member.id)}
                    >
                      <FiMoreVertical size={22} />
                    </button>

                    {openMenuId === member.id && (
                      <div className="member-page__action-menu" role="menu">
                        <button
                          type="button"
                          role="menuitem"
                          className="member-page__action-item"
                          onClick={() => handleViewMember(member)}
                        >
                          <FiEye size={15} />
                          <span>View</span>
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="member-page__action-item member-page__action-item--danger"
                          onClick={() => handleDeletePrompt(member)}
                        >
                          <FiTrash2 size={15} />
                          <span>Delete</span>
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

      {deleteTarget && (
        <div className="admin-dashboard__modal" role="dialog" aria-modal="true" aria-labelledby="delete-member-modal-title">
          <div className="admin-dashboard__modal-backdrop" onClick={() => !deleteLoading && setDeleteTarget(null)} />
          <div className="admin-dashboard__modal-panel member-page__delete-panel">
            <div className="member-page__delete-icon">
              <FiTrash2 size={28} />
            </div>
            <h2 id="delete-member-modal-title" className="member-page__delete-title">
              Remove Member
            </h2>
            <p className="member-page__delete-body">
              Are you sure you want to remove <strong>{deleteTarget.name}</strong>? This action
              cannot be undone.
            </p>
            <div className="admin-dashboard__modal-actions">
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--danger"
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
              >
                {deleteLoading ? "Removing..." : "Yes, Remove"}
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
