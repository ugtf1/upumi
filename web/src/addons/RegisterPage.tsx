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
          <input
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
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
