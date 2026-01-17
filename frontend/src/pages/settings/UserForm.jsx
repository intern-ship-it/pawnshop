/**
 * UserForm - Create/Edit User with Per-User Custom Permissions
 * Keeps old UI layout + adds permission checkboxes
 */

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { addToast } from "@/features/ui/uiSlice";
import { apiGet, apiPost, apiPut } from "@/services/api";
import { roleService } from "@/services";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { Card, Button, Input, Select } from "@/components/common";
import {
  User,
  Mail,
  Phone,
  Building2,
  Shield,
  ShieldCheck,
  Key,
  Save,
  ArrowLeft,
  Check,
  X,
  Loader2,
  Hash,
  AlertTriangle,
} from "lucide-react";

// Generate employee ID
const generateEmployeeId = () => {
  const prefix = "EMP";
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, "0");
  return `${prefix}${timestamp}${random}`;
};

export default function UserForm() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const { role: currentUserRole, branch: currentUserBranch } = useAppSelector(
    (state) => state.auth
  );
  const currentRoleSlug = currentUserRole?.slug || currentUserRole || "";
  const isSuperAdmin = currentRoleSlug === "super-admin";

  // Form state
  const [formData, setFormData] = useState({
    employee_id: "",
    username: "",
    password: "",
    confirmPassword: "",
    passkey: "",
    name: "",
    email: "",
    phone: "",
    role_id: "",
    branch_id: "",
    is_active: true,
  });

  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Dynamic data from API
  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);

  // Permissions state
  const [allPermissions, setAllPermissions] = useState({}); // All permissions grouped by module
  const [rolePermissionIds, setRolePermissionIds] = useState([]); // IDs from role
  const [customGranted, setCustomGranted] = useState([]); // Custom granted IDs
  const [customRevoked, setCustomRevoked] = useState([]); // Custom revoked IDs
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch roles
        const rolesResponse = await roleService.getRoles();
        if (rolesResponse.success) {
          setRoles(rolesResponse.data || []);
        }

        // Fetch branches
        const branchesResponse = await apiGet("/branches");
        if (branchesResponse.success) {
          setBranches(branchesResponse.data || []);
        }

        // Fetch all permissions
        const permissionsResponse = await apiGet("/permissions");
        if (permissionsResponse.success) {
          setAllPermissions(permissionsResponse.data || {});
        }

        // If editing, fetch user data
        if (isEdit && id) {
          const userResponse = await apiGet(`/users/${id}`);
          if (userResponse.success && userResponse.data) {
            const userData = userResponse.data.user || userResponse.data;
            setFormData({
              employee_id: userData.employee_id || "",
              username: userData.username || "",
              password: "",
              confirmPassword: "",
              name: userData.name || "",
              email: userData.email || "",
              phone: userData.phone || "",
              role_id:
                userData.role_id?.toString() ||
                userData.role?.id?.toString() ||
                "",
              branch_id:
                userData.branch_id?.toString() ||
                userData.branch?.id?.toString() ||
                "",
              is_active: userData.is_active !== false,
            });

            // Set custom permissions if available
            if (userResponse.data.custom_permissions) {
              setCustomGranted(
                userResponse.data.custom_permissions.granted || []
              );
              setCustomRevoked(
                userResponse.data.custom_permissions.revoked || []
              );
            }

            // Fetch role permissions
            if (userData.role_id || userData.role?.id) {
              fetchRolePermissions(userData.role_id || userData.role?.id);
            }
          } else {
            dispatch(
              addToast({
                type: "error",
                title: "Not Found",
                message: "User not found",
              })
            );
            navigate("/settings/users");
          }
        } else {
          // New user - set defaults
          setFormData((prev) => ({
            ...prev,
            employee_id: generateEmployeeId(),
            branch_id: currentUserBranch?.id?.toString() || "",
          }));
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        dispatch(
          addToast({
            type: "error",
            title: "Error",
            message: "Failed to load form data",
          })
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id, isEdit, navigate, dispatch, currentUserBranch]);

  // Fetch role permissions when role changes
  const fetchRolePermissions = async (roleId) => {
    if (!roleId) {
      setRolePermissionIds([]);
      return;
    }

    setLoadingPermissions(true);
    try {
      const response = await roleService.getRolePermissions(roleId);
      if (response.success && response.data) {
        // Extract enabled permission IDs from response
        const enabledIds = [];
        Object.values(response.data).forEach((permissions) => {
          if (Array.isArray(permissions)) {
            permissions.forEach((p) => {
              if (p.is_enabled) {
                enabledIds.push(p.id);
              }
            });
          }
        });
        setRolePermissionIds(enabledIds);
      }
    } catch (error) {
      console.error("Error fetching role permissions:", error);
    } finally {
      setLoadingPermissions(false);
    }
  };

  // Handle role change
  const handleRoleChange = (roleId) => {
    setFormData((prev) => ({ ...prev, role_id: roleId }));
    // Clear custom permissions when role changes
    setCustomGranted([]);
    setCustomRevoked([]);
    fetchRolePermissions(roleId);
  };

  // Handle input change
  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  // Handle permission checkbox change
  const handlePermissionChange = (permissionId, checked) => {
    const isFromRole = rolePermissionIds.includes(permissionId);

    if (isFromRole) {
      // Permission comes from role
      if (checked) {
        // Remove from revoked (use role permission)
        setCustomRevoked((prev) => prev.filter((id) => id !== permissionId));
      } else {
        // Add to revoked (override role permission)
        setCustomRevoked((prev) => [
          ...prev.filter((id) => id !== permissionId),
          permissionId,
        ]);
      }
      // Remove from granted since it's from role
      setCustomGranted((prev) => prev.filter((id) => id !== permissionId));
    } else {
      // Permission NOT from role
      if (checked) {
        // Add to granted
        setCustomGranted((prev) => [
          ...prev.filter((id) => id !== permissionId),
          permissionId,
        ]);
      } else {
        // Remove from granted
        setCustomGranted((prev) => prev.filter((id) => id !== permissionId));
      }
      // Remove from revoked since it's not from role
      setCustomRevoked((prev) => prev.filter((id) => id !== permissionId));
    }
  };

  // Check if permission is enabled (effective)
  const isPermissionEnabled = (permissionId) => {
    const isFromRole = rolePermissionIds.includes(permissionId);
    const isGranted = customGranted.includes(permissionId);
    const isRevoked = customRevoked.includes(permissionId);

    return (isFromRole || isGranted) && !isRevoked;
  };

  // Get permission status label
  const getPermissionStatus = (permissionId) => {
    const isFromRole = rolePermissionIds.includes(permissionId);
    const isGranted = customGranted.includes(permissionId);
    const isRevoked = customRevoked.includes(permissionId);

    if (isRevoked) return { label: "Revoked", color: "text-red-500" };
    if (isGranted) return { label: "Custom", color: "text-blue-500" };
    if (isFromRole) return { label: "From Role", color: "text-zinc-400" };
    return { label: "", color: "" };
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.employee_id.trim()) {
      newErrors.employee_id = "Employee ID is required";
    }

    if (!formData.name.trim()) {
      newErrors.name = "Full name is required";
    }

    if (!formData.username.trim()) {
      newErrors.username = "Username is required";
    } else if (formData.username.length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username =
        "Username can only contain letters, numbers and underscore";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    if (!isEdit && !formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password && formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    if (formData.password && formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (!formData.role_id) {
      newErrors.role_id = "Role is required";
    }

    // ADD THIS - Passkey validation
    if (formData.passkey && formData.passkey.length !== 6) {
      newErrors.passkey = "Passkey must be exactly 6 digits";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const payload = {
        employee_id: formData.employee_id,
        username: formData.username,
        name: formData.name,
        email: formData.email,
        phone: formData.phone || null,
        role_id: parseInt(formData.role_id),
        is_active: formData.is_active,
        custom_permissions: {
          granted: customGranted,
          revoked: customRevoked,
        },
      };

      // Only include branch_id if selected
      if (formData.branch_id) {
        payload.branch_id = parseInt(formData.branch_id);
      }

      // Only include password if provided
      if (formData.password) {
        payload.password = formData.password;
      }

      // ADD THIS - Include passkey if provided
      if (formData.passkey) {
        payload.passkey = formData.passkey;
      }

      let response;
      if (isEdit) {
        response = await apiPut(`/users/${id}`, payload);
      } else {
        response = await apiPost("/users", payload);
      }

      if (response.success) {
        dispatch(
          addToast({
            type: "success",
            title: isEdit ? "User Updated" : "User Created",
            message: `${formData.name} has been ${
              isEdit ? "updated" : "added"
            }`,
          })
        );
        navigate("/settings/users");
      } else {
        // Handle validation errors from backend
        if (response.errors) {
          const backendErrors = {};
          Object.entries(response.errors).forEach(([key, messages]) => {
            backendErrors[key] = messages[0];
          });
          setErrors(backendErrors);
        }
        throw new Error(response.message || "Failed to save user");
      }
    } catch (error) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: error.message || "Failed to save user",
        })
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Regenerate employee ID
  const handleRegenerateEmployeeId = () => {
    setFormData((prev) => ({ ...prev, employee_id: generateEmployeeId() }));
  };

  // Role options for radio buttons
  const roleOptions = roles.map((r) => ({
    value: r.id?.toString(),
    label: r.name,
    description: r.description || `${r.name} role`,
    slug: r.slug,
  }));

  // Branch options for dropdown
  const branchOptions = branches.map((b) => ({
    value: b.id?.toString(),
    label: `${b.code} - ${b.name}`,
  }));

  // Get effective permissions list for sidebar
  const getEffectivePermissions = () => {
    const effective = [];
    Object.entries(allPermissions).forEach(([module, permissions]) => {
      if (Array.isArray(permissions)) {
        permissions.forEach((p) => {
          if (isPermissionEnabled(p.id)) {
            effective.push(p.name);
          }
        });
      }
    });
    return effective;
  };

  const effectivePermissions = getEffectivePermissions();
  const selectedRole = roles.find((r) => r.id?.toString() === formData.role_id);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <PageWrapper
      title={isEdit ? "Edit User" : "Create User"}
      subtitle={
        isEdit
          ? "Update user information and permissions"
          : "Add a new system user"
      }
      actions={
        <Button
          variant="outline"
          leftIcon={ArrowLeft}
          onClick={() => navigate("/settings/users")}
        >
          Back to Users
        </Button>
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form - Left Side */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-zinc-800 mb-6 flex items-center gap-2">
                <User className="w-5 h-5 text-amber-500" />
                Basic Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Employee ID */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                    Employee ID *
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Hash className="h-4 w-4 text-zinc-400" />
                      </div>
                      <input
                        type="text"
                        value={formData.employee_id}
                        onChange={(e) =>
                          handleChange(
                            "employee_id",
                            e.target.value.toUpperCase()
                          )
                        }
                        disabled={isEdit}
                        className={cn(
                          "block w-full pl-9 pr-3 py-2 border rounded-lg text-sm",
                          "bg-white text-zinc-900 placeholder-zinc-400",
                          "focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500",
                          errors.employee_id
                            ? "border-red-300"
                            : "border-zinc-300",
                          isEdit && "bg-zinc-50 cursor-not-allowed"
                        )}
                        placeholder="EMP001"
                      />
                    </div>
                    {!isEdit && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRegenerateEmployeeId}
                      >
                        Generate
                      </Button>
                    )}
                  </div>
                  {errors.employee_id && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.employee_id}
                    </p>
                  )}
                </div>

                <Input
                  label="Username *"
                  value={formData.username}
                  onChange={(e) =>
                    handleChange("username", e.target.value.toLowerCase())
                  }
                  placeholder="Enter username"
                  error={errors.username}
                  disabled={isEdit}
                />

                <Input
                  label="Full Name *"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Enter full name"
                  error={errors.name}
                  leftIcon={User}
                />

                <Input
                  label="Email *"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="Enter email address"
                  error={errors.email}
                  leftIcon={Mail}
                />

                <Input
                  label="Phone"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="012-345 6789"
                  error={errors.phone}
                  leftIcon={Phone}
                />
              </div>
            </Card>

            {/* Password */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-zinc-800 mb-6 flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-500" />
                {isEdit ? "Change Password" : "Set Password"}
              </h3>

              {isEdit && (
                <p className="text-sm text-zinc-500 mb-4">
                  Leave blank to keep current password
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Input
                    label={isEdit ? "New Password" : "Password *"}
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleChange("password", e.target.value)}
                    placeholder="Minimum 8 characters"
                    error={errors.password}
                    leftIcon={Key}
                  />

                  {/* Password Strength Indicator */}
                  {formData.password &&
                    (() => {
                      let strength = 0;
                      if (formData.password.length >= 8) strength++;
                      if (formData.password.length >= 12) strength++;
                      if (
                        /[a-z]/.test(formData.password) &&
                        /[A-Z]/.test(formData.password)
                      )
                        strength++;
                      if (/\d/.test(formData.password)) strength++;
                      if (/[^a-zA-Z\d]/.test(formData.password)) strength++;

                      const getStrengthInfo = () => {
                        if (strength <= 2)
                          return { label: "Weak", color: "bg-red-500" };
                        if (strength <= 3)
                          return { label: "Fair", color: "bg-amber-500" };
                        if (strength <= 4)
                          return { label: "Good", color: "bg-blue-500" };
                        return { label: "Strong", color: "bg-green-500" };
                      };

                      const strengthInfo = getStrengthInfo();

                      return (
                        <div className="mt-2">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex-1 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full transition-all duration-300",
                                  strengthInfo.color
                                )}
                                style={{ width: `${(strength / 5) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-zinc-600">
                              {strengthInfo.label}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500">
                            Use 8+ characters with a mix of letters, numbers &
                            symbols
                          </p>
                        </div>
                      );
                    })()}
                </div>

                <div>
                  <Input
                    label="Confirm Password"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      handleChange("confirmPassword", e.target.value)
                    }
                    placeholder="Confirm password"
                    error={errors.confirmPassword}
                    leftIcon={Key}
                  />

                  {/* Password Match Indicator */}
                  {formData.confirmPassword && formData.password && (
                    <div className="mt-2">
                      {formData.password === formData.confirmPassword ? (
                        <div className="flex items-center gap-2 text-sm text-green-600">
                          <Check className="w-4 h-4" />
                          <span>Passwords match</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-red-600">
                          <X className="w-4 h-4" />
                          <span>Passwords do not match</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Passkey (6-digit PIN) */}
              <div>
                <Input
                  label="Passkey (6-digit PIN)"
                  type="password"
                  value={formData.passkey}
                  onChange={(e) => {
                    // Only allow numbers, max 6 digits
                    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                    handleChange("passkey", value);
                  }}
                  placeholder="Enter 6-digit passkey"
                  leftIcon={Key}
                  maxLength={6}
                  error={errors.passkey}
                  helperText="Used for sensitive actions (override, reprint, etc.)"
                />
              </div>
            </Card>

            {/* Role & Assignment */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-zinc-800 mb-6 flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-500" />
                Role & Assignment
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Role Selection */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">
                    Role *
                  </label>
                  <div className="space-y-2">
                    {roleOptions.map((role) => (
                      <label
                        key={role.value}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                          formData.role_id === role.value
                            ? "border-amber-500 bg-amber-50"
                            : "border-zinc-200 hover:border-zinc-300"
                        )}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={role.value}
                          checked={formData.role_id === role.value}
                          onChange={(e) => handleRoleChange(e.target.value)}
                          className="sr-only"
                        />
                        <div
                          className={cn(
                            "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                            formData.role_id === role.value
                              ? "border-amber-500"
                              : "border-zinc-300"
                          )}
                        >
                          {formData.role_id === role.value && (
                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-zinc-800">
                            {role.label}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {role.description}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                  {errors.role_id && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.role_id}
                    </p>
                  )}
                </div>

                {/* Branch & Status */}
                <div className="space-y-6">
                  <Select
                    label="Branch"
                    value={formData.branch_id}
                    onChange={(e) => handleChange("branch_id", e.target.value)}
                    options={[
                      { value: "", label: "Select branch" },
                      ...branchOptions,
                    ]}
                    error={errors.branch_id}
                    disabled={!isSuperAdmin}
                  />

                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-2">
                      Status
                    </label>
                    <div className="flex gap-4">
                      <label
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all",
                          formData.is_active
                            ? "border-emerald-500 bg-emerald-50"
                            : "border-zinc-200 hover:border-zinc-300"
                        )}
                      >
                        <input
                          type="radio"
                          name="status"
                          checked={formData.is_active}
                          onChange={() => handleChange("is_active", true)}
                          className="sr-only"
                        />
                        <Check
                          className={cn(
                            "w-4 h-4",
                            formData.is_active
                              ? "text-emerald-500"
                              : "text-zinc-400"
                          )}
                        />
                        <span
                          className={
                            formData.is_active
                              ? "text-emerald-700 font-medium"
                              : "text-zinc-600"
                          }
                        >
                          Active
                        </span>
                      </label>

                      <label
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all",
                          !formData.is_active
                            ? "border-zinc-500 bg-zinc-50"
                            : "border-zinc-200 hover:border-zinc-300"
                        )}
                      >
                        <input
                          type="radio"
                          name="status"
                          checked={!formData.is_active}
                          onChange={() => handleChange("is_active", false)}
                          className="sr-only"
                        />
                        <X
                          className={cn(
                            "w-4 h-4",
                            !formData.is_active
                              ? "text-zinc-500"
                              : "text-zinc-400"
                          )}
                        />
                        <span
                          className={
                            !formData.is_active
                              ? "text-zinc-700 font-medium"
                              : "text-zinc-600"
                          }
                        >
                          Inactive
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Custom Permissions - Only for Super Admin */}
            {isSuperAdmin && formData.role_id && (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-zinc-800 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-amber-500" />
                    Custom Permissions
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPermissions(!showPermissions)}
                  >
                    {showPermissions ? "Hide" : "Show"} Permissions
                  </Button>
                </div>

                <p className="text-sm text-zinc-500 mb-4">
                  Override role permissions for this specific user.
                  <span className="text-blue-500"> Blue</span> = Custom granted,
                  <span className="text-red-500"> Red</span> = Revoked from
                  role.
                </p>

                {showPermissions && (
                  <div className="space-y-6">
                    {loadingPermissions ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                      </div>
                    ) : (
                      Object.entries(allPermissions).map(
                        ([module, permissions]) => (
                          <div
                            key={module}
                            className="border border-zinc-200 rounded-lg p-4"
                          >
                            <h4 className="font-medium text-zinc-800 mb-3 capitalize">
                              {module.replace("_", " ")}
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {Array.isArray(permissions) &&
                                permissions.map((permission) => {
                                  const isEnabled = isPermissionEnabled(
                                    permission.id
                                  );
                                  const status = getPermissionStatus(
                                    permission.id
                                  );

                                  return (
                                    <label
                                      key={permission.id}
                                      className={cn(
                                        "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all",
                                        "hover:bg-zinc-50",
                                        isEnabled ? "bg-emerald-50/50" : ""
                                      )}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isEnabled}
                                        onChange={(e) =>
                                          handlePermissionChange(
                                            permission.id,
                                            e.target.checked
                                          )
                                        }
                                        className="w-4 h-4 text-amber-500 border-zinc-300 rounded focus:ring-amber-500"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm text-zinc-700 truncate">
                                          {permission.name}
                                        </p>
                                      </div>
                                      {status.label && (
                                        <span
                                          className={cn(
                                            "text-xs",
                                            status.color
                                          )}
                                        >
                                          {status.label}
                                        </span>
                                      )}
                                    </label>
                                  );
                                })}
                            </div>
                          </div>
                        )
                      )
                    )}
                  </div>
                )}
              </Card>
            )}
          </div>

          {/* Sidebar - Permissions Preview */}
          <div className="space-y-6">
            <Card className="p-6 sticky top-24">
              <h3 className="text-lg font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-500" />
                Effective Permissions
              </h3>

              {selectedRole ? (
                <>
                  <p className="text-sm text-zinc-500 mb-4">
                    Permissions for <strong>{selectedRole.name}</strong>
                    {(customGranted.length > 0 || customRevoked.length > 0) && (
                      <span className="text-amber-600">
                        {" "}
                        + custom overrides
                      </span>
                    )}
                    :
                  </p>

                  {loadingPermissions ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                    </div>
                  ) : effectivePermissions.length > 0 ? (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {effectivePermissions.map((permission, index) => (
                        <motion.div
                          key={permission}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="flex items-center gap-2 text-sm"
                        >
                          <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          <span className="text-zinc-600">{permission}</span>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-400 italic">
                      No permissions assigned
                    </p>
                  )}

                  {/* Summary */}
                  <div className="mt-4 pt-4 border-t border-zinc-200 text-xs text-zinc-500 space-y-1">
                    <p>Total: {effectivePermissions.length} permissions</p>
                    {customGranted.length > 0 && (
                      <p className="text-blue-500">
                        +{customGranted.length} custom granted
                      </p>
                    )}
                    {customRevoked.length > 0 && (
                      <p className="text-red-500">
                        -{customRevoked.length} revoked
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-zinc-400 italic">
                  Select a role to view permissions
                </p>
              )}

              {/* Save Button */}
              <div className="mt-6 pt-6 border-t border-zinc-200 space-y-3">
                <Button
                  type="submit"
                  variant="accent"
                  fullWidth
                  size="lg"
                  leftIcon={Save}
                  loading={isSaving}
                >
                  {isEdit ? "Update User" : "Create User"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  fullWidth
                  onClick={() => navigate("/settings/users")}
                >
                  Cancel
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </form>
    </PageWrapper>
  );
}
