/**
 * Login Page - User authentication
 * Company name is loaded from cached settings (localStorage)
 */

import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
  loginWithUsername,
  clearError,
  fetchCurrentUser,
  setUser,
} from "@/features/auth/authSlice";
import { addToast } from "@/features/ui/uiSlice";
import { getStorageItem, STORAGE_KEYS } from "@/utils/localStorage";
import { cn } from "@/lib/utils";
import Button from "@/components/common/Button";
import { User, Lock, Eye, EyeOff, Check, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { getPublicCompanyInfo } from "@/services/api";
import authService from "@/services/authService";

const demoAccounts = [
  { username: "superadmin", password: "password123", role: "Super Admin" },
  { username: "admin", password: "password123", role: "Administrator" },
  // { username: "manager", password: "password123", role: "Manager" },
  // { username: "cashier", password: "password123", role: "Cashier" },
  // { username: "auditor", password: "password123", role: "Auditor" },
];

const features = [
  "KPKT Malaysia Compliant",
  "Real-time Gold Price Tracking",
  "Comprehensive Reporting",
  "Multi-branch Support",
];

export default function Login() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const {
    isAuthenticated,
    loading,
    error: authError,
  } = useAppSelector((state) => state.auth);

  const [formData, setFormData] = useState({ username: "", password: "" });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-login check state
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Company info from settings
  const [companyName, setCompanyName] = useState("PawnSys");
  const [companyShort, setCompanyShort] = useState("PS");
  const [companyLogo, setCompanyLogo] = useState(null);
  const [isLoadingCompany, setIsLoadingCompany] = useState(true);

  // AUTO-LOGIN CHECK: Verify existing session on component mount
  useEffect(() => {
    const checkExistingAuth = async () => {
      // Clear any previous auth errors first
      dispatch(clearError());

      // Check if we have a stored token
      const hasToken = authService.isAuthenticated();
      const storedUser = authService.getStoredUser();

      if (!hasToken || !storedUser) {
        // No existing session, show login form
        setCheckingAuth(false);
        return;
      }

      // We have token + user, verify with backend and auto-login
      try {
        const response = await dispatch(fetchCurrentUser()).unwrap();
        if (response) {
          // Token is valid, user is authenticated - redirect to dashboard
          dispatch(setUser(response));
          navigate("/", { replace: true });
          return;
        }
      } catch (error) {
        // Token expired or invalid, clear local auth data
        console.warn("Auto-login failed, token may be expired:", error);
        authService.clearLocalAuth();
        // Clear the auth error - this is not a user login error
        dispatch(clearError());
      }

      // Show login form
      setCheckingAuth(false);
    };

    checkExistingAuth();
  }, [dispatch, navigate]);

  // Load company name and logo from API (for public pages) or cached settings
  useEffect(() => {
    const loadCompanyInfo = async () => {
      try {
        // Try to fetch from API first (public endpoint, no auth required)
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
        // Fallback to localStorage if API fails
        const settings = getStorageItem(STORAGE_KEYS.SETTINGS, {});
        if (settings.company?.name) {
          setCompanyName(settings.company.name);
          const words = settings.company.name.split(" ");
          setCompanyShort(
            words.length >= 2
              ? words[0][0] + words[1][0]
              : settings.company.name.substring(0, 2).toUpperCase()
          );
        }
      } finally {
        setIsLoadingCompany(false);
      }
    };

    // Load logo from public endpoint
    const loadLogo = async () => {
      try {
        // Fetch logo from public endpoint (no auth required)
        const logoUrl = "http://localhost:8000/api/settings/logo-image";
        const imgResponse = await fetch(logoUrl);
        if (imgResponse.ok) {
          const blob = await imgResponse.blob();
          const blobUrl = URL.createObjectURL(blob);
          setCompanyLogo(blobUrl);
        }
      } catch (error) {
        console.log("Logo not available or failed to load");
      }
    };

    loadCompanyInfo();
    loadLogo();

    // Cleanup blob URL on unmount
    return () => {
      if (companyLogo && companyLogo.startsWith("blob:")) {
        URL.revokeObjectURL(companyLogo);
      }
    };
  }, []);

  // Listen for settings updates (in case user changes settings and comes back)
  useEffect(() => {
    const handleSettingsUpdate = (e) => {
      const settings = e.detail || getStorageItem(STORAGE_KEYS.SETTINGS, {});
      if (settings.company?.name) {
        setCompanyName(settings.company.name);
        const words = settings.company.name.split(" ");
        setCompanyShort(
          words.length >= 2
            ? words[0][0] + words[1][0]
            : settings.company.name.substring(0, 2).toUpperCase()
        );
      }
    };
    window.addEventListener("settingsUpdated", handleSettingsUpdate);
    return () =>
      window.removeEventListener("settingsUpdated", handleSettingsUpdate);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (authError) {
      setErrors({ form: authError });
      setIsSubmitting(false);
    }
  }, [authError]);

  useEffect(() => {
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name] || errors.form) {
      setErrors((prev) => ({ ...prev, [name]: null, form: null }));
      dispatch(clearError());
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.username.trim()) newErrors.username = "Username is required";
    if (!formData.password) newErrors.password = "Password is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!validateForm()) return;
    if (isSubmitting || loading) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const result = await dispatch(
        loginWithUsername({
          username: formData.username,
          password: formData.password,
          rememberMe: rememberMe,
        })
      ).unwrap();

      dispatch(
        addToast({
          id: Date.now(),
          type: "success",
          title: "Login Successful!",
          message: "Welcome back, " + (result.user?.name || "User") + "!",
        })
      );
    } catch (error) {
      const errorMessage =
        error?.message || error || "Invalid username or password";
      setErrors({ form: errorMessage });
      setIsSubmitting(false);

      dispatch(
        addToast({
          id: Date.now(),
          type: "error",
          title: "Login Failed",
          message: errorMessage,
        })
      );
    }
  };

  const handleDemoLogin = (account) => {
    setFormData({ username: account.username, password: account.password });
    setErrors({});
    dispatch(clearError());
  };

  // Show loading screen while checking for existing auth session
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex flex-1 bg-zinc-900 text-white p-12 flex-col justify-center relative overflow-hidden">
        {/* Background Decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Large gradient circle */}
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl" />

          {/* Grid pattern */}
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
            <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.5)] overflow-hidden">
              {isLoadingCompany ? (
                <div className="w-8 h-8 rounded bg-amber-600/50 animate-pulse" />
              ) : companyLogo ? (
                <img
                  src={companyLogo}
                  alt="Logo"
                  className="w-full h-full object-contain p-1"
                  onError={() => setCompanyLogo(null)}
                />
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
          className="mb-8"
        >
          <h2 className="text-5xl font-bold leading-tight">
            Streamline Your
            <br />
            <span className="text-amber-500">Pawn Business</span>
          </h2>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-zinc-400 mb-8 max-w-md"
        >
          Complete pawn shop management system compliant with KPKT Malaysia
          regulations.
        </motion.p>

        <motion.ul
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="space-y-3"
        >
          {features.map((feature, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.5 + i * 0.1 }}
              className="flex items-center gap-3 text-zinc-300"
            >
              <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Check className="w-3 h-3 text-amber-500" />
              </div>
              {feature}
            </motion.li>
          ))}
        </motion.ul>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-zinc-100">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500 overflow-hidden">
              {isLoadingCompany ? (
                <div className="w-6 h-6 rounded bg-amber-600/50 animate-pulse" />
              ) : companyLogo ? (
                <img
                  src={companyLogo}
                  alt="Logo"
                  className="w-full h-full object-contain p-1"
                  onError={() => setCompanyLogo(null)}
                />
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
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-zinc-800">Welcome Back</h2>
              <p className="text-zinc-500 mt-1">Sign in to your account</p>
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

              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  Username or Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-zinc-400" />
                  </div>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    className={cn(
                      "block w-full pl-10 pr-3 py-2.5 border rounded-lg",
                      "bg-white text-zinc-900 placeholder-zinc-400",
                      "focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500",
                      errors.username ? "border-red-300" : "border-zinc-300"
                    )}
                    placeholder="Enter your username or email"
                  />
                </div>
                {errors.username && (
                  <p className="mt-1 text-sm text-red-600">{errors.username}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  Password <span className="text-red-500">*</span>
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
                    placeholder="Enter your password"
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
                  <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-sm text-zinc-600">Remember me</span>
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                variant="accent"
                size="lg"
                fullWidth
                loading={isSubmitting || loading}
                disabled={isSubmitting || loading}
              >
                {isSubmitting || loading ? "Signing In..." : "Sign In"}
              </Button>
            </form>

            {/* Demo Accounts */}

            {demoAccounts.length > 0 && (
              <div className="mt-8 pt-6 border-t border-zinc-200">
                <p className="text-xs text-zinc-500 text-center mb-3">
                  Demo Accounts (Click to autofill)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {demoAccounts.map((account) => (
                    <button
                      key={account.username}
                      type="button"
                      onClick={() => handleDemoLogin(account)}
                      className={cn(
                        "px-3 py-2 rounded-lg border text-sm font-medium transition-all",
                        "border-zinc-200 hover:border-amber-300 hover:bg-amber-50",
                        formData.username === account.username &&
                          "border-amber-400 bg-amber-50"
                      )}
                    >
                      <span className="text-zinc-700">{account.role}</span>
                    </button>
                  ))}
                </div>
              </div>
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
