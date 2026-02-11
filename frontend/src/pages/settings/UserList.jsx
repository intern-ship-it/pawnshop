/**
 * UserList - Dynamic user management from backend API
 * Fetches users, roles from API instead of localStorage
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { addToast } from "@/features/ui/uiSlice";
import { apiGet, apiDelete, apiPut } from "@/services/api";
import { roleService } from "@/services";
import { cn } from "@/lib/utils";
import PageWrapper from "@/components/layout/PageWrapper";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import Select from "@/components/common/Select";
import Modal from "@/components/common/Modal";
import { usePermission } from "@/components/auth/PermissionGate";
import {
  Plus,
  Search,
  Users,
  UserCheck,
  UserX,
  Edit,
  Trash2,
  Key,
  ShieldCheck,
  Building2,
  Calendar,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { motion } from "framer-motion";

// Role badge colors
const roleColors = {
  "super-admin": { bg: "bg-purple-100", text: "text-purple-700", icon: "👑" },
  admin: { bg: "bg-blue-100", text: "text-blue-700", icon: "⚙️" },
  manager: { bg: "bg-amber-100", text: "text-amber-700", icon: "📋" },
  cashier: { bg: "bg-emerald-100", text: "text-emerald-700", icon: "💰" },
  auditor: { bg: "bg-zinc-100", text: "text-zinc-700", icon: "👁️" },
};

// Status badge config
const statusColors = {
  active: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Active" },
  inactive: { bg: "bg-zinc-100", text: "text-zinc-500", label: "Inactive" },
};

export default function UserList() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { role: currentUserRole } = useAppSelector((state) => state.auth);
  const currentRoleSlug = currentUserRole?.slug || currentUserRole || "";

  // Permission checks
  const canCreate = usePermission("users.create");
  const canEdit = usePermission("users.edit");
  const canDelete = usePermission("users.delete");

  // Data state
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [userPermissions, setUserPermissions] = useState({});
  const [loadingPermissions, setLoadingPermissions] = useState(false);

  // Fetch users and roles
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch users
      const usersResponse = await apiGet("/users");
      if (usersResponse.success) {
        setUsers(usersResponse.data || []);
      } else {
        throw new Error(usersResponse.message || "Failed to fetch users");
      }

      // Fetch roles for filter dropdown
      const rolesResponse = await roleService.getRoles();
      if (rolesResponse.success) {
        setRoles(rolesResponse.data || []);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err.message || "Failed to load users");
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Error",
          message: err.message || "Failed to load users",
        }),
      );
    } finally {
      setIsLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate stats
  const stats = {
    total: users.length,
    active: users.filter((u) => u.is_active).length,
    inactive: users.filter((u) => !u.is_active).length,
    byRole: roles.reduce((acc, role) => {
      acc[role.slug] = users.filter(
        (u) => u.role?.slug === role.slug || u.role_id === role.id,
      ).length;
      return acc;
    }, {}),
  };

  // Filter users
  const filteredUsers = users.filter((user) => {
    // Search filter
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      user.name?.toLowerCase().includes(searchLower) ||
      user.username?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.employee_id?.toLowerCase().includes(searchLower);

    // Role filter
    const userRoleSlug = user.role?.slug || "";
    const matchesRole = roleFilter === "all" || userRoleSlug === roleFilter;

    // Status filter
    const userStatus = user.is_active ? "active" : "inactive";
    const matchesStatus = statusFilter === "all" || userStatus === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Format date
  const formatDateTime = (dateString) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString("en-MY", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Handle delete user
  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setIsDeleting(true);
    try {
      const response = await apiDelete(`/users/${selectedUser.id}`);
      if (response.success) {
        setUsers((prev) => prev.filter((u) => u.id !== selectedUser.id));
        dispatch(
          addToast({
            id: Date.now(),
            type: "success",
            title: "User Deleted",
            message: `${selectedUser.name} has been removed`,
          }),
        );
        setShowDeleteModal(false);
        setSelectedUser(null);
      } else {
        throw new Error(response.message || "Failed to delete user");
      }
    } catch (err) {
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Error",
          message: err.message || "Failed to delete user",
        }),
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle reset password
  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) return;

    if (newPassword.length < 8) {
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Error",
          message: "Password must be at least 8 characters",
        }),
      );
      return;
    }

    setIsResetting(true);
    try {
      const response = await apiPut(`/users/${selectedUser.id}`, {
        password: newPassword,
      });
      if (response.success) {
        dispatch(
          addToast({
            id: Date.now(),
            type: "success",
            title: "Password Reset",
            message: `Password for ${selectedUser.name} has been updated`,
          }),
        );
        setShowResetModal(false);
        setSelectedUser(null);
        setNewPassword("");
      } else {
        throw new Error(response.message || "Failed to reset password");
      }
    } catch (err) {
      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Error",
          message: err.message || "Failed to reset password",
        }),
      );
    } finally {
      setIsResetting(false);
    }
  };

  // View user permissions
  const handleViewPermissions = async (user) => {
    setSelectedUser(user);
    setShowPermissionsModal(true);
    setLoadingPermissions(true);

    try {
      if (user.role_id || user.role?.id) {
        const response = await roleService.getRolePermissions(
          user.role_id || user.role?.id,
        );
        if (response.success) {
          setUserPermissions(response.data || {});
        }
      }
    } catch (err) {
      console.error("Error fetching permissions:", err);
    } finally {
      setLoadingPermissions(false);
    }
  };

  // Get enabled permissions list
  const getEnabledPermissions = () => {
    const enabled = [];
    Object.entries(userPermissions).forEach(([module, permissions]) => {
      if (Array.isArray(permissions)) {
        permissions.forEach((p) => {
          if (p.is_enabled) {
            enabled.push({ module, ...p });
          }
        });
      }
    });
    return enabled;
  };

  // Role options for filter
  const roleOptions = [
    { value: "all", label: "All Roles" },
    ...roles.map((r) => ({ value: r.slug, label: r.name })),
  ];

  // Get avatar color based on name
  const getAvatarColor = (name) => {
    const colors = [
      "bg-blue-500",
      "bg-emerald-500",
      "bg-amber-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-indigo-500",
    ];
    const index = (name?.charCodeAt(0) || 0) % colors.length;
    return colors[index];
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">Loading users...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-zinc-800 font-medium mb-2">Failed to load users</p>
          <p className="text-zinc-500 mb-4">{error}</p>
          <Button onClick={fetchData} leftIcon={RefreshCw}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PageWrapper
      title="User Management"
      subtitle="Manage system users and access control"
      actions={
        canCreate && (
          <Button
            variant="accent"
            leftIcon={Plus}
            onClick={() => navigate("/settings/users/new")}
          >
            Add User
          </Button>
        )
      }
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Total Users</p>
              <p className="text-xl font-bold text-zinc-800">{stats.total}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Active</p>
              <p className="text-xl font-bold text-emerald-600">
                {stats.active}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Roles</p>
              <p className="text-xl font-bold text-amber-600">{roles.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <UserX className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Inactive</p>
              <p className="text-xl font-bold text-red-500">{stats.inactive}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search by name, username or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
          </div>

          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            options={roleOptions}
            className="w-40"
          />

          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "all", label: "All Status" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
            className="w-40"
          />
        </div>
      </Card>

      {/* User List */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase">
                  User
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase">
                  Role
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase">
                  Branch
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase">
                  Last Login
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-zinc-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Users className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                    <p className="text-zinc-500">No users found</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, index) => {
                  const roleSlug = user.role?.slug || "cashier";
                  const roleStyle = roleColors[roleSlug] || roleColors.cashier;
                  const statusStyle = user.is_active
                    ? statusColors.active
                    : statusColors.inactive;

                  return (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="hover:bg-zinc-50 transition-colors"
                    >
                      {/* User Info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold",
                              getAvatarColor(user.name),
                            )}
                          >
                            {user.name?.charAt(0) || "U"}
                          </div>
                          <div>
                            <p className="font-medium text-zinc-800">
                              {user.name}
                            </p>
                            <p className="text-sm text-zinc-500">
                              @{user.username}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                            roleStyle.bg,
                            roleStyle.text,
                          )}
                        >
                          <span>{roleStyle.icon}</span>
                          {user.role?.name || "Unknown"}
                        </span>
                      </td>

                      {/* Branch */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-zinc-600">
                          <Building2 className="w-4 h-4 text-zinc-400" />
                          {user.branch?.name || "No Branch"}
                        </div>
                      </td>

                      {/* Last Login */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-zinc-600">
                          <Calendar className="w-4 h-4 text-zinc-400" />
                          {formatDateTime(user.last_login_at)}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex px-2.5 py-1 rounded-full text-xs font-medium",
                            statusStyle.bg,
                            statusStyle.text,
                          )}
                        >
                          {statusStyle.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {canEdit && (
                            <button
                              onClick={() =>
                                navigate(`/settings/users/${user.id}/edit`)
                              }
                              className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit User"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}

                          {canEdit && (
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setShowResetModal(true);
                              }}
                              className="p-2 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Reset Password"
                            >
                              <Key className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => handleViewPermissions(user)}
                            className="p-2 text-zinc-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="View Permissions"
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </button>

                          {canDelete && (
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setShowDeleteModal(true);
                              }}
                              className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete User"
        size="sm"
      >
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-zinc-800 font-medium">Are you sure?</p>
              <p className="text-sm text-zinc-500">
                This will permanently delete{" "}
                <strong>{selectedUser?.name}</strong>
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setShowDeleteModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              fullWidth
              onClick={handleDeleteUser}
              loading={isDeleting}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => {
          setShowResetModal(false);
          setNewPassword("");
        }}
        title="Reset Password"
        size="sm"
      >
        <div className="p-6">
          <p className="text-sm text-zinc-500 mb-4">
            Enter a new password for <strong>{selectedUser?.name}</strong>
          </p>

          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            leftIcon={Key}
          />

          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                setShowResetModal(false);
                setNewPassword("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              fullWidth
              onClick={handleResetPassword}
              loading={isResetting}
              disabled={!newPassword || newPassword.length < 8}
            >
              Reset Password
            </Button>
          </div>
        </div>
      </Modal>

      {/* Permissions Modal */}
      <Modal
        isOpen={showPermissionsModal}
        onClose={() => {
          setShowPermissionsModal(false);
          setUserPermissions({});
        }}
        title={`Permissions - ${selectedUser?.name}`}
        size="md"
      >
        <div className="p-6">
          <p className="text-sm text-zinc-500 mb-4">
            Role: <strong>{selectedUser?.role?.name}</strong>
          </p>

          {loadingPermissions ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-2">
              {getEnabledPermissions().map((p, index) => (
                <motion.div
                  key={`${p.module}-${p.action}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="flex items-center gap-2 text-sm py-1"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-zinc-600">{p.name}</span>
                </motion.div>
              ))}
              {getEnabledPermissions().length === 0 && (
                <p className="text-zinc-400 text-center py-4">
                  No permissions assigned
                </p>
              )}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-zinc-200">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setShowPermissionsModal(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
}
