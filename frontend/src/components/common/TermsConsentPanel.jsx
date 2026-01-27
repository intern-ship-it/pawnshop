/**
 * Terms & Conditions Consent Panel
 * Reusable component for displaying T&C with consent checkbox
 * Supports bilingual content (BM/EN) and accordion-style display
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import settingsService from "@/services/settingsService";
import {
  FileText,
  ChevronDown,
  ChevronUp,
  Check,
  Globe,
  Loader2,
  AlertTriangle,
  CheckCircle,
  FileCheck,
} from "lucide-react";

export default function TermsConsentPanel({
  activityType = "pledge", // 'pledge', 'renewal', 'redemption'
  onConsentChange,
  className,
  compact = false,
}) {
  const [terms, setTerms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedTerms, setExpandedTerms] = useState({});
  const [language, setLanguage] = useState("ms"); // 'ms' or 'en'
  const [hasAgreed, setHasAgreed] = useState(false);

  // Fetch terms on mount
  useEffect(() => {
    fetchTerms();
  }, [activityType]);

  // Notify parent of consent changes
  useEffect(() => {
    onConsentChange?.(hasAgreed);
  }, [hasAgreed, onConsentChange]);

  const fetchTerms = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await settingsService.getTermsConditions();
      const data = response.data || response;

      // Filter by activity type and show_on_screen
      const filtered = (Array.isArray(data) ? data : [])
        .filter(
          (t) =>
            t.activity_type === activityType &&
            t.show_on_screen === true &&
            t.is_active === true,
        )
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

      setTerms(filtered);

      // Auto-expand first term if only a few terms
      if (filtered.length <= 3 && filtered.length > 0) {
        setExpandedTerms({ [filtered[0].id]: true });
      }
    } catch (err) {
      console.error("Error fetching terms:", err);
      setError("Failed to load terms and conditions");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (id) => {
    setExpandedTerms((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAllExpand = () => {
    const allExpanded = terms.every((t) => expandedTerms[t.id]);
    if (allExpanded) {
      setExpandedTerms({});
    } else {
      const newExpanded = {};
      terms.forEach((t) => (newExpanded[t.id] = true));
      setExpandedTerms(newExpanded);
    }
  };

  const handleAgreeChange = (e) => {
    setHasAgreed(e.target.checked);
  };

  // Get activity label
  const getActivityLabel = () => {
    switch (activityType) {
      case "pledge":
        return { en: "New Pledge", ms: "Gadaian Baru" };
      case "renewal":
        return { en: "Renewal", ms: "Pembaharuan" };
      case "redemption":
        return { en: "Redemption", ms: "Penebusan" };
      default:
        return { en: activityType, ms: activityType };
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div
        className={cn(
          "bg-white rounded-xl border border-zinc-200 p-6",
          className,
        )}
      >
        <div className="flex items-center justify-center gap-2 text-zinc-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading terms...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={cn(
          "bg-white rounded-xl border border-red-200 p-6",
          className,
        )}
      >
        <div className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  // No terms to display
  if (terms.length === 0) {
    return (
      <div
        className={cn(
          "bg-white rounded-xl border border-zinc-200 p-6",
          className,
        )}
      >
        <div className="flex items-center gap-2 text-zinc-500">
          <FileText className="w-5 h-5" />
          <span>No terms and conditions to display</span>
        </div>
        {/* Auto-consent if no terms */}
        {!hasAgreed && (
          <div className="mt-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasAgreed}
                onChange={handleAgreeChange}
                className="w-4 h-4 rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
              />
              <span className="text-sm text-zinc-600">
                I confirm my understanding
              </span>
            </label>
          </div>
        )}
      </div>
    );
  }

  const activityLabel = getActivityLabel();
  const requiresConsent = terms.some((t) => t.require_consent);

  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-zinc-200 overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <FileText className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-800 text-sm">
                Terms & Conditions
              </h3>
              <p className="text-xs text-zinc-500">
                {language === "ms" ? activityLabel.ms : activityLabel.en}
              </p>
            </div>
          </div>

          {/* Language Toggle */}
          <div className="flex items-center gap-1 bg-white rounded-lg p-0.5 border border-zinc-200">
            <button
              onClick={() => setLanguage("ms")}
              className={cn(
                "px-2 py-1 text-xs font-medium rounded transition-colors",
                language === "ms"
                  ? "bg-amber-500 text-white"
                  : "text-zinc-600 hover:bg-zinc-100",
              )}
            >
              BM
            </button>
            <button
              onClick={() => setLanguage("en")}
              className={cn(
                "px-2 py-1 text-xs font-medium rounded transition-colors",
                language === "en"
                  ? "bg-amber-500 text-white"
                  : "text-zinc-600 hover:bg-zinc-100",
              )}
            >
              EN
            </button>
          </div>
        </div>
      </div>

      {/* Terms List */}
      <div
        className={cn(
          "divide-y divide-zinc-100",
          compact ? "max-h-64" : "max-h-80",
          "overflow-y-auto",
        )}
      >
        {terms.map((term, index) => (
          <div key={term.id} className="bg-white">
            {/* Term Header */}
            <button
              onClick={() => toggleExpand(term.id)}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-zinc-50 transition-colors text-left"
            >
              <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-zinc-800 text-sm truncate">
                  {term.title}
                </p>
                {term.require_consent && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-600 mt-0.5">
                    <FileCheck className="w-3 h-3" />
                    Consent Required
                  </span>
                )}
              </div>
              {expandedTerms[term.id] ? (
                <ChevronUp className="w-4 h-4 text-zinc-400 flex-shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />
              )}
            </button>

            {/* Term Content (Expanded) */}
            <AnimatePresence>
              {expandedTerms[term.id] && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 pl-14">
                    <div className="p-3 bg-zinc-50 rounded-lg text-sm text-zinc-700 whitespace-pre-line">
                      {language === "ms"
                        ? term.content_ms || term.content_en || "-"
                        : term.content_en || term.content_ms || "-"}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Expand/Collapse All */}
      <div className="px-4 py-2 bg-zinc-50 border-t border-zinc-100">
        <button
          onClick={toggleAllExpand}
          className="text-xs text-amber-600 hover:text-amber-700 font-medium"
        >
          {terms.every((t) => expandedTerms[t.id])
            ? "Collapse All"
            : "Expand All"}
        </button>
      </div>

      {/* Consent Checkbox */}
      {requiresConsent && (
        <div className="px-4 py-4 bg-gradient-to-r from-emerald-50 to-green-50 border-t border-emerald-100">
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={hasAgreed}
                onChange={handleAgreeChange}
                className="w-5 h-5 rounded border-2 border-emerald-300 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-800 group-hover:text-zinc-900">
                {language === "ms"
                  ? "Saya telah membaca dan bersetuju dengan terma dan syarat di atas"
                  : "I have read and agree to the above terms and conditions"}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {language === "ms"
                  ? "Dengan menanda kotak ini, pelanggan mengakui persetujuan mereka"
                  : "By checking this box, customer acknowledges their agreement"}
              </p>
            </div>
          </label>

          {/* Visual indicator */}
          <AnimatePresence>
            {hasAgreed && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="mt-3 flex items-center gap-2 text-emerald-600"
              >
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {language === "ms"
                    ? "Persetujuan diterima"
                    : "Consent received"}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
