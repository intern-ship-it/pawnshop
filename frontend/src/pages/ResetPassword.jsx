/**
 * Reset Password Page
 * Allows users to set a new password using a reset token
 */

import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { cn } from "@/lib/utils";
import Button from "@/components/common/Button";
import { Lock, Eye, EyeOff, ArrowLeft, Check, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import authService from "@/services/authService";
import { getStorageItem, STORAGE_KEYS } from "@/utils/localStorage";
import { getPublicCompanyInfo } from "@/services/api";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [formData, setFormData] = useState({
    password: "",
    passwordConfirmation: "",
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  // Company info from settings
  const settings = getStorageItem(STORAGE_KEYS.SETTINGS, {});
  const [companyName, setCompanyName] = useState(
    settings.company?.name || "PawnSys"
  );
  const words = (settings.company?.name || "PawnSys").split(" ");
  const [companyShort, setCompanyShort] = useState(
    words.length >= 2
      ? words[0][0] + words[1][0]
      : (settings.company?.name || "PawnSys").substring(0, 2).toUpperCase()
  );
  const [isLoadingCompany, setIsLoadingCompany] = useState(true);

  // Load company name from API on mount
  useEffect(() => {
    const loadCompanyInfo = async () => {
      try {
        const response = await getPublicCompanyInfo();
        if (response.success && response.data?.company?.name) {
          const name = response.data.company.name;
          setCompanyName(name);
          const words = name.split(" ");
          setCompanyShort(
            words.length >= 2
              ? words[0][0] + words[1][0]
              : name.substring(0, 2).toUpperCase()
          );
        }
      } catch (error) {
        // Keep default values from localStorage
        console.error("Failed to load company info:", error);
      } finally {
        setIsLoadingCompany(false);
      }
    };
    loadCompanyInfo();
  }, []);

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setIsVerifying(false);
        setTokenValid(false);
        return;
      }

      try {
        const response = await authService.verifyResetToken(token);
        if (response.success) {
          setTokenValid(true);
          setUserEmail(response.data?.email || "");
        } else {
          setTokenValid(false);
          setErrors({ form: response.message || "Invalid reset token" });
        }
      } catch (err) {
        setTokenValid(false);
        setErrors({
          form: err?.message || "Failed to verify reset token",
        });
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name] || errors.form) {
      setErrors((prev) => ({ ...prev, [name]: null, form: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    if (!formData.passwordConfirmation) {
      newErrors.passwordConfirmation = "Please confirm your password";
    } else if (formData.password !== formData.passwordConfirmation) {
      newErrors.passwordConfirmation = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await authService.resetPassword(
        token,
        formData.password,
        formData.passwordConfirmation
      );

      if (response.success) {
        setIsSuccess(true);
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate("/login");
        }, 3000);
      } else {
        setErrors({ form: response.message || "Failed to reset password" });
      }
    } catch (err) {
      setErrors({
        form: err?.message || "An error occurred. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
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

  const passwordStrength = getPasswordStrength(formData.password);

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex flex-1 bg-zinc-900 text-white p-12 flex-col justify-center relative overflow-hidden">
        {/* Background Decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl" />
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23f59e0b' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.5)]">
              {isLoadingCompany ? (
                <div className="w-8 h-8 rounded bg-amber-600/50 animate-pulse" />
              ) : (
                <span className="text-2xl font-bold text-zinc-900">
                  {companyShort}
                </span>
              )}
            </div>
            <div className="flex-1">
              {isLoadingCompany ? (
                <>
                  <div className="h-6 bg-zinc-700 rounded w-48 mb-2 animate-pulse" />
                  <div className="h-4 bg-zinc-700/50 rounded w-32 animate-pulse" />
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-bold">{companyName}</h1>
                  <p className="text-amber-500 text-sm">
                    Pajak Kedai Management
                  </p>
                </>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h2 className="text-4xl font-bold leading-tight mb-4">
            Reset Your Password
          </h2>
          <p className="text-zinc-400 max-w-md">
            Choose a strong password to secure your account. Make sure it's at
            least 8 characters long.
          </p>
        </motion.div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-zinc-100">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500">
              {isLoadingCompany ? (
                <div className="w-6 h-6 rounded bg-amber-600/50 animate-pulse" />
              ) : (
                <span className="text-xl font-bold text-zinc-900">
                  {companyShort}
                </span>
              )}
            </div>
            <div className="flex-1">
              {isLoadingCompany ? (
                <>
                  <div className="h-6 bg-zinc-300 rounded w-40 mb-1 animate-pulse" />
                  <div className="h-4 bg-zinc-200 rounded w-28 animate-pulse" />
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-bold text-zinc-800">
                    {companyName}
                  </h1>
                  <p className="text-amber-600 text-sm">
                    Pajak Kedai Management
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Form Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white rounded-2xl shadow-xl p-8"
          >
            {isVerifying ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-zinc-500">Verifying reset token...</p>
              </div>
            ) : !tokenValid ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4"
              >
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-zinc-800 mb-2">
                  Invalid or Expired Link
                </h3>
                <p className="text-zinc-600 mb-6">
                  {errors.form ||
                    "This password reset link is invalid or has expired. Please request a new one."}
                </p>
                <Link to="/forgot-password">
                  <Button variant="accent" size="lg">
                    Request New Link
                  </Button>
                </Link>
                <div className="mt-6 pt-6 border-t border-zinc-200">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-amber-600 font-medium transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Login
                  </Link>
                </div>
              </motion.div>
            ) : isSuccess ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4"
              >
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-zinc-800 mb-2">
                  Password Reset Successful!
                </h3>
                <p className="text-zinc-600 mb-6">
                  Your password has been reset successfully. You can now login
                  with your new password.
                </p>
                <p className="text-sm text-zinc-500">
                  Redirecting to login page...
                </p>
              </motion.div>
            ) : (
              <>
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-zinc-800">
                    Set New Password
                  </h2>
                  {userEmail && (
                    <p className="text-zinc-500 mt-1 text-sm">
                      for <span className="font-medium">{userEmail}</span>
                    </p>
                  )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {errors.form && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
                    >
                      {errors.form}
                    </motion.div>
                  )}

                  {/* New Password */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                      New Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-zinc-400" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        className={cn(
                          "block w-full pl-10 pr-10 py-2.5 border rounded-lg",
                          "bg-white text-zinc-900 placeholder-zinc-400",
                          "focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500",
                          errors.password ? "border-red-300" : "border-zinc-300"
                        )}
                        placeholder="Enter new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.password}
                      </p>
                    )}

                    {/* Password Strength Indicator */}
                    {formData.password && (
                      <div className="mt-2">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex-1 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full transition-all duration-300",
                                passwordStrength.color
                              )}
                              style={{
                                width: `${
                                  (passwordStrength.strength / 5) * 100
                                }%`,
                              }}
                            />
                          </div>
                          <span className="text-xs font-medium text-zinc-600">
                            {passwordStrength.label}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500">
                          Use 8+ characters with a mix of letters, numbers &
                          symbols
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                      Confirm Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-zinc-400" />
                      </div>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        name="passwordConfirmation"
                        value={formData.passwordConfirmation}
                        onChange={handleChange}
                        className={cn(
                          "block w-full pl-10 pr-10 py-2.5 border rounded-lg",
                          "bg-white text-zinc-900 placeholder-zinc-400",
                          "focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500",
                          errors.passwordConfirmation
                            ? "border-red-300"
                            : "border-zinc-300"
                        )}
                        placeholder="Confirm new password"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    {errors.passwordConfirmation && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.passwordConfirmation}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    variant="accent"
                    size="lg"
                    fullWidth
                    loading={isSubmitting}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Resetting Password..." : "Reset Password"}
                  </Button>

                  <div className="text-center">
                    <Link
                      to="/login"
                      className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-amber-600 font-medium transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back to Login
                    </Link>
                  </div>
                </form>
              </>
            )}
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-center text-xs text-zinc-500 mt-6"
          >
            © {new Date().getFullYear()} {companyName}. KPKT Malaysia Compliant
            System.
          </motion.p>
        </div>
      </div>
    </div>
  );
}
