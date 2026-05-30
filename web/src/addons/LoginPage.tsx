import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiPost, setToken } from "./api";

type LoginResponse = { token: string };

export default function LoginPage() {
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
      // backend should support POST /api/auth/login
      const res = await apiPost<LoginResponse>("/auth/login", { email, password });
      setToken(res.token);
      nav("/analytics");
    } catch (e: any) {
      setErr(e?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h2 style={{ fontSize: 24, marginBottom: 12 }}>Member Login</h2>
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
          Password
          <input
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        {err && (
          <div style={{ margin: "12px 0", padding: 10, border: "1px solid #ccc" }}>
            {err}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{ width: "100%", padding: 12, marginTop: 8 }}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <div style={{ marginTop: 12 }}>
        Need an account? <Link to="/register">Create member account</Link>
      </div>
    </div>
  );
}
