
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export function getToken(): string | null {
  return localStorage.getItem("upumi_token");
}

export async function apiGet<T>(path: string): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}
