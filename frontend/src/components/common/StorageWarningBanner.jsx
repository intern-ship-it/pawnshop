import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Archive, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import storageService from "@/services/storageService";

/**
 * Storage Warning Banner - Shows at top of New Pledge page when storage is low/critical
 * Blocks pledge creation when storage is full
 */
export default function StorageWarningBanner({ onStorageFull }) {
  const navigate = useNavigate();
  const [capacity, setCapacity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetchCapacity();
  }, []);

  const fetchCapacity = async () => {
    try {
      const response = await storageService.getCapacity();
      if (response.success && response.data) {
        setCapacity(response.data);
        // Notify parent if storage is full
        if (onStorageFull && response.data.can_accept_pledge === false) {
          onStorageFull(true);
        }
      } else {
        console.warn("Storage capacity response missing data:", response);
      }
    } catch (err) {
      console.error("Storage capacity error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Don't show if loading, healthy, or dismissed
  if (loading || !capacity) return null;
  if (capacity?.status === "healthy" && capacity?.can_accept_pledge)
    return null;
  if (dismissed && capacity?.can_accept_pledge) return null;

  const getStatusConfig = () => {
    if (!capacity?.can_accept_pledge) {
      return {
        bg: "bg-red-100 border-red-300",
        text: "text-red-800",
        icon: "text-red-600",
        button: "bg-red-600 hover:bg-red-700 text-white",
        title: "🚨 Storage Full - Cannot Create Pledge",
        canDismiss: false,
      };
    }

    switch (capacity?.status) {
      case "critical":
        return {
          bg: "bg-red-50 border-red-200",
          text: "text-red-800",
          icon: "text-red-600",
          button: "bg-red-600 hover:bg-red-700 text-white",
          title: "⚠️ Critical: Storage Almost Full",
          canDismiss: true,
        };
      case "warning":
        return {
          bg: "bg-amber-50 border-amber-200",
          text: "text-amber-800",
          icon: "text-amber-600",
          button: "bg-amber-600 hover:bg-amber-700 text-white",
          title: "⚠️ Warning: Storage Running Low",
          canDismiss: true,
        };
      case "low":
        return {
          bg: "bg-yellow-50 border-yellow-200",
          text: "text-yellow-800",
          icon: "text-yellow-600",
          button: "bg-yellow-600 hover:bg-yellow-700 text-white",
          title: "ℹ️ Notice: Storage Capacity Low",
          canDismiss: true,
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  return (
    <div className={cn("rounded-xl border-2 p-4 mb-6 relative", config.bg)}>
      {/* Dismiss Button (only if allowed) */}
      {config.canDismiss && (
        <button
          onClick={() => setDismissed(true)}
          className={cn(
            "absolute top-3 right-3 p-1 hover:bg-black/10 rounded-lg transition-colors",
            config.text,
          )}
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={cn("p-2 bg-white rounded-lg shadow-sm", config.icon)}>
          <Archive className="w-6 h-6" />
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3 className={cn("font-bold mb-1", config.text)}>{config.title}</h3>
          <p className={cn("text-sm mb-3", config.text)}>
            {capacity?.message || "Storage capacity information unavailable"}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-6 text-sm mb-3">
            <div>
              <span className={cn("font-semibold", config.text)}>
                {capacity?.available_slots ?? 0}
              </span>
              <span className={cn("ml-1 opacity-75", config.text)}>
                available
              </span>
            </div>
            <div>
              <span className={cn("font-semibold", config.text)}>
                {capacity?.occupied_slots ?? 0}
              </span>
              <span className={cn("ml-1 opacity-75", config.text)}>
                occupied
              </span>
            </div>
            <div>
              <span className={cn("font-semibold", config.text)}>
                {capacity?.usage_percent?.toFixed(1) ?? "0.0"}%
              </span>
              <span className={cn("ml-1 opacity-75", config.text)}>full</span>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={() => navigate("/inventory")}
            className={cn(
              "px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm",
              config.button,
            )}
          >
            {capacity?.can_accept_pledge
              ? "View Storage & Free Up Space →"
              : "Free Up Storage Space to Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}
