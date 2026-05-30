import { Navigate } from "react-router-dom";
import { getAuthClaims, getToken } from "./api";

export default function RequireAdmin({ children }: { children: JSX.Element }) {
  const token = getToken();
  if (!token) return <Navigate to="/login" replace />;

  const claims = getAuthClaims();
  if (claims?.role !== "ADMIN") return <Navigate to="/analytics" replace />;

  return children;
}
