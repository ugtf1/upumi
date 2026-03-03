import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiPost, setToken } from "./api";

type AuthResponse = { token: string };

export default function RegisterPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await apiPost<AuthResponse>("/auth/register", { email, password });
      setToken(res.token);
      nav("/analytics");
    } catch (e: any) {
      setErr(e?.message ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 460, margin: "40px auto", padding: 16, color: "#111" }}>
      <h2 style={{ fontSize: 24, marginBottom: 12 }}>Create Member Account</h2>
      <p style={{ marginBottom: 12, color: "#444" }}>
        Use the same email that appears in the member workbook to auto-link your record.
      </p>
      <form onSubmit={onSubmit}>
        <label style={{ display: "block", marginBottom: 8 }}>
          Email
          <input
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>

        <label style={{ display: "block", marginBottom: 8 }}>
          Password (10+ chars)
          <input
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>

        {err && (
          <div style={{ margin: "12px 0", padding: 10, border: "1px solid #ccc" }}>{err}</div>
        )}

        <button type="submit" disabled={loading} style={{ width: "100%", padding: 12, marginTop: 8 }}>
          {loading ? "Creating..." : "Create account"}
        </button>
      </form>

      <div style={{ marginTop: 12 }}>
        Already have an account? <Link to="/login">Sign in</Link>
      </div>
    </div>
  );
}
