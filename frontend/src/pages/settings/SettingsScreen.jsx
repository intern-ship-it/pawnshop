import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch } from "@/app/hooks";
import { addToast } from "@/features/ui/uiSlice";
import { Upload, Image as ImageIcon } from "lucide-react";
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
import CategoriesTab from "./CategoriesTab";
import PuritiesTab from "./PuritiesTab";
import MarginPresetsTab from "./MarginPresetsTab";
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
  Banknote,
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
  FileText,
} from "lucide-react";
import WhatsAppSettings from "./WhatsAppSettings";
import storageService from "@/services/storageService";
import InterestRatesTab from "./InterestRatesTab";
import StoneDeductionTab from "./StoneDeductionTab";
import HandlingChargesTab from "./HandlingChargesTab";
import TermsConditionsTab from "./TermsConditionsTab";

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
  { id: "handling", label: "Handling Charges", icon: Banknote },
  { id: "terms", label: "Terms & Conditions", icon: FileText },
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
          new CustomEvent("settingsUpdated", { detail: settings }),
        );
        dispatch(
          addToast({
            type: "success",
            title: "Saved",
            message: "Settings have been saved successfully",
          }),
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
        new CustomEvent("settingsUpdated", { detail: settings }),
      );
      dispatch(
        addToast({
          type: "warning",
          title: "Saved Locally",
          message: "Settings saved locally. Will sync to server when online.",
        }),
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
        // Silently ignore errors during logout
        if (!error.silent) {
          console.error("Failed to load settings from API:", error);
        }
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
          pledgeMap.grace_period_days,
        );
      }
    }

    // Transform gold_price settings - NEW
    if (apiData.gold_price && Array.isArray(apiData.gold_price)) {
      const goldPriceMap = {};
      apiData.gold_price.forEach((s) => {
        goldPriceMap[s.key_name] = s.value;
      });
      result.goldPrice = {
        ...result.goldPrice,
        source: goldPriceMap.source || "api",
        manualPrice: parseFloat(goldPriceMap.manual_price) || 0,
      };
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
        },
      );
    }

    // Gold Price settings - NEW
    if (settings.goldPrice) {
      apiSettings.push(
        {
          category: "gold_price",
          key_name: "source",
          value: settings.goldPrice.source || "api",
        },
        {
          category: "gold_price",
          key_name: "manual_price",
          value: String(settings.goldPrice.manualPrice || 0),
        },
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
        return <MarginPresetsTab />;
      case "interest":
        return <InterestRatesTab />;
      case "categories":
        return <CategoriesTab />;
      case "purities":
        return <PuritiesTab />;
      case "stoneDeduction":
        return <StoneDeductionTab />;
      case "handling":
        return <HandlingChargesTab />;
      case "terms":
        return <TermsConditionsTab />;
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
      <div className="flex flex-col lg:flex-row gap-6 relative">
        {/* Tabs Sidebar - Fixed/Sticky */}
        <div className="lg:w-64 flex-shrink-0 lg:sticky lg:top-4 lg:self-start">
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
                        : "text-zinc-600 hover:bg-zinc-50",
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-5 h-5",
                        activeTab === tab.id
                          ? "text-amber-500"
                          : "text-zinc-400",
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

        {/* Tab Content - Scrollable */}
        <div className="flex-1 min-w-0">
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
  const dispatch = useAppDispatch();
  const company = settings.company;
  const [logoPreview, setLogoPreview] = useState(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isLoadingLogo, setIsLoadingLogo] = useState(true);

  // Load logo on mount
  useEffect(() => {
    const loadLogo = async () => {
      setIsLoadingLogo(true);
      try {
        const response = await settingsService.getLogo();

        // Handle both wrapped {success, data} and unwrapped {logo_url} formats
        // The response could be {success: true, data: {logo_url}} or just {logo_url}
        const logoData = response?.data || response;
        const logoUrl = logoData?.logo_url || logoData?.path;

        if (logoUrl) {
          // Fetch the image as a blob to avoid cross-origin issues
          try {
            // Construct full URL if needed
            let fullUrl = logoUrl;
            if (!logoUrl.startsWith("http")) {
              const baseUrl =
                window.location.hostname === "localhost" ||
                window.location.hostname === "127.0.0.1"
                  ? "http://localhost:8000"
                  : window.location.origin;
              fullUrl =
                baseUrl + (logoUrl.startsWith("/") ? "" : "/") + logoUrl;
            }

            const imgResponse = await fetch(fullUrl);
            if (imgResponse.ok) {
              const blob = await imgResponse.blob();
              const blobUrl = URL.createObjectURL(blob);
              setLogoPreview(blobUrl);
            } else {
              // Fallback to direct URL
              setLogoPreview(fullUrl);
            }
          } catch (fetchErr) {
            console.error("Error fetching logo:", fetchErr);
            // Fallback to direct URL
            setLogoPreview(logoUrl);
          }
        }
      } catch (err) {
        console.error("Failed to load logo:", err);
      } finally {
        setIsLoadingLogo(false);
      }
    };
    loadLogo();

    // Cleanup blob URL on unmount
    return () => {
      if (logoPreview && logoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(logoPreview);
      }
    };
  }, []);

  const handleChange = (field, value) => {
    updateSettings("company", { ...company, [field]: value });
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/svg+xml",
    ];
    if (!validTypes.includes(file.type)) {
      dispatch(
        addToast({
          type: "error",
          title: "Invalid File",
          message: "Please upload PNG, JPG, or SVG file",
        }),
      );
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      dispatch(
        addToast({
          type: "error",
          title: "File Too Large",
          message: "Logo must be less than 2MB",
        }),
      );
      return;
    }

    setIsUploadingLogo(true);
    try {
      const response = await settingsService.uploadLogo(file);
      console.log("Upload response:", response);

      if (response.success && response.data) {
        const logoUrl = response.data.logo_url || response.data.path;
        setLogoPreview(logoUrl);

        // Dispatch event for sidebar/other components to update
        window.dispatchEvent(
          new CustomEvent("logoUpdated", { detail: logoUrl }),
        );

        dispatch(
          addToast({
            type: "success",
            title: "Logo Uploaded",
            message: "Company logo updated successfully",
          }),
        );
      } else {
        throw new Error(response.message || "Upload failed");
      }
    } catch (err) {
      console.error("Logo upload failed:", err);
      dispatch(
        addToast({
          type: "error",
          title: "Upload Failed",
          message: err.message || "Failed to upload logo. Please try again.",
        }),
      );
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    try {
      setIsUploadingLogo(true);
      await settingsService.deleteLogo();

      setLogoPreview(null);
      window.dispatchEvent(new CustomEvent("logoUpdated", { detail: null }));

      dispatch(
        addToast({
          type: "success",
          title: "Logo Removed",
          message: "Company logo has been removed",
        }),
      );
    } catch (err) {
      console.error("Failed to delete logo:", err);
      dispatch(
        addToast({
          type: "error",
          title: "Delete Failed",
          message: err.message || "Failed to remove logo. Please try again.",
        }),
      );
    } finally {
      setIsUploadingLogo(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-zinc-800 mb-6 flex items-center gap-2">
        <Building2 className="w-5 h-5 text-amber-500" />
        Company Information
      </h2>

      {/* Logo Upload Section */}
      <div className="mb-8 p-4 bg-zinc-50 rounded-xl">
        <label className="block text-sm font-medium text-zinc-700 mb-3">
          Company Logo
        </label>
        <div className="flex items-center gap-6">
          {/* Logo Preview */}
          <div className="relative">
            <div className="w-24 h-24 rounded-xl border-2 border-dashed border-zinc-300 flex items-center justify-center bg-white overflow-hidden">
              {isLoadingLogo ? (
                <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
              ) : logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Company Logo"
                  className="w-full h-full object-contain p-2"
                  onError={(e) => {
                    console.error("Image load error:", logoPreview);
                    setLogoPreview(null);
                  }}
                />
              ) : (
                <ImageIcon className="w-10 h-10 text-zinc-300" />
              )}
            </div>
            {isUploadingLogo && (
              <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              </div>
            )}
          </div>

          {/* Upload Controls */}
          <div className="flex-1">
            <div className="flex gap-3">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                  onChange={handleLogoUpload}
                  className="hidden"
                  disabled={isUploadingLogo}
                />
                <span
                  className={cn(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    "bg-amber-500 text-white hover:bg-amber-600",
                    isUploadingLogo && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <Upload className="w-4 h-4" />
                  {logoPreview ? "Change Logo" : "Upload Logo"}
                </span>
              </label>

              {logoPreview && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveLogo}
                  disabled={isUploadingLogo}
                  className="text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              PNG, JPG, or SVG. Max 2MB. Recommended: 200x200px
            </p>
          </div>
        </div>
      </div>

      {/* Company Form Fields - THIS WAS MISSING! */}
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
            message: `Live price: RM ${Number(
              apiPrices?.price999 || goldPrice.manualPrice || 0,
            ).toFixed(2)}/g`,
          }),
        );
      } else {
        // Manual mode - just update timestamp
        handleChange("lastUpdated", new Date().toISOString());
        dispatch(
          addToast({
            type: "success",
            title: "Price Updated",
            message: `Manual price: RM ${Number(
              goldPrice.manualPrice || 0,
            ).toFixed(2)}/g`,
          }),
        );
      }
    } catch (err) {
      console.error("Refresh error:", err);
      dispatch(
        addToast({
          type: "error",
          title: "Refresh Failed",
          message: "Could not refresh gold price. Please try again.",
        }),
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  // Get display price - API price if available, otherwise manual
  const displayPrice =
    goldPrice.source === "api" && apiPrices?.price999
      ? Number(apiPrices.price999) || 0
      : Number(goldPrice.manualPrice) || 0;

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
    if (
      apiPrices?.source === "metals_dev" ||
      apiPrices?.source === "metalpriceapi" ||
      apiPrices?.source === "api"
    ) {
      return (
        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
          🟢 Live
        </span>
      );
    }
    if (apiPrices?.source === "bnm" || apiPrices?.source === "bnm_kijang") {
      return (
        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
          🔵 BNM
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
                `RM ${Number(displayPrice || 0).toFixed(2)}/g`
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
                      : "text-red-200",
                  )}
                >
                  {apiPrices.change.direction === "up" ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  {apiPrices.change.direction === "up" ? "+" : ""}
                  RM {Number(apiPrices.change.amount || 0).toFixed(2)} (
                  {Number(apiPrices.change.percent || 0).toFixed(2)}%)
                  <span className="text-amber-200 ml-1">vs yesterday</span>
                </p>
              )}

            <p className="text-amber-100 text-xs mt-2 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last updated:{" "}
              {new Date(
                apiPrices?.lastUpdated || goldPrice.lastUpdated,
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
                : "border-zinc-200 hover:border-zinc-300",
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
                  : "border-zinc-300",
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
                : "border-zinc-200 hover:border-zinc-300",
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
                  : "border-zinc-300",
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
            apiError ? "bg-red-50" : "bg-green-50",
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
              Connected to Metals.Dev + BNM. Prices update automatically.
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
                    RM {Number(price || 0).toFixed(2)}
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
                : "border-zinc-200 hover:border-zinc-300",
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

// Racks Tab - API Integrated with Vault + Box Management
function RacksTab({ settings, updateSettings }) {
  const [showAddVaultModal, setShowAddVaultModal] = useState(false);
  const [showAddBoxModal, setShowAddBoxModal] = useState(false);
  const [selectedVault, setSelectedVault] = useState(null);
  const [vaultFormData, setVaultFormData] = useState({
    name: "",
    code: "",
    description: "",
    number_of_boxes: 0,
  });
  const [boxFormData, setBoxFormData] = useState({
    vault_id: "",
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
          total_slots: vault.total_slots || 0,
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
        number_of_boxes: parseInt(vaultFormData.number_of_boxes) || 0,
      });

      if (response.success) {
        await fetchVaults();
        setVaultFormData({
          name: "",
          code: "",
          description: "",
          number_of_boxes: 0,
        });
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
    const targetVaultId = boxFormData.vault_id || selectedVault?.id;
    if (!boxFormData.name || !targetVaultId) return;

    setIsAdding(true);
    try {
      const response = await storageService.createBox({
        vault_id: parseInt(targetVaultId),
        name: boxFormData.name,
        total_slots: 20,
        description: boxFormData.description || null,
      });

      if (response.success) {
        if (selectedVault?.id === parseInt(targetVaultId)) {
          await fetchBoxes(selectedVault.id);
        }
        await fetchVaults();
        setBoxFormData({
          vault_id: "",
          name: "",
          total_slots: 20,
          description: "",
        });
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
      dispatch(
        addToast({
          type: "error",
          title: "Cannot Delete",
          message: `"${vault.name}" has ${vault.boxes_count} boxes. Delete boxes first.`,
        }),
      );
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${vault?.name}"? This action cannot be undone.`,
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
        dispatch(
          addToast({
            type: "success",
            title: "Deleted",
            message: `Vault "${vault?.name}" deleted successfully.`,
          }),
        );
      } else {
        throw new Error(response.message || "Failed to delete vault");
      }
    } catch (err) {
      console.error("Error deleting vault:", err);
      dispatch(
        addToast({
          type: "error",
          title: "Delete Failed",
          message: err.message || "Failed to delete vault.",
        }),
      );
    } finally {
      setDeletingId(null);
    }
  };
  const handleDeleteBox = async (id) => {
    const box = boxes.find((b) => b.id === id);
    if (box && box.occupied_slots > 0) {
      dispatch(
        addToast({
          type: "error",
          title: "Cannot Delete",
          message: `"${box.name}" has ${box.occupied_slots} items. Relocate items first.`,
        }),
      );
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${box?.name}"? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingId(`box-${id}`);
    try {
      const response = await storageService.deleteBox(id);

      if (response.success) {
        await fetchBoxes(selectedVault.id);
        await fetchVaults();
        dispatch(
          addToast({
            type: "success",
            title: "Deleted",
            message: `Box "${box?.name}" deleted successfully.`,
          }),
        );
      } else {
        throw new Error(response.message || "Failed to delete box");
      }
    } catch (err) {
      console.error("Error deleting box:", err);
      dispatch(
        addToast({
          type: "error",
          title: "Delete Failed",
          message: err.message || "Failed to delete box.",
        }),
      );
    } finally {
      setDeletingId(null);
    }
  };

  // Calculate totals
  const totalBoxes = vaults.reduce((sum, v) => sum + (v.boxes_count || 0), 0);
  const totalSlots = boxes.reduce((sum, b) => sum + (b.total_slots || 0), 0);
  const occupiedSlots = boxes.reduce(
    (sum, b) => sum + (b.occupied_slots || 0),
    0,
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
                        : "border-zinc-200 hover:border-zinc-300",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          isSelected
                            ? "bg-amber-500 text-white"
                            : "bg-zinc-100 text-zinc-600",
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
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-zinc-800">
                          {vault.boxes_count}
                        </p>
                        <p className="text-xs text-zinc-500">boxes</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-amber-600">
                          {vault.total_slots || 0}
                        </p>
                        <p className="text-xs text-zinc-500">slots</p>
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
                          vault.boxes_count > 0 && "opacity-50",
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
              onClick={() => {
                setBoxFormData({
                  vault_id: selectedVault?.id || "",
                  name: "",
                  total_slots: 20,
                  description: "",
                });
                setShowAddBoxModal(true);
              }}
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
                                  : "bg-emerald-500",
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
                          box.occupied_slots > 0 && "opacity-50",
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
        <div className="p-5 space-y-4">
          <Input
            label="Vault Name"
            value={vaultFormData.name}
            onChange={(e) => {
              const name = e.target.value;
              const autoCode = name
                .toUpperCase()
                .replace(/\s+/g, "-")
                .substring(0, 20);
              setVaultFormData({
                ...vaultFormData,
                name: name,
                code: autoCode,
              });
            }}
            placeholder="e.g. Safe Room, High Value Storage"
            required
          />
          <Input
            label="Code (Auto-generated)"
            value={vaultFormData.code}
            onChange={(e) =>
              setVaultFormData({
                ...vaultFormData,
                code: e.target.value.toUpperCase().replace(/\s+/g, "-"),
              })
            }
            placeholder="Auto-generated from name"
            helperText="You can edit if needed"
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

          {/* NEW: Number of Boxes Field */}
          <div>
            <Input
              label="Number of Boxes"
              type="number"
              min="0"
              max="100"
              value={vaultFormData.number_of_boxes}
              onChange={(e) =>
                setVaultFormData({
                  ...vaultFormData,
                  number_of_boxes: e.target.value,
                })
              }
              placeholder="0"
              helperText="Each box will have 20 slots"
            />
            {vaultFormData.number_of_boxes > 0 && (
              <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
                <Info className="w-4 h-4" />
                Total: {vaultFormData.number_of_boxes * 20} slots (
                {vaultFormData.number_of_boxes} boxes × 20 slots)
              </p>
            )}
          </div>

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
        title="Add New Box"
        size="sm"
      >
        <div className="p-5 space-y-4">
          <Select
            label="Select Vault"
            value={boxFormData.vault_id || selectedVault?.id || ""}
            onChange={(e) =>
              setBoxFormData({ ...boxFormData, vault_id: e.target.value })
            }
            options={[
              { value: "", label: "Select vault..." },
              ...vaults.map((v) => ({
                value: v.id,
                label: `${v.name} (${v.boxes_count} boxes, ${
                  v.total_slots || 0
                } slots)`,
              })),
            ]}
            required
          />
          <Input
            label="Box Name"
            value={boxFormData.name}
            onChange={(e) =>
              setBoxFormData({ ...boxFormData, name: e.target.value })
            }
            placeholder="e.g. BOX-1, Shelf A"
            required
          />

          {/* Fixed 20 slots - read only display */}
          <div className="p-3 bg-zinc-50 rounded-lg">
            <p className="text-sm text-zinc-600">
              <span className="font-medium">Slots per box:</span> 20 (fixed)
            </p>
          </div>

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
              disabled={
                !boxFormData.name || (!boxFormData.vault_id && !selectedVault)
              }
            >
              Add Box
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
