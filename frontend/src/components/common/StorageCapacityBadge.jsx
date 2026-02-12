import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Archive, AlertTriangle, AlertCircle, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import storageService from "@/services/storageService";

/**
 * Storage Capacity Badge - Premium "Catchy" Design
 * Shows in Header when storage is low/critical
 */
export default function StorageCapacityBadge({ className }) {
  const navigate = useNavigate();
  const [capacity, setCapacity] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCapacity();
    // Refresh every 60 seconds
    const interval = setInterval(fetchCapacity, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchCapacity = async () => {
    try {
      const response = await storageService.getCapacity();
      if (response.success) {
        setCapacity(response.data);
      }
    } catch (err) {
      console.error("Storage capacity error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Only show if low, warning, or critical
  if (loading || !capacity) return null;
  if (capacity.status === "healthy") return null;

  const getStatusConfig = () => {
    switch (capacity.status) {
      case "critical":
        return {
          // Vibrant Red Gradient
          container: "bg-gradient-to-r from-red-500 to-red-600 border-red-400",
          text: "text-white",
          iconColor: "text-red-100",
          shadow: "shadow-lg shadow-red-500/30 hover:shadow-red-500/40",
          pulseColor: "bg-white",
          label: "CRITICAL",
          subtextColor: "text-red-100",
        };
      case "warning":
        return {
          // Vibrant Orange Gradient
          container:
            "bg-gradient-to-r from-orange-500 to-orange-600 border-orange-400",
          text: "text-white",
          iconColor: "text-orange-100",
          shadow: "shadow-lg shadow-orange-500/30 hover:shadow-orange-500/40",
          pulseColor: "bg-white",
          label: "WARNING",
          subtextColor: "text-orange-100",
        };
      case "low":
        return {
          // Vibrant Amber/Yellow Gradient
          container:
            "bg-gradient-to-r from-amber-400 to-amber-500 border-amber-300",
          text: "text-white",
          iconColor: "text-amber-50",
          shadow: "shadow-lg shadow-amber-500/30 hover:shadow-amber-500/40",
          pulseColor: "bg-white",
          label: "LOW SPACE",
          subtextColor: "text-amber-50",
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  return (
    <button
      onClick={() => navigate("/settings?section=racks")}
      className={cn(
        "group flex items-center gap-3 px-4 py-2 rounded-xl transition-all duration-300 transform hover:-translate-y-0.5 border",
        config.container,
        config.shadow,
        config.text,
        className,
      )}
      title={capacity.message}
    >
      {/* Animated Icon Container */}
      <div className="relative">
        <div
          className={cn(
            "p-1.5 rounded-lg bg-white/20 backdrop-blur-sm group-hover:bg-white/30 transition-colors",
            config.iconColor,
          )}
        >
          <Database className="w-4 h-4" />
        </div>
        {/* Ping Animation */}
        <div className="absolute -top-1 -right-1">
          <span
            className={cn(
              "absolute inline-flex h-2.5 w-2.5 rounded-full opacity-75 animate-ping",
              config.pulseColor,
            )}
          ></span>
          <span
            className={cn(
              "relative inline-flex rounded-full h-2.5 w-2.5",
              config.pulseColor,
            )}
          ></span>
        </div>
      </div>

      <div className="flex flex-col items-start gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold leading-none tracking-tight">
            {capacity.available_slots} Slots
          </span>
        </div>
        <span
          className={cn(
            "text-[10px] font-medium leading-none tracking-wider uppercase opacity-90",
            config.subtextColor,
          )}
        >
          {config.label}
        </span>
      </div>
    </button>
  );
}
