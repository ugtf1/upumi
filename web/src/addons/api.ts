const rawBase = (import.meta as any)?.env?.VITE_API_BASE as string | undefined;
const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
const defaultBase = isLocalhost ? "/api" : "https://upumi-api-30228073381.us-east1.run.app/api";
const normalizedBase = (rawBase ?? defaultBase).trim().replace(/\/+$/, "");
export const API_BASE = normalizedBase || defaultBase;

const TOKEN_KEY = "upumi_token";
type Role = "ADMIN" | "USER";

type AuthClaims = {
  sub?: string;
  email?: string;
  role?: Role;
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
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const ct = res.headers.get("content-type") || "";

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
