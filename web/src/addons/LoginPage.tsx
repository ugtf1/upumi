import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost, setToken, getAuthClaims } from "./api";

const US_PHONE_PREFIX = "+1";
const RESEND_COOLDOWN_SECONDS = 30;

type RequestOtpResponse = {
  requiresOtp: boolean;
  message?: string;
  token?: string;
  redirectPath?: string;
};

type VerifyOtpResponse = {
  token: string;
  redirectPath: string;
};

export default function LoginPage() {
  const nav = useNavigate();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  function completeLogin(token: string, redirectPath?: string) {
    setToken(token);

    // Decide the destination from the token's own role claim rather than
    // trusting the backend's redirectPath blindly — this guarantees members
    // always land on /member and admins on /admin, even if the backend
    // sends a stale or incorrect redirectPath (e.g. "/analytics").
    const claims = getAuthClaims();
    const role = claims?.role;

    if (role === "ADMIN") {
      nav(redirectPath || "/admin");
      return;
    }

    // Any non-admin (MEMBER, or role missing/unrecognized) always goes to
    // the member dashboard, regardless of what redirectPath says.
    nav("/member");
  }

  function toE164UsPhone(localDigits: string): string {
    return `${US_PHONE_PREFIX}${localDigits}`;
  }

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setNotice(null);
    setLoading(true);

    try {
      const res = await apiPost<RequestOtpResponse>("/auth/request-otp", { phone: toE164UsPhone(phone) });
      if (res.token) {
        completeLogin(res.token, res.redirectPath);
        return;
      }

      setOtpSent(true);
      setNotice("One Time Password sent to your Phone.");
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err ?? "Login failed");
      setErr(message.includes("record not found") ? "record not found" : message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    if (resendCooldown > 0 || resendLoading) return;
    setErr(null);
    setNotice(null);
    setResendLoading(true);

    try {
      const res = await apiPost<RequestOtpResponse>("/auth/request-otp", { phone: toE164UsPhone(phone) });
      if (res.token) {
        completeLogin(res.token, res.redirectPath);
        return;
      }
      setNotice("One Time Password sent to your Phone.");
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err: unknown) {
      setErr(err instanceof Error ? err.message : String(err ?? "Failed to resend OTP"));
    } finally {
      setResendLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const res = await apiPost<VerifyOtpResponse>("/auth/verify-otp", { phone: toE164UsPhone(phone), otp });
      completeLogin(res.token, res.redirectPath);
    } catch (err: unknown) {
      setErr(err instanceof Error ? err.message : String(err ?? "OTP verification failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h2 style={{ fontSize: 24, marginBottom: 12 }}>UPUMI Login</h2>

      <form onSubmit={otpSent ? verifyOtp : requestOtp}>
        <label style={{ display: "block", marginBottom: 8 }}>
          Phone number
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0 10px",
                border: "1px solid #ccc",
                borderRadius: 4,
                background: "#f5f5f5",
                fontWeight: 600,
                color: "#333",
              }}
            >
              {US_PHONE_PREFIX}
            </span>
            <input
              style={{ flex: 1, padding: 10 }}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              autoComplete="tel"
              disabled={otpSent}
              inputMode="numeric"
              maxLength={10}
              placeholder="2025550123"
            />
          </div>
        </label>

        {otpSent && (
          <label style={{ display: "block", marginBottom: 8 }}>
            OTP
            <input
              style={{ width: "100%", padding: 10, marginTop: 6 }}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              autoComplete="one-time-code"
              inputMode="numeric"
              placeholder="Enter 6-digit code"
            />
          </label>
        )}

        {notice && (
          <div style={{ margin: "12px 0", padding: 10, border: "1px solid #cfe8d8", color: "#166445" }}>
            {notice}
          </div>
        )}

        {err && (
          <div style={{ margin: "12px 0", padding: 10, border: "1px solid #f0c7c4", color: "#9c2f29" }}>
            {err}
          </div>
        )}

        <button type="submit" disabled={loading || phone.length !== 10 || (otpSent && otp.length !== 6)} style={{ width: "100%", padding: 12, marginTop: 8 }}>
          {loading ? "Please wait..." : otpSent ? "Verify OTP" : "Send OTP"}
        </button>

        {otpSent && (
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={resendCooldown > 0 || resendLoading}
            style={{ width: "100%", padding: 12, marginTop: 8 }}
          >
            {resendLoading
              ? "Resending..."
              : resendCooldown > 0
              ? `Resend OTP in ${resendCooldown}s`
              : "Resend OTP"}
          </button>
        )}

        {otpSent && (
          <button
            type="button"
            onClick={() => {
              setOtpSent(false);
              setOtp("");
              setNotice(null);
              setErr(null);
              setResendCooldown(0);
            }}
            style={{ width: "100%", padding: 12, marginTop: 8 }}
          >
            Use another phone number
          </button>
        )}
      </form>
    </div>
  );
}
