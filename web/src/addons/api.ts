const rawBase = (import.meta as unknown as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE;
const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
const defaultBase = isLocalhost ? "/api" : "https://upumi-api-30228073381.us-east1.run.app/api";
const normalizedBase = (rawBase ?? defaultBase).trim().replace(/\/+$/, "");
export const API_BASE = normalizedBase || defaultBase;

const TOKEN_KEY = "upumi_token";
type Role = "ADMIN" | "MEMBER";

type AuthClaims = {
  sub?: string;
  phone?: string;
  email?: string;
  role?: Role;
  needsPasswordChange?: boolean;
};

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function decodeClaims(token: string): AuthClaims | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(normalized);
    return JSON.parse(json) as AuthClaims;
  } catch {
    return null;
  }
}

export function getAuthClaims(): AuthClaims | null {
  const token = getToken();
  if (!token) return null;
  return decodeClaims(token);
}

async function readErrorBody(res: Response): Promise<string> {
  try {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const j = await res.json().catch(() => null);
      return j ? JSON.stringify(j) : "(invalid json)";
    }
    const t = await res.text().catch(() => "");
    return t.slice(0, 300);
  } catch {
    return "(no body)";
  }
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const hasBody = init?.body != null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      // Only send Content-Type when there's an actual body.
      // Sending it on bodyless requests (DELETE, GET) causes Fastify to
      // respond with 400 FAST_ERR_CTP_EMPTY_BODY.
      ...(hasBody ? { "content-type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const ct = res.headers.get("content-type") || "";

  // Success responses with no body (e.g. 204 No Content) are fine
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return { ok: true } as unknown as T;
  }

  // If backend accidentally returns index.html, this will catch it clearly
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Expected JSON but got "${ct || "unknown"}" from ${path}. First bytes: ${text.slice(0, 80)}`
    );
  }

  if (!res.ok) {
    const body = await readErrorBody(res);
    throw new Error(`API error ${res.status} for ${path}: ${body}`);
  }

  return (await res.json()) as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  return fetchJson<T>(path, { method: "GET" });
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return fetchJson<T>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return fetchJson<T>(path, {
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiDelete<T>(path: string): Promise<T> {
  return fetchJson<T>(path, { method: "DELETE" });
}

// ── Member-facing API helpers ─────────────────────────────────────────────────

// GET /me/profile — returns the logged-in member's profile, linked MemberRecord,
// and all their MonthlyDue rows.
export async function getMemberProfile(): Promise<unknown> {
  return apiGet<unknown>("/me/profile");
}

// GET /analytics/summary?year=YYYY — org-wide KPIs: total members, active count,
// dues totals, membership mix breakdown.
export async function getAnalyticsSummary(year: number): Promise<unknown> {
  return apiGet<unknown>(`/analytics/summary?year=${year}`);
}

// GET /analytics/ledger-summary?year=YYYY — the exact same endpoint the admin
// dashboard calls, so member and admin dashboards always show identical figures.
export async function getLedgerSummary(year: number): Promise<unknown> {
  return apiGet<unknown>(`/analytics/ledger-summary?year=${year}`);
}

// GET /analytics/monthly?year=YYYY&month=MM — single-month breakdown.
export async function getMonthlyReport(year: number, month: number): Promise<unknown> {
  return apiGet<unknown>(`/analytics/monthly?year=${year}&month=${month}`);
}

// GET /me/members — read-only, member-safe mirror of admin's member list.
// Any signed-in user (member or admin) can call this; it returns the same
// merged MemberRecord + orphan User list as /admin/members, so counts match.
export async function getMemberSafeMemberList(): Promise<unknown[]> {
  return apiGet<unknown[]>("/me/members");
}

// GET /members/database/hostingSchedule — member-safe read of the hosting
// schedule table (memberDatabaseRoutes on the backend requires only login,
// not the ADMIN role).
export async function getHostingSchedule(): Promise<unknown[]> {
  return apiGet<unknown[]>("/members/database/hostingSchedule");
}

// GET /members/database/transactions — member-safe read of all transactions.
export async function getAllTransactionsReadOnly(): Promise<unknown[]> {
  return apiGet<unknown[]>("/members/database/transactions");
}

// GET /members/database/expenses — member-safe read of all expenses.
export async function getAllExpensesReadOnly(): Promise<unknown[]> {
  return apiGet<unknown[]>("/members/database/expenses");
}

// GET /members/database/dues — member-safe read of all monthly dues.
export async function getAllDuesReadOnly(): Promise<unknown[]> {
  return apiGet<unknown[]>("/members/database/dues");
}

// GET /members/database/attendance — member-safe read of all attendance records.
export async function getAllAttendanceReadOnly(): Promise<unknown[]> {
  return apiGet<unknown[]>("/members/database/attendance");
}

export type YearlyBalanceApiRow = {
  id: string;
  year: number;
  balance: number | string;
};

export async function getYearlyBalancesReadOnly(): Promise<YearlyBalanceApiRow[]> {
  return apiGet<YearlyBalanceApiRow[]>("/members/database/yearlyBalances");
}

export async function saveYearlyBalance(payload: { id?: string; year: number; balance: number }): Promise<YearlyBalanceApiRow> {
  if (payload.id) {
    return apiPatch<YearlyBalanceApiRow>(`/admin/database/yearlyBalances/${payload.id}`, payload);
  } else {
    return apiPost<YearlyBalanceApiRow>("/admin/database/yearlyBalances", payload);
  }
}

export async function deleteYearlyBalance(id: string): Promise<{ ok: boolean }> {
  return apiDelete<{ ok: boolean }>(`/admin/database/yearlyBalances/${id}`);
}

// ── Member Yearly Balance (per-member, linked to MemberRecord) ───────────────

export type MemberYearlyBalanceApiRow = {
  id: string;
  memberRecordId: string;
  year: number;
  balance: number | string;
};

/** Member-safe: returns only the logged-in member's own yearly balance records. */
export async function getMemberYearlyBalances(): Promise<MemberYearlyBalanceApiRow[]> {
  return apiGet<MemberYearlyBalanceApiRow[]>("/members/database/memberYearlyBalances");
}

/** Admin: fetch ALL member yearly balances (filtered by memberRecordId in the UI). */
export async function getAllMemberYearlyBalances(): Promise<MemberYearlyBalanceApiRow[]> {
  return apiGet<MemberYearlyBalanceApiRow[]>("/admin/database/memberYearlyBalances");
}

/** Admin: create or update a member yearly balance record. */
export async function saveMemberYearlyBalance(payload: {
  id?: string;
  memberRecordId: string;
  year: number;
  balance: number;
}): Promise<MemberYearlyBalanceApiRow> {
  if (payload.id) {
    return apiPatch<MemberYearlyBalanceApiRow>(
      `/admin/database/memberYearlyBalances/${payload.id}`,
      { balance: payload.balance }
    );
  }
  return apiPost<MemberYearlyBalanceApiRow>("/admin/database/memberYearlyBalances", payload);
}

/** Admin: delete a member yearly balance record. */
export async function deleteMemberYearlyBalance(id: string): Promise<{ ok: boolean }> {
  return apiDelete<{ ok: boolean }>(`/admin/database/memberYearlyBalances/${id}`);
}

// ── Meeting API helpers ───────────────────────────────────────────────────────

export type Meeting = {
  id: string;
  title: string;
  date: string;
  transcription: string;
  summary: string;
  createdAt: string;
};

export type MemberMeeting = {
  id: string;
  title: string;
  date: string;
  summary: string;
  createdAt: string;
};

// GET /admin/meetings — returns all meetings (admin only)
export async function getMeetings(): Promise<Meeting[]> {
  return apiGet<Meeting[]>("/admin/meetings");
}

// GET /members/meetings — member-safe read-only list
export async function getMemberMeetings(): Promise<MemberMeeting[]> {
  return apiGet<MemberMeeting[]>("/members/meetings");
}

// POST /admin/meetings — saves meeting, triggers Gemini summarisation
export async function saveMeeting(payload: {
  title: string;
  transcript: string;
  date?: string;
}): Promise<Meeting> {
  return apiPost<Meeting>("/admin/meetings", payload);
}

// DELETE /admin/meetings/:id — deletes meeting (admin only)
export async function deleteMeeting(id: string): Promise<{ ok: boolean }> {
  return apiDelete<{ ok: boolean }>(`/admin/meetings/${encodeURIComponent(id)}`);
}