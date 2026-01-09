import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch } from "@/app/hooks";
import { addToast } from "@/features/ui/uiSlice";
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
} from "@/utils/localStorage";
import { settingsService } from "@/services";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { Card, Button, Input, Select, Badge, Modal } from "@/components/common";
import goldPriceService from "@/services/goldPriceService";
import {
  Settings,
  Building2,
  DollarSign,
  Percent,
  TrendingUp,
  TrendingDown,
  Package,
  Grid3X3,
  Gem,
  Scale,
  Save,
  Plus,
  Trash2,
  Edit,
  Check,
  X,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Info,
  Clock,
  Calculator,
  Users,
  ChevronRight,
  MessageCircle,
  Loader2,
} from "lucide-react";
import WhatsAppSettings from "./WhatsAppSettings";
import storageService from "@/services/storageService";

// Default settings structure
const defaultSettings = {
  company: {
    name: "Dsara Asset Ventures Sdn Bhd",
    license: "KPKT-PG-12345",
    address: "No. 123, Jalan Utama, 50000 Kuala Lumpur",
    phone: "03-1234 5678",
    email: "info@dsara.com",
    receiptHeader: "PAJAK GADAI BERLESEN",
    receiptFooter: "Terima kasih atas sokongan anda",
  },
  goldPrice: {
    source: "api", // 'api' or 'manual'
    apiUrl: "",
    manualPrice: 320.0,
    lastUpdated: new Date().toISOString(),
    updatedBy: "System",
  },
  marginPresets: [
    { id: 1, value: 80, label: "80%", isDefault: true },
    { id: 2, value: 70, label: "70%", isDefault: false },
    { id: 3, value: 60, label: "60%", isDefault: false },
  ],
  interestRules: {
    tier1: { months: 6, rate: 0.5, label: "First 6 months" },
    tier2: { months: 12, rate: 1.5, label: "After 6 months (maintained)" },
    tier3: { months: 999, rate: 2.0, label: "Overdue (not maintained)" },
    gracePeriodDays: 7,
  },
  categories: [
    { id: 1, name: "Ring", nameMs: "Cincin", active: true },
    { id: 2, name: "Chain", nameMs: "Rantai", active: true },
    { id: 3, name: "Bangle", nameMs: "Gelang", active: true },
    { id: 4, name: "Bracelet", nameMs: "Rantai Tangan", active: true },
    { id: 5, name: "Necklace", nameMs: "Kalung", active: true },
    { id: 6, name: "Earring", nameMs: "Anting-anting", active: true },
    { id: 7, name: "Pendant", nameMs: "Loket", active: true },
    { id: 8, name: "Brooch", nameMs: "Kerongsang", active: true },
    { id: 9, name: "Gold Bar", nameMs: "Jongkong Emas", active: true },
    { id: 10, name: "Other", nameMs: "Lain-lain", active: true },
  ],
  purities: [
    { id: 1, value: "999", label: "999 (24K)", factor: 0.999, active: true },
    { id: 2, value: "916", label: "916 (22K)", factor: 0.916, active: true },
    { id: 3, value: "835", label: "835 (20K)", factor: 0.835, active: true },
    { id: 4, value: "750", label: "750 (18K)", factor: 0.75, active: true },
    { id: 5, value: "375", label: "375 (9K)", factor: 0.375, active: true },
  ],
  stoneDeduction: {
    defaultType: "percentage", // 'percentage' or 'fixed'
    defaultValue: 5,
    categoryRules: [],
  },
  racks: [
    { id: "A", name: "Rack A", slots: 20, description: "Main storage" },
    { id: "B", name: "Rack B", slots: 20, description: "Secondary storage" },
    { id: "C", name: "Rack C", slots: 15, description: "Forfeited items" },
  ],
};

// Tabs configuration
const tabs = [
  { id: "company", label: "Company", icon: Building2 },
  { id: "goldPrice", label: "Gold Price", icon: DollarSign },
  { id: "margin", label: "Margin %", icon: Percent },
  { id: "interest", label: "Interest Rules", icon: TrendingUp },
  { id: "categories", label: "Categories", icon: Package },
  { id: "purities", label: "Purities", icon: Gem },
  { id: "stoneDeduction", label: "Stone Deduction", icon: Scale },
  { id: "racks", label: "Racks", icon: Grid3X3 },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
];

