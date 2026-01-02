/**
 * ProtectedRoute - Permission-based route protection
 * Uses dynamic permissions from backend (stored in Redux)
 */

import { Navigate, Outlet, useLocation } from "react-router";
import { useAppSelector } from "@/app/hooks";

/**
 * Route to permission mapping
 */
const routePermissions = {
  "/": "dashboard.view",
  "/customers": "customers.view",
  "/customers/new": "customers.create",
  "/customers/:id": "customers.view",
  "/customers/:id/edit": "customers.edit",
  "/pledges": "pledges.view",
  "/pledges/new": "pledges.create",
  "/pledges/:id": "pledges.view",
  "/renewals": "renewals.view",
  "/redemptions": "redemptions.view",
  "/inventory": "inventory.view",
  "/inventory/rack-map": "storage.view",
  "/inventory/reconciliation": "reconciliation.view",
  "/auctions": "auctions.view",
  "/reports": "reports.view",
  "/reports/day-end": "dayend.view",
  "/settings": "settings.view",
  "/settings/users": "users.view",
  "/settings/users/new": "users.create",
  "/settings/users/:id/edit": "users.edit",
  "/settings/audit-log": "audit.view",
  "/settings/whatsapp": "whatsapp.view",
};

/**
 * Match dynamic routes like /customers/:id
 */
const matchRoute = (path, pattern) => {
  const pathParts = path.split("/").filter(Boolean);
  const patternParts = pattern.split("/").filter(Boolean);

  if (pathParts.length !== patternParts.length) return false;

  return patternParts.every((part, i) => {
    if (part.startsWith(":")) return true;
    return part === pathParts[i];
  });
};

/**
 * Get required permission for a path
 */
const getRequiredPermission = (path) => {
  if (routePermissions[path]) return routePermissions[path];

  for (const [pattern, permission] of Object.entries(routePermissions)) {
    if (matchRoute(path, pattern)) return permission;
  }

  return null;
};

/**
 * Check if user has permission
 */
const hasPermission = (permissions, requiredPermission, roleSlug) => {
  if (roleSlug === "super-admin") return true;
  if (!requiredPermission) return true;
  if (!permissions || !Array.isArray(permissions)) return false;
  return permissions.includes(requiredPermission);
};

export default function ProtectedRoute({
  children,
  permission = null,
  fallback = "/",
}) {
  const location = useLocation();
  const { isAuthenticated, role, permissions } = useAppSelector(
    (state) => state.auth
  );

  const roleSlug = role?.slug || role || "";

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const requiredPermission =
    permission || getRequiredPermission(location.pathname);

  if (hasPermission(permissions, requiredPermission, roleSlug)) {
    return children || <Outlet />;
  }

  console.warn(
    `Access denied: ${location.pathname} requires ${requiredPermission}`
  );
  return <Navigate to={fallback} replace />;
}

/**
 * Hook: Check permission programmatically
 */
export const usePermission = (permission) => {
  const { role, permissions } = useAppSelector((state) => state.auth);
  const roleSlug = role?.slug || role || "";

  if (roleSlug === "super-admin") return true;
  if (!permission) return true;
  if (!permissions || !Array.isArray(permissions)) return false;

  return permissions.includes(permission);
};

/**
 * Hook: Check multiple permissions
 */
export const usePermissions = (...permissionList) => {
  const { role, permissions } = useAppSelector((state) => state.auth);
  const roleSlug = role?.slug || role || "";

  if (roleSlug === "super-admin") {
    return permissionList.reduce((acc, p) => ({ ...acc, [p]: true }), {});
  }

  if (!permissions || !Array.isArray(permissions)) {
    return permissionList.reduce((acc, p) => ({ ...acc, [p]: false }), {});
  }

  return permissionList.reduce(
    (acc, p) => ({
      ...acc,
      [p]: permissions.includes(p),
    }),
    {}
  );
};

/**
 * Hook: Get user's role slug
 */
export const useRole = () => {
  const { role } = useAppSelector((state) => state.auth);
  return role?.slug || role || "";
};
