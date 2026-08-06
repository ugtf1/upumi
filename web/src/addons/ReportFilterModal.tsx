import { useState, useEffect, useRef } from "react";
import {
  FiX,
  FiFilter,
  FiCalendar,
  FiCreditCard,
  FiSearch,
  FiMail,
  FiPhone,
  FiUserCheck,
  FiAlertCircle,
  FiChevronDown,
  FiCheckCircle,
} from "react-icons/fi";
import {
  getAllDuesReadOnly,
  getAllTransactionsReadOnly,
  getHostingSchedule,
  getMemberSafeMemberList,
  apiGet,
} from "./api";
import "./admin-page.scss";
import "./report-filter-modal.scss";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const SHORT_MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

type ReportFilterModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type ReportCategory = "dues" | "transactions" | "hosting" | "member" | "attendance";

type AttendanceReportDetail = {
  year: number;
  month: number;
  presentCount: number;
  absentCount: number;
  totalCount: number;
  presentMembers: MemberInfo[];
  absentMembers: MemberInfo[];
};

type ApiMonthlyDue = {
  id: string;
  memberRecordId: string;
  year: number;
  month: number;
  duesPaid: number;
  present: boolean | null;
  createdAt: string;
  member?: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  };
};

type ApiTransactionRow = {
  id: string;
  userId?: string | null;
  fullName: string;
  title: string;
  description?: string | null;
  amount: string | number;
  date: string;
};

type HostingScheduleApiRow = {
  id: string;
  year: number;
  month: number;
  hostMember: string;
};

type AttendanceApiRow = {
  id: string;
  year: number;
  month: number;
  usersIn: string;
};

type MemberInfo = {
  id: string;
  memberKey: string;
  displayMemberId: string;
  status: string;
  title: string | null;
  firstName: string;
  lastName: string;
  joined: string | null;
  phone: string | null;
  email: string | null;
  goodStanding: string | null;
  financialGoodStanding: string | null;
  voter: string | null;
  attendancePct: string | null;
  userId: string | null;
  updatedAt: string;
};

type MemberReportData = {
  profile: MemberInfo;
  dues: {
    year: number;
    month: number;
    present: boolean;
    duesPaid: number;
  }[];
  transactions: ApiTransactionRow[];
  hosting: HostingScheduleApiRow[];
};

const YEAR_OPTIONS = [2024, 2025, 2026, 2027];
const MONTH_OPTIONS = MONTH_NAMES.map((name: string, i: number) => ({ value: i + 1, label: name }));

function formatCurrency(amount: number | string): string {
  const numeric = Number(amount);
  if (Number.isNaN(numeric)) return "$0";
  return `$${numeric.toLocaleString()}`;
}

type UnifiedReportRow = {
  id: string;
  date: string;
  year: number;
  month: number;
  title: string;
  name: string;
  description: string;
  amount: number;
  isExpense: boolean;
};

