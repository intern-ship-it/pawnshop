/**
 * User Profile Page
 * Allows users to view and edit their personal information, change password, and upload profile photo
 */

import { useState, useEffect, useRef } from "react";
import { useAppSelector, useAppDispatch } from "@/app/hooks";
import { setUser } from "@/features/auth/authSlice";
import { addToast } from "@/features/ui/uiSlice";
import authService from "@/services/authService";
import Button from "@/components/common/Button";
import {
  User,
  Mail,
  Phone,
  Building,
  Shield,
  Calendar,
  Camera,
  Lock,
  Eye,
  EyeOff,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export default function Profile() {
  const dispatch = useAppDispatch();
  const { user, role } = useAppSelector((state) => state.auth);

  // Personal Info State
  const [personalInfo, setPersonalInfo] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });
  const [personalInfoLoading, setPersonalInfoLoading] = useState(false);

  // Password Change State
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Profile Photo State
  const [profilePhoto, setProfilePhoto] = useState(user?.profile_photo || null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Update state when user changes
  useEffect(() => {
    if (user) {
      setPersonalInfo({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
      });
      setProfilePhoto(user.profile_photo || null);
    }
  }, [user]);

  // Handle personal info change
  const handlePersonalInfoChange = (e) => {
    const { name, value } = e.target;
    setPersonalInfo((prev) => ({ ...prev, [name]: value }));
  };

  // Handle personal info submit
  const handlePersonalInfoSubmit = async (e) => {
    e.preventDefault();
    setPersonalInfoLoading(true);

    try {
      const formData = new FormData();
      formData.append("name", personalInfo.name);
      formData.append("email", personalInfo.email);
      if (personalInfo.phone) {
        formData.append("phone", personalInfo.phone);
      }

      const response = await authService.updateProfile(formData);

      if (response.success) {
        dispatch(setUser(response.data.user));
        dispatch(
          addToast({
            type: "success",
            message: "Profile updated successfully",
          })
        );
      }
    } catch (error) {
      dispatch(
        addToast({
          type: "error",
          message: error?.message || "Failed to update profile",
        })
      );
    } finally {
      setPersonalInfoLoading(false);
    }
  };

  // Handle password change
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle password submit
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      dispatch(
        addToast({
          type: "error",
          message: "New passwords do not match",
        })
      );
      return;
    }

    if (passwordData.newPassword.length < 8) {
      dispatch(
        addToast({
          type: "error",
          message: "Password must be at least 8 characters",
        })
      );
      return;
    }

    setPasswordLoading(true);

    try {
      const response = await authService.changePassword(
        passwordData.currentPassword,
        passwordData.newPassword,
        passwordData.confirmPassword
      );

      if (response.success) {
        dispatch(
          addToast({
            type: "success",
            message: "Password changed successfully",
          })
        );
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      }
    } catch (error) {
      dispatch(
        addToast({
          type: "error",
          message: error?.message || "Failed to change password",
        })
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  // Handle photo selection
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        dispatch(
          addToast({
            type: "error",
            message: "Image size must be less than 2MB",
          })
        );
        return;
      }

      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle photo upload
  const handlePhotoUpload = async () => {
    if (!photoFile) return;

    setPhotoLoading(true);

    try {
      const formData = new FormData();
      formData.append("profile_photo", photoFile);

      const response = await authService.updateProfile(formData);

      if (response.success) {
        dispatch(setUser(response.data.user));
        setProfilePhoto(response.data.user.profile_photo);
        setPhotoPreview(null);
        setPhotoFile(null);
        dispatch(
          addToast({
            type: "success",
            message: "Profile photo updated successfully",
          })
        );
      }
    } catch (error) {
      dispatch(
        addToast({
          type: "error",
          message: error?.message || "Failed to upload photo",
        })
      );
    } finally {
      setPhotoLoading(false);
    }
  };

  // Cancel photo selection
  const handleCancelPhoto = () => {
    setPhotoPreview(null);
    setPhotoFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Password strength indicator
  const getPasswordStrength = (password) => {
    if (!password) return { strength: 0, label: "", color: "" };

    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;

    if (strength <= 2) return { strength, label: "Weak", color: "bg-red-500" };
    if (strength <= 3)
      return { strength, label: "Fair", color: "bg-amber-500" };
    if (strength <= 4) return { strength, label: "Good", color: "bg-blue-500" };
    return { strength, label: "Strong", color: "bg-green-500" };
  };

  const passwordStrength = getPasswordStrength(passwordData.newPassword);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-800">My Profile</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Manage your personal information and account settings
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Profile Photo & Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Profile Photo Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6"
          >
            <h2 className="text-lg font-semibold text-zinc-800 mb-4">
              Profile Photo
            </h2>

            <div className="flex flex-col items-center">
              {/* Photo Display */}
              <div className="relative w-32 h-32 mb-4">
                <div className="w-full h-full rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-4xl font-bold shadow-lg overflow-hidden">
                  {photoPreview || profilePhoto ? (
                    <img
                      src={photoPreview || profilePhoto}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    user?.name?.charAt(0)?.toUpperCase() || "U"
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-10 h-10 bg-amber-500 hover:bg-amber-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
                >
                  <Camera className="w-5 h-5" />
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />

              {photoPreview && (
                <div className="flex gap-2 mt-2">
                  <Button
                    onClick={handlePhotoUpload}
                    loading={photoLoading}
                    disabled={photoLoading}
                    variant="accent"
                    size="sm"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Save Photo
                  </Button>
                  <Button
                    onClick={handleCancelPhoto}
                    disabled={photoLoading}
                    variant="outline"
                    size="sm"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              )}

              <p className="text-xs text-zinc-500 mt-4 text-center">
                JPG, PNG or GIF. Max size 2MB
              </p>
            </div>
          </motion.div>

          {/* Account Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6"
          >
            <h2 className="text-lg font-semibold text-zinc-800 mb-4">
              Account Information
            </h2>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Shield className="w-4 h-4 text-zinc-400" />
                <div>
                  <p className="text-zinc-500">Role</p>
                  <p className="font-medium text-zinc-800">
                    {role?.name || "N/A"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <Building className="w-4 h-4 text-zinc-400" />
                <div>
                  <p className="text-zinc-500">Employee ID</p>
                  <p className="font-medium text-zinc-800">
                    {user?.employee_id || "N/A"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-zinc-400" />
                <div>
                  <p className="text-zinc-500">Member Since</p>
                  <p className="font-medium text-zinc-800">
                    {user?.created_at
                      ? new Date(user.created_at).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
              </div>

              {user?.last_login_at && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-zinc-400" />
                  <div>
                    <p className="text-zinc-500">Last Login</p>
                    <p className="font-medium text-zinc-800">
                      {new Date(user.last_login_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Right Column - Forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6"
          >
            <h2 className="text-lg font-semibold text-zinc-800 mb-4">
              Personal Information
            </h2>

            <form onSubmit={handlePersonalInfoSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                  <input
                    type="text"
                    name="name"
                    value={personalInfo.name}
                    onChange={handlePersonalInfoChange}
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                  <input
                    type="email"
                    name="email"
                    value={personalInfo.email}
                    onChange={handlePersonalInfoChange}
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                  <input
                    type="tel"
                    name="phone"
                    value={personalInfo.phone}
                    onChange={handlePersonalInfoChange}
                    className="w-full pl-10 pr-4 py-2.5 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  variant="accent"
                  loading={personalInfoLoading}
                  disabled={personalInfoLoading}
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </motion.div>

          {/* Password Change Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6"
          >
            <h2 className="text-lg font-semibold text-zinc-800 mb-4">
              Change Password
            </h2>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {/* Current Password */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  Current Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                  <input
                    type={showPasswords.current ? "text" : "password"}
                    name="currentPassword"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordChange}
                    required
                    className="w-full pl-10 pr-10 py-2.5 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowPasswords((prev) => ({
                        ...prev,
                        current: !prev.current,
                      }))
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showPasswords.current ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                  <input
                    type={showPasswords.new ? "text" : "password"}
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    required
                    className="w-full pl-10 pr-10 py-2.5 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowPasswords((prev) => ({ ...prev, new: !prev.new }))
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showPasswords.new ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {passwordData.newPassword && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all duration-300",
                            passwordStrength.color
                          )}
                          style={{
                            width: `${(passwordStrength.strength / 5) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium text-zinc-600">
                        {passwordStrength.label}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500">
                      Use 8+ characters with a mix of letters, numbers & symbols
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  Confirm New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                  <input
                    type={showPasswords.confirm ? "text" : "password"}
                    name="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    required
                    className={cn(
                      "w-full pl-10 pr-10 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500",
                      passwordData.confirmPassword &&
                        passwordData.newPassword !==
                          passwordData.confirmPassword
                        ? "border-red-300"
                        : "border-zinc-300"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowPasswords((prev) => ({
                        ...prev,
                        confirm: !prev.confirm,
                      }))
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showPasswords.confirm ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {passwordData.confirmPassword &&
                  passwordData.newPassword !== passwordData.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">
                      Passwords do not match
                    </p>
                  )}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  variant="accent"
                  loading={passwordLoading}
                  disabled={passwordLoading}
                >
                  Change Password
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