export default function SettingsScreen() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState("company");
  const [settings, setSettings] = useState(() => {
    const stored = getStorageItem(STORAGE_KEYS.SETTINGS, null);
    return stored ? { ...defaultSettings, ...stored } : defaultSettings;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  // Save settings to API
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const apiPayload = transformFrontendToApi(settings);
      const response = await settingsService.update(apiPayload);

      if (response.success) {
        setStorageItem(STORAGE_KEYS.SETTINGS, settings);
        setHasChanges(false);
        window.dispatchEvent(
          new CustomEvent("settingsUpdated", { detail: settings })
        );
        dispatch(
          addToast({
            type: "success",
            title: "Saved",
            message: "Settings have been saved successfully",
          })
        );
      } else {
        throw new Error(response.message || "Save failed");
      }
    } catch (error) {
      console.error("API save failed:", error);
      // Fallback: Save to localStorage anyway
      setStorageItem(STORAGE_KEYS.SETTINGS, settings);
      setHasChanges(false);
      window.dispatchEvent(
        new CustomEvent("settingsUpdated", { detail: settings })
      );
      dispatch(
        addToast({
          type: "warning",
          title: "Saved Locally",
          message: "Settings saved locally. Will sync to server when online.",
        })
      );
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================
  // LOAD SETTINGS FROM API ON MOUNT - ADD THIS BLOCK
  // ============================================
  useEffect(() => {
    const loadSettingsFromApi = async () => {
      setIsLoading(true);
      try {
        const response = await settingsService.getAll();
        if (response.success && response.data) {
          const transformed = transformApiToFrontend(response.data);
          const merged = { ...settings, ...transformed };
          setSettings(merged);
          setStorageItem(STORAGE_KEYS.SETTINGS, merged);
        }
      } catch (error) {
        console.error("Failed to load settings from API:", error);
        // Keep using localStorage data (already loaded)
      } finally {
        setIsLoading(false);
      }
    };
    loadSettingsFromApi();
  }, []);
  // Update settings helper
  const updateSettings = (section, data) => {
    setSettings((prev) => ({
      ...prev,
      [section]: typeof data === "function" ? data(prev[section]) : data,
    }));
    setHasChanges(true);
  };

  // ============================================
  // API TRANSFORM HELPERS - ADD THIS BLOCK
  // ============================================
  const transformApiToFrontend = (apiData) => {
    const result = { ...defaultSettings };
    if (!apiData) return result;

    // Transform company settings from API grouped format
    if (apiData.company && Array.isArray(apiData.company)) {
      const companyMap = {};
      apiData.company.forEach((s) => {
        companyMap[s.key_name] = s.value;
      });
      result.company = {
        name: companyMap.name || defaultSettings.company.name,
        license: companyMap.registration_no || defaultSettings.company.license,
        address: companyMap.address || defaultSettings.company.address,
        phone: companyMap.phone || defaultSettings.company.phone,
        email: companyMap.email || defaultSettings.company.email,
        receiptHeader:
          companyMap.receipt_header || defaultSettings.company.receiptHeader,
        receiptFooter:
          companyMap.receipt_footer || defaultSettings.company.receiptFooter,
      };
    }

    // Transform pledge settings
    if (apiData.pledge && Array.isArray(apiData.pledge)) {
      const pledgeMap = {};
      apiData.pledge.forEach((s) => {
        pledgeMap[s.key_name] = s.value;
      });
      if (pledgeMap.default_loan_percentage) {
        const defaultPct = parseInt(pledgeMap.default_loan_percentage);
        result.marginPresets = result.marginPresets.map((m) => ({
          ...m,
          isDefault: m.value === defaultPct,
        }));
      }
      if (pledgeMap.grace_period_days) {
        result.interestRules.gracePeriodDays = parseInt(
          pledgeMap.grace_period_days
        );
      }
    }

    return result;
  };

  const transformFrontendToApi = (settings) => {
    const apiSettings = [];

    // Company settings
    if (settings.company) {
      apiSettings.push(
        { category: "company", key_name: "name", value: settings.company.name },
        {
          category: "company",
          key_name: "registration_no",
          value: settings.company.license,
        },
        {
          category: "company",
          key_name: "address",
          value: settings.company.address,
        },
        {
          category: "company",
          key_name: "phone",
          value: settings.company.phone,
        },
        {
          category: "company",
          key_name: "email",
          value: settings.company.email,
        },
        {
          category: "company",
          key_name: "receipt_header",
          value: settings.company.receiptHeader,
        },
        {
          category: "company",
          key_name: "receipt_footer",
          value: settings.company.receiptFooter,
        }
      );
    }

    // Margin - save default percentage
    if (settings.marginPresets) {
      const defaultMargin = settings.marginPresets.find((m) => m.isDefault);
      if (defaultMargin) {
        apiSettings.push({
          category: "pledge",
          key_name: "default_loan_percentage",
          value: String(defaultMargin.value),
        });
      }
    }

    // Interest rules
    if (settings.interestRules) {
      apiSettings.push({
        category: "pledge",
        key_name: "grace_period_days",
        value: String(settings.interestRules.gracePeriodDays),
      });
    }

    return apiSettings;
  };
  // Render tab content
  const renderTabContent = () => {
    if (isLoading) {
      return (
        <Card className="p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
          <span className="ml-3 text-zinc-600">Loading settings...</span>
        </Card>
      );
    }
    switch (activeTab) {
      case "company":
        return (
          <CompanyTab settings={settings} updateSettings={updateSettings} />
        );
      case "goldPrice":
        return (
          <GoldPriceTab
            settings={settings}
            updateSettings={updateSettings}
            dispatch={dispatch}
          />
        );
      case "margin":
        return (
          <MarginTab settings={settings} updateSettings={updateSettings} />
        );
      case "interest":
        return (
          <InterestTab settings={settings} updateSettings={updateSettings} />
        );
      case "categories":
        return (
          <CategoriesTab settings={settings} updateSettings={updateSettings} />
        );
      case "purities":
        return (
          <PuritiesTab settings={settings} updateSettings={updateSettings} />
        );
      case "stoneDeduction":
        return (
          <StoneDeductionTab
            settings={settings}
            updateSettings={updateSettings}
          />
        );
      case "racks":
        return <RacksTab settings={settings} updateSettings={updateSettings} />;
      case "whatsapp":
        return <WhatsAppSettings />;
      default:
        return null;
    }
  };

  return (
    <PageWrapper
      title="Settings"
      subtitle="Configure system settings and master data"
      actions={
        <Button
          variant="accent"
          leftIcon={Save}
          onClick={handleSave}
          loading={isSaving}
          disabled={!hasChanges || isLoading}
        >
          Save Changes
        </Button>
      }
    >
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tabs Sidebar */}
        <div className="lg:w-64 flex-shrink-0">
          <Card className="p-2">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all",
                      activeTab === tab.id
                        ? "bg-amber-500/10 text-amber-600 font-medium"
                        : "text-zinc-600 hover:bg-zinc-50"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-5 h-5",
                        activeTab === tab.id
                          ? "text-amber-500"
                          : "text-zinc-400"
                      )}
                    />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </Card>

          {/* Unsaved Changes Warning */}
          {hasChanges && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4"
            >
              <Card className="p-4 border-amber-200 bg-amber-50">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      Unsaved Changes
                    </p>
                    <p className="text-xs text-amber-600 mt-1">
                      Don't forget to save your changes.
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* User Management Link */}
          <Card
            className="mt-4 p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate("/settings/users")}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-zinc-800">User Management</p>
                  <p className="text-xs text-zinc-500">
                    Manage users & permissions
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-400" />
            </div>
          </Card>
        </div>

        {/* Tab Content */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </PageWrapper>
  );
}

// ============================================
// TAB COMPONENTS
// ============================================

