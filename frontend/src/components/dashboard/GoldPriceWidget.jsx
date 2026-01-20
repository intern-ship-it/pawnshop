/**
 * GoldPriceWidget Component
 *
 * Displays live gold prices from Metals.Dev + BNM APIs
 * Shows: Current price, change indicator, purity breakdown
 */

import { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { goldPriceService } from "@/services";

export default function GoldPriceWidget({ className = "" }) {
  const [prices, setPrices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchPrices();
  }, []);

  const fetchPrices = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await goldPriceService.getDashboardPrices();
      if (response.data) {
        setPrices(response.data);
      }
    } catch (err) {
      setError("Failed to load gold prices");
      console.error("Gold price fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await goldPriceService.refreshPrices();
      await fetchPrices();
    } catch (err) {
      setError("Failed to refresh prices");
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div
        className={`bg-white rounded-lg border border-zinc-200 p-4 ${className}`}
      >
        <div className="animate-pulse">
          <div className="h-4 bg-zinc-200 rounded w-1/2 mb-3"></div>
          <div className="h-8 bg-zinc-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-zinc-200 rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`bg-white rounded-lg border border-zinc-200 p-4 ${className}`}
      >
        <div className="flex items-center gap-2 text-red-600 mb-2">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm font-medium">Error</span>
        </div>
        <p className="text-sm text-zinc-500 mb-3">{error}</p>
        <button
          onClick={fetchPrices}
          className="text-sm text-amber-600 hover:text-amber-700 font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }

  const currentGold = prices?.current?.prices?.gold?.per_gram;
  const change = prices?.change;
  const caratPrices = prices?.carat?.purity_codes;
  const source = prices?.current?.source;

  // Change indicator
  const ChangeIcon =
    change?.direction === "up"
      ? TrendingUp
      : change?.direction === "down"
        ? TrendingDown
        : Minus;
  const changeColor =
    change?.direction === "up"
      ? "text-green-600"
      : change?.direction === "down"
        ? "text-red-600"
        : "text-zinc-500";

  return (
    <div
      className={`bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg border border-amber-200 p-4 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
          <span className="text-amber-500">●</span>
          Live Gold Price
        </h3>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-1 hover:bg-amber-200 rounded transition-colors"
          title="Refresh prices"
        >
          <RefreshCw
            className={`w-4 h-4 text-amber-700 ${refreshing ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Main Price */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-zinc-800">
            {goldPriceService.formatPrice(currentGold)}
          </span>
          <span className="text-xs text-zinc-500">/gram (999)</span>
        </div>

        {/* Change indicator */}
        {change?.amount !== null && (
          <div className={`flex items-center gap-1 mt-1 ${changeColor}`}>
            <ChangeIcon className="w-3 h-3" />
            <span className="text-xs font-medium">
              {change?.direction === "up" ? "+" : ""}
              {goldPriceService.formatPrice(change?.amount)} (
              {change?.percent?.toFixed(2)}%)
            </span>
            <span className="text-xs text-zinc-400 ml-1">vs yesterday</span>
          </div>
        )}
      </div>

      {/* Purity Breakdown */}
      {caratPrices && (
        <div className="border-t border-amber-200 pt-3">
          <p className="text-xs text-zinc-500 mb-2">
            Price by Purity (per gram)
          </p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {["916", "750", "585"].map((code) => (
              <div key={code} className="bg-white/50 rounded px-2 py-1">
                <span className="text-zinc-500">{code}</span>
                <span className="ml-1 font-semibold text-zinc-700">
                  {goldPriceService.formatPrice(caratPrices[code])}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Source & Update Time */}
      <div className="mt-3 pt-2 border-t border-amber-200 flex items-center justify-between text-xs text-zinc-400">
        <span>
          Source:{" "}
          {source === "metals_dev"
            ? "Metals.Dev"
            : source === "bnm" || source === "bnm_kijang"
              ? "BNM Kijang"
              : source === "metalpriceapi"
                ? "MetalPriceAPI"
                : source === "cache"
                  ? "Cached"
                  : source === "fallback" || source === "manual"
                    ? "Manual"
                    : source || "API"}
        </span>
        <span>
          {prices?.last_updated &&
            new Date(prices.last_updated).toLocaleTimeString("en-MY")}
        </span>
      </div>
    </div>
  );
}

/**
 * Compact version for sidebars/small spaces
 */
export function GoldPriceCompact({ className = "" }) {
  const [price, setPrice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const response = await goldPriceService.getCurrentPrices();
        setPrice(response.data?.prices?.gold?.per_gram);
      } catch (err) {
        console.error("Gold price error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPrice();
  }, []);

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-amber-500">●</span>
        <span className="text-sm text-zinc-400">Loading...</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-amber-500">●</span>
      <span className="text-sm font-medium text-zinc-700">
        Gold: {goldPriceService.formatPrice(price)}/g
      </span>
    </div>
  );
}
