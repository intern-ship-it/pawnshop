/**
 * Can - Conditionally render UI based on permission
 *
 * Usage:
 * <Can permission="customers.create">
 *   <Button>Add Customer</Button>
 * </Can>
 */

import { useAppSelector } from "@/app/hooks";

export default function Can({ permission, children, fallback = null }) {
  const { role, permissions } = useAppSelector((state) => state.auth);
  const roleSlug = role?.slug || role || "";

  if (roleSlug === "super-admin") return children;
  if (!permission) return children;

  const hasAccess =
    Array.isArray(permissions) && permissions.includes(permission);
  return hasAccess ? children : fallback;
}

/**
 * CanAny - Show if user has ANY of the permissions
 */
export function CanAny({
  permissions: requiredPermissions,
  children,
  fallback = null,
}) {
  const { role, permissions } = useAppSelector((state) => state.auth);
  const roleSlug = role?.slug || role || "";

  if (roleSlug === "super-admin") return children;
  if (!requiredPermissions || requiredPermissions.length === 0) return children;
  if (!Array.isArray(permissions)) return fallback;

  const hasAny = requiredPermissions.some((p) => permissions.includes(p));
  return hasAny ? children : fallback;
}

/**
 * CanAll - Show only if user has ALL permissions
 */
export function CanAll({
  permissions: requiredPermissions,
  children,
  fallback = null,
}) {
  const { role, permissions } = useAppSelector((state) => state.auth);
  const roleSlug = role?.slug || role || "";

  if (roleSlug === "super-admin") return children;
  if (!requiredPermissions || requiredPermissions.length === 0) return children;
  if (!Array.isArray(permissions)) return fallback;

  const hasAll = requiredPermissions.every((p) => permissions.includes(p));
  return hasAll ? children : fallback;
}
