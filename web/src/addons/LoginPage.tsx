import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost, setToken, getAuthClaims } from "./api";

type CountryOption = { code: string; flag: string; label: string };

const COUNTRY_OPTIONS: CountryOption[] = [
  { code: "+1", flag: "🇺🇸", label: "US" },
  { code: "+234", flag: "🇳🇬", label: "Nigeria" },
];

type LoginResponse = {
  token: string;
  redirectPath: string;
  user: {
    id: string;
    phone: string;
    email: string | null;
    role: string;
    needsPasswordChange: boolean;
  };
};

export default function LoginPage() {
  const nav = useNavigate();
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState(COUNTRY_OPTIONS[0].code);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toE164Phone(localDigits: string): string {
    return `${countryCode}${localDigits}`;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const res = await apiPost<LoginResponse>("/auth/login", {
        phone: toE164Phone(phone),
        password,
      });

      setToken(res.token);

      const claims = getAuthClaims();
      if (claims?.needsPasswordChange) {
        nav("/change-password");
        return;
      }

      if (claims?.role === "ADMIN") {
        nav(res.redirectPath || "/admin");
      } else {
        nav("/member");
      }
    } catch (e: unknown) {
      const rawMessage = e instanceof Error ? e.message : String(e ?? "Login failed");
      let displayMessage = rawMessage;

      // Extract a cleaner message if it contains Fastify API error structure
      if (rawMessage.startsWith("API error")) {
        try {
          const jsonStr = rawMessage.substring(rawMessage.indexOf("{"));
          const parsed = JSON.parse(jsonStr);
          displayMessage = parsed.message || displayMessage;
        } catch {
          // ignore parsing error, use rawMessage
        }
      }

      if (displayMessage.includes("record not found")) {
        setErr("Phone number not registered. Please contact your admin.");
      } else {
        setErr(displayMessage);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "80vh",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#ffffff",
          borderRadius: 16,
          boxShadow: "0 8px 30px rgba(0,0,0,0.1)",
          border: "1px solid #eaeaea",
          padding: 32,
          color: "#333",
        }}
      >
        <h2
          style={{
            fontSize: 28,
            fontWeight: 700,
            marginBottom: 8,
            color: "#0c4a34",
            textAlign: "center",
          }}
        >
          UPUMI Login
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "#666",
            textAlign: "center",
            marginBottom: 28,
          }}
        >
          Welcome back! Sign in to access your dashboard.
        </p>

        {err && (
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: "#fdf2f2",
              border: "1px solid #fde8e8",
              color: "#9c2f29",
              fontSize: 14,
              marginBottom: 20,
            }}
          >
            {err}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontWeight: 600, fontSize: 14 }}>
            Phone number
            <div style={{ display: "flex", gap: 8 }}>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                aria-label="Country code"
                style={{
                  padding: "0 12px",
                  border: "1px solid #ccc",
                  borderRadius: 8,
                  background: "#f9f9f9",
                  fontWeight: 600,
                  color: "#333",
                  outline: "none",
                }}
              >
                {COUNTRY_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.flag} {option.code}
                  </option>
                ))}
              </select>
              <input
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  fontSize: 15,
                  outline: "none",
                }}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                autoComplete="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="2025550123"
                required
              />
            </div>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontWeight: 600, fontSize: 14 }}>
            Password
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                padding: 12,
                borderRadius: 8,
                border: "1px solid #ccc",
                fontSize: 15,
                outline: "none",
              }}
              required
            />
          </label>

          <button
            type="submit"
            disabled={loading || phone.length !== 10 || !password}
            style={{
              background: phone.length === 10 && password ? "#186F51" : "#a8d3c5",
              color: "#ffffff",
              border: "none",
              padding: "14px 20px",
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: phone.length === 10 && password ? "pointer" : "not-allowed",
              transition: "background 0.2s",
              marginTop: 10,
            }}
          >
            {loading ? "Please wait..." : "Sign In"}
          </button>

          <div
            style={{
              marginTop: 24,
              fontSize: 12,
              color: "#666",
              textAlign: "center",
              borderTop: "1px solid #eaeaea",
              paddingTop: 20,
              lineHeight: 1.6,
            }}
          >
            <p style={{ margin: "0 0 6px 0" }}>
              UPUMI Support: For assistance, please contact our team at{" "}
              <a href="mailto:support@upumi.com" style={{ color: "#186F51", textDecoration: "none", fontWeight: 600 }}>
                support@upumi.com
              </a>
              .
            </p>
            <p style={{ margin: 0 }}>
              Visit us at{" "}
              <a
                href="https://upumi.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#186F51", textDecoration: "none", fontWeight: 600 }}
              >
                upumi.com
              </a>
              .
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
