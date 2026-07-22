import { Navigate } from "react-router-dom";
import { getAuthClaims, getToken } from "./api";

export default function RequireAuth({ children }: { children: JSX.Element }) {
  const token = getToken();
  if (!token) return <Navigate to="/login" replace />;

  const claims = getAuthClaims();
  if (claims?.needsPasswordChange) {
    return <Navigate to="/change-password" replace />;
  }

  return children;
}
