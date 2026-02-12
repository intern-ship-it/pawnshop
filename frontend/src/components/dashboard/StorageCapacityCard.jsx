import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Database,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Disc,
} from "lucide-react";
import { cn } from "@/lib/utils";
import storageService from "@/services/storageService";

export default function StorageCapacityCard() {
  const navigate = useNavigate();
  const [capacity, setCapacity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0); // For animation reset

  useEffect(() => {
    fetchCapacity();
    const interval = setInterval(fetchCapacity, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchCapacity = async () => {
    try {
      const response = await storageService.getCapacity();
      if (response.success) {
        setCapacity(response.data);
        setRefreshKey((prev) => prev + 1); // Trigger animations
      }
    } catch (err) {
      console.error("Storage capacity error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !capacity)
    return (
      <div className="h-40 bg-zinc-100/50 rounded-2xl animate-pulse flex items-center justify-center">
        <span className="text-zinc-400 font-medium">Loading Storage...</span>
      </div>
    );

  if (!capacity) return null;

  // Premium Theme Config
  const getTheme = (status) => {
    switch (status) {
      case "critical":
        return {
          bg: "bg-white",
          border: "border-red-100",
          gradient: "from-red-50 to-white", // Subtle background
          accent: "text-red-600",
          iconBg: "bg-red-100",
          iconColor: "text-red-600",
          barBg: "bg-red-100",
          barFill: "bg-gradient-to-r from-red-500 to-red-600",
          glow: "shadow-red-500/20",
          badge: "bg-red-100 text-red-700 border-red-200",
        };
      case "warning":
        return {
          bg: "bg-white",
          border: "border-amber-100",
          gradient: "from-amber-50 to-white",
          accent: "text-amber-600",
          iconBg: "bg-amber-100",
          iconColor: "text-amber-600",
          barBg: "bg-amber-100",
          barFill: "bg-gradient-to-r from-amber-500 to-amber-400",
          glow: "shadow-amber-500/20",
          badge: "bg-amber-100 text-amber-700 border-amber-200",
        };
      case "low":
        return {
          bg: "bg-white",
          border: "border-yellow-100",
          gradient: "from-yellow-50 to-white",
          accent: "text-yellow-600",
          iconBg: "bg-yellow-100",
          iconColor: "text-yellow-700",
          barBg: "bg-yellow-100",
          barFill: "bg-gradient-to-r from-yellow-400 to-yellow-500",
          glow: "shadow-yellow-500/20",
          badge: "bg-yellow-100 text-yellow-700 border-yellow-200",
        };
      default: // healthy
        return {
          bg: "bg-white",
          border: "border-emerald-100",
          gradient: "from-emerald-50 to-white",
          accent: "text-emerald-600",
          iconBg: "bg-emerald-100",
          iconColor: "text-emerald-600",
          barBg: "bg-emerald-100",
          barFill: "bg-gradient-to-r from-emerald-500 to-emerald-400",
          glow: "shadow-emerald-500/20",
          badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
        };
    }
  };

  const theme = getTheme(capacity.status);
  const usagePercent = capacity.usage_percent || 0;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-lg group cursor-pointer",
        theme.bg,
        theme.border,
      )}
      onClick={() => navigate("/settings?section=racks")}
    >
      {/* Background Decor */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-50 transition-opacity",
          theme.gradient,
        )}
      />
      <div
        className={cn(
          "absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-20",
          theme.barFill,
        )}
      />

      <div className="relative p-5">
        {/* Header Section */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "p-2.5 rounded-xl shadow-sm transition-colors",
                theme.iconBg,
              )}
            >
              <Database className={cn("w-5 h-5", theme.iconColor)} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-zinc-800 tracking-tight">
                Storage Capacity
              </h3>
              <p className={cn("text-xs font-medium mt-0.5", theme.accent)}>
                {capacity.message}
              </p>
            </div>
          </div>

          <div
            className={cn(
              "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm",
              theme.badge,
            )}
          >
            {capacity.status}
          </div>
        </div>

        {/* Big Number Section (Horizontal Flex) */}
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span
                className={cn(
                  "text-4xl font-black tracking-tighter",
                  theme.accent,
                )}
              >
                {capacity.available_slots}
              </span>
              <span className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-1">
                Slots Available
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-zinc-500 text-sm font-medium">
                Total:{" "}
                <span className="text-zinc-800">{capacity.total_slots}</span>
              </span>
              <span className="text-zinc-300">•</span>
              <span className="text-zinc-500 text-sm font-medium">
                Used:{" "}
                <span className="text-zinc-800">{capacity.occupied_slots}</span>
              </span>
            </div>
          </div>

          <div className="text-right mb-1">
            <div className={cn("text-2xl font-bold", theme.accent)}>
              {usagePercent.toFixed(1)}%
            </div>
            <div className="text-xs font-medium text-zinc-400">Full</div>
          </div>
        </div>

        {/* Modern Progress Bar */}
        <div
          className={cn(
            "h-3 w-full rounded-full overflow-hidden shadow-inner relative",
            theme.barBg,
          )}
        >
          <div
            key={refreshKey} // Force re-animation
            className={cn(
              "h-full rounded-full shadow-lg relative overflow-hidden transition-all duration-1000 ease-out",
              theme.barFill,
              theme.glow,
            )}
            style={{ width: `${usagePercent}%` }}
          >
            {/* Shimmer Effect */}
            <div className="absolute top-0 left-0 bottom-0 right-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
          </div>
        </div>

        {/* Footer / CTA */}
        <div className="mt-5 flex items-center justify-between pt-4 border-t border-zinc-100/50">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-2 h-2 rounded-full animate-pulse",
                theme.barFill,
              )}
            />
            <span className="text-xs font-medium text-zinc-500">
              Live Status
            </span>
          </div>

          <div
            className={cn(
              "flex items-center gap-1 text-sm font-semibold transition-all group-hover:gap-2",
              theme.accent,
            )}
          >
            Manage Storage <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
