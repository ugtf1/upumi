import { useState } from "react";
import { Link } from "react-router-dom";

type CountryOption = { code: string; flag: string; label: string };

const COUNTRY_OPTIONS: CountryOption[] = [
  { code: "+1", flag: "🇺🇸", label: "US" },
  { code: "+234", flag: "🇳🇬", label: "Nigeria" },
];

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState(COUNTRY_OPTIONS[0].code);
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [consent, setConsent] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Dormant form: do not send to database
  }

  return (
    <div style={{ maxWidth: 460, margin: "40px auto", padding: 16, color: "#111" }}>
      <h2 style={{ fontSize: 24, marginBottom: 12 }}>Create Member Account</h2>
      <p style={{ marginBottom: 12, color: "#444" }}>
        Use the same email that appears in the member workbook to auto-link your record.
      </p>
      <form onSubmit={onSubmit}>
        <label style={{ display: "block", marginBottom: 8 }}>
          Name
          <input
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </label>

        <label style={{ display: "block", marginBottom: 8 }}>
          Phone number
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              aria-label="Country code"
              style={{
                padding: "0 8px",
                border: "1px solid #ccc",
                borderRadius: 4,
                background: "#f5f5f5",
                fontWeight: 600,
                color: "#333",
              }}
            >
              {COUNTRY_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.flag} {option.code}
                </option>
              ))}
            </select>
            <input
              style={{ flex: 1, padding: 10 }}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              autoComplete="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="2025550123"
            />
          </div>
        </label>

        <label style={{ display: "block", marginBottom: 8 }}>
          Address
          <input
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            autoComplete="street-address"
          />
        </label>

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
          <div style={{ position: "relative", display: "flex", width: "100%", marginTop: 6 }}>
            <input
              style={{ width: "100%", padding: 10, paddingRight: 40, boxSizing: "border-box" }}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                color: "#666",
              }}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                  <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                  <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                  <line x1="2" y1="2" x2="22" y2="22" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </label>

        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 12, marginBottom: 12, fontSize: 12, lineHeight: 1.4, color: "#555" }}>
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            style={{ marginTop: 2 }}
          />
          <span>
            By creating an account, you agree to receive recurring OTP text messages from Urhobo Global Tech Foundation to authenticate your account. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe or HELP for support. You can read our <a href="/privacy-policy" target="_blank" rel="noreferrer">Privacy Policy</a> and <a href="/terms-of-service" target="_blank" rel="noreferrer">Terms of Service</a>.
          </span>
        </label>

        <button type="submit" disabled={!consent} style={{ width: "100%", padding: 12, marginTop: 8 }}>
          Create account
        </button>

        <div style={{ marginTop: 24, fontSize: 12, color: "#666", textAlign: "center", borderTop: "1px solid #eaeaea", paddingTop: 16 }}>
          <p style={{ margin: "0 0 4px 0" }}>UPUMI Support: For assistance, please contact our team at <a href="mailto:support@upumi.com" style={{ color: "#0066cc", textDecoration: "none" }}>support@upumi.com</a>.</p>
          <p style={{ margin: 0 }}>UPUMI Support: For help, visit <a href="https://upumi.com" target="_blank" rel="noopener noreferrer" style={{ color: "#0066cc", textDecoration: "none" }}>upumi.com</a>.</p>
        </div>
      </form>

      <div style={{ marginTop: 12 }}>
        Already have an account? <Link to="/login">Sign in</Link>
      </div>
    </div>
  );
}