export default function ReportFilterModal({ isOpen, onClose }: ReportFilterModalProps) {
  const [category, setCategory] = useState<ReportCategory>("transactions");

  // Filter selections for Financials/Transactions & Dues
  const [selectedTxTitle, setSelectedTxTitle] = useState<string>("ALL_REVENUE");
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState<string>("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Month/Year for Hosting & Attendance
  const [startMonth, setStartMonth] = useState("");
  const [endMonth, setEndMonth] = useState("");
  const [hostingYear, setHostingYear] = useState<number>(new Date().getFullYear());

  // Member Autocomplete Search
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<MemberInfo | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Result state
  const [resultsUnified, setResultsUnified] = useState<UnifiedReportRow[] | null>(null);
  const [resultsDues, setResultsDues] = useState<ApiMonthlyDue[] | null>(null);
  const [resultsTransactions, setResultsTransactions] = useState<ApiTransactionRow[] | null>(null);
  const [resultsHosting, setResultsHosting] = useState<HostingScheduleApiRow[] | null>(null);
  const [resultsMember, setResultsMember] = useState<MemberReportData | null>(null);
  const [resultsAttendance, setResultsAttendance] = useState<AttendanceReportDetail[] | null>(null);

  // Tracker year inside Member Report
  const [trackerYear, setTrackerYear] = useState<number>(new Date().getFullYear());

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Pre-load members for search
  useEffect(() => {
    if (isOpen) {
      loadMembers();
    }
  }, [isOpen]);

  async function loadMembers() {
    setMembersLoading(true);
    try {
      const data = await getMemberSafeMemberList();
      setMembers(data as MemberInfo[]);
    } catch (err) {
      console.error("Failed to load members for report filter:", err);
    } finally {
      setMembersLoading(false);
    }
  }

  if (!isOpen) return null;

  function resetResults() {
    setResultsUnified(null);
    setResultsDues(null);
    setResultsTransactions(null);
    setResultsHosting(null);
    setResultsMember(null);
    setResultsAttendance(null);
    setError(null);
  }

  async function handleGenerateReport() {
    resetResults();
    setLoading(true);

    try {
      if (category === "dues") {
        const duesRows = await getAllDuesReadOnly().catch(() => []) as ApiMonthlyDue[];
        let filtered = duesRows.filter(r => Number(r.duesPaid || 0) > 0);

        if (startDate && endDate) {
          const start = new Date(startDate).getTime();
          const end = new Date(endDate).setHours(23, 59, 59, 999);
          if (start > end) throw new Error("Start date cannot be after end date.");
          filtered = filtered.filter(r => {
            if (!r.createdAt) return false;
            const t = new Date(r.createdAt).getTime();
            return t >= start && t <= end;
          });
        }

        if (selectedMember) {
          filtered = filtered.filter(r => r.memberRecordId === selectedMember.id);
        }

        setResultsDues(filtered);

      } else if (category === "transactions") {
        const [duesRows, txRows] = await Promise.all([
          getAllDuesReadOnly().catch(() => []) as Promise<ApiMonthlyDue[]>,
          getAllTransactionsReadOnly().catch(() => []) as Promise<ApiTransactionRow[]>,
        ]);

        const unifiedList: UnifiedReportRow[] = [];

        // 1. Process Dues payments
        for (const d of duesRows) {
          const amt = Number(d.duesPaid || 0);
          if (amt <= 0) continue;
          const name = [d.member?.firstName, d.member?.lastName].filter(Boolean).join(" ") || d.member?.email || "Member";
          const dateStr = d.createdAt
            ? new Date(d.createdAt).toISOString().split("T")[0]
            : `${d.year}-${String(d.month).padStart(2, "0")}-01`;
          unifiedList.push({
            id: `due-${d.id}`,
            date: dateStr,
            year: d.year,
            month: d.month,
            title: "Dues",
            name,
            description: `Dues payment for ${SHORT_MONTH_NAMES[d.month - 1] || d.month} ${d.year}`,
            amount: amt,
            isExpense: false,
          });
        }

        // 2. Process Transactions
        for (const t of txRows) {
          const amt = Number(t.amount || 0);
          const dateObj = t.date ? new Date(t.date) : new Date();
          const yr = dateObj.getFullYear();
          const mo = dateObj.getMonth() + 1;
          const titleClean = (t.title || "Transaction").trim();
          const isExp = titleClean.toLowerCase().includes("expense") || amt < 0;
          unifiedList.push({
            id: `tx-${t.id}`,
            date: t.date || dateObj.toISOString().split("T")[0],
            year: yr,
            month: mo,
            title: titleClean,
            name: t.fullName || "N/A",
            description: t.description || "",
            amount: Math.abs(amt),
            isExpense: isExp,
          });
        }

        // Apply Title/Category filter
        let filtered = unifiedList;
        if (selectedTxTitle === "ALL_REVENUE") {
          filtered = filtered.filter(r => !r.isExpense);
        } else if (selectedTxTitle === "ALL_EXPENSES") {
          filtered = filtered.filter(r => r.isExpense);
        } else if (selectedTxTitle === "ALL") {
          // All records
        } else if (selectedTxTitle === "Dues") {
          filtered = filtered.filter(r => r.title.toLowerCase() === "dues");
        } else if (selectedTxTitle === "Expense" || selectedTxTitle === "Expenses") {
          filtered = filtered.filter(r => r.isExpense);
        } else {
          filtered = filtered.filter(r => r.title.toLowerCase() === selectedTxTitle.toLowerCase());
        }

        // Apply Year filter
        if (selectedYear !== "ALL") {
          const targetYr = Number(selectedYear);
          filtered = filtered.filter(r => r.year === targetYr);
        }

        // Apply Month filter
        if (selectedMonth !== "ALL") {
          const targetMo = Number(selectedMonth);
          filtered = filtered.filter(r => r.month === targetMo);
        }

        // Apply Date Range filter if set
        if (startDate && endDate) {
          const start = new Date(startDate).getTime();
          const end = new Date(endDate).setHours(23, 59, 59, 999);
          if (start > end) throw new Error("Start date cannot be after end date.");
          filtered = filtered.filter(r => {
            const t = new Date(r.date).getTime();
            return t >= start && t <= end;
          });
        }

        // Apply Member Filter if set
        if (selectedMember) {
          const nameToMatch = `${selectedMember.firstName} ${selectedMember.lastName}`.toLowerCase().trim();
          filtered = filtered.filter(r => r.name.toLowerCase().includes(nameToMatch));
        }

        // Sort by date descending
        filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setResultsUnified(filtered);

      } else if (category === "hosting") {
        const sm = startMonth ? Number(startMonth) : 1;
        const em = endMonth ? Number(endMonth) : 12;
        if (sm > em) throw new Error("From Month cannot be after To Month.");

        const rows = await getHostingSchedule() as HostingScheduleApiRow[];
        let filtered = rows.filter(r => {
          const yearMatch = !hostingYear || hostingYear === 0 || r.year === hostingYear;
          const monthMatch = r.month >= sm && r.month <= em;
          return yearMatch && monthMatch;
        });

        // Filter by selected member name/ID if set
        if (selectedMember) {
          const nameToMatch = `${selectedMember.firstName} ${selectedMember.lastName}`.toLowerCase().trim();
          filtered = filtered.filter(r => {
            return r.hostMember && r.hostMember.toLowerCase().includes(nameToMatch);
          });
        }

        // Sort by month ascending
        filtered.sort((a, b) => a.month - b.month);
        setResultsHosting(filtered);

      } else if (category === "member") {
        if (!selectedMember) throw new Error("Please select a member to generate the report.");

        // Load all data in parallel
        const [duesRows, attendanceRows, transactionRows, hostingRows] = await Promise.all([
          getAllDuesReadOnly() as Promise<ApiMonthlyDue[]>,
          apiGet<AttendanceApiRow[]>("/members/database/attendance").catch(() => []),
          getAllTransactionsReadOnly() as Promise<ApiTransactionRow[]>,
          getHostingSchedule() as Promise<HostingScheduleApiRow[]>,
        ]);

        // 1. Process Dues & Attendance
        // Filter dues by memberRecordId
        const memberDues = duesRows.filter(r => r.memberRecordId === selectedMember.id);

        // Build attendance map from Attendance table
        const attendanceMap = new Map<string, boolean>();
        for (const att of attendanceRows) {
          const usersInList = String(att.usersIn ?? '').split(',').map((s) => s.trim()).filter(Boolean);
          const isPresent =
            usersInList.includes(selectedMember.userId || "") ||
            usersInList.includes(selectedMember.id) ||
            usersInList.includes(selectedMember.memberKey) ||
            usersInList.includes(`user.${selectedMember.userId}`);
          attendanceMap.set(`${att.year}-${att.month}`, isPresent);
        }

        // Merge Dues and Attendance into 12 months for visual display
        // We will do this dynamically for the selected trackerYear in the rendering,
        // but here we compile a complete list of historical monthly dues paid
        const compiledDues = memberDues.map(d => {
          const attKey = `${d.year}-${d.month}`;
          const present = d.present === true || attendanceMap.get(attKey) === true;
          return {
            year: d.year,
            month: d.month,
            present,
            duesPaid: Number(d.duesPaid || 0),
          };
        });

        // Add dummy months for the current/selected years if they are missing
        const availableYears = Array.from(new Set([trackerYear, ...compiledDues.map(d => d.year)]));
        const finalDues: { year: number; month: number; present: boolean; duesPaid: number }[] = [...compiledDues];

        for (const yr of availableYears) {
          for (let m = 1; m <= 12; m++) {
            const exists = compiledDues.some(d => d.year === yr && d.month === m);
            if (!exists) {
              const attKey = `${yr}-${m}`;
              const present = attendanceMap.get(attKey) === true;
              finalDues.push({
                year: yr,
                month: m,
                present,
                duesPaid: 0,
              });
            }
          }
        }

        // 2. Filter transactions
        const nameToMatch = `${selectedMember.firstName} ${selectedMember.lastName}`.toLowerCase().trim();
        const memberTransactions = transactionRows.filter(r => {
          const hasUserId = r.userId && r.userId === selectedMember.userId;
          const hasNameMatch = r.fullName && r.fullName.toLowerCase().includes(nameToMatch);
          return hasUserId || hasNameMatch;
        });

        // 3. Filter hosting
        const memberHosting = hostingRows.filter(r => {
          return r.hostMember && r.hostMember.toLowerCase().includes(nameToMatch);
        });

        setResultsMember({
          profile: selectedMember,
          dues: finalDues,
          transactions: memberTransactions,
          hosting: memberHosting,
        });
      } else if (category === "attendance") {
        const sm = startMonth ? Number(startMonth) : 1;
        const em = endMonth ? Number(endMonth) : 12;
        if (sm > em) throw new Error("From Month cannot be after To Month.");

        const [attendanceRows, memberList] = await Promise.all([
          apiGet<AttendanceApiRow[]>("/members/database/attendance").catch(() => []),
          getMemberSafeMemberList() as Promise<MemberInfo[]>,
        ]);

        const filteredAttendance = attendanceRows.filter(r => {
          const yearMatch = !hostingYear || hostingYear === 0 || r.year === hostingYear;
          const monthMatch = r.month >= sm && r.month <= em;
          return yearMatch && monthMatch;
        });

        const compiled = filteredAttendance.map(att => {
          const usersInList = String(att.usersIn ?? '').split(',').map((s) => s.trim()).filter(Boolean);
          
          const presentMembers = memberList.filter(m => {
            return (
              usersInList.includes(m.userId || "") ||
              usersInList.includes(m.id) ||
              usersInList.includes(m.memberKey) ||
              usersInList.includes(`user.${m.userId}`)
            );
          });

          const absentMembers = memberList.filter(m => !presentMembers.some(p => p.id === m.id));

          return {
            year: att.year,
            month: att.month,
            presentCount: presentMembers.length,
            absentCount: absentMembers.length,
            totalCount: memberList.length,
            presentMembers,
            absentMembers,
          };
        });

        // Filter by selected member if set
        let finalResults = compiled;
        if (selectedMember) {
          finalResults = compiled.map(c => {
            const isPresent = c.presentMembers.some(p => p.id === selectedMember.id);
            return {
              ...c,
              presentMembers: isPresent ? [selectedMember] : [],
              absentMembers: !isPresent ? [selectedMember] : [],
              presentCount: isPresent ? 1 : 0,
              absentCount: !isPresent ? 1 : 0,
              totalCount: 1,
            };
          });
        }

        finalResults.sort((a, b) => a.month - b.month);
        setResultsAttendance(finalResults);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred generating the report.");
    } finally {
      setLoading(false);
    }
  }

  function handleCategoryChange(c: ReportCategory) {
    setCategory(c);
    resetResults();
    // Do not clear selectedMember as they might want to filter the new category by the same member
  }

  // Filter members list based on query
  const filteredMembers = searchQuery.trim() === ""
    ? members
    : members.filter(m => {
        const fullName = `${m.firstName} ${m.lastName}`.toLowerCase();
        const email = (m.email || "").toLowerCase();
        const phone = (m.phone || "").toLowerCase();
        const q = searchQuery.toLowerCase();
        return fullName.includes(q) || email.includes(q) || phone.includes(q);
      });

  function selectMember(member: MemberInfo) {
    setSelectedMember(member);
    setSearchQuery(`${member.firstName} ${member.lastName}`);
    setIsDropdownOpen(false);
    resetResults();
  }

  function clearMemberSelection() {
    setSelectedMember(null);
    setSearchQuery("");
    resetResults();
  }

  function renderResults() {
    if (loading) {
      return (
        <div className="admin-dashboard__empty-state" style={{ padding: "3rem 1rem", display: "flex", flexDirection: "column", gap: "1rem", alignItems: "center" }}>
          <div className="admin-dashboard__modal-input-field" style={{ border: "none", animation: "pulse 1.5s infinite", width: "120px", height: "4px", background: "#166d2e", borderRadius: "2px" }} />
          <span style={{ color: "#64748b", fontWeight: 600 }}>Generating beautiful report details...</span>
        </div>
      );
    }

    if (resultsUnified) {
      if (resultsUnified.length === 0) {
        return <div className="report-modal__empty-text">No transaction or financial records found for this period.</div>;
      }

      const totalIncome = resultsUnified.filter(r => !r.isExpense).reduce((sum, r) => sum + r.amount, 0);
      const totalExpense = resultsUnified.filter(r => r.isExpense).reduce((sum, r) => sum + r.amount, 0);
      const netTotal = totalIncome - totalExpense;

      return (
        <div style={{ marginTop: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "1.25rem", paddingInline: "4px", alignItems: "center" }}>
            <span style={{ fontSize: "0.95rem", color: "#475569" }}>
              Found <strong>{resultsUnified.length}</strong> record{resultsUnified.length !== 1 ? "s" : ""}
            </span>
            <div style={{ display: "flex", gap: "16px", fontSize: "1rem" }}>
              {totalIncome > 0 && (
                <span style={{ color: "#1e293b" }}>Total Income: <strong style={{ color: "#166d2e" }}>{formatCurrency(totalIncome)}</strong></span>
              )}
              {totalExpense > 0 && (
                <span style={{ color: "#1e293b" }}>Total Expense: <strong style={{ color: "#dc2626" }}>{formatCurrency(totalExpense)}</strong></span>
              )}
            </div>
          </div>

          <div className="admin-dashboard__table-container">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Date / Period</th>
                  <th style={{ textAlign: "left" }}>Title / Category</th>
                  <th style={{ textAlign: "left" }}>Member / Source</th>
                  <th style={{ textAlign: "left" }}>Description</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {resultsUnified.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Date / Period" style={{ whiteSpace: "nowrap" }}>
                      {new Date(row.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td data-label="Title / Category">
                      <span
                        className={`admin-dashboard__status-pill ${row.isExpense ? "is-bad" : "is-good"}`}
                        style={{ fontSize: "0.78rem", padding: "3px 8px" }}
                      >
                        {row.title}
                      </span>
                    </td>
                    <td data-label="Member / Source" style={{ fontWeight: 600, color: "#1e293b" }}>
                      {row.name}
                    </td>
                    <td data-label="Description" style={{ color: "#475569", fontSize: "0.85rem" }}>
                      {row.description || "-"}
                    </td>
                    <td data-label="Amount" style={{ textAlign: "right", fontWeight: 700, color: row.isExpense ? "#dc2626" : "#166d2e" }}>
                      {row.isExpense ? `-${formatCurrency(row.amount)}` : formatCurrency(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f1f5f9", fontWeight: 700, fontSize: "1.05rem", borderTop: "2px solid #cbd5e1" }}>
                  <td colSpan={4} style={{ textAlign: "right", padding: "14px 16px", color: "#0f172a" }}>
                    TOTAL AMOUNT:
                  </td>
                  <td style={{ textAlign: "right", padding: "14px 16px", color: netTotal < 0 ? "#dc2626" : "#166d2e", fontSize: "1.15rem" }}>
                    {formatCurrency(netTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      );
    }

    if (resultsDues) {
      if (resultsDues.length === 0) {
        return <div className="report-modal__empty-text">No dues payments found for this period.</div>;
      }

      const total = resultsDues.reduce((sum, r) => sum + Number(r.duesPaid || 0), 0);

      return (
        <div style={{ marginTop: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "1.25rem", paddingInline: "4px" }}>
            <span style={{ fontSize: "0.95rem", color: "#475569" }}>Found <strong>{resultsDues.length}</strong> records</span>
            <span style={{ fontSize: "1.05rem", color: "#1e293b" }}>Total Dues: <strong style={{ color: "#166d2e" }}>{formatCurrency(total)}</strong></span>
          </div>

          <div className="admin-dashboard__table-container">
            <table>
              <thead>
                <tr>
                  <th>Member Name</th>
                  <th>For Period</th>
                  <th>Date Paid</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {resultsDues.map((row: ApiMonthlyDue) => {
                  const name = [row.member?.firstName, row.member?.lastName].filter(Boolean).join(" ") || row.member?.email || "Unknown Member";
                  const monthName = SHORT_MONTH_NAMES[row.month - 1] || String(row.month);
                  return (
                    <tr key={row.id}>
                      <td data-label="Member Name" style={{ fontWeight: 600, color: "#1e293b" }}>{name}</td>
                      <td data-label="For Period">{monthName} {row.year}</td>
                      <td data-label="Date Paid">{new Date(row.createdAt).toLocaleDateString()}</td>
                      <td data-label="Amount" style={{ fontWeight: 700, color: "#166d2e", textAlign: "right" }}>{formatCurrency(row.duesPaid)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f1f5f9", fontWeight: 700, fontSize: "1.05rem", borderTop: "2px solid #cbd5e1" }}>
                  <td colSpan={3} style={{ textAlign: "right", padding: "14px 16px", color: "#0f172a" }}>
                    TOTAL DUES:
                  </td>
                  <td style={{ textAlign: "right", padding: "14px 16px", color: "#166d2e", fontSize: "1.15rem" }}>
                    {formatCurrency(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      );
    }

    if (resultsTransactions) {
      if (resultsTransactions.length === 0) {
        return <div className="report-modal__empty-text">No transactions found for this period.</div>;
      }

      const total = resultsTransactions.reduce((sum, r) => sum + Number(r.amount || 0), 0);

      return (
        <div style={{ marginTop: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "1.25rem", paddingInline: "4px" }}>
            <span style={{ fontSize: "0.95rem", color: "#475569" }}>Found <strong>{resultsTransactions.length}</strong> transactions</span>
            <span style={{ fontSize: "1.05rem", color: "#1e293b" }}>Total Amount: <strong style={{ color: "#166d2e" }}>{formatCurrency(total)}</strong></span>
          </div>

          <div className="admin-dashboard__table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Title</th>
                  <th>Member Name</th>
                  <th>Description</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {resultsTransactions.map((row: ApiTransactionRow) => (
                  <tr key={row.id}>
                    <td data-label="Date">{new Date(row.date).toLocaleDateString()}</td>
                    <td data-label="Title" style={{ fontWeight: 600 }}>{row.title}</td>
                    <td data-label="Member Name">{row.fullName}</td>
                    <td data-label="Description" style={{ color: "#475569", fontSize: "0.85rem" }}>{row.description || "-"}</td>
                    <td data-label="Amount" style={{ fontWeight: 700, color: "#166d2e", textAlign: "right" }}>{formatCurrency(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f1f5f9", fontWeight: 700, fontSize: "1.05rem", borderTop: "2px solid #cbd5e1" }}>
                  <td colSpan={4} style={{ textAlign: "right", padding: "14px 16px", color: "#0f172a" }}>
                    TOTAL AMOUNT:
                  </td>
                  <td style={{ textAlign: "right", padding: "14px 16px", color: "#166d2e", fontSize: "1.15rem" }}>
                    {formatCurrency(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      );
    }

    if (resultsHosting) {
      if (resultsHosting.length === 0) {
        return <div className="report-modal__empty-text">No hosting schedule found for this period.</div>;
      }

      return (
        <div style={{ marginTop: "1rem" }}>
          <div style={{ marginBottom: "1.25rem", paddingInline: "4px" }}>
            <span style={{ fontSize: "0.95rem", color: "#475569" }}>Found <strong>{resultsHosting.length}</strong> hosting schedules</span>
          </div>

          <div className="report-modal__hosting-list">
            {resultsHosting.map((row: HostingScheduleApiRow) => {
              const monthName = MONTH_OPTIONS.find((m) => m.value === row.month)?.label || String(row.month);
              return (
                <div key={row.id} className="report-modal__hosting-card">
                  <FiCalendar />
                  <div>
                    <div style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase" }}>{row.year}</div>
                    <div>{monthName}</div>
                    <div style={{ fontSize: "0.82rem", color: "#475569", fontWeight: "normal", marginTop: "4px" }}>Host: {row.hostMember || "-"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (resultsMember) {
      const p = resultsMember.profile;
      const filteredDues = resultsMember.dues.filter(d => d.year === trackerYear);
      filteredDues.sort((a, b) => a.month - b.month);

      const totalDuesPaid = resultsMember.dues.reduce((sum, d) => sum + d.duesPaid, 0);
      const totalTransactionsAmount = resultsMember.transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);

      return (
        <div style={{ marginTop: "1rem" }}>
          {/* Member Profile Card */}
          <div className="report-modal__profile-card">
            <div className="report-modal__profile-header">
              <h3>
                {p.title ? `${p.title} ` : ""}{p.firstName} {p.lastName}
              </h3>
              <div style={{ display: "flex", gap: "6px" }}>
                <span className={`report-modal__badge report-modal__badge--${p.status.toLowerCase() === "active" ? "active" : "inactive"}`}>
                  {p.status}
                </span>
                {p.goodStanding && (
                  <span className={`report-modal__badge report-modal__badge--${p.goodStanding.toLowerCase().includes("good") ? "standing" : "standing-bad"}`}>
                    {p.goodStanding}
                  </span>
                )}
              </div>
            </div>

            <div className="report-modal__profile-grid">
              <div className="report-modal__profile-item">
                <span><FiMail style={{ display: "inline", marginRight: "4px" }} /> Email</span>
                <span>{p.email || "No Email"}</span>
              </div>
              <div className="report-modal__profile-item">
                <span><FiPhone style={{ display: "inline", marginRight: "4px" }} /> Phone</span>
                <span>{p.phone || "No Phone"}</span>
              </div>
              <div className="report-modal__profile-item">
                <span>Joined Date</span>
                <span>{p.joined ? new Date(p.joined).toLocaleDateString(undefined, { year: 'numeric', month: 'long' }) : "Unknown"}</span>
              </div>
              <div className="report-modal__profile-item">
                <span>Voter Status</span>
                <span>{p.voter || "No"}</span>
              </div>
              <div className="report-modal__profile-item">
                <span>Financial Good Standing</span>
                <span>{p.financialGoodStanding || "No"}</span>
              </div>
              <div className="report-modal__profile-item">
                <span>Attendance Pct</span>
                <span>{p.attendancePct ? `${p.attendancePct}%` : "0%"}</span>
              </div>
            </div>
          </div>

          {/* Dues & Attendance Section */}
          <div className="report-modal__section-title">
            <FiCheckCircle /> Dues & Attendance Tracker
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "10px" }}>
            <div className="report-modal__tracker-year-select">
              <label htmlFor="tracker-year">Tracker Year:</label>
              <select
                id="tracker-year"
                value={trackerYear}
                onChange={(e) => setTrackerYear(Number(e.target.value))}
              >
                {YEAR_OPTIONS.map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>
            <span style={{ fontSize: "0.9rem", color: "#475569" }}>
              Total Dues Paid: <strong style={{ color: "#166d2e" }}>{formatCurrency(totalDuesPaid)}</strong>
            </span>
          </div>

          <div className="report-modal__monthly-grid">
            {filteredDues.map((d) => (
              <div
                key={d.month}
                className={`report-modal__month-card report-modal__month-card--${d.present ? "present" : "absent"}`}
              >
                <div className="report-modal__month-header">
                  <span>{MONTH_NAMES[d.month - 1]}</span>
                  <span
                    className={`report-modal__attendance-indicator report-modal__attendance-indicator--${d.present ? "present" : "absent"}`}
                    title={d.present ? "Present" : "Absent"}
                  >
                    {d.present ? "P" : "A"}
                  </span>
                </div>
                <div className="report-modal__dues-info">
                  <span>Dues Paid</span>
                  <span style={{ color: d.duesPaid > 0 ? "#166d2e" : "#64748b" }}>
                    {formatCurrency(d.duesPaid)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Hosting Schedule Section */}
          <div className="report-modal__section-title" style={{ marginTop: "2rem" }}>
            <FiCalendar /> Hosting Schedule
          </div>
          {resultsMember.hosting.length === 0 ? (
            <div className="report-modal__empty-text" style={{ padding: "16px", marginBottom: "2rem" }}>
              No hosting schedule records found.
            </div>
          ) : (
            <div className="report-modal__hosting-list" style={{ marginBottom: "2rem" }}>
              {resultsMember.hosting.map(h => (
                <div key={h.id} className="report-modal__hosting-card">
                  <FiCalendar />
                  <div>
                    <div>{MONTH_NAMES[h.month - 1]} {h.year}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Transactions Section */}
          <div className="report-modal__section-title">
            <FiCreditCard /> Transaction History
          </div>
          {resultsMember.transactions.length === 0 ? (
            <div className="report-modal__empty-text" style={{ padding: "16px" }}>
              No transaction history found for other categories (Raffles, Levies, etc.).
            </div>
          ) : (
            <div>
              <div style={{ textAlign: "right", fontSize: "0.9rem", color: "#475569", marginBottom: "10px" }}>
                Total Transactions: <strong>{formatCurrency(totalTransactionsAmount)}</strong>
              </div>
              <div className="admin-dashboard__table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Title</th>
                      <th>Description</th>
                      <th style={{ textAlign: "right" }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultsMember.transactions.map((row: ApiTransactionRow) => (
                      <tr key={row.id}>
                        <td data-label="Date">{new Date(row.date).toLocaleDateString()}</td>
                        <td data-label="Title" style={{ fontWeight: 600 }}>{row.title}</td>
                        <td data-label="Description" style={{ color: "#475569", fontSize: "0.85rem" }}>{row.description || "-"}</td>
                        <td data-label="Amount" style={{ fontWeight: 700, color: "#166d2e", textAlign: "right" }}>{formatCurrency(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#f1f5f9", fontWeight: 700, fontSize: "1.05rem", borderTop: "2px solid #cbd5e1" }}>
                      <td colSpan={3} style={{ textAlign: "right", padding: "14px 16px", color: "#0f172a" }}>
                        TOTAL TRANSACTIONS:
                      </td>
                      <td style={{ textAlign: "right", padding: "14px 16px", color: "#166d2e", fontSize: "1.15rem" }}>
                        {formatCurrency(totalTransactionsAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (resultsAttendance) {
      if (resultsAttendance.length === 0) {
        return <div className="report-modal__empty-text">No attendance records found for this period.</div>;
      }

      const overallPresent = resultsAttendance.reduce((s, r) => s + r.presentCount, 0);
      const overallTotal = resultsAttendance.reduce((s, r) => s + r.totalCount, 0);
      const overallRate = overallTotal > 0 ? Math.round((overallPresent / overallTotal) * 100) : 0;

      return (
        <div style={{ marginTop: "1rem" }}>
          {/* Summary Banner */}
          <div className="report-modal__attendance-summary">
            <div className="report-modal__attendance-summary-stat">
              <span className="report-modal__attendance-summary-label">Months Covered</span>
              <span className="report-modal__attendance-summary-value">{resultsAttendance.length}</span>
            </div>
            <div className="report-modal__attendance-summary-stat">
              <span className="report-modal__attendance-summary-label">Overall Rate</span>
              <span className="report-modal__attendance-summary-value" style={{ color: overallRate >= 75 ? "#16a34a" : overallRate >= 50 ? "#d97706" : "#dc2626" }}>
                {overallRate}%
              </span>
            </div>
            <div className="report-modal__attendance-summary-stat">
              <span className="report-modal__attendance-summary-label">Total Attendances</span>
              <span className="report-modal__attendance-summary-value">{overallPresent}</span>
            </div>
          </div>

          {/* Per-Month Cards */}
          <div className="report-modal__attendance-months">
            {resultsAttendance.map((att) => {
              const rate = att.totalCount > 0 ? Math.round((att.presentCount / att.totalCount) * 100) : 0;
              const monthLabel = MONTH_NAMES[att.month - 1] + " " + att.year;
              const rateColor = rate >= 75 ? "#16a34a" : rate >= 50 ? "#d97706" : "#dc2626";
              return (
                <details key={`${att.year}-${att.month}`} className="report-modal__attendance-month-detail">
                  <summary className="report-modal__attendance-month-summary">
                    <div className="report-modal__attendance-month-info">
                      <span className="report-modal__attendance-month-name">{monthLabel}</span>
                      <div className="report-modal__attendance-month-stats">
                        <span style={{ color: "#16a34a", fontWeight: 600 }}>{att.presentCount} present</span>
                        <span style={{ color: "#64748b" }}>·</span>
                        <span style={{ color: "#dc2626", fontWeight: 600 }}>{att.absentCount} absent</span>
                      </div>
                    </div>
                    <div className="report-modal__attendance-rate-wrap">
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: rateColor }}>{rate}%</span>
                      <div className="report-modal__progress-bar">
                        <div className="report-modal__progress-fill" style={{ width: `${rate}%`, background: rateColor }} />
                      </div>
                    </div>
                  </summary>

                  <div className="report-modal__attendance-lists">
                    {att.presentMembers.length > 0 && (
                      <div className="report-modal__attendance-list-block report-modal__attendance-list-block--present">
                        <div className="report-modal__attendance-list-header">✅ Present ({att.presentMembers.length})</div>
                        {att.presentMembers.map(m => (
                          <div key={m.id} className="report-modal__attendance-member-item">
                            {m.title ? `${m.title} ` : ""}{m.firstName} {m.lastName}
                          </div>
                        ))}
                      </div>
                    )}
                    {att.absentMembers.length > 0 && (
                      <div className="report-modal__attendance-list-block report-modal__attendance-list-block--absent">
                        <div className="report-modal__attendance-list-header">❌ Absent ({att.absentMembers.length})</div>
                        {att.absentMembers.map(m => (
                          <div key={m.id} className="report-modal__attendance-member-item">
                            {m.title ? `${m.title} ` : ""}{m.firstName} {m.lastName}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      );
    }

    return null;
  }

  return (
    <div className="admin-dashboard__modal" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
      <div className="report-modal__backdrop" onClick={onClose} />

      <div
        className="admin-dashboard__modal-panel"
        style={{
          maxWidth: "840px",
          width: "95%",
          maxHeight: "92vh",
          overflowY: "auto",
          display: "block", // override template grid
          padding: "24px",
          borderRadius: "20px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
        }}
      >
        <button
          type="button"
          className="admin-dashboard__modal-close"
          onClick={onClose}
          aria-label="Close modal"
          style={{ position: "absolute", top: "16px", right: "16px" }}
        >
          <FiX size={20} />
        </button>

        <h2
          id="report-modal-title"
          className="admin-dashboard__modal-title"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "1.4rem",
            marginBottom: "24px",
            color: "#0f172a"
          }}
        >
          <FiFilter size={24} style={{ color: "#166d2e" }} /> Reports Hub
        </h2>

        {error && (
          <div className="admin-dashboard__modal-error" style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <FiAlertCircle /> {error}
          </div>
        )}

        {/* Tab Selection */}
        <div className="report-modal__tabs">
          <button
            type="button"
            className={`report-modal__tab ${category === "dues" ? "report-modal__tab--active" : ""}`}
            onClick={() => handleCategoryChange("dues")}
          >
            Dues Paid
          </button>
          <button
            type="button"
            className={`report-modal__tab ${category === "transactions" ? "report-modal__tab--active" : ""}`}
            onClick={() => handleCategoryChange("transactions")}
          >
            Transactions
          </button>
          <button
            type="button"
            className={`report-modal__tab ${category === "hosting" ? "report-modal__tab--active" : ""}`}
            onClick={() => handleCategoryChange("hosting")}
          >
            Hosting
          </button>
          <button
            type="button"
            className={`report-modal__tab ${category === "member" ? "report-modal__tab--active" : ""}`}
            onClick={() => handleCategoryChange("member")}
          >
            Member Profile
          </button>
          <button
            type="button"
            className={`report-modal__tab ${category === "attendance" ? "report-modal__tab--active" : ""}`}
            onClick={() => handleCategoryChange("attendance")}
          >
            Attendance
          </button>
        </div>

        {/* Filter Selection Panel */}
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "20px"
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: category === "member" ? "1fr" : "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
              alignItems: "end"
            }}
          >
            {/* Global Member Autocomplete Selector */}
            <div className="admin-dashboard__modal-section" style={{ gridColumn: "1 / -1" }}>
              <label className="admin-dashboard__modal-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Filter by Member Name {category === "member" && <span style={{ color: "#b91c1c", fontSize: "0.8rem" }}>(Required)</span>}</span>
                {selectedMember && (
                  <button
                    type="button"
                    onClick={clearMemberSelection}
                    style={{ background: "transparent", border: "none", color: "#b91c1c", fontSize: "0.8rem", cursor: "pointer", fontWeight: 600 }}
                  >
                    Clear Filter
                  </button>
                )}
              </label>
              <div className="report-modal__search-container" ref={dropdownRef}>
                <div className="report-modal__search-input-wrapper">
                  <FiSearch />
                  <input
                    type="text"
                    placeholder={membersLoading ? "Loading members list..." : "Type member name, email or phone..."}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (selectedMember && e.target.value !== `${selectedMember.firstName} ${selectedMember.lastName}`) {
                        setSelectedMember(null);
                        resetResults();
                      }
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    disabled={membersLoading}
                  />
                  {selectedMember && (
                    <FiUserCheck style={{ color: "#166d2e", fontSize: "1.2rem", marginLeft: "8px" }} />
                  )}
                </div>

                {isDropdownOpen && (
                  <div className="report-modal__dropdown">
                    {filteredMembers.length === 0 ? (
                      <div className="report-modal__no-results">No members match your search.</div>
                    ) : (
                      filteredMembers.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className={`report-modal__dropdown-item ${selectedMember?.id === m.id ? "report-modal__dropdown-item--active" : ""}`}
                          onClick={() => selectMember(m)}
                        >
                          <span className="report-modal__member-name">{m.firstName} {m.lastName}</span>
                          <span className="report-modal__member-meta">
                            {[m.email, m.phone].filter(Boolean).join(" • ")}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Dues Specific Inputs — filters within dues paid only */}
            {category === "dues" && (
              <>
                <div className="admin-dashboard__modal-section">
                  <label className="admin-dashboard__modal-label">From Date (Optional)</label>
                  <div className="admin-dashboard__modal-input-field" style={{ padding: "0 12px", display: "flex", alignItems: "center", background: "#fff" }}>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => { setStartDate(e.target.value); resetResults(); }}
                      style={{ border: "none", outline: "none", width: "100%", height: "100%", font: "inherit", color: "#0f172a" }}
                    />
                  </div>
                </div>
                <div className="admin-dashboard__modal-section">
                  <label className="admin-dashboard__modal-label">To Date (Optional)</label>
                  <div className="admin-dashboard__modal-input-field" style={{ padding: "0 12px", display: "flex", alignItems: "center", background: "#fff" }}>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => { setEndDate(e.target.value); resetResults(); }}
                      style={{ border: "none", outline: "none", width: "100%", height: "100%", font: "inherit", color: "#0f172a" }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Transactions Specific Inputs */}
            {category === "transactions" && (
              <>
                <div className="admin-dashboard__modal-section">
                  <label className="admin-dashboard__modal-label">Transaction Category / Title</label>
                  <div className="admin-dashboard__modal-input-field" style={{ padding: "0 12px", display: "flex", alignItems: "center", background: "#fff", position: "relative" }}>
                    <select
                      value={selectedTxTitle}
                      onChange={(e) => { setSelectedTxTitle(e.target.value); resetResults(); }}
                      style={{ border: "none", outline: "none", width: "100%", background: "transparent", cursor: "pointer", font: "inherit", height: "100%", appearance: "none", color: "#0f172a" }}
                    >
                      <option value="ALL_REVENUE">Total Income / Revenue (Dues, Raffles, Levies...)</option>
                      <option value="ALL_EXPENSES">Total Expenses (Outgoings)</option>
                      <option value="ALL">All Transactions & Financials</option>
                      <option value="Dues">Dues Only</option>
                      <option value="Expense">Expenses Only</option>
                      <option value="Raffle">Raffle</option>
                      <option value="Levy">Levy</option>
                      <option value="Insurance">Insurance</option>
                      <option value="Wrapper">Wrapper</option>
                      <option value="UPUA 25 Raffle">UPUA 25 Raffle</option>
                      <option value="Others">Others</option>
                    </select>
                    <FiChevronDown style={{ position: "absolute", right: "12px", pointerEvents: "none", color: "#64748b" }} />
                  </div>
                </div>
                <div className="admin-dashboard__modal-section">
                  <label className="admin-dashboard__modal-label">Month</label>
                  <div className="admin-dashboard__modal-input-field" style={{ padding: "0 12px", display: "flex", alignItems: "center", background: "#fff", position: "relative" }}>
                    <select
                      value={selectedMonth}
                      onChange={(e) => { setSelectedMonth(e.target.value); resetResults(); }}
                      style={{ border: "none", outline: "none", width: "100%", background: "transparent", cursor: "pointer", font: "inherit", height: "100%", appearance: "none", color: "#0f172a" }}
                    >
                      <option value="ALL">All Months</option>
                      {MONTH_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <FiChevronDown style={{ position: "absolute", right: "12px", pointerEvents: "none", color: "#64748b" }} />
                  </div>
                </div>
                <div className="admin-dashboard__modal-section">
                  <label className="admin-dashboard__modal-label">Year</label>
                  <div className="admin-dashboard__modal-input-field" style={{ padding: "0 12px", display: "flex", alignItems: "center", background: "#fff", position: "relative" }}>
                    <select
                      value={selectedYear}
                      onChange={(e) => { setSelectedYear(e.target.value); resetResults(); }}
                      style={{ border: "none", outline: "none", width: "100%", background: "transparent", cursor: "pointer", font: "inherit", height: "100%", appearance: "none", color: "#0f172a" }}
                    >
                      <option value="ALL">All Years</option>
                      {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <FiChevronDown style={{ position: "absolute", right: "12px", pointerEvents: "none", color: "#64748b" }} />
                  </div>
                </div>
                <div className="admin-dashboard__modal-section">
                  <label className="admin-dashboard__modal-label">From Date (Optional)</label>
                  <div className="admin-dashboard__modal-input-field" style={{ padding: "0 12px", display: "flex", alignItems: "center", background: "#fff" }}>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => { setStartDate(e.target.value); resetResults(); }}
                      style={{ border: "none", outline: "none", width: "100%", height: "100%", font: "inherit", color: "#0f172a" }}
                    />
                  </div>
                </div>
                <div className="admin-dashboard__modal-section">
                  <label className="admin-dashboard__modal-label">To Date (Optional)</label>
                  <div className="admin-dashboard__modal-input-field" style={{ padding: "0 12px", display: "flex", alignItems: "center", background: "#fff" }}>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => { setEndDate(e.target.value); resetResults(); }}
                      style={{ border: "none", outline: "none", width: "100%", height: "100%", font: "inherit", color: "#0f172a" }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Hosting Specific Inputs — Year and Month are all optional */}
            {category === "hosting" && (
              <>
                <div className="admin-dashboard__modal-section">
                  <label className="admin-dashboard__modal-label">Year (Optional)</label>
                  <div className="admin-dashboard__modal-input-field" style={{ padding: "0 12px", display: "flex", alignItems: "center", background: "#fff", position: "relative" }}>
                    <select
                      value={hostingYear || ""}
                      onChange={(e) => { setHostingYear(e.target.value ? Number(e.target.value) : 0); resetResults(); }}
                      style={{ border: "none", outline: "none", width: "100%", background: "transparent", cursor: "pointer", font: "inherit", height: "100%", appearance: "none", color: "#0f172a" }}
                    >
                      <option value="">All Years</option>
                      {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <FiChevronDown style={{ position: "absolute", right: "12px", pointerEvents: "none", color: "#64748b" }} />
                  </div>
                </div>
                <div className="admin-dashboard__modal-section">
                  <label className="admin-dashboard__modal-label">From Month (Optional)</label>
                  <div className="admin-dashboard__modal-input-field" style={{ padding: "0 12px", display: "flex", alignItems: "center", background: "#fff", position: "relative" }}>
                    <select
                      value={startMonth}
                      onChange={(e) => { setStartMonth(e.target.value); resetResults(); }}
                      style={{ border: "none", outline: "none", width: "100%", background: "transparent", cursor: "pointer", font: "inherit", height: "100%", appearance: "none", color: "#0f172a" }}
                    >
                      <option value="">All Months</option>
                      {MONTH_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <FiChevronDown style={{ position: "absolute", right: "12px", pointerEvents: "none", color: "#64748b" }} />
                  </div>
                </div>
                <div className="admin-dashboard__modal-section">
                  <label className="admin-dashboard__modal-label">To Month (Optional)</label>
                  <div className="admin-dashboard__modal-input-field" style={{ padding: "0 12px", display: "flex", alignItems: "center", background: "#fff", position: "relative" }}>
                    <select
                      value={endMonth}
                      onChange={(e) => { setEndMonth(e.target.value); resetResults(); }}
                      style={{ border: "none", outline: "none", width: "100%", background: "transparent", cursor: "pointer", font: "inherit", height: "100%", appearance: "none", color: "#0f172a" }}
                    >
                      <option value="">All Months</option>
                      {MONTH_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <FiChevronDown style={{ position: "absolute", right: "12px", pointerEvents: "none", color: "#64748b" }} />
                  </div>
                </div>
              </>
            )}

            {/* Attendance Specific Inputs — all filters optional */}
            {category === "attendance" && (
              <>
                <div className="admin-dashboard__modal-section">
                  <label className="admin-dashboard__modal-label">Year (Optional)</label>
                  <div className="admin-dashboard__modal-input-field" style={{ padding: "0 12px", display: "flex", alignItems: "center", background: "#fff", position: "relative" }}>
                    <select
                      value={hostingYear || ""}
                      onChange={(e) => { setHostingYear(e.target.value ? Number(e.target.value) : 0); resetResults(); }}
                      style={{ border: "none", outline: "none", width: "100%", background: "transparent", cursor: "pointer", font: "inherit", height: "100%", appearance: "none", color: "#0f172a" }}
                    >
                      <option value="">All Years</option>
                      {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <FiChevronDown style={{ position: "absolute", right: "12px", pointerEvents: "none", color: "#64748b" }} />
                  </div>
                </div>
                <div className="admin-dashboard__modal-section">
                  <label className="admin-dashboard__modal-label">From Month (Optional)</label>
                  <div className="admin-dashboard__modal-input-field" style={{ padding: "0 12px", display: "flex", alignItems: "center", background: "#fff", position: "relative" }}>
                    <select
                      value={startMonth}
                      onChange={(e) => { setStartMonth(e.target.value); resetResults(); }}
                      style={{ border: "none", outline: "none", width: "100%", background: "transparent", cursor: "pointer", font: "inherit", height: "100%", appearance: "none", color: "#0f172a" }}
                    >
                      <option value="">All Months</option>
                      {MONTH_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <FiChevronDown style={{ position: "absolute", right: "12px", pointerEvents: "none", color: "#64748b" }} />
                  </div>
                </div>
                <div className="admin-dashboard__modal-section">
                  <label className="admin-dashboard__modal-label">To Month (Optional)</label>
                  <div className="admin-dashboard__modal-input-field" style={{ padding: "0 12px", display: "flex", alignItems: "center", background: "#fff", position: "relative" }}>
                    <select
                      value={endMonth}
                      onChange={(e) => { setEndMonth(e.target.value); resetResults(); }}
                      style={{ border: "none", outline: "none", width: "100%", background: "transparent", cursor: "pointer", font: "inherit", height: "100%", appearance: "none", color: "#0f172a" }}
                    >
                      <option value="">All Months</option>
                      {MONTH_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <FiChevronDown style={{ position: "absolute", right: "12px", pointerEvents: "none", color: "#64748b" }} />
                  </div>
                </div>
              </>
            )}

            {/* Generate Button inside selection grid to save space */}
            <div className="admin-dashboard__modal-section" style={{ gridColumn: category === "member" ? "auto" : "span 1" }}>
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--primary"
                onClick={handleGenerateReport}
                disabled={loading || (category === "member" && !selectedMember) || ((category === "hosting" || category === "attendance") && (!startMonth || !endMonth))}
                style={{ width: "100%", minHeight: "44px", borderRadius: "12px" }}
              >
                {loading ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>
        </div>

        {/* Results Area */}
        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}>
          {renderResults()}
        </div>

      </div>
    </div>
  );
}
