import { useEffect, useRef, useState } from "react";
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
import { MEMBER_STATUS_OPTIONS, type MemberDetailRecord, type MemberStatus } from "./member-data";
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

type AddTransactionFormState = {
  title: string;
  description: string;
  amount: string;
  paymentDate: string;
};

// A unified row merging MonthlyDue records and Transaction records
type UnifiedPaymentRow = {
  id: string;
  // Display label — "January 2026" for dues, formatted date for transactions
  period: string;
  title: string;
  amountPaid: string;
  status: "Paid" | "Unpaid";
  paymentDate: string;
  rawAmount: number;
  rawDate: string;
  // Discriminator
  source: "due" | "transaction";
  // Due-specific
  year?: number;
  monthNum?: number;
  // Transaction-specific
  description?: string;
};

type ApiTransactionRow = {
  id: string;
  userId?: string | null;
  fullName: string;
  title: string;
  description?: string | null;
  amount: string | number;
  date: string;
  createdAt?: string;
};

type RecordAttendanceFormState = {
  year: string;
  month: string;
  status: "present" | "absent" | "";
};

type EditMemberFormState = {
  title: string;
  fName: string;
  lName: string;
  email: string;
  phone: string;
  address: string;
  whatsapp: string;
  facebook: string;
  insurance: string;
  dateJoined: string;
  voteRole: string;
  goodStanding: string;
  financialGoodStanding: string;
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

const TRANSACTION_TITLE_OPTIONS = [
  "Dues",
  "Raffle",
  "Insurance",
  "Wrapper",
  "UPUA 25 Raffle",
  "Levy",
  "Others",
];

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
  updatedAt?: string;
};

type ApiMemberDetail = {
  id: string;
  displayMemberId?: string | null;
  memberKey?: string | null;
  title?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  whatsapp?: string | null;
  facebook?: string | null;
  insurance?: string | null;
  joined?: string | null;
  voter?: string | null;
  attendancePct?: string | null;
  attendanceCount?: number | null;
  totalMeetings?: number | null;
  monthlyDuesAmount?: number | null;
  totalPaid?: number | null;
  outstanding?: number | null;
  status?: string | null;
  goodStanding?: string | null;
  financialGoodStanding?: string | null;
  monthlyDues?: ApiMonthlyDue[];
  userId?: string | null;
  user?: { id: string } | null;
};

function mapDueRows(rows: ApiMonthlyDue[] = []): UnifiedPaymentRow[] {
  return rows.map((row) => {
    const monthName = MONTH_NAMES[Math.max(1, Math.min(12, row.month)) - 1] ?? String(row.month);
    const amount = Number(row.duesPaid ?? 0);
    const dateStr = row.createdAt ?? row.updatedAt ?? "";
    return {
      id: row.id,
      period: `${monthName} ${row.year}`,
      title: "Dues",
      amountPaid: formatCurrencyAmount(amount),
      status: amount > 0 ? "Paid" : "Unpaid",
      paymentDate: dateStr ? formatDateDisplay(dateStr) : "-",
      rawAmount: amount,
      rawDate: dateStr,
      source: "due" as const,
      year: row.year,
      monthNum: row.month,
    };
  });
}

function mapTransactionRows(rows: ApiTransactionRow[] = [], memberUserId: string | null): UnifiedPaymentRow[] {
  return rows
    .filter((row) => row.userId === memberUserId && row.title === "Dues")
    .map((row) => {
      const amount = Number(row.amount ?? 0);
      const dateStr = row.date ?? row.createdAt ?? "";
      return {
        id: row.id,
        period: formatDateDisplay(dateStr),
        title: row.title,
        amountPaid: formatCurrencyAmount(amount),
        status: amount > 0 ? "Paid" : ("Unpaid" as "Paid" | "Unpaid"),
        paymentDate: formatDateDisplay(dateStr),
        rawAmount: amount,
        rawDate: dateStr,
        source: "transaction" as const,
        description: row.description ?? undefined,
      };
    });
}

function mergeAndSortPayments(
  dueRows: ApiMonthlyDue[],
  txRows: ApiTransactionRow[],
  memberUserId: string | null,
): UnifiedPaymentRow[] {
  const dues = mapDueRows(dueRows);
  const txs = mapTransactionRows(txRows, memberUserId);
  return [...dues, ...txs].sort((a, b) => {
    const da = new Date(a.rawDate || 0).getTime();
    const db = new Date(b.rawDate || 0).getTime();
    return db - da;
  });
}

const EMPTY_PROFILE: MemberDetailRecord = {
  memberId: "", name: "", email: "", phoneNumber: "", address: "",
  dateJoined: "", attendance: "", voteRole: "NO",
  monthlyDues: "$0", totalPaid: "$0", outstanding: "$0",
  status: "Inactive", paymentHistory: [],
};

