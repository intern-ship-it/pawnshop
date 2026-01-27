/**
 * Enhanced Payment Split Card Component
 * Features: Circular progress rings, animated gradient bar, glass-morphism
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CreditCard, Banknote, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";

// Circular Progress Ring Component
const ProgressRing = ({
  percent,
  color,
  size = 80,
  strokeWidth = 8,
  label,
  amount,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            className="text-xl font-extrabold text-zinc-800"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            {Math.round(percent)}%
          </motion.span>
        </div>
      </div>
      <div className="mt-2 text-center">
        <p className="text-xs text-zinc-500 font-medium">{label}</p>
        <motion.p
          className="text-base font-bold text-zinc-800"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          {formatCurrency(amount)}
        </motion.p>
      </div>
    </div>
  );
};

// Animated Split Bar Component
const AnimatedSplitBar = ({ cashPercent, transferPercent }) => {
  return (
    <div className="relative h-4 bg-zinc-100 rounded-full overflow-hidden">
      {/* Cash portion */}
      <motion.div
        className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-l-full"
        initial={{ width: 0 }}
        animate={{ width: `${cashPercent}%` }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      >
        {/* Shimmer effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        />
      </motion.div>

      {/* Transfer portion */}
      <motion.div
        className="absolute top-0 h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-r-full"
        style={{ left: `${cashPercent}%` }}
        initial={{ width: 0 }}
        animate={{ width: `${transferPercent}%` }}
        transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
      />
    </div>
  );
};

export default function EnhancedPaymentSplitCard({
  cashAmount = 0,
  transferAmount = 0,
  cashCount = 0,
  transferCount = 0,
}) {
  const total = cashAmount + transferAmount;
  const cashPercent = total > 0 ? (cashAmount / total) * 100 : 0;
  const transferPercent = total > 0 ? (transferAmount / total) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-white rounded-xl border border-zinc-200 p-6 shadow-sm relative overflow-hidden"
    >
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, #000 10px, #000 11px)`,
          }}
        />
      </div>

      {/* Subtle warm tint */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-50/30 via-transparent to-amber-50/20" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25"
              whileHover={{ scale: 1.1, rotate: -5 }}
            >
              <CreditCard className="w-5 h-5 text-white" />
            </motion.div>
            <div>
              <h3 className="font-bold text-lg text-zinc-800">
                Today's Total Payment Split
              </h3>
              <p className="text-sm text-zinc-500">All transactions combined</p>
            </div>
          </div>
          <div className="text-right">
            <motion.p
              className="text-3xl font-extrabold text-zinc-800 tracking-tight"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              {formatCurrency(total)}
            </motion.p>
            <p className="text-sm text-zinc-500">Total collected</p>
          </div>
        </div>

        {/* Progress Rings */}
        <div className="flex justify-center gap-12 mb-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
          >
            <ProgressRing
              percent={cashPercent}
              color="#10b981"
              size={90}
              strokeWidth={10}
              label="Cash"
              amount={cashAmount}
            />
          </motion.div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: "spring" }}
          >
            <ProgressRing
              percent={transferPercent}
              color="#3b82f6"
              size={90}
              strokeWidth={10}
              label="Online Transfer"
              amount={transferAmount}
            />
          </motion.div>
        </div>

        {/* Animated Split Bar */}
        <AnimatedSplitBar
          cashPercent={cashPercent}
          transferPercent={transferPercent}
        />

        {/* Legend */}
        <div className="flex items-center justify-center gap-8 mt-4">
          <div className="flex items-center gap-2">
            <motion.div
              className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center"
              whileHover={{ scale: 1.1 }}
            >
              <Banknote className="w-4 h-4 text-emerald-600" />
            </motion.div>
            <div>
              <p className="text-xs text-zinc-500">Cash</p>
              <p className="text-sm font-semibold text-emerald-600">
                {Math.round(cashPercent)}% of total
              </p>
            </div>
          </div>
          <div className="w-px h-8 bg-zinc-200" />
          <div className="flex items-center gap-2">
            <motion.div
              className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"
              whileHover={{ scale: 1.1 }}
            >
              <Building2 className="w-4 h-4 text-blue-600" />
            </motion.div>
            <div>
              <p className="text-xs text-zinc-500">Transfer</p>
              <p className="text-sm font-semibold text-blue-600">
                {Math.round(transferPercent)}% of total
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
