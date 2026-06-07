import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { IconType } from "react-icons";
import {
  FiCheck,
  FiCreditCard,
  FiFilter,
  FiHome,
  FiLogOut,
  FiMoreVertical,
  FiPlus,
  FiSearch,
  FiSettings,
  FiUsers,
} from "react-icons/fi";

import { clearToken } from "./api";
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

export default function MemberPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

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

                  <button
                    type="button"
                    className="member-page__more-button"
                    aria-label={`More actions for ${member.name}`}
                  >
                    <FiMoreVertical size={22} />
                  </button>
                </article>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