// Separate state for all Transaction rows (fetched org-wide and filtered by userId in UI)
type AllTransactionsState = ApiTransactionRow[];

export default function MemberViewPage() {
  const navigate = useNavigate();
  const { memberId = "" } = useParams();
  const [search, setSearch] = useState("");
  const [memberProfile, setMemberProfile] = useState<MemberDetailRecord>(EMPTY_PROFILE);
  // Raw data from API
  const [rawDues, setRawDues] = useState<ApiMonthlyDue[]>([]);
  const [rawTransactions, setRawTransactions] = useState<AllTransactionsState>([]);
  const [unifiedPayments, setUnifiedPayments] = useState<UnifiedPaymentRow[]>([]);
  const [memberLoading, setMemberLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [isEditMemberModalOpen, setIsEditMemberModalOpen] = useState(false);
  const [isAddTransactionModalOpen, setIsAddTransactionModalOpen] = useState(false);
  const [editMemberForm, setEditMemberForm] = useState<EditMemberFormState>({
    title: "", fName: "", lName: "", email: "", phone: "", address: "",
    whatsapp: "", facebook: "", insurance: "",
    dateJoined: "", voteRole: "", goodStanding: "", financialGoodStanding: "",
    monthlyDues: "", totalPaid: "", outstanding: "", status: "Active",
  });
  const [editMemberLoading, setEditMemberLoading] = useState(false);
  const [editMemberError, setEditMemberError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [addTransactionForm, setAddTransactionForm] = useState<AddTransactionFormState>({
    title: "",
    description: "",
    amount: "",
    paymentDate: "",
  });
  const [addTransactionLoading, setAddTransactionLoading] = useState(false);
  const [addTransactionError, setAddTransactionError] = useState<string | null>(null);
  // Store the linked userId from the member fetch so it can be attached to transactions
  const [memberUserId, setMemberUserId] = useState<string | null>(null);
  const [isRecordAttendanceModalOpen, setIsRecordAttendanceModalOpen] = useState(false);
  const [attendanceForm, setAttendanceForm] = useState<RecordAttendanceFormState>({
    year: String(CURRENT_YEAR),
    month: "",
    status: "",
  });
  const [recordAttendanceLoading, setRecordAttendanceLoading] = useState(false);
  const [recordAttendanceError, setRecordAttendanceError] = useState<string | null>(null);

  // Extra raw member detail fields (not in MemberDetailRecord)
  const [memberRaw, setMemberRaw] = useState<Partial<ApiMemberDetail>>({});
  const [hostingSchedule, setHostingSchedule] = useState<{ id: string; year: number; month: number; hostMember: string }[]>([]);
  // Tracker year for the attendance grid
  const [attendanceYear, setAttendanceYear] = useState<number>(new Date().getFullYear());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isDeletePaymentPromptOpen, setIsDeletePaymentPromptOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<UnifiedPaymentRow | null>(null);
  const [isEditPaymentModalOpen, setIsEditPaymentModalOpen] = useState(false);
  const [paymentToEdit, setPaymentToEdit] = useState<UnifiedPaymentRow | null>(null);
  const [editPaymentForm, setEditPaymentForm] = useState({
    amount: "",
    month: "",
    year: "",
    paymentDate: "",
    title: "",
    description: "",
  });
  const [editPaymentLoading, setEditPaymentLoading] = useState(false);
  const [editPaymentError, setEditPaymentError] = useState<string | null>(null);

  // Use a stable ref + useEffect for the action menu outside-click handler
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openMenuId) return undefined;
    function handler(e: MouseEvent) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenuId]);

  // Fetch member detail + both dues and transactions in parallel on mount.
  useEffect(() => {
    let active = true;
    if (!memberId) {
      setMemberError("Member ID is missing");
      setMemberLoading(false);
      return undefined;
    }

    setMemberLoading(true);
    setTxLoading(true);
    setMemberError(null);

    let resolvedUserId: string | null = null;
    let resolvedDues: ApiMonthlyDue[] = [];

    const memberPromise = apiGet<ApiMemberDetail>(`/admin/members/${memberId}`)
      .then((row) => {
        if (!active) return;
        const firstName = row.firstName?.trim() ?? "";
        const lastName = row.lastName?.trim() ?? "";
        resolvedUserId = row.user?.id ?? row.userId ?? null;
        resolvedDues = row.monthlyDues ?? [];
        setMemberUserId(resolvedUserId);
        setRawDues(resolvedDues);
        setMemberRaw(row);
        const profile: MemberDetailRecord = {
          memberId: row.displayMemberId || row.memberKey || row.id,
          name: [row.title, firstName, lastName].filter(Boolean).join(" ") || row.email || "Unnamed member",
          email: row.email || "-",
          phoneNumber: row.phone || "-",
          address: row.address || "",
          dateJoined: formatDateDisplay(row.joined),
          attendance: row.attendanceCount != null && row.totalMeetings != null
            ? `${row.attendanceCount} / ${row.totalMeetings} Meetings (${row.attendancePct || 0}%)`
            : row.attendancePct ? `${row.attendancePct}%` : "-",
          voteRole: String(row.voter ?? "").trim().toUpperCase() === "YES" ? "YES" : "NO",
          monthlyDues: formatCurrencyAmount(row.monthlyDuesAmount),
          totalPaid: formatCurrencyAmount(row.totalPaid),
          outstanding: formatCurrencyAmount(row.outstanding),
          status: String(row.status ?? "").trim().toLowerCase() === "active" ? "Active" : "Inactive",
          paymentHistory: [],
        };
        setMemberProfile(profile);
      })
      .catch((error: Error) => {
        if (!active) return;
        setMemberError(error?.message ?? "Failed to load member");
      })
      .finally(() => {
        if (active) setMemberLoading(false);
      });

    const txPromise = apiGet<ApiTransactionRow[]>("/admin/database/transactions")
      .then((rows) => {
        if (!active) return;
        setRawTransactions(rows);
      })
      .catch(() => {
        if (active) setRawTransactions([]);
      })
      .finally(() => {
        if (active) setTxLoading(false);
      });

    const hostingPromise = apiGet<{ id: string; year: number; month: number; hostMember: string }[]>("/admin/database/hosting-schedule")
      .then((rows) => {
        if (!active) return;
        // Filter to rows where this member's name appears
        setHostingSchedule(rows);
      })
      .catch(() => {
        if (active) setHostingSchedule([]);
      });

    // Once both resolve, build the merged list
    Promise.all([memberPromise, txPromise, hostingPromise]).then(() => {
      if (!active) return;
      setUnifiedPayments(mergeAndSortPayments(resolvedDues, [], resolvedUserId));
    });

    return () => { active = false; };
  }, [memberId]);

  // Re-merge whenever raw data or userId changes
  useEffect(() => {
    setUnifiedPayments(mergeAndSortPayments(rawDues, rawTransactions, memberUserId));
  }, [rawDues, rawTransactions, memberUserId]);

  useEffect(() => {
    if (!isEditMemberModalOpen && !isAddTransactionModalOpen) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsEditMemberModalOpen(false);
        setIsAddTransactionModalOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isEditMemberModalOpen, isAddTransactionModalOpen]);

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  function handleOpenEditMemberModal() {
    const rawTitle = memberRaw.title ?? "";
    const [fName = "", ...rest] = memberProfile.name.replace(rawTitle, "").trim().split(" ");
    const lName = rest.join(" ");

    setEditMemberForm({
      title: rawTitle,
      fName,
      lName,
      email: memberProfile.email,
      phone: memberProfile.phoneNumber,
      address: memberProfile.address,
      whatsapp: memberRaw.whatsapp ?? "",
      facebook: memberRaw.facebook ?? "",
      insurance: memberRaw.insurance ?? "",
      dateJoined: memberProfile.dateJoined,
      voteRole: memberProfile.voteRole,
      goodStanding: memberRaw.goodStanding ?? "",
      financialGoodStanding: memberRaw.financialGoodStanding ?? "",
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
        title: editMemberForm.title.trim() || null,
        fName,
        lName,
        email,
        phone,
        address,
        whatsapp: editMemberForm.whatsapp.trim() || null,
        facebook: editMemberForm.facebook.trim() || null,
        insurance: editMemberForm.insurance.trim() || null,
        goodStanding: editMemberForm.goodStanding.trim() || null,
        financialGoodStanding: editMemberForm.financialGoodStanding.trim() || null,
        dateJoined: dateJoined || null,
        voteRole,
        monthlyDues,
        totalPaid,
        outstanding,
        status,
      });

      // Reflect the update locally so the UI doesn't need a full refetch
      setMemberRaw((prev) => ({
        ...prev,
        title: editMemberForm.title.trim() || null,
        whatsapp: editMemberForm.whatsapp.trim() || null,
        facebook: editMemberForm.facebook.trim() || null,
        insurance: editMemberForm.insurance.trim() || null,
        goodStanding: editMemberForm.goodStanding.trim() || null,
        financialGoodStanding: editMemberForm.financialGoodStanding.trim() || null,
      }));
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

  function resetAddTransactionForm() {
    setAddTransactionForm({ title: "", description: "", amount: "", paymentDate: "" });
    setAddTransactionError(null);
  }

  function handleOpenAddTransactionModal() {
    resetAddTransactionForm();
    setIsAddTransactionModalOpen(true);
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

  function handleCloseAddTransactionModal() {
    setIsAddTransactionModalOpen(false);
    setAddTransactionError(null);
  }

  function handleDeletePaymentPrompt(payment: UnifiedPaymentRow) {
    setPaymentToDelete(payment);
    setOpenMenuId(null);
    setIsDeletePaymentPromptOpen(true);
  }

  function handleEditPaymentPrompt(payment: UnifiedPaymentRow) {
    setPaymentToEdit(payment);
    setEditPaymentForm({
      amount: String(payment.rawAmount),
      month: String(payment.monthNum ?? ""),
      year: String(payment.year ?? ""),
      paymentDate: payment.source === "transaction" ? (payment.rawDate ? payment.rawDate.slice(0, 10) : "") : "",
      title: payment.title,
      description: payment.description ?? "",
    });
    setEditPaymentError(null);
    setOpenMenuId(null);
    setIsEditPaymentModalOpen(true);
  }

  async function handleSaveEditPayment() {
    if (!paymentToEdit) return;
    setEditPaymentError(null);

    const numericAmount = Number(editPaymentForm.amount);
    if (Number.isNaN(numericAmount) || numericAmount < 0) {
      setEditPaymentError("Amount must be a valid number");
      return;
    }

    setEditPaymentLoading(true);
    try {
      if (paymentToEdit.source === "due") {
        // Edit a MonthlyDue record
        await apiPatch(`/admin/members/${memberId}/monthly-dues/${paymentToEdit.id}`, {
          duesPaid: numericAmount,
          ...(editPaymentForm.month ? { month: Number(editPaymentForm.month) } : {}),
          ...(editPaymentForm.year ? { year: Number(editPaymentForm.year) } : {}),
        });
        setRawDues((current) =>
          current.map((d) =>
            d.id === paymentToEdit.id
              ? {
                  ...d,
                  duesPaid: numericAmount,
                  ...(editPaymentForm.month ? { month: Number(editPaymentForm.month) } : {}),
                  ...(editPaymentForm.year ? { year: Number(editPaymentForm.year) } : {}),
                }
              : d
          )
        );
      } else {
        // Edit a Transaction record
        await apiPatch(`/admin/database/transactions/${paymentToEdit.id}`, {
          amount: numericAmount,
          ...(editPaymentForm.paymentDate ? { date: new Date(editPaymentForm.paymentDate).toISOString() } : {}),
          ...(editPaymentForm.title ? { title: editPaymentForm.title } : {}),
          ...(editPaymentForm.description !== undefined ? { description: editPaymentForm.description || null } : {}),
        });
        setRawTransactions((current) =>
          current.map((t) =>
            t.id === paymentToEdit.id
              ? {
                  ...t,
                  amount: numericAmount,
                  ...(editPaymentForm.paymentDate ? { date: new Date(editPaymentForm.paymentDate).toISOString() } : {}),
                  ...(editPaymentForm.title ? { title: editPaymentForm.title } : {}),
                  description: editPaymentForm.description || null,
                }
              : t
          )
        );
      }

      setIsEditPaymentModalOpen(false);
      setPaymentToEdit(null);
      setToast("Payment updated successfully");
      window.setTimeout(() => setToast(null), 3000);
    } catch (error) {
      setEditPaymentError(error instanceof Error ? error.message : "Failed to update payment");
    } finally {
      setEditPaymentLoading(false);
    }
  }

  async function handleConfirmDeletePayment() {
    if (!paymentToDelete) return;
    try {
      if (paymentToDelete.source === "due") {
        await apiDelete(`/admin/members/${memberId}/monthly-dues/${paymentToDelete.id}`);
        setRawDues((current) => current.filter((d) => d.id !== paymentToDelete.id));
      } else {
        await apiDelete(`/admin/database/transactions/${paymentToDelete.id}`);
        setRawTransactions((current) => current.filter((t) => t.id !== paymentToDelete.id));
      }
      setIsDeletePaymentPromptOpen(false);
      setPaymentToDelete(null);
      setToast("Payment deleted successfully");
      window.setTimeout(() => setToast(null), 3000);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Failed to delete payment");
      window.setTimeout(() => setToast(null), 3000);
    }
  }

  function handleAddTransactionFormChange(field: keyof AddTransactionFormState, value: string) {
    setAddTransactionForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  async function handleSaveAddTransaction() {
    setAddTransactionError(null);

    const { title, description, amount, paymentDate } = addTransactionForm;

    if (!title.trim()) { setAddTransactionError("Select a title"); return; }
    if (!amount.trim()) { setAddTransactionError("Enter an amount"); return; }
    if (!paymentDate.trim()) { setAddTransactionError("Enter a payment date"); return; }

    const numericAmount = Number(amount.replace(/[$,]/g, "").trim());
    if (Number.isNaN(numericAmount)) { setAddTransactionError("Amount must be a number"); return; }

    const parsedDate = new Date(paymentDate.trim());
    if (Number.isNaN(parsedDate.getTime())) { setAddTransactionError("Enter a valid date"); return; }

    setAddTransactionLoading(true);

    try {
      const newTx = await apiPost<ApiTransactionRow>(
        "/admin/database/transactions",
        {
          ...(memberUserId ? { userId: memberUserId } : {}),
          fullName: memberProfile.name,
          title: title.trim(),
          description: description.trim() || null,
          amount: numericAmount,
          date: parsedDate.toISOString(),
        }
      );

      // Immediately add the new transaction to local state so it appears in the table
      setRawTransactions((current) => [newTx, ...current]);

      setIsAddTransactionModalOpen(false);
      resetAddTransactionForm();
      setToast("Transaction added successfully");
      window.setTimeout(() => setToast(null), 3000);
    } catch (error) {
      setAddTransactionError(error instanceof Error ? error.message : "Failed to add transaction");
    } finally {
      setAddTransactionLoading(false);
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

  // Sum ALL dues payments — both MonthlyDue rows and Transaction rows with title "Dues"
  const totalPaidFromAllSources = unifiedPayments.reduce((sum, row) => {
    return sum + (row.rawAmount ?? 0);
  }, 0);

  const summaryCards: SummaryCard[] = [
    { label: "Monthly Dues", value: memberProfile.monthlyDues },
    { label: "Total Paid", value: `$${totalPaidFromAllSources.toLocaleString()}`, tone: "success" },
    { label: "Attendance", value: memberProfile.attendance || "0 Meetings", tone: "success" },
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
            {/* ── Top Identity + Quick Stats ──────────────────────── */}
            <div className="member-view-page__details-main">
              <div className="member-view-page__identity">
                <span className="member-view-page__eyebrow">Member ID {memberProfile.memberId}</span>
                <h3>{memberProfile.name}</h3>

                <div className="member-view-page__status-badges">
                  <span className={`member-view-page__badge member-view-page__badge--${memberProfile.status === "Active" ? "active" : "inactive"}`}>
                    {memberProfile.status}
                  </span>
                  {memberRaw.goodStanding && (
                    <span className="member-view-page__badge member-view-page__badge--standing">
                      {memberRaw.goodStanding}
                    </span>
                  )}
                  {memberRaw.insurance && (
                    <span className="member-view-page__badge member-view-page__badge--insurance">
                      Insured
                    </span>
                  )}
                </div>

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
                  {memberRaw.whatsapp && (
                    <div className="member-view-page__contact-item">
                      <FiPhone size={18} />
                      <div>
                        <span className="member-view-page__contact-label">WhatsApp</span>
                        <strong>{memberRaw.whatsapp}</strong>
                      </div>
                    </div>
                  )}
                  {memberRaw.facebook && (
                    <div className="member-view-page__contact-item">
                      <FiUsers size={18} />
                      <div>
                        <span className="member-view-page__contact-label">Facebook</span>
                        <strong>{memberRaw.facebook}</strong>
                      </div>
                    </div>
                  )}
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

            {/* ── Full Info Grid ────────────────────────────────────── */}
            <div className="member-view-page__info-grid">
              <div className="member-view-page__info-item">
                <span className="member-view-page__info-label">Title / Prefix</span>
                <span className="member-view-page__info-value">{memberRaw.title || "—"}</span>
              </div>
              <div className="member-view-page__info-item">
                <span className="member-view-page__info-label">Date Joined</span>
                <span className="member-view-page__info-value">{memberProfile.dateJoined || "—"}</span>
              </div>
              <div className="member-view-page__info-item">
                <span className="member-view-page__info-label">Address</span>
                <span className="member-view-page__info-value">{memberProfile.address || "—"}</span>
              </div>
              <div className="member-view-page__info-item">
                <span className="member-view-page__info-label">Voter Status</span>
                <span className="member-view-page__info-value">{memberProfile.voteRole}</span>
              </div>
              <div className="member-view-page__info-item">
                <span className="member-view-page__info-label">Attendance %</span>
                <span className="member-view-page__info-value">{memberProfile.attendance ? `${memberProfile.attendance}%` : "—"}</span>
              </div>
              <div className="member-view-page__info-item">
                <span className="member-view-page__info-label">Financial Standing</span>
                <span className="member-view-page__info-value">{memberRaw.financialGoodStanding || "—"}</span>
              </div>
              <div className="member-view-page__info-item">
                <span className="member-view-page__info-label">Good Standing</span>
                <span className="member-view-page__info-value">{memberRaw.goodStanding || "—"}</span>
              </div>
              <div className="member-view-page__info-item">
                <span className="member-view-page__info-label">Insurance</span>
                <span className="member-view-page__info-value">{memberRaw.insurance || "—"}</span>
              </div>
            </div>

            {/* ── Attendance Month Grid ─────────────────────────────── */}
            <div className="member-view-page__section-divider">
              <span>Monthly Attendance</span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "0.82rem", color: "#64748b" }}>Year:</span>
                <select
                  value={attendanceYear}
                  onChange={(e) => setAttendanceYear(Number(e.target.value))}
                  className="member-view-page__year-select"
                >
                  {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div className="member-view-page__attendance-grid">
              {MONTH_OPTIONS.map((m) => {
                const due = rawDues.find(d => d.year === attendanceYear && d.month === m.value);
                const isPresent = due?.present === true;
                const hasDue = !!due;
                return (
                  <div
                    key={m.value}
                    className={`member-view-page__attendance-cell member-view-page__attendance-cell--${isPresent ? "present" : hasDue ? "absent" : "none"}`}
                    title={`${m.label} ${attendanceYear}: ${isPresent ? "Present" : hasDue ? "Absent" : "No record"}`}
                  >
                    <span className="member-view-page__attendance-month">{m.label.slice(0, 3)}</span>
                    <span className="member-view-page__attendance-dot">{isPresent ? "✓" : hasDue ? "✗" : "–"}</span>
                    {due && due.duesPaid > 0 && (
                      <span className="member-view-page__attendance-dues">${Number(due.duesPaid).toLocaleString()}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Hosting Schedule ──────────────────────────────────── */}
            {(() => {
              const memberFirstLast = `${memberRaw.firstName ?? ""} ${memberRaw.lastName ?? ""}`.toLowerCase().trim();
              const myHosting = hostingSchedule.filter(h => h.hostMember.toLowerCase().includes(memberFirstLast) && memberFirstLast.length > 0);
              if (myHosting.length === 0) return null;
              return (
                <>
                  <div className="member-view-page__section-divider"><span>Hosting Schedule</span></div>
                  <div className="member-view-page__hosting-list">
                    {myHosting.sort((a, b) => a.year !== b.year ? b.year - a.year : b.month - a.month).map(h => (
                      <div key={h.id} className="member-view-page__hosting-item">
                        <FiCalendar size={15} />
                        <span>{MONTH_NAMES[h.month - 1]} {h.year}</span>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}

            <div className="member-view-page__action-row">
              <button type="button" className="member-view-page__outline-button" onClick={handleOpenEditMemberModal}>
                <FiEdit2 size={16} />
                <span>Edit Member</span>
              </button>
              <button type="button" className="member-view-page__outline-button" onClick={handleOpenAddTransactionModal}>
                <FiCreditCard size={16} />
                <span>Add Transaction</span>
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
              {(memberLoading || txLoading)
                ? "Loading..."
                : `${unifiedPayments.length} payment record${unifiedPayments.length !== 1 ? "s" : ""}`}
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
                      <th>Period / Date</th>
                      <th>Title</th>
                      <th>Amount Paid</th>
                      <th>Status</th>
                      <th>Source</th>
                      <th>Payment Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(memberLoading || txLoading) ? (
                      <tr>
                        <td colSpan={7} className="member-view-page__table-state">
                          Loading payment history...
                        </td>
                      </tr>
                    ) : !unifiedPayments.length ? (
                      <tr>
                        <td colSpan={7} className="member-view-page__table-state">
                          No payments recorded yet.
                        </td>
                      </tr>
                    ) : (
                      unifiedPayments.map((payment) => (
                        <tr key={`${payment.source}-${payment.id}`}>
                          <td data-label="Period / Date">{payment.period}</td>
                          <td data-label="Title">{payment.title}</td>
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
                          <td data-label="Source">
                            <span
                              className={[
                                "admin-dashboard__status-pill",
                                payment.source === "transaction" ? "is-info" : "is-neutral",
                              ].join(" ")}
                              title={payment.source === "transaction" ? "Recorded via transaction form" : "Recorded as monthly dues"}
                            >
                              {payment.source === "transaction" ? "Transaction" : "Dues Record"}
                            </span>
                          </td>
                          <td data-label="Payment Date">{payment.paymentDate}</td>
                          <td data-label="Action">
                            <div
                              className="member-page__action-wrap"
                              ref={openMenuId === payment.id ? actionMenuRef : null}
                            >
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
                                <div className="member-page__action-menu" role="menu" style={{ right: 0, left: "auto" }}>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="member-page__action-item"
                                    onClick={() => handleEditPaymentPrompt(payment)}
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

      {isAddTransactionModalOpen && (
        <div className="admin-dashboard__modal" role="dialog" aria-modal="true" aria-labelledby="add-transaction-modal-title">
          <div className="admin-dashboard__modal-backdrop" onClick={handleCloseAddTransactionModal} />

          <div className="admin-dashboard__modal-panel transaction-page__modal-panel">
            <h2 id="add-transaction-modal-title" className="admin-dashboard__modal-title">
              Add Transaction
            </h2>

            {addTransactionError && (
              <div className="admin-dashboard__modal-error">{addTransactionError}</div>
            )}

            <div className="transaction-page__modal-grid">
              {/* ── Title ─────────────────────────────────────────── */}
              <div className="admin-dashboard__modal-section">
                <label htmlFor="mv-transaction-title" className="admin-dashboard__modal-label">
                  Title *
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain transaction-page__modal-select-wrap">
                  <select
                    id="mv-transaction-title"
                    value={addTransactionForm.title}
                    onChange={(event) => handleAddTransactionFormChange("title", event.target.value)}
                    aria-label="Transaction title"
                    className={addTransactionForm.title ? "has-value" : ""}
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
                <label htmlFor="mv-transaction-description" className="admin-dashboard__modal-label">
                  Description (Optional)
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain">
                  <input
                    id="mv-transaction-description"
                    value={addTransactionForm.description}
                    onChange={(event) => handleAddTransactionFormChange("description", event.target.value)}
                    placeholder="Add a note"
                    aria-label="Transaction description"
                  />
                </div>
              </div>

              {/* ── Amount ────────────────────────────────────────── */}
              <div className="admin-dashboard__modal-section">
                <label htmlFor="mv-transaction-amount" className="admin-dashboard__modal-label">
                  Amount *
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain">
                  <input
                    id="mv-transaction-amount"
                    type="number"
                    inputMode="decimal"
                    value={addTransactionForm.amount}
                    onChange={(event) => handleAddTransactionFormChange("amount", event.target.value)}
                    placeholder="100"
                    aria-label="Transaction amount"
                  />
                </div>
              </div>

              {/* ── Payment Date ──────────────────────────────────── */}
              <div className="admin-dashboard__modal-section">
                <label htmlFor="mv-transaction-payment-date" className="admin-dashboard__modal-label">
                  Payment Date *
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain">
                  <input
                    id="mv-transaction-payment-date"
                    type="date"
                    value={addTransactionForm.paymentDate}
                    onChange={(event) => handleAddTransactionFormChange("paymentDate", event.target.value)}
                    aria-label="Payment date"
                  />
                </div>
              </div>
            </div>

            <div className="admin-dashboard__modal-actions">
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--secondary"
                onClick={handleCloseAddTransactionModal}
                disabled={addTransactionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--primary"
                onClick={handleSaveAddTransaction}
                disabled={
                  !addTransactionForm.title.trim() ||
                  !addTransactionForm.amount.toString().trim() ||
                  !addTransactionForm.paymentDate.trim() ||
                  addTransactionLoading
                }
              >
                {addTransactionLoading ? "Saving..." : "Save Transaction"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditPaymentModalOpen && paymentToEdit && (
        <div className="admin-dashboard__modal" role="dialog" aria-modal="true" aria-labelledby="edit-payment-modal-title">
          <div className="admin-dashboard__modal-backdrop" onClick={() => setIsEditPaymentModalOpen(false)} />

          <div className="admin-dashboard__modal-panel transaction-page__modal-panel">
            <h2 id="edit-payment-modal-title" className="admin-dashboard__modal-title">
              Edit Payment — {paymentToEdit.period}
            </h2>

            {editPaymentError && (
              <div className="admin-dashboard__modal-error">{editPaymentError}</div>
            )}

            <div className="transaction-page__modal-grid">
              {/* Amount — shown for both sources */}
              <div className="admin-dashboard__modal-section">
                <label htmlFor="edit-payment-amount" className="admin-dashboard__modal-label">
                  Amount Paid *
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input">
                  <input
                    id="edit-payment-amount"
                    type="number"
                    inputMode="decimal"
                    value={editPaymentForm.amount}
                    onChange={(e) => setEditPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="0"
                    aria-label="Amount paid"
                  />
                </div>
              </div>

              {/* Due-specific: Month + Year */}
              {paymentToEdit.source === "due" && (
                <>
                  <div className="admin-dashboard__modal-section">
                    <label htmlFor="edit-payment-month" className="admin-dashboard__modal-label">
                      Month
                    </label>
                    <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input member-view-page__modal-select-wrap">
                      <select
                        id="edit-payment-month"
                        value={editPaymentForm.month}
                        onChange={(e) => setEditPaymentForm((f) => ({ ...f, month: e.target.value }))}
                        aria-label="Payment month"
                        className={editPaymentForm.month ? "has-value" : ""}
                      >
                        <option value="">Select month</option>
                        {MONTH_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="admin-dashboard__modal-section">
                    <label htmlFor="edit-payment-year" className="admin-dashboard__modal-label">
                      Year
                    </label>
                    <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input member-view-page__modal-select-wrap">
                      <select
                        id="edit-payment-year"
                        value={editPaymentForm.year}
                        onChange={(e) => setEditPaymentForm((f) => ({ ...f, year: e.target.value }))}
                        aria-label="Payment year"
                        className="has-value"
                      >
                        {YEAR_OPTIONS.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Transaction-specific: Date + Title + Description */}
              {paymentToEdit.source === "transaction" && (
                <>
                  <div className="admin-dashboard__modal-section">
                    <label htmlFor="edit-tx-date" className="admin-dashboard__modal-label">
                      Payment Date
                    </label>
                    <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input">
                      <input
                        id="edit-tx-date"
                        type="date"
                        value={editPaymentForm.paymentDate}
                        onChange={(e) => setEditPaymentForm((f) => ({ ...f, paymentDate: e.target.value }))}
                        aria-label="Payment date"
                      />
                    </div>
                  </div>
                  <div className="admin-dashboard__modal-section">
                    <label htmlFor="edit-tx-title" className="admin-dashboard__modal-label">
                      Title
                    </label>
                    <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input member-view-page__modal-select-wrap">
                      <select
                        id="edit-tx-title"
                        value={editPaymentForm.title}
                        onChange={(e) => setEditPaymentForm((f) => ({ ...f, title: e.target.value }))}
                        aria-label="Transaction title"
                        className={editPaymentForm.title ? "has-value" : ""}
                      >
                        {TRANSACTION_TITLE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="admin-dashboard__modal-section">
                    <label htmlFor="edit-tx-description" className="admin-dashboard__modal-label">
                      Description (Optional)
                    </label>
                    <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input">
                      <input
                        id="edit-tx-description"
                        value={editPaymentForm.description}
                        onChange={(e) => setEditPaymentForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Add a note"
                        aria-label="Description"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="admin-dashboard__modal-actions">
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--secondary"
                onClick={() => setIsEditPaymentModalOpen(false)}
                disabled={editPaymentLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-dashboard__modal-button admin-dashboard__modal-button--primary"
                onClick={handleSaveEditPayment}
                disabled={!editPaymentForm.amount.trim() || editPaymentLoading}
              >
                {editPaymentLoading ? "Saving..." : "Save Changes"}
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
              <p>Are you sure you want to delete the payment record for <strong>{paymentToDelete.period}</strong>?</p>
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
              {/* Title */}
              <div className="admin-dashboard__modal-section">
                <label htmlFor="member-profile-title" className="admin-dashboard__modal-label" id="member-profile-edit-modal-title">
                  Edit Member
                </label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input">
                  <input
                    id="member-profile-title"
                    value={editMemberForm.title}
                    onChange={(event) => handleEditMemberChange("title", event.target.value)}
                    placeholder="e.g. Dr, Mr, Mrs"
                    aria-label="Title or prefix"
                  />
                </div>
              </div>

              <div className="admin-dashboard__modal-section">
                <label htmlFor="member-profile-fname" className="admin-dashboard__modal-label">
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

              {/* WhatsApp */}
              <div className="admin-dashboard__modal-section">
                <label htmlFor="member-profile-whatsapp" className="admin-dashboard__modal-label">WhatsApp</label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input">
                  <input
                    id="member-profile-whatsapp"
                    type="tel"
                    value={editMemberForm.whatsapp}
                    onChange={(event) => handleEditMemberChange("whatsapp", event.target.value)}
                    placeholder="WhatsApp number"
                    aria-label="WhatsApp"
                  />
                </div>
              </div>

              {/* Facebook */}
              <div className="admin-dashboard__modal-section">
                <label htmlFor="member-profile-facebook" className="admin-dashboard__modal-label">Facebook</label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input">
                  <input
                    id="member-profile-facebook"
                    value={editMemberForm.facebook}
                    onChange={(event) => handleEditMemberChange("facebook", event.target.value)}
                    placeholder="Facebook profile"
                    aria-label="Facebook"
                  />
                </div>
              </div>

              {/* Insurance */}
              <div className="admin-dashboard__modal-section">
                <label htmlFor="member-profile-insurance" className="admin-dashboard__modal-label">Insurance</label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input">
                  <input
                    id="member-profile-insurance"
                    value={editMemberForm.insurance}
                    onChange={(event) => handleEditMemberChange("insurance", event.target.value)}
                    placeholder="Insurance policy / provider"
                    aria-label="Insurance"
                  />
                </div>
              </div>

              {/* Good Standing */}
              <div className="admin-dashboard__modal-section">
                <label htmlFor="member-profile-good-standing" className="admin-dashboard__modal-label">Good Standing</label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input">
                  <input
                    id="member-profile-good-standing"
                    value={editMemberForm.goodStanding}
                    onChange={(event) => handleEditMemberChange("goodStanding", event.target.value)}
                    placeholder="e.g. Good Standing"
                    aria-label="Good Standing"
                  />
                </div>
              </div>

              {/* Financial Good Standing */}
              <div className="admin-dashboard__modal-section">
                <label htmlFor="member-profile-fin-standing" className="admin-dashboard__modal-label">Financial Standing</label>
                <div className="admin-dashboard__modal-input admin-dashboard__modal-input--plain member-view-page__modal-input">
                  <input
                    id="member-profile-fin-standing"
                    value={editMemberForm.financialGoodStanding}
                    onChange={(event) => handleEditMemberChange("financialGoodStanding", event.target.value)}
                    placeholder="e.g. Good Financial Standing"
                    aria-label="Financial Good Standing"
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