// Company Tab
function CompanyTab({ settings, updateSettings }) {
  const company = settings.company;

  const handleChange = (field, value) => {
    updateSettings("company", { ...company, [field]: value });
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-zinc-800 mb-6 flex items-center gap-2">
        <Building2 className="w-5 h-5 text-amber-500" />
        Company Information
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="Company Name"
          value={company.name}
          onChange={(e) => handleChange("name", e.target.value)}
          placeholder="Enter company name"
        />
        <Input
          label="License Number (KPKT)"
          value={company.license}
          onChange={(e) => handleChange("license", e.target.value)}
          placeholder="KPKT-PG-XXXXX"
        />
        <div className="md:col-span-2">
          <Input
            label="Address"
            value={company.address}
            onChange={(e) => handleChange("address", e.target.value)}
            placeholder="Full business address"
          />
        </div>
        <Input
          label="Phone"
          value={company.phone}
          onChange={(e) => handleChange("phone", e.target.value)}
          placeholder="03-XXXX XXXX"
        />
        <Input
          label="Email"
          type="email"
          value={company.email}
          onChange={(e) => handleChange("email", e.target.value)}
          placeholder="info@company.com"
        />
        <div className="md:col-span-2">
          <Input
            label="Receipt Header Text"
            value={company.receiptHeader}
            onChange={(e) => handleChange("receiptHeader", e.target.value)}
            placeholder="Text shown at top of receipts"
          />
        </div>
        <div className="md:col-span-2">
          <Input
            label="Receipt Footer Text"
            value={company.receiptFooter}
            onChange={(e) => handleChange("receiptFooter", e.target.value)}
            placeholder="Text shown at bottom of receipts"
          />
        </div>
      </div>
    </Card>
  );
}

