/**
 * Forgot Password Page
 * Allows users to request a password reset link via email
 */

import { useState, useEffect } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import Button from "@/components/common/Button";
import { Mail, ArrowLeft, Check, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import authService from "@/services/authService";
import { getStorageItem, STORAGE_KEYS } from "@/utils/localStorage";
import { getPublicCompanyInfo } from "@/services/api";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

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
    const [companyLogo, setCompanyLogo] = useState(null);
    const [isLoadingCompany, setIsLoadingCompany] = useState(true);

    // Load company name from API on mount
    useEffect(() => {
        const loadCompanyInfo = async () => {
            try {
                const response = await getPublicCompanyInfo();
                if (response.success && response.data?.company?.name) {
                    const name = response.data.company.name;
                    setCompanyName(name);
                    const w = name.split(" ");
                    setCompanyShort(
                        w.length >= 2
                            ? w[0][0] + w[1][0]
                            : name.substring(0, 2).toUpperCase()
                    );
                }
            } catch (error) {
                console.error("Failed to load company info:", error);
            } finally {
                setIsLoadingCompany(false);
            }
        };

        const loadLogo = async () => {
            try {
                const apiBaseUrl =
                    window.location.hostname === "localhost" ||
                        window.location.hostname === "127.0.0.1"
                        ? "http://localhost:8000"
                        : window.location.origin;
                const logoUrl = `${apiBaseUrl}/api/settings/logo-image`;

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

        return () => {
            if (companyLogo && companyLogo.startsWith("blob:")) {
                URL.revokeObjectURL(companyLogo);
            }
        };
    }, []);

    const handleChange = (e) => {
        setEmail(e.target.value);
        if (errors.email || errors.form) {
            setErrors({});
        }
    };

    const validateForm = () => {
        const newErrors = {};
        if (!email.trim()) {
            newErrors.email = "Email address is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            newErrors.email = "Please enter a valid email address";
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
            const response = await authService.forgotPassword(email);

            if (response.success) {
                setIsSuccess(true);
            } else {
                setErrors({
                    form: response.message || "Failed to send reset link",
                });
            }
        } catch (err) {
            setErrors({
                form:
                    err?.message ||
                    "An error occurred. Please try again.",
            });
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
                >
                    <h2 className="text-4xl font-bold leading-tight mb-4">
                        Forgot Your Password?
                    </h2>
                    <p className="text-zinc-400 max-w-md">
                        No worries! Enter your email address and we'll send you a link to
                        reset your password.
                    </p>
                </motion.div>
            </div>

            {/* Right Side - Form */}
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
                        {isSuccess ? (
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
                                <p className="text-zinc-600 mb-2">
                                    We've sent a password reset link to:
                                </p>
                                <p className="text-amber-600 font-medium mb-6">{email}</p>
                                <p className="text-sm text-zinc-500 mb-6">
                                    If you don't see the email, check your spam folder. The link
                                    will expire in 60 minutes.
                                </p>

                                <div className="space-y-3">
                                    <Button
                                        variant="outline"
                                        fullWidth
                                        onClick={() => {
                                            setIsSuccess(false);
                                            setEmail("");
                                        }}
                                    >
                                        Send Again
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
                                </div>
                            </motion.div>
                        ) : (
                            <>
                                <div className="text-center mb-8">
                                    <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                                        <Mail className="w-7 h-7 text-amber-600" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-zinc-800">
                                        Forgot Password
                                    </h2>
                                    <p className="text-zinc-500 mt-1">
                                        Enter your email to receive a reset link
                                    </p>
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
                                                onChange={handleChange}
                                                className={cn(
                                                    "block w-full pl-10 pr-3 py-2.5 border rounded-lg",
                                                    "bg-white text-zinc-900 placeholder-zinc-400",
                                                    "focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500",
                                                    errors.email ? "border-red-300" : "border-zinc-300"
                                                )}
                                                placeholder="Enter your email address"
                                                autoFocus
                                            />
                                        </div>
                                        {errors.email && (
                                            <p className="mt-1 text-sm text-red-600">
                                                {errors.email}
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
