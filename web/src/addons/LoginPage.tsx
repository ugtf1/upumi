import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost, setToken } from "./api";

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

  function completeLogin(token: string, redirectPath?: string) {
    setToken(token);
    nav(redirectPath || "/member");
  }

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setNotice(null);
    setLoading(true);

    try {
      const res = await apiPost<RequestOtpResponse>("/auth/request-otp", { phone });
      if (res.token) {
        completeLogin(res.token, res.redirectPath);
        return;
      }

      setOtpSent(true);
      setNotice(res.message || "OTP sent");
    } catch (e: unknown) {
      const message = String((e as Error)?.message ?? "Login failed");
      setErr(message.includes("record not found") ? "record not found" : message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const res = await apiPost<VerifyOtpResponse>("/auth/verify-otp", { phone, otp });
      completeLogin(res.token, res.redirectPath);
    } catch (e: unknown) {
      setErr((e as Error)?.message ?? "OTP verification failed");
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
          <input
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            disabled={otpSent}
            placeholder="Phone Number"
          />
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

        <button type="submit" disabled={loading || !phone.trim() || (otpSent && otp.length !== 6)} style={{ width: "100%", padding: 12, marginTop: 8 }}>
          {loading ? "Please wait..." : otpSent ? "Verify OTP" : "Send OTP"}
        </button>

        {otpSent && (
          <button
            type="button"
            onClick={() => {
              setOtpSent(false);
              setOtp("");
              setNotice(null);
              setErr(null);
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
