/**
 * Enhanced Summary Card Component
 * Features: Animated counting numbers, gradient backgrounds, hover effects
 */

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";

// Animated number counter hook
const useAnimatedCounter = (targetValue, duration = 1500, delay = 0) => {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const countRef = useRef(null);

  useEffect(() => {
    const timeout = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  useEffect(() => {
    if (!started) return;

    const startTime = Date.now();
    const startValue = 0;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue =
        startValue + (targetValue - startValue) * easeOutQuart;

      setCount(currentValue);

      if (progress < 1) {
        countRef.current = requestAnimationFrame(animate);
      }
    };

    countRef.current = requestAnimationFrame(animate);

    return () => {
      if (countRef.current) {
        cancelAnimationFrame(countRef.current);
      }
    };
  }, [targetValue, duration, started]);

  return count;
};

// Color presets - matching existing Charcoal & Amber theme
const PRESETS = {
  light: {
    gradient: "from-amber-50/50 via-white to-amber-50/30",
    textPrimary: "text-zinc-900",
    textSecondary: "text-zinc-600",
    iconColor: "text-amber-600",
    border: "border border-amber-200/50",
  },
  dark: {
    gradient: "from-zinc-800 to-zinc-900",
    textPrimary: "text-white",
    textSecondary: "text-zinc-400",
    iconColor: "text-amber-400",
    border: "",
  },
  amber: {
    gradient: "from-amber-500 to-amber-600",
    textPrimary: "text-white",
    textSecondary: "text-amber-100",
    iconColor: "text-amber-100",
    border: "",
  },
  emerald: {
    gradient: "from-emerald-500 to-emerald-600",
    textPrimary: "text-white",
    textSecondary: "text-emerald-100",
    iconColor: "text-emerald-100",
    border: "",
  },
  blue: {
    gradient: "from-blue-500 to-blue-600",
    textPrimary: "text-white",
    textSecondary: "text-blue-100",
    iconColor: "text-blue-100",
    border: "",
  },
};

export default function EnhancedSummaryCard({
  title,
  value,
  icon: Icon,
  preset = "dark",
  isCurrency = false,
  delay = 0,
  onClick,
}) {
  const colors = PRESETS[preset] || PRESETS.dark;

  // Parse numeric value
  const numericValue =
    typeof value === "number" ? value : parseFloat(value) || 0;
  const animatedValue = useAnimatedCounter(numericValue, 1500, delay);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay / 1000, duration: 0.4 }}
      whileHover={{
        y: -4,
        scale: 1.02,
        boxShadow:
          "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)",
      }}
      onClick={onClick}
      className={cn(
        "bg-gradient-to-br rounded-xl p-5 relative overflow-hidden cursor-pointer",
        colors.gradient,
        colors.border,
      )}
    >
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 80%, rgba(255,255,255,0.1) 0%, transparent 50%),
                             radial-gradient(circle at 80% 20%, rgba(255,255,255,0.08) 0%, transparent 40%)`,
          }}
        />
      </div>

      {/* Shimmer effect on hover */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        initial={{ x: "-100%" }}
        whileHover={{ x: "100%" }}
        transition={{ duration: 0.6 }}
      />

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          {Icon && (
            <motion.div
              whileHover={{ rotate: 15, scale: 1.1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Icon className={cn("w-6 h-6", colors.iconColor)} />
            </motion.div>
          )}
          <span
            className={cn(
              "text-sm font-semibold uppercase tracking-wider",
              colors.textSecondary,
            )}
          >
            {title}
          </span>
        </div>

        <motion.p
          className={cn(
            "text-4xl font-extrabold tabular-nums tracking-tight",
            colors.textPrimary,
          )}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: (delay + 200) / 1000 }}
        >
          {isCurrency
            ? formatCurrency(animatedValue)
            : Math.round(animatedValue).toLocaleString()}
        </motion.p>
      </div>
    </motion.div>
  );
}
