/**
 * Gold Price Chart Modal - FIXED VERSION
 * Uses /api/settings/gold-price-history endpoint (correct data source)
 *
 * Place in: /frontend/src/components/dashboard/GoldPriceChartModal.jsx
 */

import { useState, useEffect } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
} from "recharts";
import { Modal, Button, Badge } from "@/components/common";
import { settingsService } from "@/services";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  X,
  RefreshCw,
  Calendar,
  Loader2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TIME_RANGES = [
  { label: "7D", value: 7 },
  { label: "1M", value: 30 },
  { label: "3M", value: 90 },
  { label: "6M", value: 180 },
  { label: "1Y", value: 365 },
];

const PURITIES = [
  { code: "999", label: "24K", color: "#f59e0b" },
  { code: "916", label: "22K", color: "#eab308" },
  { code: "875", label: "21K", color: "#84cc16" },
  { code: "750", label: "18K", color: "#22c55e" },
];

export default function GoldPriceChartModal({
  isOpen,
  onClose,
  currentPrices,
}) {
  const [selectedRange, setSelectedRange] = useState(30);
  const [selectedPurity, setSelectedPurity] = useState("916");
  const [chartData, setChartData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch history data
  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, selectedRange]);

  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Use the settings gold price history endpoint (correct data source)
      const response = await settingsService.getGoldPriceHistory(selectedRange);
      const data = response.data || response || [];

      // Transform data for chart
      // API returns: { price_date, price_999, price_916, price_875, price_750, source }
      const transformed = data.map((item) => {
        return {
          date: item.price_date,
          displayDate: formatDate(item.price_date),
          price999: parseFloat(item.price_999) || 0,
          price916: parseFloat(item.price_916) || 0,
          price875: parseFloat(item.price_875) || 0,
          price750: parseFloat(item.price_750) || 0,
          source: item.source,
        };
      });

      // Sort by date ascending for proper chart display
      transformed.sort((a, b) => new Date(a.date) - new Date(b.date));

      // Filter out zero values (no data)
      const filteredData = transformed.filter(
        (d) =>
          d.price999 > 0 || d.price916 > 0 || d.price875 > 0 || d.price750 > 0,
      );

      setChartData(filteredData);
    } catch (err) {
      console.error("Failed to fetch history:", err);
      setError("Failed to load price history");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  };

  // Format date for display
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-MY", {
      day: "numeric",
      month: "short",
    });
  };

  // Get price key based on selected purity
  const getPriceKey = () => {
    switch (selectedPurity) {
      case "999":
        return "price999";
      case "916":
        return "price916";
      case "875":
        return "price875";
      case "750":
        return "price750";
      default:
        return "price916";
    }
  };

  // Calculate statistics
  const getStats = () => {
    if (chartData.length === 0) return null;

    const priceKey = getPriceKey();
    const prices = chartData.map((d) => d[priceKey]).filter((p) => p > 0);

    if (prices.length === 0) return null;

    const currentPrice = prices[prices.length - 1] || 0;
    const previousPrice = prices[0] || 0;
    const change = currentPrice - previousPrice;
    const changePercent =
      previousPrice > 0 ? (change / previousPrice) * 100 : 0;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

    return {
      current: currentPrice,
      previous: previousPrice,
      change,
      changePercent,
      min,
      max,
      avg,
      direction: change > 0 ? "up" : change < 0 ? "down" : "unchanged",
    };
  };

  const stats = getStats();
  const priceKey = getPriceKey();
  const lineColor =
    PURITIES.find((p) => p.code === selectedPurity)?.color || "#f59e0b";

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-zinc-900 text-white px-3 py-2 rounded-lg shadow-lg text-sm">
          <p className="text-zinc-400 text-xs mb-1">{data.displayDate}</p>
          <p className="font-bold text-lg">
            RM {payload[0].value?.toFixed(2)}
            <span className="text-xs text-zinc-400 ml-1">/g</span>
          </p>
          {data.source && (
            <p className="text-xs text-zinc-400 mt-1">
              Source: {data.source === "manual" ? "Manual" : "API"}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="xl">
      <div className="p-0">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-amber-500 to-amber-600 text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <BarChart3 className="w-6 h-6" />
                Gold Price Chart
                <Badge className="bg-white/20 text-white text-xs ml-2">
                  {selectedPurity} (
                  {PURITIES.find((p) => p.code === selectedPurity)?.label})
                </Badge>
              </h2>
              <p className="text-amber-100 text-sm mt-1">
                Historical price data • Last {selectedRange} days
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                <RefreshCw
                  className={cn("w-5 h-5", refreshing && "animate-spin")}
                />
              </button>
              <button
                onClick={onClose}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Current Price & Stats */}
          {stats ? (
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-bold">
                  RM {stats.current.toFixed(2)}
                  <span className="text-lg text-amber-200 ml-1">/g</span>
                </p>
                <div
                  className={cn(
                    "flex items-center gap-1 mt-1 text-sm",
                    stats.direction === "up"
                      ? "text-green-300"
                      : stats.direction === "down"
                        ? "text-red-300"
                        : "text-amber-200",
                  )}
                >
                  {stats.direction === "up" ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : stats.direction === "down" ? (
                    <ArrowDownRight className="w-4 h-4" />
                  ) : (
                    <Minus className="w-4 h-4" />
                  )}
                  <span>
                    {stats.direction === "up" ? "+" : ""}
                    RM {stats.change.toFixed(2)} (
                    {stats.changePercent.toFixed(2)}%)
                  </span>
                  <span className="text-amber-200 ml-1">
                    vs {selectedRange} days ago
                  </span>
                </div>
              </div>

              <div className="text-right text-sm">
                <div className="text-amber-200">
                  <span className="text-white font-medium">High:</span> RM{" "}
                  {stats.max.toFixed(2)}
                </div>
                <div className="text-amber-200">
                  <span className="text-white font-medium">Low:</span> RM{" "}
                  {stats.min.toFixed(2)}
                </div>
                <div className="text-amber-200">
                  <span className="text-white font-medium">Avg:</span> RM{" "}
                  {stats.avg.toFixed(2)}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-amber-100">
              <p className="text-2xl font-bold">No price data available</p>
              <p className="text-sm mt-1">
                Set gold prices in Settings to see historical data
              </p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-4">
          {/* Time Range Selector */}
          <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-zinc-200">
            {TIME_RANGES.map((range) => (
              <button
                key={range.value}
                onClick={() => setSelectedRange(range.value)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  selectedRange === range.value
                    ? "bg-amber-500 text-white"
                    : "text-zinc-600 hover:bg-zinc-100",
                )}
              >
                {range.label}
              </button>
            ))}
          </div>

          {/* Purity Selector */}
          <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-zinc-200">
            {PURITIES.map((purity) => (
              <button
                key={purity.code}
                onClick={() => setSelectedPurity(purity.code)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  selectedPurity === purity.code
                    ? "text-white"
                    : "text-zinc-600 hover:bg-zinc-100",
                )}
                style={{
                  backgroundColor:
                    selectedPurity === purity.code ? purity.color : undefined,
                }}
              >
                {purity.code}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="p-5">
          {isLoading ? (
            <div className="h-80 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
              <span className="ml-3 text-zinc-500">Loading chart data...</span>
            </div>
          ) : error ? (
            <div className="h-80 flex flex-col items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-red-400 mb-2" />
              <p className="text-zinc-500">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={handleRefresh}
              >
                Try Again
              </Button>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-80 flex flex-col items-center justify-center">
              <Calendar className="w-12 h-12 text-zinc-300 mb-3" />
              <p className="text-zinc-600 font-medium">
                No historical data available
              </p>
              <p className="text-zinc-400 text-sm mt-1 text-center max-w-sm">
                Gold prices are recorded when you update them in Settings → Gold
                Price. Data will appear here as prices are logged over time.
              </p>
              <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-600 mt-0.5" />
                  <div className="text-sm text-amber-700">
                    <p className="font-medium">Tip:</p>
                    <p>
                      Go to Settings → Gold Price and update today's prices to
                      start tracking history.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={lineColor}
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor={lineColor}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="displayDate"
                    tick={{ fill: "#71717a", fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: "#e5e7eb" }}
                  />
                  <YAxis
                    domain={["dataMin - 10", "dataMax + 10"]}
                    tick={{ fill: "#71717a", fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: "#e5e7eb" }}
                    tickFormatter={(value) => `${value.toFixed(0)}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {stats && (
                    <ReferenceLine
                      y={stats.avg}
                      stroke="#9ca3af"
                      strokeDasharray="5 5"
                      label={{
                        value: "Avg",
                        position: "right",
                        fill: "#9ca3af",
                        fontSize: 11,
                      }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey={priceKey}
                    stroke={lineColor}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorPrice)"
                    dot={false}
                    activeDot={{
                      r: 6,
                      fill: lineColor,
                      stroke: "#fff",
                      strokeWidth: 2,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="px-5 pb-5">
          <div className="p-3 bg-zinc-50 rounded-lg text-xs text-zinc-500 flex items-center justify-between">
            <span>
              Data source:{" "}
              {currentPrices?.source === "manual"
                ? "Manual Entry"
                : "Metals.Dev API"}
            </span>
            <span>Prices are per gram in Malaysian Ringgit (MYR)</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
