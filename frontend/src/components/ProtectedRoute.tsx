import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type UserRole } from "../lib/AuthContext";

export default function ProtectedRoute({
  children,
  roles,
  loginPath = "/login",
}: {
  children: ReactNode;
  roles?: UserRole[];
  loginPath?: string;
}) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user || (roles && !roles.includes(user.role))) {
    return <Navigate to={loginPath} state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
