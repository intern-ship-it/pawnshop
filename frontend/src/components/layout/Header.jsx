import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { logout } from "@/features/auth/authSlice";
import { toggleSidebar } from "@/features/ui/uiSlice";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";
import { getStorageItem, STORAGE_KEYS } from "@/utils/localStorage";
import goldPriceService from "@/services/goldPriceService";
import {
  Menu,
  Search,
  Bell,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  LogOut,
  User,
  Settings,
  HelpCircle,
  X,
  RefreshCw,
  AlertCircle,
  Building2,
  Landmark,
  ArrowUpDown,
} from "lucide-react";

export default function Header() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user, role } = useAppSelector((state) => state.auth);
  const { sidebarCollapsed } = useAppSelector((state) => state.ui);

  // Get gold price settings from localStorage (same source as SettingsScreen)
  const [goldPriceSettings, setGoldPriceSettings] = useState(() => {
    const stored = getStorageItem(STORAGE_KEYS.SETTINGS, null);
    return stored?.goldPrice || { source: "api", manualPrice: 320 };
  });

  // Listen for settings updates from SettingsScreen
  useEffect(() => {
    const handleSettingsUpdate = (event) => {
      console.log("Settings updated event received:", event.detail);
      if (event.detail?.goldPrice) {
        const newGoldPriceSettings = event.detail.goldPrice;
        setGoldPriceSettings(newGoldPriceSettings);
        // Clear any existing errors
        setGoldError(null);
        // Clear cache to ensure fresh data on next API call
        goldPriceService.clearCache();
        // Immediately update gold prices with new settings (not stale state)
        fetchGoldPricesWithSettings(newGoldPriceSettings, true);
      }
    };

    window.addEventListener("settingsUpdated", handleSettingsUpdate);
    return () =>
      window.removeEventListener("settingsUpdated", handleSettingsUpdate);
  }, []);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [goldPriceDropdownOpen, setGoldPriceDropdownOpen] = useState(false);

  // Gold price state
  const [goldPrices, setGoldPrices] = useState(null);
  const [goldLoading, setGoldLoading] = useState(true);
  const [goldError, setGoldError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  const [selectedPurity, setSelectedPurity] = useState("916"); // Default to 916
  const [cacheAge, setCacheAge] = useState("");

  const goldDropdownRef = useRef(null);

  // Mock notifications
  const notifications = [
    {
      id: 1,
      type: "warning",
      message: "3 pledges expiring today",
      time: "5 min ago",
    },
    { id: 2, type: "info", message: "Gold price updated", time: "1 hour ago" },
    {
      id: 3,
      type: "success",
      message: "Daily reconciliation complete",
      time: "2 hours ago",
    },
  ];

  // Purity definitions
  const purities = [
    { code: "999", karat: "24K", percentage: 99.9 },
    { code: "916", karat: "22K", percentage: 91.6 },
    { code: "875", karat: "21K", percentage: 87.5 },
    { code: "750", karat: "18K", percentage: 75.0 },
    { code: "585", karat: "14K", percentage: 58.5 },
    { code: "375", karat: "9K", percentage: 37.5 },
  ];

  // Fetch gold prices on mount and when settings change
  useEffect(() => {
    fetchGoldPrices();
  }, [goldPriceSettings?.source, goldPriceSettings?.manualPrice]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        goldDropdownRef.current &&
        !goldDropdownRef.current.contains(event.target)
      ) {
        setGoldPriceDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchGoldPrices = async (
    forceRefresh = false,
    overrideSettings = null,
  ) => {
    // Use override settings if provided, otherwise use state
    const settings = overrideSettings || goldPriceSettings;

    try {
      setGoldLoading(true);
      setGoldError(null);

      // Check settings source
      const source = settings?.source || "api";

      if (source === "manual") {
        // Use manual prices from settings
        const manualPrice = parseFloat(settings?.manualPrice) || 0;
        if (manualPrice > 0) {
          // Calculate prices for each purity based on manual 999 price
          const calculatedPrices = {};
          purities.forEach((p) => {
            calculatedPrices[p.code] = manualPrice * (p.percentage / 100);
          });

          setGoldPrices({
            source: "manual",
            price999: manualPrice,
            carat: calculatedPrices,
            lastUpdated: settings?.lastUpdated || new Date().toISOString(),
            updatedBy: settings?.updatedBy || "Admin",
          });
          setGoldError(null); // Clear any previous errors
          setIsFromCache(false);
          setCacheAge("");
        } else {
          setGoldError("Manual price not set");
        }
      } else {
        // Fetch from API (with caching)
        try {
          const response =
            await goldPriceService.getDashboardPrices(forceRefresh);

          console.log("Gold price API response:", response);

          if (response.success && response.data) {
            const data = response.data;

            // Get 999 price - try multiple sources
            let price999 = 0;

            // From purity_codes
            if (data.purity_codes?.["999"]) {
              price999 = data.purity_codes["999"];
            }
            // From carat object
            else if (data.carat?.["999"]) {
              price999 = data.carat["999"];
            }
            // From price999 directly
            else if (data.price999) {
              price999 = data.price999;
            }
            // From current prices
            else if (data.current?.prices?.gold?.per_gram) {
              price999 = data.current.prices.gold.per_gram;
            }

            // Get carat prices from API or calculate
            const caratPrices = data.purity_codes || data.carat || {};

            // Ensure we have prices for all purities
            const allPrices = {};
            purities.forEach((p) => {
              allPrices[p.code] =
                caratPrices[p.code] || price999 * (p.percentage / 100);
            });

            setGoldPrices({
              source: response.fromCache ? "cache" : data.source || "api",
              price999: price999,
              carat: allPrices,
              // BID/ASK from Metals.Dev
              bid_price_999: data.bid_price_999,
              ask_price_999: data.ask_price_999,
              // BNM prices
              bnm_buying_999: data.bnm_buying_999,
              bnm_selling_999: data.bnm_selling_999,
              // Price date
              price_date: data.price_date,
              // Change info
              change: data.change,
              lastUpdated: data.updated_at || new Date().toISOString(),
            });

            // Set cache status
            setIsFromCache(response.fromCache || false);
            setCacheAge(response.cacheAge || "");

            if (!price999) {
              setGoldError("No gold price available");
            } else {
              // Clear any previous errors when we have a valid price
              setGoldError(null);
            }
          } else {
            setGoldError(response.message || "Failed to load prices");
          }
        } catch (apiError) {
          console.error("API fetch error:", apiError);
          setGoldError("API error: " + (apiError.message || "Request failed"));
        }
      }
    } catch (err) {
      console.error("Gold price error:", err);
      setGoldError("Failed to load");
    } finally {
      setGoldLoading(false);
    }
  };

  // Wrapper to call fetchGoldPrices with specific settings (used by event handler)
  const fetchGoldPricesWithSettings = (settings, forceRefresh = false) => {
    fetchGoldPrices(forceRefresh, settings);
  };

  const handleRefreshGoldPrice = async () => {
    setRefreshing(true);
    try {
      // Force refresh from API
      await goldPriceService.refreshPrices();
      await fetchGoldPrices(true);
    } catch (err) {
      console.error("Refresh error:", err);
    } finally {
      setRefreshing(false);
    }
  };

  // Get source indicator color and label
  const getSourceInfo = () => {
    if (goldError)
      return { color: "text-red-500", label: "❌ Error", bg: "bg-red-100" };
    switch (goldPrices?.source) {
      case "metals_dev":
        return {
          color: "text-green-600",
          label: "Metals.Dev",
          bg: "bg-green-100",
          icon: "🟢",
        };
      case "bnm":
      case "bnm_kijang":
        return {
          color: "text-blue-600",
          label: "BNM Kijang",
          bg: "bg-blue-100",
          icon: "🏛️",
        };
      case "cache":
        return {
          color: "text-yellow-600",
          label: `Cached (${cacheAge})`,
          bg: "bg-yellow-100",
          icon: "🟡",
        };
      case "manual":
        return {
          color: "text-purple-600",
          label: "Manual",
          bg: "bg-purple-100",
          icon: "✏️",
        };
      case "api":
        return {
          color: "text-green-600",
          label: "API",
          bg: "bg-green-100",
          icon: "🟢",
        };
      default:
        return {
          color: "text-zinc-500",
          label: "Unknown",
          bg: "bg-zinc-100",
          icon: "⚪",
        };
    }
  };

  const sourceInfo = getSourceInfo();

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      console.log("Searching for:", searchQuery);
      setSearchOpen(false);
      setSearchQuery("");
    }
  };

  // Format price helper
  const formatPrice = (price) => {
    if (price === null || price === undefined || isNaN(price)) return "-";
    return `RM ${Number(price).toFixed(2)}`;
  };

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-30 h-16",
        "bg-white/80 backdrop-blur-md border-b border-zinc-200",
        "transition-all duration-300",
        sidebarCollapsed ? "left-20" : "left-64",
      )}
    >
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Left Section - HQ Badge */}
        <div className="flex items-center gap-4">
          {/* Mobile Menu Toggle */}
          <button
            onClick={() => dispatch(toggleSidebar())}
            className="lg:hidden p-2 rounded-lg text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* HQ Label */}
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-zinc-100 rounded-lg text-zinc-600">
            <Building2 className="w-4 h-4 text-zinc-500" />
            <span className="text-sm font-medium">HQ - Kuala Lumpur</span>
          </div>

          {/* Gold Price Widget */}
          <div className="relative" ref={goldDropdownRef}>
            <button
              onClick={() => setGoldPriceDropdownOpen(!goldPriceDropdownOpen)}
              className={cn(
                "hidden md:flex items-center gap-2 px-4 py-2 rounded-xl transition-all",
                goldError
                  ? "bg-red-100 text-red-700"
                  : "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30",
              )}
            >
              {goldLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : goldError ? (
                <>
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Gold price error</span>
                </>
              ) : (
                <>
                  <span className="text-xs font-semibold text-white/80">
                    GOLD ({selectedPurity})
                  </span>
                  <span className="text-base font-bold">
                    RM{" "}
                    {Number(
                      goldPrices?.carat?.[selectedPurity] ||
                        goldPrices?.price999 ||
                        0,
                    ).toFixed(2)}
                    /g
                  </span>
                  {/* Trend Indicator */}
                  {goldPrices?.change &&
                    goldPrices.change.amount !== null &&
                    goldPrices.change.amount !== 0 && (
                      <span
                        className={cn(
                          "flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded",
                          goldPrices.change.direction === "up"
                            ? "bg-green-500/30 text-green-100"
                            : "bg-red-500/30 text-red-100",
                        )}
                      >
                        {goldPrices.change.direction === "up" ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {Number(goldPrices.change.percent || 0).toFixed(2)}%
                      </span>
                    )}
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-white/70 transition-transform",
                      goldPriceDropdownOpen && "rotate-180",
                    )}
                  />
                </>
              )}
            </button>

            {/* Gold Price Dropdown - Enhanced */}
            {goldPriceDropdownOpen && !goldError && goldPrices && (
              <div className="absolute top-full left-0 mt-2 w-96 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 overflow-hidden">
                {/* Header */}
                <div className="p-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-white/80">Gold Price (999)</p>
                      <div className="flex items-center gap-2">
                        <p className="text-2xl font-bold">
                          {formatPrice(goldPrices.price999)}/g
                        </p>
                        {/* Trend Badge */}
                        {goldPrices.change &&
                          goldPrices.change.amount !== null &&
                          goldPrices.change.amount !== 0 && (
                            <span
                              className={cn(
                                "flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-lg",
                                goldPrices.change.direction === "up"
                                  ? "bg-green-500/30 text-green-100"
                                  : "bg-red-500/30 text-red-100",
                              )}
                            >
                              {goldPrices.change.direction === "up" ? (
                                <TrendingUp className="w-4 h-4" />
                              ) : (
                                <TrendingDown className="w-4 h-4" />
                              )}
                              {Number(goldPrices.change.percent || 0).toFixed(
                                2,
                              )}
                              %
                            </span>
                          )}
                      </div>
                    </div>
                    <button
                      onClick={handleRefreshGoldPrice}
                      disabled={refreshing}
                      className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                      title="Refresh prices from API"
                    >
                      <RefreshCw
                        className={cn("w-5 h-5", refreshing && "animate-spin")}
                      />
                    </button>
                  </div>

                  {/* Source Badge */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-white/90 bg-white/20 px-2 py-0.5 rounded-full">
                      {sourceInfo.icon} {sourceInfo.label}
                    </span>
                    {isFromCache && (
                      <span className="text-xs text-white/60">
                        (saves API quota)
                      </span>
                    )}
                  </div>
                </div>

                {/* Active Source Price Details - Shows only the active source */}
                <div className="p-4 bg-zinc-50 border-b border-zinc-100">
                  {/* Metals.Dev Active */}
                  {goldPrices.source === "metals_dev" &&
                    goldPrices.bid_price_999 && (
                      <div className="p-3 bg-white rounded-lg border border-green-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-sm font-medium text-zinc-700">
                              Metals.Dev
                            </span>
                            <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                              Real-time
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center p-2 bg-green-50 rounded-lg">
                            <p className="text-xs text-zinc-500 mb-1">
                              BID (Buy)
                            </p>
                            <p className="text-lg font-bold text-green-700">
                              {formatPrice(goldPrices.bid_price_999)}
                            </p>
                            <p className="text-[10px] text-green-600">
                              Use for valuation
                            </p>
                          </div>
                          <div className="text-center p-2 bg-zinc-100 rounded-lg">
                            <p className="text-xs text-zinc-500 mb-1">
                              ASK (Sell)
                            </p>
                            <p className="text-lg font-semibold text-zinc-700">
                              {formatPrice(goldPrices.ask_price_999)}
                            </p>
                            <p className="text-[10px] text-zinc-500">
                              Market sell
                            </p>
                          </div>
                          <div className="text-center p-2 bg-zinc-100 rounded-lg">
                            <p className="text-xs text-zinc-500 mb-1">Spread</p>
                            <p className="text-lg font-semibold text-zinc-600">
                              {formatPrice(
                                goldPrices.ask_price_999 -
                                  goldPrices.bid_price_999,
                              )}
                            </p>
                            <p className="text-[10px] text-zinc-500">
                              Difference
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                  {/* BNM Kijang Active (Fallback) */}
                  {(goldPrices.source === "bnm" ||
                    goldPrices.source === "bnm_kijang") &&
                    goldPrices.bnm_buying_999 && (
                      <div className="p-3 bg-white rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Landmark className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-zinc-700">
                              BNM Kijang Emas
                            </span>
                            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                              Official
                            </span>
                          </div>
                        </div>
                        {/* Fallback Notice */}
                        <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-xs text-amber-700">
                            ⚠️ Using BNM as fallback (Metals.Dev unavailable)
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center p-2 bg-blue-50 rounded-lg">
                            <p className="text-xs text-zinc-500 mb-1">Buying</p>
                            <p className="text-lg font-bold text-blue-700">
                              {formatPrice(goldPrices.bnm_buying_999)}
                            </p>
                            <p className="text-[10px] text-blue-600">
                              Use for valuation
                            </p>
                          </div>
                          <div className="text-center p-2 bg-zinc-100 rounded-lg">
                            <p className="text-xs text-zinc-500 mb-1">
                              Selling
                            </p>
                            <p className="text-lg font-semibold text-zinc-700">
                              {formatPrice(goldPrices.bnm_selling_999)}
                            </p>
                            <p className="text-[10px] text-zinc-500">
                              BNM sell price
                            </p>
                          </div>
                          <div className="text-center p-2 bg-zinc-100 rounded-lg">
                            <p className="text-xs text-zinc-500 mb-1">Spread</p>
                            <p className="text-lg font-semibold text-zinc-600">
                              {formatPrice(
                                goldPrices.bnm_selling_999 -
                                  goldPrices.bnm_buying_999,
                              )}
                            </p>
                            <p className="text-[10px] text-zinc-500">Premium</p>
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Manual Price Active */}
                  {goldPrices.source === "manual" && (
                    <div className="p-3 bg-white rounded-lg border border-purple-200">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm">✏️</span>
                        <span className="text-sm font-medium text-zinc-700">
                          Manual Price
                        </span>
                        <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                          Set by Admin
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500">
                        Price manually configured in Settings. Enable API for
                        real-time rates.
                      </p>
                    </div>
                  )}

                  {/* Cache Notice */}
                  {goldPrices.source === "cache" && (
                    <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-xs text-yellow-700">
                        🟡 Using cached data ({cacheAge}) - Click refresh for
                        latest prices
                      </p>
                    </div>
                  )}
                </div>

                {/* Purity Prices */}
                <div className="p-4">
                  <p className="text-xs font-medium text-zinc-500 mb-3 uppercase tracking-wider">
                    Price by Purity{" "}
                    <span className="text-zinc-400 normal-case">
                      (Click to set as default)
                    </span>
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {purities.map((purity) => (
                      <button
                        key={purity.code}
                        onClick={() => setSelectedPurity(purity.code)}
                        className={cn(
                          "flex flex-col items-center p-2.5 rounded-lg border transition-all",
                          selectedPurity === purity.code
                            ? "bg-amber-50 border-amber-300 ring-1 ring-amber-300"
                            : "bg-zinc-50 border-zinc-100 hover:border-amber-200 hover:bg-amber-50/50",
                        )}
                      >
                        <span
                          className={cn(
                            "text-sm font-bold",
                            selectedPurity === purity.code
                              ? "text-amber-700"
                              : "text-zinc-700",
                          )}
                        >
                          {purity.code}
                        </span>
                        <span className="text-[10px] text-zinc-400 mb-1">
                          {purity.karat}
                        </span>
                        <span
                          className={cn(
                            "text-xs font-semibold",
                            selectedPurity === purity.code
                              ? "text-amber-600"
                              : "text-zinc-600",
                          )}
                        >
                          {formatPrice(goldPrices.carat?.[purity.code])}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-400">
                      Updated:{" "}
                      {new Date(goldPrices.lastUpdated).toLocaleString("en-MY")}
                    </p>
                    {goldPrices.price_date && (
                      <p className="text-xs text-zinc-400">
                        Price Date: {goldPrices.price_date}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => navigate("/settings")}
                    className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                  >
                    Settings →
                  </button>
                </div>
              </div>
            )}

            {/* Error Dropdown */}
            {goldPriceDropdownOpen && goldError && (
              <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-red-200 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="p-4 bg-red-50">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-medium">Gold Price Error</span>
                  </div>
                  <p className="text-sm text-red-600 mt-2">{goldError}</p>
                </div>
                <div className="p-4 flex gap-2">
                  <button
                    onClick={handleRefreshGoldPrice}
                    disabled={refreshing}
                    className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
                  >
                    {refreshing ? (
                      <RefreshCw className="w-4 h-4 animate-spin mx-auto" />
                    ) : (
                      "Retry"
                    )}
                  </button>
                  <button
                    onClick={() => navigate("/settings")}
                    className="px-4 py-2 bg-zinc-100 text-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors"
                  >
                    Settings
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3 md:gap-4">
          {/* Search Bar (Persistent) */}
          <div className="hidden md:flex items-center relative w-64 h-10">
            <Search className="absolute left-3 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full h-full pl-10 pr-4 bg-zinc-100 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all placeholder:text-zinc-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Mobile Search Icon */}
          <button
            onClick={() => setSearchOpen(true)}
            className="md:hidden p-2 rounded-lg text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setNotificationOpen(!notificationOpen)}
              className="relative p-2 rounded-lg text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {/* Notification Badge */}
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
            </button>

            {/* Notification Dropdown */}
            {notificationOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setNotificationOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-zinc-200 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-100">
                    <h3 className="font-semibold text-zinc-800">
                      Notifications
                    </h3>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className="px-4 py-3 border-b border-zinc-50 hover:bg-zinc-50 cursor-pointer transition-colors"
                      >
                        <p className="text-sm text-zinc-700">{notif.message}</p>
                        <p className="text-xs text-zinc-400 mt-1">
                          {notif.time}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-3 bg-zinc-50 border-t border-zinc-100">
                    <button className="text-sm text-amber-600 hover:text-amber-700 font-medium">
                      View All Notifications
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </div>

              {/* Name & Role (Hidden on mobile) */}
              <div className="hidden lg:block text-left">
                <p className="text-sm font-medium text-zinc-800">
                  {user?.name || "User"}
                </p>
                <p className="text-xs text-zinc-500">{role?.name || "Staff"}</p>
              </div>

              <ChevronDown className="hidden lg:block w-4 h-4 text-zinc-400" />
            </button>

            {/* User Dropdown */}
            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setUserMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-zinc-200 z-50 overflow-hidden">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-zinc-100">
                    <p className="font-medium text-zinc-800">
                      {user?.name || "User"}
                    </p>
                    <p className="text-sm text-zinc-500">
                      {user?.email || "user@example.com"}
                    </p>
                  </div>

                  {/* Menu Items */}
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate("/profile");
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-600 hover:text-zinc-800 hover:bg-zinc-50 rounded-lg transition-colors"
                    >
                      <User className="w-4 h-4" />
                      My Profile
                    </button>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate("/settings");
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-600 hover:text-zinc-800 hover:bg-zinc-50 rounded-lg transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </button>
                    <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-600 hover:text-zinc-800 hover:bg-zinc-50 rounded-lg transition-colors">
                      <HelpCircle className="w-4 h-4" />
                      Help & Support
                    </button>
                  </div>

                  {/* Logout */}
                  <div className="p-2 border-t border-zinc-100">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Search Overlay */}
      {searchOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 md:hidden">
          <div className="bg-white p-4">
            <form onSubmit={handleSearch} className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search pledges, customers..."
                  className="w-full h-12 pl-12 pr-4 bg-zinc-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(false);
                  setSearchQuery("");
                }}
                className="p-3 rounded-xl bg-zinc-100 text-zinc-500"
              >
                <X className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
