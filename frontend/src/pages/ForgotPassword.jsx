/**
 * Forgot Password Page
 * Allows users to request a password reset link
 */

import { useState, useEffect } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import Button from "@/components/common/Button";
import { Mail, ArrowLeft, Check } from "lucide-react";
import { motion } from "framer-motion";
import authService from "@/services/authService";
import { getStorageItem, STORAGE_KEYS } from "@/utils/localStorage";
import { getPublicCompanyInfo } from "@/services/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [resetToken, setResetToken] = useState(""); // For development only

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await authService.forgotPassword(email);

      if (response.success) {
        setIsSuccess(true);
        // Store token for development (remove in production)
        if (response.token) {
          setResetToken(response.token);
        }
      } else {
        setError(response.message || "Failed to send reset email");
      }
    } catch (err) {
      setError(err?.message || "An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
            Password Recovery
          </h2>
          <p className="text-zinc-400 max-w-md">
            Enter your email address and we'll send you instructions to reset
            your password.
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
            {!isSuccess ? (
              <>
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-zinc-800">
                    Forgot Password?
                  </h2>
                  <p className="text-zinc-500 mt-1">
                    No worries, we'll send you reset instructions
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
                    >
                      {error}
                    </motion.div>
                  )}

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-zinc-400" />
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={cn(
                          "block w-full pl-10 pr-3 py-2.5 border rounded-lg",
                          "bg-white text-zinc-900 placeholder-zinc-400",
                          "focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500",
                          error ? "border-red-300" : "border-zinc-300"
                        )}
                        placeholder="Enter your email address"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant="accent"
                    size="lg"
                    fullWidth
                    loading={isSubmitting}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Sending..." : "Send Reset Link"}
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
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4"
              >
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-zinc-800 mb-2">
                  Check Your Email
                </h3>
                <p className="text-zinc-600 mb-6">
                  We've sent password reset instructions to{" "}
                  <span className="font-medium text-zinc-800">{email}</span>
                </p>

                {/* Development only - show token */}
                {resetToken && (
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-800 font-medium mb-2">
                      Development Mode - Reset Token:
                    </p>
                    <code className="text-xs text-amber-900 break-all block bg-white p-2 rounded border border-amber-300">
                      {resetToken}
                    </code>
                    <Link
                      to={`/reset-password?token=${resetToken}`}
                      className="inline-block mt-3 text-sm text-amber-600 hover:text-amber-700 font-medium"
                    >
                      → Go to Reset Password Page
                    </Link>
                  </div>
                )}

                <div className="space-y-3">
                  <p className="text-sm text-zinc-500">
                    Didn't receive the email? Check your spam folder
                  </p>
                  <button
                    onClick={() => {
                      setIsSuccess(false);
                      setEmail("");
                      setResetToken("");
                    }}
                    className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                  >
                    Try another email address
                  </button>
                </div>

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