// ============================================
// GOLD PRICE TAB - WITH REAL API INTEGRATION
// ============================================
function GoldPriceTab({ settings, updateSettings, dispatch }) {
  const goldPrice = settings.goldPrice;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [apiPrices, setApiPrices] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [apiLoading, setApiLoading] = useState(false);

  // Purity definitions for display
  const purities = [
    { code: "999", karat: "24K", percentage: 99.9 },
    { code: "916", karat: "22K", percentage: 91.6 },
    { code: "875", karat: "21K", percentage: 87.5 },
    { code: "750", karat: "18K", percentage: 75.0 },
    { code: "585", karat: "14K", percentage: 58.5 },
    { code: "375", karat: "9K", percentage: 37.5 },
  ];

  // Fetch API prices when source is 'api'
  useEffect(() => {
    if (goldPrice.source === "api") {
      fetchApiPrices();
    }
  }, [goldPrice.source]);

  const handleChange = (field, value) => {
    updateSettings("goldPrice", {
      ...goldPrice,
      [field]: value,
      lastUpdated: new Date().toISOString(),
      updatedBy: "Admin",
    });
  };

  // Fetch prices from real API
  const fetchApiPrices = async () => {
    try {
      setApiLoading(true);
      setApiError(null);

      const response = await goldPriceService.getDashboardPrices();

      if (response.data) {
        const data = response.data;
        const price999 = data.current?.prices?.gold?.per_gram || 0;

        setApiPrices({
          price999: price999,
          carat: data.carat || {},
          source: data.current?.source || "api",
          change: data.change,
          lastUpdated: data.last_updated,
        });

        // Update settings with live price
        if (price999 > 0) {
          updateSettings("goldPrice", {
            ...goldPrice,
            manualPrice: price999,
            lastUpdated: new Date().toISOString(),
            updatedBy: "API",
          });
        }
      }
    } catch (err) {
      console.error("API fetch error:", err);
      setApiError("Failed to fetch from API. Please check backend connection.");
    } finally {
      setApiLoading(false);
    }
  };

  // Handle refresh button click
  const handleRefreshAPI = async () => {
    setIsRefreshing(true);

    try {
      if (goldPrice.source === "api") {
        // Clear cache and fetch fresh prices
        await goldPriceService.refreshPrices();
        await fetchApiPrices();

        dispatch(
          addToast({
            type: "success",
            title: "Gold Price Updated",
            message: `Live price: RM ${
              apiPrices?.price999?.toFixed(2) ||
              goldPrice.manualPrice?.toFixed(2)
            }/g`,
          })
        );
      } else {
        // Manual mode - just update timestamp
        handleChange("lastUpdated", new Date().toISOString());
        dispatch(
          addToast({
            type: "success",
            title: "Price Updated",
            message: `Manual price: RM ${goldPrice.manualPrice?.toFixed(2)}/g`,
          })
        );
      }
    } catch (err) {
      console.error("Refresh error:", err);
      dispatch(
        addToast({
          type: "error",
          title: "Refresh Failed",
          message: "Could not refresh gold price. Please try again.",
        })
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  // Get display price - API price if available, otherwise manual
  const displayPrice =
    goldPrice.source === "api" && apiPrices?.price999
      ? apiPrices.price999
      : goldPrice.manualPrice;

  // Get source indicator
  const getSourceBadge = () => {
    if (goldPrice.source === "manual") {
      return (
        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
          Manual
        </span>
      );
    }
    if (apiError) {
      return (
        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">
          API Error
        </span>
      );
    }
    if (apiPrices?.source === "metalpriceapi") {
      return (
        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
          🟢 Live
        </span>
      );
    }
    if (apiPrices?.source === "cache") {
      return (
        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs">
          🟡 Cached
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 bg-zinc-100 text-zinc-700 rounded-full text-xs">
        Loading...
      </span>
    );
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-zinc-800 mb-6 flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-amber-500" />
        Gold Price Settings
      </h2>

      {/* Current Price Display */}
      <div className="p-6 bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl text-white mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-amber-100 text-sm">Current Gold Price (999)</p>
              {getSourceBadge()}
            </div>
            <p className="text-4xl font-bold mt-1">
              {apiLoading ? (
                <span className="text-2xl">Loading...</span>
              ) : (
                `RM ${displayPrice?.toFixed(2) || "0.00"}/g`
              )}
            </p>

            {/* Price Change */}
            {goldPrice.source === "api" &&
              apiPrices?.change &&
              apiPrices.change.amount !== 0 && (
                <p
                  className={cn(
                    "text-sm mt-1 flex items-center gap-1",
                    apiPrices.change.direction === "up"
                      ? "text-green-200"
                      : "text-red-200"
                  )}
                >
                  {apiPrices.change.direction === "up" ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  {apiPrices.change.direction === "up" ? "+" : ""}
                  RM {apiPrices.change.amount?.toFixed(2)} (
                  {apiPrices.change.percent?.toFixed(2)}%)
                  <span className="text-amber-200 ml-1">vs yesterday</span>
                </p>
              )}

            <p className="text-amber-100 text-xs mt-2 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last updated:{" "}
              {new Date(
                apiPrices?.lastUpdated || goldPrice.lastUpdated
              ).toLocaleString()}
            </p>
          </div>
          <Button
            variant="outline"
            className="bg-white/20 border-white/30 text-white hover:bg-white/30"
            leftIcon={RefreshCw}
            onClick={handleRefreshAPI}
            loading={isRefreshing || apiLoading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Source Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-700 mb-3">
          Price Source
        </label>
        <div className="flex gap-4">
          <label
            className={cn(
              "flex-1 flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
              goldPrice.source === "manual"
                ? "border-amber-500 bg-amber-50"
                : "border-zinc-200 hover:border-zinc-300"
            )}
          >
            <input
              type="radio"
              name="priceSource"
              value="manual"
              checked={goldPrice.source === "manual"}
              onChange={() => handleChange("source", "manual")}
              className="sr-only"
            />
            <div
              className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                goldPrice.source === "manual"
                  ? "border-amber-500"
                  : "border-zinc-300"
              )}
            >
              {goldPrice.source === "manual" && (
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              )}
            </div>
            <div>
              <p className="font-medium text-zinc-800">Manual Entry</p>
              <p className="text-sm text-zinc-500">
                Enter price manually each day
              </p>
            </div>
          </label>

          <label
            className={cn(
              "flex-1 flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
              goldPrice.source === "api"
                ? "border-amber-500 bg-amber-50"
                : "border-zinc-200 hover:border-zinc-300"
            )}
          >
            <input
              type="radio"
              name="priceSource"
              value="api"
              checked={goldPrice.source === "api"}
              onChange={() => handleChange("source", "api")}
              className="sr-only"
            />
            <div
              className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                goldPrice.source === "api"
                  ? "border-amber-500"
                  : "border-zinc-300"
              )}
            >
              {goldPrice.source === "api" && (
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              )}
            </div>
            <div>
              <p className="font-medium text-zinc-800">API (Automatic)</p>
              <p className="text-sm text-zinc-500">Fetch from gold price API</p>
            </div>
          </label>
        </div>
      </div>

      {/* Manual Price Input */}
      {goldPrice.source === "manual" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Gold Price (RM/gram) - 999 Purity"
            type="number"
            step="0.01"
            value={goldPrice.manualPrice}
            onChange={(e) =>
              handleChange("manualPrice", parseFloat(e.target.value) || 0)
            }
            leftIcon={DollarSign}
          />
        </div>
      )}

      {/* API Status */}
      {goldPrice.source === "api" && (
        <div
          className={cn(
            "p-4 rounded-xl",
            apiError ? "bg-red-50" : "bg-green-50"
          )}
        >
          {apiError ? (
            <p className="text-sm text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {apiError}
            </p>
          ) : (
            <p className="text-sm text-green-600 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Connected to MetalPriceAPI. Prices update automatically.
            </p>
          )}
        </div>
      )}

      {/* Price by Purity Table (when API mode) */}
      {goldPrice.source === "api" && apiPrices && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-zinc-700 mb-3">
            Price by Purity (RM/gram)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {purities.map((purity) => {
              const price =
                apiPrices.carat?.[purity.code] ||
                displayPrice * (purity.percentage / 100);
              return (
                <div
                  key={purity.code}
                  className="p-3 bg-zinc-50 rounded-lg text-center"
                >
                  <p className="text-xs text-zinc-500">{purity.karat}</p>
                  <p className="text-sm font-bold text-zinc-800">
                    RM {price.toFixed(2)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

// Margin Tab
function MarginTab({ settings, updateSettings }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMargin, setNewMargin] = useState("");
  const presets = settings.marginPresets;

  const handleSetDefault = (id) => {
    const updated = presets.map((p) => ({ ...p, isDefault: p.id === id }));
    updateSettings("marginPresets", updated);
  };

  const handleDelete = (id) => {
    const updated = presets.filter((p) => p.id !== id);
    updateSettings("marginPresets", updated);
  };

  const handleAdd = () => {
    const value = parseInt(newMargin);
    if (value > 0 && value <= 100) {
      const updated = [
        ...presets,
        { id: Date.now(), value, label: `${value}%`, isDefault: false },
      ];
      updateSettings("marginPresets", updated);
      setNewMargin("");
      setShowAddModal(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-zinc-800 flex items-center gap-2">
          <Percent className="w-5 h-5 text-amber-500" />
          Margin Percentage Presets
        </h2>
        <Button
          variant="outline"
          size="sm"
          leftIcon={Plus}
          onClick={() => setShowAddModal(true)}
        >
          Add Preset
        </Button>
      </div>

      <p className="text-sm text-zinc-500 mb-6">
        These presets appear as quick-select buttons when creating a new pledge.
        The default preset will be pre-selected.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {presets.map((preset) => (
          <div
            key={preset.id}
            className={cn(
              "p-4 rounded-xl border-2 transition-all",
              preset.isDefault
                ? "border-amber-500 bg-amber-50"
                : "border-zinc-200 hover:border-zinc-300"
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-3xl font-bold text-zinc-800">
                {preset.value}%
              </span>
              {preset.isDefault && <Badge variant="success">Default</Badge>}
            </div>
            <div className="flex gap-2">
              {!preset.isDefault && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSetDefault(preset.id)}
                  className="flex-1"
                >
                  Set Default
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(preset.id)}
                className="text-red-500 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Margin Preset"
        size="sm"
      >
        <div className="p-5">
          <Input
            label="Margin Percentage"
            type="number"
            min="1"
            max="100"
            value={newMargin}
            onChange={(e) => setNewMargin(e.target.value)}
            placeholder="e.g. 75"
            rightElement={<span className="text-zinc-400">%</span>}
          />
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button variant="accent" fullWidth onClick={handleAdd}>
              Add Preset
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

// Interest Tab
function InterestTab({ settings, updateSettings }) {
  const rules = settings.interestRules;

  const handleChange = (tier, field, value) => {
    updateSettings("interestRules", {
      ...rules,
      [tier]: { ...rules[tier], [field]: value },
    });
  };

  const handleGraceChange = (value) => {
    updateSettings("interestRules", {
      ...rules,
      gracePeriodDays: parseInt(value) || 0,
    });
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-zinc-800 mb-6 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-amber-500" />
        Interest Rate Rules
      </h2>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl mb-6">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">
              Interest Calculation (KPKT Compliant)
            </p>
            <ul className="list-disc list-inside space-y-1 text-blue-600">
              <li>Interest is calculated monthly based on principal amount</li>
              <li>Tier upgrades apply to all outstanding months</li>
              <li>Renewal payments reset the "maintained" status</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Tier 1 */}
        <div className="p-4 rounded-xl border border-zinc-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <span className="text-emerald-600 font-bold text-sm">1</span>
            </div>
            <div>
              <p className="font-medium text-zinc-800">{rules.tier1.label}</p>
              <p className="text-sm text-zinc-500">
                Initial rate for new pledges
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Duration (months)"
              type="number"
              value={rules.tier1.months}
              onChange={(e) =>
                handleChange("tier1", "months", parseInt(e.target.value) || 0)
              }
            />
            <Input
              label="Interest Rate (%)"
              type="number"
              step="0.1"
              value={rules.tier1.rate}
              onChange={(e) =>
                handleChange("tier1", "rate", parseFloat(e.target.value) || 0)
              }
              rightElement={<span className="text-zinc-400">%</span>}
            />
          </div>
        </div>

        {/* Tier 2 */}
        <div className="p-4 rounded-xl border border-zinc-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
              <span className="text-amber-600 font-bold text-sm">2</span>
            </div>
            <div>
              <p className="font-medium text-zinc-800">{rules.tier2.label}</p>
              <p className="text-sm text-zinc-500">
                Rate after initial period if renewed
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Duration (months)"
              type="number"
              value={rules.tier2.months}
              onChange={(e) =>
                handleChange("tier2", "months", parseInt(e.target.value) || 0)
              }
            />
            <Input
              label="Interest Rate (%)"
              type="number"
              step="0.1"
              value={rules.tier2.rate}
              onChange={(e) =>
                handleChange("tier2", "rate", parseFloat(e.target.value) || 0)
              }
              rightElement={<span className="text-zinc-400">%</span>}
            />
          </div>
        </div>

        {/* Tier 3 */}
        <div className="p-4 rounded-xl border border-red-200 bg-red-50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-red-600 font-bold text-sm">3</span>
            </div>
            <div>
              <p className="font-medium text-zinc-800">{rules.tier3.label}</p>
              <p className="text-sm text-zinc-500">
                Penalty rate for overdue pledges
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Interest Rate (%)"
              type="number"
              step="0.1"
              value={rules.tier3.rate}
              onChange={(e) =>
                handleChange("tier3", "rate", parseFloat(e.target.value) || 0)
              }
              rightElement={<span className="text-zinc-400">%</span>}
            />
            <Input
              label="Grace Period (days)"
              type="number"
              value={rules.gracePeriodDays}
              onChange={(e) => handleGraceChange(e.target.value)}
              helperText="Days before penalty applies"
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 p-4 bg-zinc-50 rounded-xl">
        <p className="text-sm font-medium text-zinc-700 mb-2">Rate Summary:</p>
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="success">{rules.tier1.rate}%</Badge>
          <span className="text-zinc-400">→</span>
          <Badge variant="warning">{rules.tier2.rate}%</Badge>
          <span className="text-zinc-400">→</span>
          <Badge variant="error">{rules.tier3.rate}%</Badge>
        </div>
      </div>
    </Card>
  );
}

// Categories Tab
function CategoriesTab({ settings, updateSettings }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ name: "", nameMs: "" });
  const categories = settings.categories;

  const handleAdd = () => {
    if (formData.name) {
      const updated = [
        ...categories,
        {
          id: Date.now(),
          name: formData.name,
          nameMs: formData.nameMs || formData.name,
          active: true,
        },
      ];
      updateSettings("categories", updated);
      setFormData({ name: "", nameMs: "" });
      setShowAddModal(false);
    }
  };

  const handleToggle = (id) => {
    const updated = categories.map((c) =>
      c.id === id ? { ...c, active: !c.active } : c
    );
    updateSettings("categories", updated);
  };

  const handleDelete = (id) => {
    const updated = categories.filter((c) => c.id !== id);
    updateSettings("categories", updated);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-zinc-800 flex items-center gap-2">
          <Package className="w-5 h-5 text-amber-500" />
          Item Categories
        </h2>
        <Button
          variant="outline"
          size="sm"
          leftIcon={Plus}
          onClick={() => setShowAddModal(true)}
        >
          Add Category
        </Button>
      </div>

      <div className="space-y-2">
        {categories.map((category) => (
          <div
            key={category.id}
            className={cn(
              "flex items-center justify-between p-4 rounded-xl border transition-all",
              category.active
                ? "border-zinc-200 bg-white"
                : "border-zinc-100 bg-zinc-50 opacity-60"
            )}
          >
            <div className="flex items-center gap-4">
              <button
                onClick={() => handleToggle(category.id)}
                className={cn(
                  "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                  category.active
                    ? "bg-emerald-500 border-emerald-500"
                    : "border-zinc-300"
                )}
              >
                {category.active && <Check className="w-3 h-3 text-white" />}
              </button>
              <div>
                <p className="font-medium text-zinc-800">{category.name}</p>
                <p className="text-sm text-zinc-500">{category.nameMs}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(category.id)}
              className="text-zinc-400 hover:text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Category"
        size="sm"
      >
        <div className="p-5">
          <Input
            label="Category Name (English)"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Ring"
          />
          <Input
            label="Category Name (Malay)"
            value={formData.nameMs}
            onChange={(e) =>
              setFormData({ ...formData, nameMs: e.target.value })
            }
            placeholder="e.g. Cincin"
          />
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button variant="accent" fullWidth onClick={handleAdd}>
              Add Category
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

// Purities Tab
function PuritiesTab({ settings, updateSettings }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    value: "",
    label: "",
    factor: "",
  });
  const purities = settings.purities;

  const handleAdd = () => {
    if (formData.value && formData.factor) {
      const updated = [
        ...purities,
        {
          id: Date.now(),
          value: formData.value,
          label: formData.label || formData.value,
          factor: parseFloat(formData.factor) || 0,
          active: true,
        },
      ];
      updateSettings("purities", updated);
      setFormData({ value: "", label: "", factor: "" });
      setShowAddModal(false);
    }
  };

  const handleToggle = (id) => {
    const updated = purities.map((p) =>
      p.id === id ? { ...p, active: !p.active } : p
    );
    updateSettings("purities", updated);
  };

  const handleDelete = (id) => {
    const updated = purities.filter((p) => p.id !== id);
    updateSettings("purities", updated);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-zinc-800 flex items-center gap-2">
          <Gem className="w-5 h-5 text-amber-500" />
          Gold Purities
        </h2>
        <Button
          variant="outline"
          size="sm"
          leftIcon={Plus}
          onClick={() => setShowAddModal(true)}
        >
          Add Purity
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {purities.map((purity) => (
          <div
            key={purity.id}
            className={cn(
              "p-4 rounded-xl border-2 transition-all",
              purity.active
                ? "border-amber-200 bg-amber-50"
                : "border-zinc-100 bg-zinc-50 opacity-60"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold text-zinc-800">
                {purity.value}
              </span>
              <button
                onClick={() => handleToggle(purity.id)}
                className={cn(
                  "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                  purity.active
                    ? "bg-emerald-500 border-emerald-500"
                    : "border-zinc-300"
                )}
              >
                {purity.active && <Check className="w-3 h-3 text-white" />}
              </button>
            </div>
            <p className="text-sm text-zinc-500 mb-3">{purity.label}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">
                Factor: {purity.factor}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(purity.id)}
                className="text-zinc-400 hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Purity"
        size="sm"
      >
        <div className="p-5">
          <Input
            label="Purity Code"
            value={formData.value}
            onChange={(e) =>
              setFormData({ ...formData, value: e.target.value })
            }
            placeholder="e.g. 916"
          />
          <Input
            label="Display Label"
            value={formData.label}
            onChange={(e) =>
              setFormData({ ...formData, label: e.target.value })
            }
            placeholder="e.g. 916 (22K)"
          />
          <Input
            label="Factor (decimal)"
            type="number"
            step="0.001"
            value={formData.factor}
            onChange={(e) =>
              setFormData({ ...formData, factor: e.target.value })
            }
            placeholder="e.g. 0.916"
            helperText="Used for value calculation"
          />
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button variant="accent" fullWidth onClick={handleAdd}>
              Add Purity
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

// Stone Deduction Tab
function StoneDeductionTab({ settings, updateSettings }) {
  const deduction = settings.stoneDeduction;

  const handleChange = (field, value) => {
    updateSettings("stoneDeduction", { ...deduction, [field]: value });
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-zinc-800 mb-6 flex items-center gap-2">
        <Scale className="w-5 h-5 text-amber-500" />
        Stone Deduction Rules
      </h2>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl mb-6">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            Stone deduction is applied to gross weight to calculate net gold
            weight for valuation.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-3">
            Default Deduction Type
          </label>
          <div className="flex gap-4">
            <label
              className={cn(
                "flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all",
                deduction.defaultType === "percentage"
                  ? "border-amber-500 bg-amber-50"
                  : "border-zinc-200 hover:border-zinc-300"
              )}
            >
              <input
                type="radio"
                name="deductionType"
                value="percentage"
                checked={deduction.defaultType === "percentage"}
                onChange={() => handleChange("defaultType", "percentage")}
                className="sr-only"
              />
              <Percent className="w-4 h-4" />
              <span className="font-medium">Percentage</span>
            </label>
            <label
              className={cn(
                "flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all",
                deduction.defaultType === "fixed"
                  ? "border-amber-500 bg-amber-50"
                  : "border-zinc-200 hover:border-zinc-300"
              )}
            >
              <input
                type="radio"
                name="deductionType"
                value="fixed"
                checked={deduction.defaultType === "fixed"}
                onChange={() => handleChange("defaultType", "fixed")}
                className="sr-only"
              />
              <Scale className="w-4 h-4" />
              <span className="font-medium">Fixed (g)</span>
            </label>
          </div>
        </div>
        <Input
          label={`Default Value (${
            deduction.defaultType === "percentage" ? "%" : "grams"
          })`}
          type="number"
          step="0.01"
          value={deduction.defaultValue}
          onChange={(e) =>
            handleChange("defaultValue", parseFloat(e.target.value) || 0)
          }
          rightElement={
            <span className="text-zinc-400">
              {deduction.defaultType === "percentage" ? "%" : "g"}
            </span>
          }
        />
      </div>

      {/* Example Calculation */}
      <div className="p-4 bg-zinc-50 rounded-xl">
        <p className="text-sm font-medium text-zinc-700 mb-2">
          Example Calculation:
        </p>
        <div className="text-sm text-zinc-600">
          <p>Gross Weight: 10.00g</p>
          <p>
            Stone Deduction: {deduction.defaultValue}
            {deduction.defaultType === "percentage" ? "%" : "g"}
          </p>
          <p className="font-medium text-zinc-800 mt-1">
            Net Weight:{" "}
            {deduction.defaultType === "percentage"
              ? (10 * (1 - deduction.defaultValue / 100)).toFixed(2)
              : (10 - deduction.defaultValue).toFixed(2)}
            g
          </p>
        </div>
      </div>
    </Card>
  );
}

// Racks Tab - API Integrated with Vault + Box Management
function RacksTab({ settings, updateSettings }) {
  const [showAddVaultModal, setShowAddVaultModal] = useState(false);
  const [showAddBoxModal, setShowAddBoxModal] = useState(false);
  const [selectedVault, setSelectedVault] = useState(null);
  const [vaultFormData, setVaultFormData] = useState({
    name: "",
    code: "",
    description: "",
  });
  const [boxFormData, setBoxFormData] = useState({
    name: "",
    total_slots: 20,
    description: "",
  });
  const [vaults, setVaults] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingBoxes, setIsLoadingBoxes] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);

  // Fetch vaults from API on mount
  useEffect(() => {
    fetchVaults();
  }, []);

  // Fetch boxes when vault is selected
  useEffect(() => {
    if (selectedVault) {
      fetchBoxes(selectedVault.id);
    } else {
      setBoxes([]);
    }
  }, [selectedVault]);

  const fetchVaults = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await storageService.getVaults();

      if (response.success && response.data) {
        const mapped = response.data.map((vault) => ({
          id: vault.id,
          name: vault.name,
          code: vault.code,
          description: vault.description,
          total_boxes: vault.total_boxes || 0,
          boxes_count: vault.boxes_count || 0,
          is_active: vault.is_active,
        }));
        setVaults(mapped);

        // Auto-select first vault if none selected
        if (mapped.length > 0 && !selectedVault) {
          setSelectedVault(mapped[0]);
        }
      } else {
        throw new Error(response.message || "Failed to load vaults");
      }
    } catch (err) {
      console.error("Error fetching vaults:", err);
      setError("Failed to load vaults. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBoxes = async (vaultId) => {
    try {
      setIsLoadingBoxes(true);

      const response = await storageService.getBoxes(vaultId);

      if (response.success && response.data) {
        const mapped = response.data.map((box) => ({
          id: box.id,
          name: box.name,
          total_slots: box.total_slots || 0,
          occupied_slots: box.occupied_slots || 0,
          description: box.description,
        }));
        setBoxes(mapped);
      } else {
        setBoxes([]);
      }
    } catch (err) {
      console.error("Error fetching boxes:", err);
      setBoxes([]);
    } finally {
      setIsLoadingBoxes(false);
    }
  };

  const handleAddVault = async () => {
    if (!vaultFormData.name) return;

    setIsAdding(true);
    try {
      const response = await storageService.createVault({
        name: vaultFormData.name,
        code:
          vaultFormData.code ||
          vaultFormData.name.toUpperCase().replace(/\s+/g, "-"),
        description: vaultFormData.description || null,
      });

      if (response.success) {
        await fetchVaults();
        setVaultFormData({ name: "", code: "", description: "" });
        setShowAddVaultModal(false);
      } else {
        throw new Error(response.message || "Failed to create vault");
      }
    } catch (err) {
      console.error("Error creating vault:", err);
      setError(err.message || "Failed to create vault. Please try again.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddBox = async () => {
    if (!boxFormData.name || !selectedVault) return;

    setIsAdding(true);
    try {
      const response = await storageService.createBox({
        vault_id: selectedVault.id,
        name: boxFormData.name,
        total_slots: parseInt(boxFormData.total_slots) || 20,
        description: boxFormData.description || null,
      });

      if (response.success) {
        await fetchBoxes(selectedVault.id);
        await fetchVaults(); // Refresh vault counts
        setBoxFormData({ name: "", total_slots: 20, description: "" });
        setShowAddBoxModal(false);
      } else {
        throw new Error(response.message || "Failed to create box");
      }
    } catch (err) {
      console.error("Error creating box:", err);
      setError(err.message || "Failed to create box. Please try again.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteVault = async (id) => {
    const vault = vaults.find((v) => v.id === id);
    if (vault && vault.boxes_count > 0) {
      alert(
        `Cannot delete "${vault.name}" - it has ${vault.boxes_count} boxes. Please delete boxes first.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${vault?.name}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(`vault-${id}`);
    try {
      const response = await storageService.deleteVault(id);

      if (response.success) {
        if (selectedVault?.id === id) {
          setSelectedVault(null);
        }
        await fetchVaults();
      } else {
        throw new Error(response.message || "Failed to delete vault");
      }
    } catch (err) {
      console.error("Error deleting vault:", err);
      alert(err.message || "Failed to delete vault.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteBox = async (id) => {
    const box = boxes.find((b) => b.id === id);
    if (box && box.occupied_slots > 0) {
      alert(
        `Cannot delete "${box.name}" - it has ${box.occupied_slots} occupied slots. Please relocate items first.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${box?.name}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(`box-${id}`);
    try {
      const response = await storageService.deleteBox(id);

      if (response.success) {
        await fetchBoxes(selectedVault.id);
        await fetchVaults(); // Refresh vault counts
      } else {
        throw new Error(response.message || "Failed to delete box");
      }
    } catch (err) {
      console.error("Error deleting box:", err);
      alert(err.message || "Failed to delete box.");
    } finally {
      setDeletingId(null);
    }
  };

  // Calculate totals
  const totalBoxes = vaults.reduce((sum, v) => sum + (v.boxes_count || 0), 0);
  const totalSlots = boxes.reduce((sum, b) => sum + (b.total_slots || 0), 0);
  const occupiedSlots = boxes.reduce(
    (sum, b) => sum + (b.occupied_slots || 0),
    0
  );

  // Loading state
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
          <span className="ml-3 text-zinc-600">Loading storage setup...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-zinc-800 flex items-center gap-2">
          <Grid3X3 className="w-5 h-5 text-amber-500" />
          Rack / Locker Setup
        </h2>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={RefreshCw}
          onClick={() => {
            fetchVaults();
            if (selectedVault) fetchBoxes(selectedVault.id);
          }}
        >
          Refresh
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 mb-6 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            className="ml-auto"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-zinc-50 rounded-xl">
          <p className="text-sm text-zinc-500">Total Vaults</p>
          <p className="text-2xl font-bold text-zinc-800">{vaults.length}</p>
        </div>
        <div className="p-4 bg-amber-50 rounded-xl">
          <p className="text-sm text-amber-600">Total Boxes</p>
          <p className="text-2xl font-bold text-amber-600">{totalBoxes}</p>
        </div>
        <div className="p-4 bg-emerald-50 rounded-xl">
          <p className="text-sm text-emerald-600">
            {selectedVault ? `Slots in ${selectedVault.name}` : "Total Slots"}
          </p>
          <p className="text-2xl font-bold text-emerald-600">
            {occupiedSlots}{" "}
            <span className="text-sm font-normal">/ {totalSlots}</span>
          </p>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Vaults */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-zinc-800 flex items-center gap-2">
              <Package className="w-4 h-4 text-zinc-500" />
              Vaults / Racks
            </h3>
            <Button
              variant="outline"
              size="sm"
              leftIcon={Plus}
              onClick={() => setShowAddVaultModal(true)}
            >
              Add Vault
            </Button>
          </div>

          {vaults.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 border-2 border-dashed border-zinc-200 rounded-xl">
              <Package className="w-10 h-10 mx-auto mb-2 text-zinc-300" />
              <p className="text-sm">No vaults configured</p>
              <Button
                variant="link"
                size="sm"
                onClick={() => setShowAddVaultModal(true)}
              >
                Add your first vault
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {vaults.map((vault, index) => {
                const letter = String.fromCharCode(65 + index);
                const isSelected = selectedVault?.id === vault.id;

                return (
                  <div
                    key={vault.id}
                    onClick={() => setSelectedVault(vault)}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all",
                      isSelected
                        ? "border-amber-500 bg-amber-50"
                        : "border-zinc-200 hover:border-zinc-300"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          isSelected
                            ? "bg-amber-500 text-white"
                            : "bg-zinc-100 text-zinc-600"
                        )}
                      >
                        <span className="font-bold">{letter}</span>
                      </div>
                      <div>
                        <p className="font-medium text-zinc-800">
                          {vault.name}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {vault.description || vault.code}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-zinc-800">
                          {vault.boxes_count}
                        </p>
                        <p className="text-xs text-zinc-500">boxes</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteVault(vault.id);
                        }}
                        disabled={deletingId === `vault-${vault.id}`}
                        className={cn(
                          "text-zinc-400 hover:text-red-500",
                          vault.boxes_count > 0 && "opacity-50"
                        )}
                        title={
                          vault.boxes_count > 0
                            ? "Delete boxes first"
                            : "Delete vault"
                        }
                      >
                        {deletingId === `vault-${vault.id}` ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column - Boxes */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-zinc-800 flex items-center gap-2">
              <Grid3X3 className="w-4 h-4 text-zinc-500" />
              Boxes in{" "}
              <span className="text-amber-600">
                {selectedVault?.name || "..."}
              </span>
            </h3>
            <Button
              variant="outline"
              size="sm"
              leftIcon={Plus}
              onClick={() => setShowAddBoxModal(true)}
              disabled={!selectedVault}
            >
              Add Box
            </Button>
          </div>

          {!selectedVault ? (
            <div className="text-center py-8 text-zinc-500 border-2 border-dashed border-zinc-200 rounded-xl">
              <ChevronRight className="w-10 h-10 mx-auto mb-2 text-zinc-300" />
              <p className="text-sm">Select a vault to manage boxes</p>
            </div>
          ) : isLoadingBoxes ? (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500 mx-auto" />
              <p className="text-sm text-zinc-500 mt-2">Loading boxes...</p>
            </div>
          ) : boxes.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 border-2 border-dashed border-zinc-200 rounded-xl">
              <Grid3X3 className="w-10 h-10 mx-auto mb-2 text-zinc-300" />
              <p className="text-sm">No boxes in this vault</p>
              <Button
                variant="link"
                size="sm"
                onClick={() => setShowAddBoxModal(true)}
              >
                Add your first box
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {boxes.map((box) => {
                const occupancyPercent =
                  box.total_slots > 0
                    ? Math.round((box.occupied_slots / box.total_slots) * 100)
                    : 0;

                return (
                  <div
                    key={box.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 hover:border-zinc-300 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center">
                        <Grid3X3 className="w-5 h-5 text-zinc-500" />
                      </div>
                      <div>
                        <p className="font-medium text-zinc-800">{box.name}</p>
                        <p className="text-xs text-zinc-500">
                          {box.total_slots} slots
                          {box.description && ` • ${box.description}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {/* Occupancy */}
                      <div className="hidden sm:block w-24">
                        <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                          <span>{occupancyPercent}%</span>
                        </div>
                        <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              occupancyPercent >= 90
                                ? "bg-red-500"
                                : occupancyPercent >= 70
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            )}
                            style={{ width: `${occupancyPercent}%` }}
                          />
                        </div>
                      </div>
                      {/* Slot count */}
                      <div className="text-right min-w-[50px]">
                        <p className="text-sm font-semibold text-zinc-800">
                          {box.occupied_slots}/{box.total_slots}
                        </p>
                        <p className="text-xs text-zinc-500">slots</p>
                      </div>
                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteBox(box.id)}
                        disabled={deletingId === `box-${box.id}`}
                        className={cn(
                          "text-zinc-400 hover:text-red-500",
                          box.occupied_slots > 0 && "opacity-50"
                        )}
                        title={
                          box.occupied_slots > 0
                            ? "Has items - relocate first"
                            : "Delete box"
                        }
                      >
                        {deletingId === `box-${box.id}` ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Vault Modal */}
      <Modal
        isOpen={showAddVaultModal}
        onClose={() => setShowAddVaultModal(false)}
        title="Add Vault"
        size="sm"
      >
        <div className="p-5">
          <Input
            label="Vault Name"
            value={vaultFormData.name}
            onChange={(e) =>
              setVaultFormData({ ...vaultFormData, name: e.target.value })
            }
            placeholder="e.g. Safe Room, High Value Storage"
          />
          <Input
            label="Code (Optional)"
            value={vaultFormData.code}
            onChange={(e) =>
              setVaultFormData({
                ...vaultFormData,
                code: e.target.value.toUpperCase(),
              })
            }
            placeholder="e.g. SAFE-1"
            helperText="Auto-generated if left empty"
          />
          <Input
            label="Description (Optional)"
            value={vaultFormData.description}
            onChange={(e) =>
              setVaultFormData({
                ...vaultFormData,
                description: e.target.value,
              })
            }
            placeholder="e.g. For high-value items only"
          />
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setShowAddVaultModal(false)}
              disabled={isAdding}
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              fullWidth
              onClick={handleAddVault}
              loading={isAdding}
              disabled={!vaultFormData.name}
            >
              Add Vault
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Box Modal */}
      <Modal
        isOpen={showAddBoxModal}
        onClose={() => setShowAddBoxModal(false)}
        title={`Add Box to ${selectedVault?.name || "Vault"}`}
        size="sm"
      >
        <div className="p-5">
          <Input
            label="Box Name"
            value={boxFormData.name}
            onChange={(e) =>
              setBoxFormData({ ...boxFormData, name: e.target.value })
            }
            placeholder="e.g. BOX-1, Shelf A"
          />
          <Input
            label="Number of Slots"
            type="number"
            value={boxFormData.total_slots}
            onChange={(e) =>
              setBoxFormData({ ...boxFormData, total_slots: e.target.value })
            }
            placeholder="20"
            helperText="Each slot can hold one pledge item"
          />
          <Input
            label="Description (Optional)"
            value={boxFormData.description}
            onChange={(e) =>
              setBoxFormData({ ...boxFormData, description: e.target.value })
            }
            placeholder="e.g. Top shelf"
          />
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setShowAddBoxModal(false)}
              disabled={isAdding}
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              fullWidth
              onClick={handleAddBox}
              loading={isAdding}
              disabled={!boxFormData.name}
            >
              Add Box
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
