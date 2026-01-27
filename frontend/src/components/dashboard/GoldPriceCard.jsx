/**
 * Gold Price Card for Dashboard
 * Clickable card that opens interactive chart modal
 *
 * Place in: /frontend/src/components/dashboard/GoldPriceCard.jsx
 *
 * Usage in Dashboard.jsx:
 *   import GoldPriceCard from "@/components/dashboard/GoldPriceCard";
 *
 *   // Replace the existing Gold Prices section with:
 *   <GoldPriceCard goldPrices={goldPrices} goldPrice={goldPrice} />
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  ExternalLink,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import GoldPriceChartModal from "./GoldPriceChartModal";

// Format currency helper
const formatCurrency = (value) => {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(value || 0);
};

export default function GoldPriceCard({ goldPrices, goldPrice }) {
  const [showChart, setShowChart] = useState(false);

  // Get source badge
  const getSourceBadge = () => {
    const source = goldPrices?.source || goldPrice?.source;
    if (source === "manual") {
      return (
        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
          Manual
        </span>
      );
    }
    if (source === "api" || source === "metalpriceapi") {
      return (
        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
          🟢 Live
        </span>
      );
    }
    if (source === "cache") {
      return (
        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
          🟡 Cached
        </span>
      );
    }
    return null;
  };

  // Get price change info
  const priceChange = goldPrices?.change || goldPrice?.change;
  const hasChange =
    priceChange && priceChange.amount !== null && priceChange.amount !== 0;

  return (
    <>
      {/* Clickable Gold Price Card */}
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => setShowChart(true)}
        className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm cursor-pointer hover:shadow-md hover:border-amber-200 transition-all group"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-zinc-800">Gold Prices (RM/g)</h3>
            {getSourceBadge()}
          </div>
          <div className="flex items-center gap-2">
            {goldPrices?.updated_at && (
              <span className="text-xs text-zinc-400">
                {new Date(goldPrices.updated_at).toLocaleDateString()}
              </span>
            )}
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 group-hover:bg-amber-100 transition-colors">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Price Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-amber-50 rounded-lg p-3 hover:bg-amber-100 transition-colors">
            <p className="text-xs text-amber-600 font-medium">999 (24K)</p>
            <p className="text-lg font-bold text-amber-700">
              {formatCurrency(
                goldPrices?.price_999 || goldPrice?.price999 || 0,
              )}
            </p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 hover:bg-amber-100 transition-colors">
            <p className="text-xs text-amber-600 font-medium">916 (22K)</p>
            <p className="text-lg font-bold text-amber-700">
              {formatCurrency(
                goldPrices?.price_916 || goldPrice?.price916 || 0,
              )}
            </p>
          </div>
          <div className="bg-zinc-50 rounded-lg p-3 hover:bg-zinc-100 transition-colors">
            <p className="text-xs text-zinc-500 font-medium">875 (21K)</p>
            <p className="text-lg font-bold text-zinc-700">
              {formatCurrency(
                goldPrices?.price_875 || goldPrice?.price875 || 0,
              )}
            </p>
          </div>
          <div className="bg-zinc-50 rounded-lg p-3 hover:bg-zinc-100 transition-colors">
            <p className="text-xs text-zinc-500 font-medium">750 (18K)</p>
            <p className="text-lg font-bold text-zinc-700">
              {formatCurrency(
                goldPrices?.price_750 || goldPrice?.price750 || 0,
              )}
            </p>
          </div>
        </div>

        {/* Price Change Indicator */}
        {hasChange && (
          <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center justify-between">
            <div
              className={cn(
                "flex items-center gap-1 text-sm",
                priceChange.direction === "up"
                  ? "text-green-600"
                  : priceChange.direction === "down"
                    ? "text-red-600"
                    : "text-zinc-500",
              )}
            >
              {priceChange.direction === "up" ? (
                <TrendingUp className="w-4 h-4" />
              ) : priceChange.direction === "down" ? (
                <TrendingDown className="w-4 h-4" />
              ) : (
                <Minus className="w-4 h-4" />
              )}
              <span className="font-medium">
                {priceChange.direction === "up" ? "+" : ""}
                {formatCurrency(priceChange.amount)}
              </span>
              <span className="text-xs text-zinc-400">
                ({priceChange.percent?.toFixed(2)}% vs yesterday)
              </span>
            </div>
          </div>
        )}

        {/* Click hint */}
        <div className="mt-3 flex items-center justify-center gap-1 text-xs text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity">
          <BarChart3 className="w-3 h-3" />
          Click to view price chart
          <ExternalLink className="w-3 h-3" />
        </div>
      </motion.div>

      {/* Chart Modal */}
      <GoldPriceChartModal
        isOpen={showChart}
        onClose={() => setShowChart(false)}
        currentPrices={goldPrices || goldPrice}
      />
    </>
  );
}
