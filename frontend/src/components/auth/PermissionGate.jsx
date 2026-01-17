/**
 * PermissionGate - Render children only if user has required permission
 * Uses the permission hooks from ProtectedRoute
 */

import { usePermission } from "@/components/auth/ProtectedRoute";

/**
 * Component that conditionally renders children based on permission
 * @param {string} permission - Permission slug like "customers.create"
 * @param {React.ReactNode} children - Content to render if permission granted
 * @param {React.ReactNode} fallback - Optional content to render if denied (default: null)
 */
export function PermissionGate({ permission, children, fallback = null }) {
  const hasPermission = usePermission(permission);

  if (hasPermission) {
    return children;
  }

  return fallback;
}

/**
 * Hook for checking single permission
 * Re-exported from ProtectedRoute for convenience
 */
export { usePermission } from "@/components/auth/ProtectedRoute";

/**
 * Hook for checking multiple permissions
 * Re-exported from ProtectedRoute for convenience
 */
export { usePermissions } from "@/components/auth/ProtectedRoute";

/**
 * Hook for getting user role
 * Re-exported from ProtectedRoute for convenience
 */
export { useRole } from "@/components/auth/ProtectedRoute";

export default PermissionGate;
