/**
 * Enhanced Stats Card Component
 * Features: Animated counter, gradient icons, mini donut chart for payment split
 */

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";

// Animated number counter hook
const useAnimatedCounter = (targetValue, duration = 1000) => {
  const [count, setCount] = useState(0);
  const countRef = useRef(null);

  useEffect(() => {
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
  }, [targetValue, duration]);

  return count;
};

// Mini Donut Chart Component
const MiniDonutChart = ({ cash = 0, transfer = 0, size = 40 }) => {
  const total = cash + transfer;
  const cashPercent = total > 0 ? (cash / total) * 100 : 0;
  const transferPercent = total > 0 ? (transfer / total) * 100 : 0;

  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const cashDash = (cashPercent / 100) * circumference;
  const transferDash = (transferPercent / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="5"
        />
        {/* Transfer (Blue) */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${transferDash} ${circumference}`}
          strokeDashoffset={0}
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${transferDash} ${circumference}` }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.5 }}
        />
        {/* Cash (Green) - on top */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#10b981"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${cashDash} ${circumference}`}
          strokeDashoffset={-transferDash}
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${cashDash} ${circumference}` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
    </div>
  );
};

export default function EnhancedStatsCard({
  title,
  value,
  subtitle,
  amount,
  icon: Icon,
  trend,
  trendValue,
  accentColor = "zinc",
  cash = 0,
  transfer = 0,
  showPaymentSplit = false,
  onClick,
  linkText,
}) {
  const animatedValue = useAnimatedCounter(
    typeof value === "number" ? value : 0,
    1200,
  );
  const animatedAmount = useAnimatedCounter(
    typeof amount === "number" ? amount : 0,
    1500,
  );

  // Color mappings
  const colors = {
    zinc: {
      bg: "bg-zinc-100",
      hoverBg: "group-hover:bg-zinc-200",
      icon: "text-zinc-600",
      border: "border-l-zinc-900",
      gradient: "from-zinc-800 to-zinc-600",
    },
    amber: {
      bg: "bg-amber-50",
      hoverBg: "group-hover:bg-amber-100",
      icon: "text-amber-600",
      border: "border-l-amber-500",
      gradient: "from-amber-500 to-amber-400",
    },
    emerald: {
      bg: "bg-emerald-50",
      hoverBg: "group-hover:bg-emerald-100",
      icon: "text-emerald-600",
      border: "border-l-emerald-500",
      gradient: "from-emerald-500 to-emerald-400",
    },
    red: {
      bg: "bg-red-50",
      hoverBg: "group-hover:bg-red-100",
      icon: "text-red-600",
      border: "border-l-red-500",
      gradient: "from-red-500 to-red-400",
    },
  };

  const colorSet = colors[accentColor] || colors.zinc;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, boxShadow: "0 12px 24px -8px rgba(0,0,0,0.15)" }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={cn(
        "bg-white rounded-xl border border-zinc-200 border-l-4 p-5 shadow-sm cursor-pointer group relative overflow-hidden",
        colorSet.border,
      )}
    >
      {/* Subtle amber gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-50/50 via-transparent to-amber-50/30 opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Subtle warm tint base */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-50/20 to-transparent" />

      <div className="relative z-10">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-4">
          {/* Animated Icon */}
          <motion.div
            whileHover={{ scale: 1.1, rotate: 5 }}
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center transition-all shadow-sm",
              colorSet.bg,
              colorSet.hoverBg,
            )}
          >
            {Icon && <Icon className={cn("w-5 h-5", colorSet.icon)} />}
          </motion.div>

          {/* Trend Badge or Donut Chart */}
          {showPaymentSplit ? (
            <MiniDonutChart cash={cash} transfer={transfer} size={44} />
          ) : trend !== undefined ? (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring" }}
              className={cn(
                "text-xs font-bold px-2.5 py-1 rounded-full",
                trend >= 0
                  ? "text-emerald-600 bg-emerald-50"
                  : "text-red-600 bg-red-50",
              )}
            >
              {trend >= 0 ? "+" : ""}
              {trendValue || `${trend}%`}
            </motion.span>
          ) : null}
        </div>

        {/* Title */}
        <p className="text-sm font-semibold text-zinc-500 mb-2 uppercase tracking-wide">
          {title}
        </p>

        {/* Value with Animation */}
        <div className="flex items-baseline gap-2">
          <motion.p
            className="text-3xl font-extrabold text-zinc-900 tracking-tight"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {typeof value === "number" ? Math.round(animatedValue) : value}
          </motion.p>
          {subtitle && (
            <span className="text-sm font-medium text-zinc-400">
              {subtitle}
            </span>
          )}
        </div>

        {/* Amount */}
        {amount !== undefined && (
          <motion.p
            className={cn(
              "text-sm font-semibold mt-1",
              accentColor === "red"
                ? "text-red-600"
                : accentColor === "emerald"
                  ? "text-emerald-600"
                  : "text-zinc-700",
            )}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            {formatCurrency(animatedAmount)}
          </motion.p>
        )}

        {/* Link Text */}
        {linkText && (
          <motion.p
            className={cn(
              "text-sm mt-2 flex items-center gap-1 group-hover:underline",
              accentColor === "red" ? "text-red-500" : "text-zinc-500",
            )}
            whileHover={{ x: 4 }}
          >
            {linkText}
          </motion.p>
        )}

        {/* Payment Split Legend */}
        {showPaymentSplit && (cash > 0 || transfer > 0) && (
          <div className="mt-3 pt-3 border-t border-zinc-100">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-zinc-500">Cash</span>
                <span className="font-semibold text-zinc-700">
                  {Math.round((cash / (cash + transfer || 1)) * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-zinc-500">Transfer</span>
                <span className="font-semibold text-zinc-700">
                  {Math.round((transfer / (cash + transfer || 1)) * 100)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
