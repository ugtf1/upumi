import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { apiPost, setToken, getAuthClaims, getToken } from "./api";

export default function ChangePasswordPage() {
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Password rules validation states
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const isFormValid =
    hasMinLength &&
    hasUppercase &&
    hasLowercase &&
    hasNumber &&
    hasSpecial &&
    passwordsMatch &&
    currentPassword.length > 0;

  // Guard: if not authenticated, redirect to /login.
  // If authenticated and doesn't need password change, redirect to respective dashboard.
  const token = getToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const claims = getAuthClaims();
  if (!claims?.needsPasswordChange) {
    return <Navigate to={claims?.role === "ADMIN" ? "/admin" : "/member"} replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid || loading) return;

    setErr(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await apiPost<{
        token: string;
        redirectPath: string;
        user: { role: string };
        message?: string;
      }>("/auth/change-password", {
        currentPassword,
        newPassword,
      });

      setSuccess("Password updated successfully! Redirecting...");
      setToken(res.token);

      // Redirect after a short delay to show success state
      setTimeout(() => {
        if (res.user.role === "ADMIN") {
          navigate("/admin");
        } else {
          navigate("/member");
        }
      }, 1500);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e ?? "Failed to update password"));
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
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
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
          Setup Secure Password
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "#666",
            textAlign: "center",
            marginBottom: 28,
          }}
        >
          Your account is currently using a temporary password. Please set a new, secure password to continue.
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

        {success && (
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: "#f3faf7",
              border: "1px solid #def7ec",
              color: "#166445",
              fontSize: 14,
              marginBottom: 20,
            }}
          >
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontWeight: 600, fontSize: 14 }}>
            Current Temporary Password
            <input
              type="password"
              placeholder="Your surname in BLOCK LETTERS"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={loading || !!success}
              style={{
                padding: 12,
                borderRadius: 8,
                border: "1px solid #ccc",
                fontSize: 15,
                outline: "none",
                transition: "border-color 0.2s",
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontWeight: 600, fontSize: 14 }}>
            New Password
            <input
              type="password"
              placeholder="Enter secure password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading || !!success}
              style={{
                padding: 12,
                borderRadius: 8,
                border: "1px solid #ccc",
                fontSize: 15,
                outline: "none",
                transition: "border-color 0.2s",
              }}
            />
          </label>

          {/* Password strength checklist */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              background: "#f9f9f9",
              padding: 16,
              borderRadius: 8,
              border: "1px solid #eee",
              fontSize: 13,
            }}
          >
            <div style={{ fontWeight: 600, color: "#555", marginBottom: 4 }}>Password requirements:</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: hasMinLength ? "#166445" : "#666" }}>
              <span>{hasMinLength ? "✔" : "○"}</span> At least 8 characters
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: hasUppercase ? "#166445" : "#666" }}>
              <span>{hasUppercase ? "✔" : "○"}</span> At least one uppercase letter (A-Z)
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: hasLowercase ? "#166445" : "#666" }}>
              <span>{hasLowercase ? "✔" : "○"}</span> At least one lowercase letter (a-z)
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: hasNumber ? "#166445" : "#666" }}>
              <span>{hasNumber ? "✔" : "○"}</span> At least one number (0-9)
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: hasSpecial ? "#166445" : "#666" }}>
              <span>{hasSpecial ? "✔" : "○"}</span> At least one special character
            </div>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontWeight: 600, fontSize: 14 }}>
            Confirm New Password
            <input
              type="password"
              placeholder="Confirm secure password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading || !!success}
              style={{
                padding: 12,
                borderRadius: 8,
                border: "1px solid #ccc",
                fontSize: 15,
                outline: "none",
                transition: "border-color 0.2s",
              }}
            />
          </label>

          {confirmPassword && (
            <div
              style={{
                fontSize: 13,
                color: passwordsMatch ? "#166445" : "#9c2f29",
                marginTop: -8,
                fontWeight: 500,
              }}
            >
              {passwordsMatch ? "✓ Passwords match" : "✗ Passwords do not match"}
            </div>
          )}

          <button
            type="submit"
            disabled={!isFormValid || loading || !!success}
            style={{
              background: isFormValid && !success ? "#186F51" : "#a8d3c5",
              color: "#ffffff",
              border: "none",
              padding: "14px 20px",
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: isFormValid && !success ? "pointer" : "not-allowed",
              transition: "background 0.2s",
              marginTop: 10,
            }}
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
