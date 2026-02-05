import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
  setCustomers,
  setSelectedCustomer,
} from "@/features/customers/customersSlice";
import { setPledges, addPledge } from "@/features/pledges/pledgesSlice";
import {
  addToast,
  openCamera,
  clearCapturedImage,
} from "@/features/ui/uiSlice";
import { customerService, pledgeService, settingsService } from "@/services";
import { getToken } from "@/services/api";
import storageService from "@/services/storageService";
import goldPriceService from "@/services/goldPriceService";
import { getStorageItem, STORAGE_KEYS } from "@/utils/localStorage";
import { formatCurrency, formatIC, formatPhone } from "@/utils/formatters";
import { validateIC } from "@/utils/validators";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import {
  Card,
  Button,
  Input,
  Select,
  Badge,
  Modal,
  TermsConsentPanel,
} from "@/components/common";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  User,
  Package,
  Calculator,
  Wallet,
  FileSignature,
  Search,
  Plus,
  Trash2,
  Camera,
  Scale,
  Gem,
  X,
  FileText,
  Receipt,
  ExternalLink,
  AlertTriangle,
  CreditCard,
  Building2,
  RefreshCw,
  Printer,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Info,
  DollarSign,
  Edit,
  Calendar,
  Clock,
  TrendingUp,
  Archive,
  Box,
  MapPin,
  Zap,
  Loader2,
  Upload,
  Barcode,
  Copy,
} from "lucide-react";

// Step configuration - NOW 6 STEPS WITH STORAGE
const steps = [
  { id: 1, title: "Customer", icon: User, description: "Select customer" },
  { id: 2, title: "Items", icon: Package, description: "Add items" },
  {
    id: 3,
    title: "Valuation",
    icon: Calculator,
    description: "Calculate value",
  },
  { id: 4, title: "Payout", icon: Wallet, description: "Payment method" },
  { id: 5, title: "Storage", icon: Archive, description: "Assign location" },
  {
    id: 6,
    title: "Confirm",
    icon: FileSignature,
    description: "Review & sign",
  },
];

// Item categories
const itemCategories = [
  { value: "chain", label: "Chain (Rantai)" },
  { value: "bangle", label: "Bangle (Gelang)" },
  { value: "ring", label: "Ring (Cincin)" },
  { value: "earring", label: "Earring (Anting)" },
  { value: "pendant", label: "Pendant (Loket)" },
  { value: "bracelet", label: "Bracelet (Gelang Tangan)" },
  { value: "necklace", label: "Necklace (Kalung)" },
  { value: "bar", label: "Gold Bar (Jongkong)" },
  { value: "coin", label: "Gold Coin (Syiling)" },
  { value: "other", label: "Other (Lain-lain)" },
];

// Purity options with prices (per gram) - percentage used to calculate from 999 price
const purityOptions = [
  {
    value: "999",
    label: "999 (24K)",
    priceKey: "price999",
    karat: "24K",
    percentage: 99.9,
  },
  {
    value: "916",
    label: "916 (22K)",
    priceKey: "price916",
    karat: "22K",
    percentage: 91.6,
  },
  {
    value: "875",
    label: "875 (21K)",
    priceKey: "price875",
    karat: "21K",
    percentage: 87.5,
  },
  {
    value: "750",
    label: "750 (18K)",
    priceKey: "price750",
    karat: "18K",
    percentage: 75.0,
  },
  {
    value: "585",
    label: "585 (14K)",
    priceKey: "price585",
    karat: "14K",
    percentage: 58.5,
  },
  {
    value: "375",
    label: "375 (9K)",
    priceKey: "price375",
    karat: "9K",
    percentage: 37.5,
  },
];

// Percentage presets - will be loaded from API
// const percentagePresets = [80, 70, 60]; // REMOVED - now dynamic

// Empty item template
const emptyItem = {
  id: "",
  category: "",
  description: "",
  weight: "",
  purity: "916",
  pricePerGram: "",
  stoneDeduction: "",
  stoneDeductionType: "amount",
  photo: null,
};

export default function NewPledge() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { selectedCustomer, customers } = useAppSelector(
    (state) => state.customers,
  );
  const { goldPrice } = useAppSelector((state) => state.ui);

  // Refs
  const signatureCanvasRef = useRef(null);
  const signatureUploadRef = useRef(null);
  const photoInputRefs = useRef({});

  // Step state
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Customer state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [customerSearchResult, setCustomerSearchResult] = useState(null);
  const [customerPledges, setCustomerPledges] = useState([]);

  // Step 2: Items state
  const [items, setItems] = useState([{ ...emptyItem, id: "item-1" }]);

  // Handle global camera capture
  const { capturedImage, contextId } = useAppSelector(
    (state) => state.ui.camera,
  );

  useEffect(() => {
    if (capturedImage && contextId) {
      setItems((currentItems) =>
        currentItems.map((item) => {
          if (item.id === contextId) {
            return { ...item, photo: capturedImage };
          }
          return item;
        }),
      );
    }
  }, [capturedImage, contextId]);

  // Step 3: Valuation state
  const [loanPercentage, setLoanPercentage] = useState(70);
  const [customPercentage, setCustomPercentage] = useState("");
  const [useCustomPercentage, setUseCustomPercentage] = useState(false);
  const [interestScenario, setInterestScenario] = useState("standard"); // 'standard', 'renewed', 'overdue'

  // Step 4: Payout state
  const [payoutMethod, setPayoutMethod] = useState("cash");
  const [cashAmount, setCashAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [bankId, setBankId] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [handlingSettings, setHandlingSettings] = useState({
    type: "fixed",
    value: 0,
    min_amount: 0,
  });
  const [handlingCharge, setHandlingCharge] = useState("");
  const [netPayoutAmount, setNetPayoutAmount] = useState(0);

  // Step 5: Storage Assignment state - USING REAL API DATA ONLY
  const [vaults, setVaults] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [slots, setSlots] = useState([]);
  const [selectedVault, setSelectedVault] = useState(null);
  const [selectedBox, setSelectedBox] = useState(null);
  const [itemStorageAssignments, setItemStorageAssignments] = useState({}); // { itemId: { vaultId, boxId, slotId, slotNumber } }
  const [loadingVaults, setLoadingVaults] = useState(false);
  const [loadingBoxes, setLoadingBoxes] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [storageError, setStorageError] = useState(null);

  // Step 6: Signature state (was Step 5)
  const [signature, setSignature] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // General state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdPledgeId, setCreatedPledgeId] = useState(null);
  const [createdReceiptNo, setCreatedReceiptNo] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

  // Auto-print status tracking
  const [printJobStatus, setPrintJobStatus] = useState({
    dotMatrixOffice: { status: "pending", message: "" },
    dotMatrixCustomer: { status: "pending", message: "" },
    barcode: { status: "pending", message: "" },
    whatsapp: { status: "pending", message: "" },
  });

  // Gold prices from API/Settings
  const [goldPrices, setGoldPrices] = useState({});
  const [goldPricesLoading, setGoldPricesLoading] = useState(true);

  // Backend data for categories, purities, banks
  const [backendCategories, setBackendCategories] = useState([]);
  const [backendPurities, setBackendPurities] = useState([]);
  const [backendBanks, setBackendBanks] = useState([]);
  const [backendStoneDeductions, setBackendStoneDeductions] = useState([]);
  const [marginPresets, setMarginPresets] = useState([]); // Dynamic margin presets

  // Dynamic interest rates from settings
  const [interestRates, setInterestRates] = useState({
    standard: 0.5, // First 6 months
    extended: 1.5, // Renewed before due date
    overdue: 2.0, // Overdue > 6 months
  });

  // Fetch gold prices on mount
  useEffect(() => {
    fetchGoldPrices();
    fetchBackendData();
  }, []);

  // Fetch storage data when reaching step 5
  useEffect(() => {
    if (currentStep === 5) {
      fetchVaults();
    }
  }, [currentStep]);

  // Fetch boxes when vault changes
  useEffect(() => {
    if (selectedVault) {
      fetchBoxes(selectedVault);
    }
  }, [selectedVault]);

  // Fetch slots when box changes
  useEffect(() => {
    if (selectedBox) {
      fetchSlots(selectedBox);
    }
  }, [selectedBox]);

  // Fetch categories, purities, banks from backend
  const fetchBackendData = async () => {
    try {
      const catResponse = await settingsService.getCategories();
      const categories = catResponse.data?.data || catResponse.data || [];
      setBackendCategories(categories);

      const purityResponse = await settingsService.getPurities();
      const purities = purityResponse.data?.data || purityResponse.data || [];
      setBackendPurities(purities);

      const bankResponse = await settingsService.getBanks();
      const banks = bankResponse.data?.data || bankResponse.data || [];
      setBackendBanks(banks);

      const stoneResponse = await settingsService.getStoneDeductions();
      const stoneDeductions =
        stoneResponse.data?.data || stoneResponse.data || [];
      setBackendStoneDeductions(stoneDeductions);

      // Fetch margin presets
      const marginResponse = await settingsService.getMarginPresets();
      const settingsResponse = await settingsService.getAll();
      const settingsData = settingsResponse.data || {};
      const pledgeSettings = settingsData.pledge || [];

      // Load handling settings
      const hType =
        pledgeSettings.find((s) => s.key_name === "handling_charge_type")
          ?.value || "fixed";
      const hValue = parseFloat(
        pledgeSettings.find((s) => s.key_name === "handling_charge_value")
          ?.value || 0,
      );
      const hMin = parseFloat(
        pledgeSettings.find((s) => s.key_name === "handling_charge_min")
          ?.value || 0,
      );

      const newHandlingSettings = {
        type: hType,
        value: hValue,
        min_amount: hMin,
      };

      setHandlingSettings(newHandlingSettings);

      const margins = marginResponse.data?.data || marginResponse.data || [];
      // Normalize fields - map backend margin_percentage to value
      const normalizedMargins = margins.map((m) => ({
        ...m,
        value: m.margin_percentage || m.value,
        label: m.name || m.label || `${m.margin_percentage || m.value}%`,
      }));
      const activeMargins = normalizedMargins.filter(
        (m) => m.is_active !== false,
      );
      setMarginPresets(activeMargins);

      // Set default margin percentage from presets
      if (activeMargins.length > 0) {
        const defaultPreset =
          activeMargins.find((m) => m.is_default) || activeMargins[0];
        setLoanPercentage(defaultPreset.value);
      }

      // Apply default stone deduction to existing items if they are empty
      const defaultDeduction = stoneDeductions.find(
        (d) => d.is_default && d.is_active !== false,
      );
      if (defaultDeduction) {
        setItems((currentItems) =>
          currentItems.map((item) => {
            if (!item.stoneDeduction && item.stoneDeductionType === "amount") {
              return {
                ...item,
                stoneDeduction: defaultDeduction.value.toString(),
                stoneDeductionType: defaultDeduction.deduction_type,
              };
            }
            return item;
          }),
        );
      }

      // Fetch interest rates from settings
      try {
        const interestResponse = await settingsService.getInterestRates();
        const rates =
          interestResponse.data?.data || interestResponse.data || [];

        // Map rates by type
        const ratesMap = {
          standard: 0.5, // default
          extended: 1.5, // default
          overdue: 2.0, // default
        };

        rates.forEach((rate) => {
          if (rate.is_active !== false && rate.rate_percentage) {
            if (rate.rate_type === "standard") {
              ratesMap.standard = parseFloat(rate.rate_percentage);
            } else if (rate.rate_type === "extended") {
              ratesMap.extended = parseFloat(rate.rate_percentage);
            } else if (rate.rate_type === "overdue") {
              ratesMap.overdue = parseFloat(rate.rate_percentage);
            }
          }
        });

        setInterestRates(ratesMap);
      } catch (interestError) {
        console.error("Error fetching interest rates:", interestError);
        // Keep default rates
      }
    } catch (error) {
      console.error("Error fetching backend data:", error);
      // If API fails, set default fallback
      setMarginPresets([{ id: 1, value: 70, label: "70%", is_default: true }]);
    }
  };

  // Calculate handling charge when loan amount changes
  useEffect(() => {
    // Calculate total net value first to derive loan amount
    const validItems = items.filter((i) => i.category && i.weight);
    let totalNetValue = 0;

    validItems.forEach((item) => {
      const val = calculateItemValue(item);
      totalNetValue += val.net;
    });

    const currentLoanAmount = totalNetValue * (loanPercentage / 100);

    let calculatedCharge = 0;
    if (handlingSettings.type === "percentage") {
      calculatedCharge = Math.max(
        currentLoanAmount * (handlingSettings.value / 100),
        handlingSettings.min_amount,
      );
    } else {
      calculatedCharge = handlingSettings.value;
    }

    // Round to 2 decimals
    calculatedCharge = Math.round(calculatedCharge * 100) / 100;

    // Store handling charge for record keeping (NOT deducted from payout)
    setHandlingCharge(calculatedCharge.toString());

    // BUSINESS RULE: Net Payout = Loan Amount (NO deductions)
    // Handling charges are recorded separately but customer receives full loan amount
    setNetPayoutAmount(currentLoanAmount);
  }, [items, loanPercentage, handlingSettings, goldPrices]);

  // Update net payout when handling charge is manually edited
  // BUSINESS RULE: Handling charge is recorded separately, NOT deducted from payout
  useEffect(() => {
    const validItems = items.filter((i) => i.category && i.weight);
    let totalNetValue = 0;
    validItems.forEach((item) => {
      const val = calculateItemValue(item);
      totalNetValue += val.net;
    });
    const currentLoanAmount = totalNetValue * (loanPercentage / 100);

    // Net Payout = Full Loan Amount (handling charge NOT deducted)
    setNetPayoutAmount(currentLoanAmount);
  }, [handlingCharge, items, loanPercentage]); // Added dependencies for recalculation

  // ============ STORAGE API FUNCTIONS - NO MOCK DATA ============

  // Fetch all vaults from API
  const fetchVaults = async () => {
    setLoadingVaults(true);
    setStorageError(null);
    try {
      const response = await storageService.getVaults();
      const vaultsData = response.data?.data || response.data || [];
      setVaults(vaultsData);

      // Auto-select first vault if exists
      if (vaultsData.length > 0 && !selectedVault) {
        setSelectedVault(vaultsData[0].id);
      }
    } catch (error) {
      console.error("Error fetching vaults:", error);
      setStorageError("Failed to load vaults. Please try again.");
      setVaults([]);
    } finally {
      setLoadingVaults(false);
    }
  };

  // Fetch boxes for selected vault from API
  const fetchBoxes = async (vaultId) => {
    if (!vaultId) return;

    setLoadingBoxes(true);
    setBoxes([]);
    setSlots([]);
    setSelectedBox(null);

    try {
      const response = await storageService.getBoxes(vaultId);
      const boxesData = response.data?.data || response.data || [];
      setBoxes(boxesData);

      // Auto-select first box with available slots
      const boxWithSlots = boxesData.find(
        (b) => (b.available_slots || b.total_slots - b.occupied_slots) > 0,
      );
      if (boxWithSlots) {
        setSelectedBox(boxWithSlots.id);
      } else if (boxesData.length > 0) {
        setSelectedBox(boxesData[0].id);
      }
    } catch (error) {
      console.error("Error fetching boxes:", error);
      setBoxes([]);
    } finally {
      setLoadingBoxes(false);
    }
  };

  // Fetch slots for selected box from API
  const fetchSlots = async (boxId) => {
    if (!boxId) return;

    setLoadingSlots(true);
    setSlots([]);

    try {
      const response = await storageService.getSlots(boxId);
      const slotsData = response.data?.data || response.data || [];
      setSlots(slotsData);
    } catch (error) {
      console.error("Error fetching slots:", error);
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  // Handle vault change
  const handleVaultChange = (vaultId) => {
    const numericVaultId = parseInt(vaultId, 10);
    setSelectedVault(numericVaultId);
    setSelectedBox(null);
    setSlots([]);
    // Clear assignments when vault changes
    setItemStorageAssignments({});
  };

  // Handle box change
  const handleBoxChange = (boxId) => {
    const numericBoxId = parseInt(boxId, 10);
    setSelectedBox(numericBoxId);
    // Clear assignments when box changes
    setItemStorageAssignments({});
  };

  // Auto-assign storage for all items
  const handleAutoAssign = () => {
    const validItems = items.filter((i) => i.category && i.weight);
    const availableSlots = slots.filter((s) => !s.is_occupied);

    if (availableSlots.length === 0) {
      dispatch(
        addToast({
          type: "error",
          title: "No Slots Available",
          message: "No available slots in this box",
        }),
      );
      return;
    }

    if (availableSlots.length < validItems.length) {
      dispatch(
        addToast({
          type: "warning",
          title: "Not Enough Slots",
          message: `Need ${validItems.length} slots but only ${availableSlots.length} available in this box`,
        }),
      );
    }

    const assignments = {};
    validItems.forEach((item, index) => {
      if (availableSlots[index]) {
        const slot = availableSlots[index];
        assignments[item.id] = {
          vaultId: selectedVault,
          boxId: selectedBox,
          slotId: slot.id, // Real integer ID from API
          slotNumber: slot.slot_number,
        };
      }
    });

    setItemStorageAssignments(assignments);
    dispatch(
      addToast({
        type: "success",
        title: "Auto-Assigned",
        message: `${Object.keys(assignments).length} items assigned to storage`,
      }),
    );
  };

  // Assign single slot to item
  const handleSlotAssign = (itemId, slot) => {
    if (slot.is_occupied) {
      dispatch(
        addToast({
          type: "error",
          title: "Slot Occupied",
          message: "This slot is already occupied",
        }),
      );
      return;
    }

    // Check if slot is already assigned to another item in this pledge
    const existingAssignment = Object.entries(itemStorageAssignments).find(
      ([id, assignment]) => assignment.slotId === slot.id && id !== itemId,
    );

    if (existingAssignment) {
      dispatch(
        addToast({
          type: "warning",
          title: "Slot Already Assigned",
          message: "This slot is assigned to another item in this pledge",
        }),
      );
      return;
    }

    setItemStorageAssignments((prev) => ({
      ...prev,
      [itemId]: {
        vaultId: selectedVault,
        boxId: selectedBox,
        slotId: slot.id, // Real integer ID from API
        slotNumber: slot.slot_number,
      },
    }));

    dispatch(
      addToast({
        type: "success",
        title: "Assigned",
        message: `Item assigned to Slot ${slot.slot_number}`,
      }),
    );
  };

  // Remove storage assignment
  const handleRemoveAssignment = (itemId) => {
    setItemStorageAssignments((prev) => {
      const updated = { ...prev };
      delete updated[itemId];
      return updated;
    });
  };

  // Helper to get category ID from category value/name
  const getCategoryId = (categoryValue) => {
    const found = backendCategories.find(
      (c) =>
        c.code?.toLowerCase() === categoryValue?.toLowerCase() ||
        c.name?.toLowerCase() === categoryValue?.toLowerCase() ||
        c.slug?.toLowerCase() === categoryValue?.toLowerCase(),
    );
    return found?.id || null;
  };

  // Helper to get purity ID from purity value/code
  const getPurityId = (purityValue) => {
    const found = backendPurities.find(
      (p) => p.code === purityValue || p.name === purityValue,
    );
    return found?.id || null;
  };

  // Compute category options from backend data (with fallback to hardcoded)
  const categoryOptions =
    backendCategories.length > 0
      ? backendCategories.map((cat) => ({
          value: cat.code || cat.slug || cat.name_en,
          label: `${cat.name_en}${cat.name_ms ? ` (${cat.name_ms})` : ""}`,
        }))
      : itemCategories;

  // Compute purity options from backend data (with fallback to hardcoded)
  const dynamicPurityOptions =
    backendPurities.length > 0
      ? backendPurities.map((purity) => ({
          value: purity.code,
          label: `${purity.code}${purity.karat ? ` (${purity.karat})` : ""}`,
          priceKey: `price${purity.code}`,
          karat: purity.karat || "",
          percentage: purity.percentage || 0,
        }))
      : purityOptions;

  const fetchGoldPrices = async () => {
    try {
      setGoldPricesLoading(true);

      const storedSettings = getStorageItem(STORAGE_KEYS.SETTINGS, null);
      const goldPriceSettings = storedSettings?.goldPrice || {
        source: "api",
        manualPrice: 400,
      };
      const source = goldPriceSettings?.source || "api";

      if (source === "manual") {
        const manualPrice = parseFloat(goldPriceSettings?.manualPrice) || 400;
        const calculatedPrices = {};
        purityOptions.forEach((p) => {
          calculatedPrices[p.value] =
            Math.round(manualPrice * (p.percentage / 100) * 100) / 100;
        });
        setGoldPrices(calculatedPrices);
      } else {
        try {
          const response = await goldPriceService.getDashboardPrices();
          if (response.data) {
            const data = response.data;
            const price999 = data.current?.prices?.gold?.per_gram || 400;
            const caratPrices = data.carat?.purity_codes || data.carat || {};

            const allPrices = {};
            purityOptions.forEach((p) => {
              allPrices[p.value] =
                caratPrices[p.value] ||
                Math.round(price999 * (p.percentage / 100) * 100) / 100;
            });
            setGoldPrices(allPrices);
          }
        } catch (apiError) {
          console.error("API fetch error:", apiError);
          const manualPrice = parseFloat(goldPriceSettings?.manualPrice) || 400;
          const calculatedPrices = {};
          purityOptions.forEach((p) => {
            calculatedPrices[p.value] =
              Math.round(manualPrice * (p.percentage / 100) * 100) / 100;
          });
          setGoldPrices(calculatedPrices);
        }
      }
    } catch (error) {
      console.error("Error fetching gold prices:", error);
    } finally {
      setGoldPricesLoading(false);
    }
  };

  // Handle pre-selected customer
  useEffect(() => {
    if (selectedCustomer) {
      setCustomer(selectedCustomer);
      setIcSearch(selectedCustomer.ic_number || selectedCustomer.icNumber);
    }
  }, [selectedCustomer]);

  // Update items' prices when gold prices are loaded
  useEffect(() => {
    if (Object.keys(goldPrices).length > 0) {
      setItems((prevItems) =>
        prevItems.map((item) => {
          if (!item.pricePerGram || item.pricePerGram === "") {
            const marketPrice =
              goldPrices[item.purity] || getMarketPrice(item.purity);
            return { ...item, pricePerGram: marketPrice.toFixed(2) };
          }
          return item;
        }),
      );
    }
  }, [goldPrices]);

  // Initialize signature canvas when step 6 is reached
  useEffect(() => {
    if (currentStep === 6) {
      setTimeout(() => {
        initSignatureCanvas();
      }, 100);
    }
  }, [currentStep]);

  // Get market price for a purity
  const getMarketPrice = (purity) => {
    if (goldPrices[purity] && goldPrices[purity] > 0) {
      return goldPrices[purity];
    }

    const purityOption = dynamicPurityOptions.find((p) => p.value === purity);
    if (!purityOption) return 295;

    const base999Price = goldPrice?.manualPrice || goldPrice?.price999 || 400;
    const calculatedPrice = base999Price * (purityOption.percentage / 100);
    return Math.round(calculatedPrice * 100) / 100;
  };

  // Calculate totals
  const calculateItemValue = (item) => {
    if (!item.weight || !item.purity)
      return { gross: 0, deduction: 0, net: 0, priceUsed: 0, netWeight: 0 };

    const grossWeight = parseFloat(item.weight) || 0;
    const marketPrice = getMarketPrice(item.purity);
    const pricePerGram = item.pricePerGram
      ? parseFloat(item.pricePerGram)
      : marketPrice;

    let netWeight = grossWeight;
    let deduction = 0;

    if (item.stoneDeduction) {
      const deductionValue = parseFloat(item.stoneDeduction) || 0;
      if (item.stoneDeductionType === "percentage") {
        const grossValue = grossWeight * pricePerGram;
        deduction = grossValue * (deductionValue / 100);
      } else if (item.stoneDeductionType === "grams") {
        netWeight = Math.max(0, grossWeight - deductionValue);
        deduction = deductionValue * pricePerGram;
      } else {
        deduction = deductionValue;
      }
    }

    const grossValue = grossWeight * pricePerGram;
    const netValue =
      item.stoneDeductionType === "grams"
        ? netWeight * pricePerGram
        : Math.max(0, grossValue - deduction);

    return {
      gross: grossValue,
      deduction,
      net: netValue,
      priceUsed: pricePerGram,
      netWeight: netWeight,
    };
  };

  const totals = items.reduce(
    (acc, item) => {
      const { gross, deduction, net } = calculateItemValue(item);
      return {
        grossValue: acc.grossValue + gross,
        totalDeduction: acc.totalDeduction + deduction,
        netValue: acc.netValue + net,
        totalWeight: acc.totalWeight + (parseFloat(item.weight) || 0),
      };
    },
    { grossValue: 0, totalDeduction: 0, netValue: 0, totalWeight: 0 },
  );

  const effectivePercentage = useCustomPercentage
    ? parseFloat(customPercentage) || 0
    : loanPercentage;
  const loanAmount = totals.netValue * (effectivePercentage / 100);

  // Customer search handler
  // Perform generic search
  const performSearch = async (query = searchQuery) => {
    if (!query) return;
    setIsSearching(true);
    setCustomerSearchResult(null);

    try {
      const response = await customerService.getAll({
        search: query,
        per_page: 5,
      });
      const results = response.data?.data || response.data || [];
      setSearchResults(results);

      if (results.length === 0) {
        setCustomerSearchResult("not_found");
        setCustomer(null);
        setCustomerPledges([]);
      } else {
        setShowResults(true);
        // Auto-select if exact IC match
        const cleanQuery = query.replace(/[-\s]/g, "");
        const exactMatch = results.find((c) => c.ic_number === cleanQuery);
        if (exactMatch) {
          handleCustomerSelect(exactMatch);
        }
      }
    } catch (error) {
      console.error("Search error:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Failed to search customer",
        }),
      );
    } finally {
      setIsSearching(false);
    }
  };

  // Handle selection from results
  const handleCustomerSelect = async (selectedCustomer) => {
    setCustomer(selectedCustomer);
    // DO NOT change searchQuery - keep the original IC number the user typed
    setShowResults(false);
    setSearchResults([]); // Clear results to prevent dropdown from reopening
    setCustomerSearchResult(selectedCustomer);

    // Fetch active pledges
    try {
      const response = await customerService.getActivePledges(
        selectedCustomer.id,
      );
      const pledges = response.data?.data || response.data || [];
      setCustomerPledges(pledges);
    } catch (err) {
      console.error("Error fetching pledges:", err);
    }
  };

  // Debounced search effect
  useEffect(() => {
    // Skip search if customer is already selected (prevents dropdown reopening)
    if (customer) {
      return;
    }

    const timer = setTimeout(() => {
      if (searchQuery.length >= 3) {
        performSearch(searchQuery);
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, customer]);

  // Item handlers
  // Maximum 4 items allowed per pledge (Business Rule)
  const MAX_PLEDGE_ITEMS = 4;

  const addItem = () => {
    // Check maximum items limit
    if (items.length >= MAX_PLEDGE_ITEMS) {
      dispatch(
        addToast({
          type: "warning",
          title: "Maximum Items Reached",
          message: `Maximum ${MAX_PLEDGE_ITEMS} items allowed per pledge`,
        }),
      );
      return;
    }

    const defaultPurity = "916";
    const defaultPrice =
      goldPrices[defaultPurity] || getMarketPrice(defaultPurity);

    // Find default stone deduction
    const defaultStoneDeduction = backendStoneDeductions.find(
      (d) => d.is_default && d.is_active !== false,
    );

    const newItem = {
      ...emptyItem,
      id: `item-${Date.now()}`,
      purity: defaultPurity,
      pricePerGram: defaultPrice.toFixed(2),
      // Set default stone deduction if available
      stoneDeduction: defaultStoneDeduction
        ? defaultStoneDeduction.value.toString()
        : "",
      stoneDeductionType: defaultStoneDeduction
        ? defaultStoneDeduction.deduction_type
        : "amount",
    };
    setItems([...items, newItem]);
  };

  const removeItem = (id) => {
    if (items.length === 1) {
      dispatch(
        addToast({
          type: "warning",
          title: "Required",
          message: "At least one item is required",
        }),
      );
      return;
    }
    setItems(items.filter((item) => item.id !== id));
    // Also remove storage assignment if exists
    handleRemoveAssignment(id);
  };

  const updateItem = (id, field, value) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    );
  };

  // Handle Dot Matrix Print (Epson LQ-310)
  const handleDotMatrixPrint = async (copyType = "customer") => {
    if (!createdPledgeId) return;

    const token = getToken();
    if (!token) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Please login again",
        }),
      );
      return;
    }

    setIsPrinting(true);
    try {
      const apiUrl =
        import.meta.env.VITE_API_URL || "http://localhost:8000/api";

      const response = await fetch(
        `${apiUrl}/print/dot-matrix/pledge-receipt/${createdPledgeId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ copy_type: copyType }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to generate receipt");
      }

      const data = await response.json();

      if (!data.success || !data.data?.receipt_text) {
        throw new Error("Invalid response from server");
      }

      // Open print window with both pages (receipt + terms)
      const printWindow = window.open("", "_blank", "width=600,height=800");

      if (!printWindow) {
        dispatch(
          addToast({
            type: "error",
            title: "Popup Blocked",
            message: "Please allow popups for this site to print.",
          }),
        );
        return;
      }

      // Use shared function for 2-page document
      printWindow.document.write(
        generateDotMatrixHTML(
          data.data.receipt_text,
          data.data.terms_text || "",
          copyType,
        ),
      );
      printWindow.document.close();
      printWindow.focus();

      dispatch(
        addToast({
          type: "success",
          title: "Receipt Ready",
          message: `${copyType === "office" ? "Office" : "Customer"} copy sent to printer (2 pages)`,
        }),
      );
    } catch (error) {
      console.error("Dot matrix print error:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Print Error",
          message: error.message || "Failed to print receipt",
        }),
      );
    } finally {
      setIsPrinting(false);
    }
  };

  // Update print job status helper
  const updateJobStatus = (jobKey, status, message = "") => {
    setPrintJobStatus((prev) => ({
      ...prev,
      [jobKey]: { status, message },
    }));
  };

  // Auto-print sequence - triggers all print jobs one by one
  const triggerAutoPrint = async (pledgeId) => {
    const token = getToken();
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

    if (!token || !pledgeId) return;

    let officeWindow = null;
    let customerWindow = null;
    let barcodeWindow = null;

    // 1. Dot Matrix - Office Copy
    updateJobStatus("dotMatrixOffice", "running", "Printing office copy...");
    try {
      const response = await fetch(
        `${apiUrl}/print/dot-matrix/pledge-receipt/${pledgeId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ copy_type: "office" }),
        },
      );

      if (!response.ok) throw new Error("Failed to generate office copy");
      const data = await response.json();

      if (data.success && data.data?.receipt_text) {
        officeWindow = window.open("", "_blank", "width=600,height=800");
        if (officeWindow) {
          officeWindow.document.open();
          officeWindow.document.write(
            generateDotMatrixHTML(
              data.data.receipt_text,
              data.data.terms_text || "",
              "office",
            ),
          );
          officeWindow.document.close();
          updateJobStatus(
            "dotMatrixOffice",
            "success",
            "Office copy ready (2 pages)",
          );
        } else {
          updateJobStatus("dotMatrixOffice", "failed", "Popup blocked");
        }
      } else {
        throw new Error("Invalid response");
      }
    } catch (error) {
      console.error("Office copy error:", error);
      if (officeWindow && !officeWindow.closed) {
        officeWindow.close();
      }
      updateJobStatus(
        "dotMatrixOffice",
        "failed",
        error.message || "Failed to print",
      );
    }

    // Small delay between jobs
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 2. Dot Matrix - Customer Copy
    updateJobStatus(
      "dotMatrixCustomer",
      "running",
      "Printing customer copy...",
    );
    try {
      const response = await fetch(
        `${apiUrl}/print/dot-matrix/pledge-receipt/${pledgeId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ copy_type: "customer" }),
        },
      );

      if (!response.ok) throw new Error("Failed to generate customer copy");
      const data = await response.json();

      if (data.success && data.data?.receipt_text) {
        customerWindow = window.open("", "_blank", "width=600,height=800");
        if (customerWindow) {
          customerWindow.document.open();
          customerWindow.document.write(
            generateDotMatrixHTML(
              data.data.receipt_text,
              data.data.terms_text || "",
              "customer",
            ),
          );
          customerWindow.document.close();
          updateJobStatus(
            "dotMatrixCustomer",
            "success",
            "Customer copy ready (2 pages)",
          );
        } else {
          updateJobStatus("dotMatrixCustomer", "failed", "Popup blocked");
        }
      } else {
        throw new Error("Invalid response");
      }
    } catch (error) {
      console.error("Customer copy error:", error);
      if (customerWindow && !customerWindow.closed) {
        customerWindow.close();
      }
      updateJobStatus(
        "dotMatrixCustomer",
        "failed",
        error.message || "Failed to print",
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 3. Barcode Labels (Thermal Printer)
    // 3. Barcode Label (Thermal Printer) - ONE barcode per pledge
    updateJobStatus("barcode", "running", "Generating barcode label...");
    try {
      const response = await fetch(`${apiUrl}/print/barcodes/${pledgeId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) throw new Error("Failed to generate barcode");
      const data = await response.json();

      // Use pledge-level barcode data (ONE barcode per pledge)
      if (data.success && data.data) {
        barcodeWindow = window.open("", "_blank", "width=400,height=600");
        if (barcodeWindow) {
          barcodeWindow.document.open();
          // Pass pledge data for single barcode generation
          const pledgeBarcodeData = {
            barcode_image:
              data.data.barcode_image || data.data.items?.[0]?.image || "",
            barcode:
              data.data.barcode ||
              data.data.pledge_barcode ||
              data.data.receipt_no ||
              data.data.pledge_no,
            total_items: data.data.items?.length || data.data.total_items || 1,
            total_weight:
              data.data.total_weight ||
              data.data.items?.reduce(
                (sum, item) => sum + (parseFloat(item.net_weight) || 0),
                0,
              ) ||
              0,
          };
          barcodeWindow.document.write(
            generateBarcodeHTML(
              pledgeBarcodeData,
              data.data.pledge_no,
              data.data.receipt_no,
            ),
          );
          barcodeWindow.document.close();
          updateJobStatus("barcode", "success", "1 barcode label ready");
        } else {
          updateJobStatus("barcode", "failed", "Popup blocked");
        }
      } else {
        throw new Error("No barcode data");
      }
    } catch (error) {
      console.error("Barcode error:", error);
      if (barcodeWindow && !barcodeWindow.closed) {
        barcodeWindow.close();
      }
      updateJobStatus(
        "barcode",
        "failed",
        error.message || "Failed to generate",
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 300));

    // 4. WhatsApp Message
    if (!customer?.phone) {
      updateJobStatus("whatsapp", "skipped", "No phone number");
    } else {
      // Check if WhatsApp is configured first
      updateJobStatus(
        "whatsapp",
        "running",
        "Checking WhatsApp configuration...",
      );
      try {
        // Try to get WhatsApp config to check if it's set up
        const configResponse = await fetch(`${apiUrl}/whatsapp/config`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        const configData = await configResponse.json();

        // Check if WhatsApp is enabled and configured
        // API returns: { data: { is_configured: true, config: { is_enabled: true, api_token, instance_id } } }
        const whatsappConfig = configData.data?.config;

        if (!configData.success || !whatsappConfig?.is_enabled) {
          updateJobStatus(
            "whatsapp",
            "skipped",
            "Not configured - Set up in Settings → WhatsApp",
          );
        } else if (!whatsappConfig?.api_token || !whatsappConfig?.instance_id) {
          updateJobStatus(
            "whatsapp",
            "skipped",
            "API credentials missing - Check Settings → WhatsApp",
          );
        } else {
          // WhatsApp is configured, try to send
          updateJobStatus("whatsapp", "running", "Sending WhatsApp...");
          const whatsappResponse = await pledgeService.sendWhatsApp(pledgeId);
          if (whatsappResponse.success || whatsappResponse.data?.success) {
            updateJobStatus("whatsapp", "success", "Message sent");
          } else {
            throw new Error(whatsappResponse.data?.message || "Failed to send");
          }
        }
      } catch (error) {
        console.error("WhatsApp error:", error);
        const errorMsg =
          error.response?.data?.message || error.message || "Failed to send";

        // Check for common configuration issues
        if (
          errorMsg.includes("not configured") ||
          errorMsg.includes("401") ||
          errorMsg.includes("not found")
        ) {
          updateJobStatus(
            "whatsapp",
            "skipped",
            "Not configured - Set up in Settings → WhatsApp",
          );
        } else {
          updateJobStatus("whatsapp", "failed", errorMsg);
        }
      }
    }
  };

  // Generate dot matrix print HTML - MANUAL DUPLEX for Epson LQ-310
  // Step 1: Print FRONT (Receipt), Step 2: Flip paper & print BACK (Terms)
  const generateDotMatrixHTML = (receiptHtml, termsHtml, copyType) => {
    const copyLabel =
      copyType === "office" ? "SALINAN PEJABAT" : "SALINAN PELANGGAN";

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Resit Pajak Gadai - ${copyType === "office" ? "Office" : "Customer"} Copy</title>
      <style>
        @page { size: A5 landscape; margin: 3mm; }
        @media print {
          html, body { margin: 0; padding: 0; }
          .print-controls, .step-indicator, .flip-instructions { display: none !important; }
          .page { page-break-after: auto; }
          .page.hidden-for-print { display: none !important; }
        }
        @media screen {
          body { max-width: 220mm; margin: 0 auto; padding: 10px; background: #1f2937; min-height: 100vh; }
          .page { background: white; margin-bottom: 15px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); border-radius: 4px; overflow: hidden; }
          .page.hidden-for-print { opacity: 0.3; pointer-events: none; }
        }
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #000; }
        
        /* Control Panel */
        .print-controls { 
          background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
          padding: 20px; 
          margin-bottom: 15px; 
          border-radius: 12px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        }
        .step-indicator {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-bottom: 15px;
        }
        .step {
          padding: 8px 20px;
          border-radius: 20px;
          font-weight: bold;
          font-size: 13px;
          transition: all 0.3s;
        }
        .step.active { background: #f59e0b; color: #000; }
        .step.completed { background: #10b981; color: #fff; }
        .step.pending { background: #4b5563; color: #9ca3af; }
        
        .btn-row { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
        .print-btn { 
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: #000; 
          border: none; 
          padding: 14px 30px; 
          font-size: 15px; 
          cursor: pointer; 
          border-radius: 8px; 
          font-weight: bold;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .print-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(245,158,11,0.4); }
        .print-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .print-btn.green { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; }
        .close-btn { 
          background: #6b7280; 
          color: white; 
          border: none; 
          padding: 14px 20px; 
          font-size: 14px; 
          cursor: pointer; 
          border-radius: 8px;
        }
        
        .flip-instructions {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border: 2px solid #f59e0b;
          border-radius: 10px;
          padding: 15px 20px;
          margin: 15px 0;
          text-align: center;
        }
        .flip-instructions h3 { color: #92400e; margin: 0 0 8px 0; font-size: 16px; }
        .flip-instructions p { color: #78350f; margin: 5px 0; font-size: 13px; }
        .flip-instructions .icon { font-size: 28px; }
        
        .printer-note { font-size: 11px; color: #9ca3af; margin-top: 12px; text-align: center; }
        .printer-note strong { color: #fbbf24; }
        
        .page-label { 
          background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
          color: white; 
          padding: 10px 15px; 
          font-size: 12px; 
          font-weight: bold;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .page-label.terms { background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)); }
        .page-label .badge { 
          background: rgba(255,255,255,0.2); 
          padding: 3px 10px; 
          border-radius: 10px; 
          font-size: 10px; 
        }
      </style>
    </head>
    <body>
      <div class="print-controls">
        <div class="step-indicator">
          <div class="step active" id="step1-indicator">① DEPAN / FRONT</div>
          <div class="step pending" id="step2-indicator">② BELAKANG / BACK</div>
        </div>
        
        <div class="btn-row">
          <button class="print-btn" id="printFrontBtn" onclick="printFront()">
            🖨️ Cetak DEPAN / Print FRONT
          </button>
          <button class="print-btn green" id="printBackBtn" onclick="printBack()" disabled>
            🔄 Cetak BELAKANG / Print BACK
          </button>
          <button class="close-btn" onclick="window.close()">✕ Tutup</button>
        </div>
        
        <div class="flip-instructions" id="flipInstructions" style="display: none;">
          <div class="icon">🔄📄</div>
          <h3>PUSING KERTAS / FLIP PAPER</h3>
          <p>1. Keluarkan kertas dari printer / Remove paper from printer</p>
          <p>2. <strong>Pusing kertas</strong> dan masukkan semula / <strong>Flip paper</strong> and reinsert</p>
          <p>3. Klik butang hijau untuk cetak belakang / Click green button to print back</p>
        </div>
        
        <p class="printer-note">
          Printer: <strong>Epson LQ-310</strong> | Kertas: <strong>A5 Landscape</strong> | Salinan: <strong>${copyLabel}</strong>
        </p>
      </div>
      
      <!-- Page 1: Receipt (FRONT) -->
      <div class="page" id="frontPage">
        <div class="page-label">
          <span>📄 HALAMAN DEPAN / FRONT PAGE - RESIT PAJAK GADAI</span>
          <span class="badge">${copyLabel}</span>
        </div>
        ${receiptHtml}
      </div>
      
      <!-- Page 2: Terms & Conditions (BACK) -->
      <div class="page hidden-for-print" id="backPage">
        <div class="page-label terms">
          <span>📋 HALAMAN BELAKANG / BACK PAGE - TERMA & SYARAT</span>
          <span class="badge">${copyLabel}</span>
        </div>
        ${termsHtml}
      </div>
      
      <script>
        let currentStep = 1;
        
        function printFront() {
          // Show only front page for printing
          document.getElementById('frontPage').classList.remove('hidden-for-print');
          document.getElementById('backPage').classList.add('hidden-for-print');
          
          window.print();
          
          // After print dialog closes, move to step 2
          setTimeout(function() {
            currentStep = 2;
            document.getElementById('step1-indicator').classList.remove('active');
            document.getElementById('step1-indicator').classList.add('completed');
            document.getElementById('step1-indicator').textContent = '✓ DEPAN / FRONT';
            document.getElementById('step2-indicator').classList.remove('pending');
            document.getElementById('step2-indicator').classList.add('active');
            document.getElementById('printFrontBtn').disabled = true;
            document.getElementById('printBackBtn').disabled = false;
            document.getElementById('flipInstructions').style.display = 'block';
            
            // Show back page preview
            document.getElementById('frontPage').classList.add('hidden-for-print');
            document.getElementById('backPage').classList.remove('hidden-for-print');
          }, 1000);
        }
        
        function printBack() {
          // Show only back page for printing
          document.getElementById('frontPage').classList.add('hidden-for-print');
          document.getElementById('backPage').classList.remove('hidden-for-print');
          
          window.print();
          
          // After print, mark as complete
          setTimeout(function() {
            document.getElementById('step2-indicator').classList.remove('active');
            document.getElementById('step2-indicator').classList.add('completed');
            document.getElementById('step2-indicator').textContent = '✓ BELAKANG / BACK';
            document.getElementById('printBackBtn').disabled = true;
            document.getElementById('flipInstructions').innerHTML = '<div class="icon">✅</div><h3>SELESAI / COMPLETE</h3><p>Kedua-dua halaman telah dicetak / Both pages have been printed</p>';
          }, 1000);
        }
        
        window.onload = function() { 
          document.getElementById('printFrontBtn').focus(); 
        };
      </script>
    </body>
    </html>`;
  };

  // Generate barcode print HTML (for thermal printer) - ONE BARCODE PER PLEDGE
  // Business Rule: Only ONE barcode per pledge/receipt (transaction-based, not item-based)
  const generateBarcodeHTML = (pledgeData, pledgeNo, receiptNo) => {
    // Extract barcode data - use pledge-level barcode, not item-level
    const barcodeImage = pledgeData.barcode_image || pledgeData.image || "";
    const barcodeText =
      pledgeData.barcode ||
      pledgeData.pledge_barcode ||
      receiptNo ||
      pledgeNo ||
      "N/A";
    const totalItems = pledgeData.total_items || pledgeData.items_count || 1;
    const totalWeight = pledgeData.total_weight || "0";

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Barcode Label - ${receiptNo || pledgeNo || "Pledge"}</title>
      <style>
        @page { 
          size: 50mm auto; 
          margin: 0; 
        }
        @media print {
          html, body {
            width: 50mm;
            margin: 0;
            padding: 0;
          }
          .controls { display: none !important; }
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: Arial, sans-serif; 
          margin: 0; 
          padding: 0; 
          background: #f5f5f5;
          width: 50mm;
        }
        .controls { 
          text-align: center; 
          padding: 15px; 
          background: linear-gradient(135deg, #1f2937 0%, #374151 100%); 
          margin-bottom: 15px;
          width: 100%;
          max-width: 300px;
          margin-left: auto;
          margin-right: auto;
        }
        .controls button { 
          background: linear-gradient(135deg, #d97706 0%, #b45309 100%); 
          color: white; 
          border: none; 
          padding: 12px 25px; 
          cursor: pointer; 
          border-radius: 8px; 
          margin: 0 5px; 
          font-weight: bold; 
        }
        .controls button.close { background: #6b7280; }
        .controls .info { color: #9ca3af; font-size: 11px; margin-top: 10px; }
        .controls .info strong { color: #fbbf24; }
        .labels-wrapper { 
          width: 50mm; 
          margin: 0 auto; 
          background: white; 
          box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        .label { 
          width: 50mm; 
          min-height: 30mm;
          padding: 2mm 3mm; 
          background: white; 
          display: flex; 
          flex-direction: column; 
          overflow: hidden; 
          page-break-inside: avoid;
        }
        .header-row { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          border-bottom: 0.3mm solid #333; 
          padding-bottom: 1mm; 
          margin-bottom: 1mm; 
        }
        .pledge-no { font-size: 9pt; font-weight: bold; }
        .items-count { font-size: 8pt; font-weight: 600; text-transform: uppercase; color: #333; }
        .barcode-section { 
          flex: 1; 
          text-align: center; 
          display: flex; 
          flex-direction: column; 
          align-items: center; 
          justify-content: center;
          padding: 2mm 0;
        }
        .barcode-img { 
          width: 42mm; 
          height: 12mm; 
          object-fit: contain; 
        }
        .barcode-text { 
          font-family: 'Courier New', monospace; 
          font-size: 8pt; 
          margin-top: 1mm; 
          font-weight: bold; 
          letter-spacing: 0.5px; 
        }
        .footer-row { 
          border-top: 0.3mm solid #333; 
          padding-top: 1mm; 
          font-size: 9pt; 
          font-weight: bold; 
          text-align: center; 
        }
        @media screen { 
          body { padding: 20px; width: auto; } 
          .labels-wrapper { box-shadow: 0 2px 10px rgba(0,0,0,0.2); }
        }
      </style>
    </head>
    <body>
      <div class="controls">
        <button onclick="window.print()">🏷️ Print Barcode Label</button>
        <button class="close" onclick="window.close()">✕ Close</button>
        <p class="info">Printer: <strong>Thermal 58mm</strong> | <strong>1 Label per Pledge</strong></p>
        <p class="info" style="margin-top:5px;">⚠️ Set printer to <strong>58mm Roll</strong> or <strong>Custom 50mm</strong></p>
      </div>
      <div class="labels-wrapper">
        <div class="label">
          <div class="header-row">
            <span class="pledge-no">${pledgeNo || receiptNo || ""}</span>
            <span class="items-count">${totalItems} Item${totalItems > 1 ? "s" : ""}</span>
          </div>
          <div class="barcode-section">
            ${barcodeImage ? `<img class="barcode-img" src="${barcodeImage}" alt="barcode" onerror="this.style.display='none'" />` : ""}
            <div class="barcode-text">${barcodeText}</div>
          </div>
          <div class="footer-row">Total: ${parseFloat(totalWeight).toFixed(2)}g</div>
        </div>
      </div>
      <script>window.onload = function() { document.querySelector('button').focus(); };</script>
    </body>
    </html>`;
  };
  // Manual retry function for failed jobs
  const retryPrintJob = async (jobKey) => {
    if (!createdPledgeId) return;

    const token = getToken();
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

    updateJobStatus(jobKey, "running", "Retrying...");

    try {
      switch (jobKey) {
        case "dotMatrixOffice":
        case "dotMatrixCustomer": {
          const copyType = jobKey === "dotMatrixOffice" ? "office" : "customer";
          const response = await fetch(
            `${apiUrl}/print/dot-matrix/pledge-receipt/${createdPledgeId}`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({ copy_type: copyType }),
            },
          );
          if (!response.ok) throw new Error("Failed");
          const data = await response.json();
          if (data.success && data.data?.receipt_text) {
            const printWindow = window.open(
              "",
              "_blank",
              "width=600,height=800",
            );
            if (printWindow) {
              printWindow.document.write(
                generateDotMatrixHTML(
                  data.data.receipt_text,
                  data.data.terms_text || "",
                  copyType,
                ),
              );
              printWindow.document.close();
              updateJobStatus(
                jobKey,
                "success",
                `${copyType === "office" ? "Office" : "Customer"} copy ready (2 pages)`,
              );
            } else {
              throw new Error("Popup blocked");
            }
          }
          break;
        }
        case "barcode": {
          const response = await fetch(
            `${apiUrl}/print/barcodes/${createdPledgeId}`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
              },
            },
          );
          if (!response.ok) throw new Error("Failed");
          const data = await response.json();
          if (data.success && data.data) {
            const printWindow = window.open(
              "",
              "_blank",
              "width=400,height=600",
            );
            if (printWindow) {
              // Prepare single barcode data for pledge
              const pledgeBarcodeData = {
                barcode_image:
                  data.data.barcode_image || data.data.items?.[0]?.image || "",
                barcode:
                  data.data.barcode ||
                  data.data.pledge_barcode ||
                  data.data.receipt_no ||
                  data.data.pledge_no,
                total_items:
                  data.data.items?.length || data.data.total_items || 1,
                total_weight:
                  data.data.total_weight ||
                  data.data.items?.reduce(
                    (sum, item) => sum + (parseFloat(item.net_weight) || 0),
                    0,
                  ) ||
                  0,
              };
              printWindow.document.write(
                generateBarcodeHTML(
                  pledgeBarcodeData,
                  data.data.pledge_no,
                  data.data.receipt_no,
                ),
              );
              printWindow.document.close();
              updateJobStatus("barcode", "success", "1 barcode label ready");
            } else {
              throw new Error("Popup blocked");
            }
          }
          break;
        }
        case "whatsapp": {
          // Check config first
          const configResponse = await fetch(`${apiUrl}/whatsapp/config`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          });
          const configData = await configResponse.json();
          const whatsappConfig = configData.data?.config;

          if (!configData.success || !whatsappConfig?.is_enabled) {
            updateJobStatus(
              "whatsapp",
              "skipped",
              "Not configured - Set up in Settings → WhatsApp",
            );
            return;
          }
          if (!whatsappConfig?.api_token || !whatsappConfig?.instance_id) {
            updateJobStatus(
              "whatsapp",
              "skipped",
              "API credentials missing - Check Settings → WhatsApp",
            );
            return;
          }

          const whatsappResponse =
            await pledgeService.sendWhatsApp(createdPledgeId);
          if (whatsappResponse.success || whatsappResponse.data?.success) {
            updateJobStatus("whatsapp", "success", "Message sent");
          } else {
            throw new Error(whatsappResponse.data?.message || "Failed to send");
          }
          break;
        }
      }
    } catch (error) {
      console.error(`Retry ${jobKey} error:`, error);
      updateJobStatus(jobKey, "failed", error.message || "Failed");
    }
  };

  const handleItemPhoto = (e, itemId) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      dispatch(
        addToast({
          type: "error",
          title: "Invalid",
          message: "Please upload an image",
        }),
      );
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      updateItem(itemId, "photo", reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Payout auto-calculate
  useEffect(() => {
    if (payoutMethod === "cash") {
      setCashAmount(Number(netPayoutAmount).toFixed(2));
      setTransferAmount("");
    } else if (payoutMethod === "transfer") {
      setTransferAmount(Number(netPayoutAmount).toFixed(2));
      setCashAmount("");
    }
  }, [payoutMethod, netPayoutAmount]);

  // Signature canvas handlers
  const initSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  };

  const startDrawing = (e) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    setIsDrawing(true);
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = signatureCanvasRef.current;
      if (canvas) {
        setSignature(canvas.toDataURL());
      }
    }
  };

  const clearSignature = () => {
    setSignature(null);
    initSignatureCanvas();
  };

  // Handle signature image upload
  const handleSignatureUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      dispatch(
        addToast({
          type: "error",
          title: "Invalid File",
          message: "Please upload an image file (PNG, JPG, etc.)",
        }),
      );
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSignature(reader.result);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be uploaded again
    if (signatureUploadRef.current) {
      signatureUploadRef.current.value = "";
    }
  };

  // Navigation validation - UPDATED FOR 6 STEPS
  const validateStep = (step) => {
    switch (step) {
      case 1:
        if (!customer) {
          dispatch(
            addToast({
              type: "error",
              title: "Required",
              message: "Please select a customer",
            }),
          );
          return false;
        }
        return true;
      case 2:
        const validItems = items.filter(
          (item) => item.category && item.weight && parseFloat(item.weight) > 0,
        );
        if (validItems.length === 0) {
          dispatch(
            addToast({
              type: "error",
              title: "Required",
              message: "Please add at least one item with category and weight",
            }),
          );
          return false;
        }
        return true;
      case 3:
        if (effectivePercentage <= 0 || effectivePercentage > 100) {
          dispatch(
            addToast({
              type: "error",
              title: "Invalid",
              message: "Loan percentage must be between 1-100%",
            }),
          );
          return false;
        }
        return true;
      case 4:
        if (payoutMethod === "partial") {
          const cash = parseFloat(cashAmount) || 0;
          const transfer = parseFloat(transferAmount) || 0;
          if (Math.abs(cash + transfer - loanAmount) > 0.01) {
            dispatch(
              addToast({
                type: "error",
                title: "Mismatch",
                message: "Cash + Transfer must equal loan amount",
              }),
            );
            return false;
          }
          if (transfer > 0 && (!bankId || !accountNumber)) {
            dispatch(
              addToast({
                type: "error",
                title: "Required",
                message: "Bank details required for transfer",
              }),
            );
            return false;
          }
        }
        if (payoutMethod === "transfer" && (!bankId || !accountNumber)) {
          dispatch(
            addToast({
              type: "error",
              title: "Required",
              message: "Bank details required for transfer",
            }),
          );
          return false;
        }
        return true;
      case 5:
        // Storage assignment validation - MANDATORY
        const itemsNeedingStorage = items.filter((i) => i.category && i.weight);
        const assignedCount = Object.keys(itemStorageAssignments).length;

        if (
          itemsNeedingStorage.length > 0 &&
          assignedCount < itemsNeedingStorage.length
        ) {
          dispatch(
            addToast({
              type: "error",
              title: "Storage Required",
              message: `Please assign storage locations for all ${itemsNeedingStorage.length} item(s).`,
            }),
          );
          return false;
        }
        return true;
      case 6:
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Submit pledge - INCLUDES STORAGE WITH INTEGER IDs
  const handleSubmit = async () => {
    if (!agreedToTerms) {
      dispatch(
        addToast({
          type: "error",
          title: "Required",
          message: "Please agree to terms and conditions",
        }),
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const pledgeItems = items
        .filter((item) => item.category && item.weight)
        .map((item) => {
          const categoryId = getCategoryId(item.category);
          const purityId = getPurityId(item.purity);
          const storageAssignment = itemStorageAssignments[item.id];

          if (!categoryId) {
            console.warn(`Category ID not found for: ${item.category}`);
          }
          if (!purityId) {
            console.warn(`Purity ID not found for: ${item.purity}`);
          }

          // Build item payload - ENSURE INTEGER IDs
          const itemPayload = {
            category_id: categoryId,
            purity_id: purityId,
            gross_weight: parseFloat(item.weight),
            stone_deduction_type: item.stoneDeductionType || "amount",
            stone_deduction_value: parseFloat(item.stoneDeduction) || 0,
            description: item.description || null,
            photo: item.photo || null, // Include captured item photo
          };

          // Only add storage if assigned - ENSURE INTEGER VALUES
          if (storageAssignment) {
            itemPayload.vault_id = parseInt(storageAssignment.vaultId, 10);
            itemPayload.box_id = parseInt(storageAssignment.boxId, 10);
            itemPayload.slot_id = parseInt(storageAssignment.slotId, 10);
          }

          return itemPayload;
        });

      const hasInvalidItems = pledgeItems.some(
        (item) => !item.category_id || !item.purity_id,
      );
      if (hasInvalidItems) {
        dispatch(
          addToast({
            type: "error",
            title: "Error",
            message:
              "Could not find category or purity IDs. Please check settings.",
          }),
        );
        setIsSubmitting(false);
        return;
      }

      const payment = {
        method: payoutMethod === "partial" ? "partial" : payoutMethod,
        cash_amount:
          payoutMethod === "cash" || payoutMethod === "partial"
            ? parseFloat(cashAmount) || netPayoutAmount
            : 0,
        transfer_amount:
          payoutMethod === "transfer" || payoutMethod === "partial"
            ? parseFloat(transferAmount) ||
              (payoutMethod === "transfer" ? netPayoutAmount : 0)
            : 0,
        reference_no: referenceNo || null,
      };

      if (
        (payoutMethod === "transfer" || payoutMethod === "partial") &&
        bankId
      ) {
        payment.bank_id = parseInt(bankId);
      }

      const pledgeData = {
        customer_id: customer.id,
        items: pledgeItems,
        loan_percentage: effectivePercentage,
        handling_fee: parseFloat(handlingCharge) || 0,
        payment: payment,
        customer_signature: signature,
        terms_accepted: true,
      };

      console.log(
        "Submitting pledge data:",
        JSON.stringify(pledgeData, null, 2),
      );

      const response = await pledgeService.create(pledgeData);
      const createdPledge = response.data?.data || response.data;

      dispatch(addPledge(createdPledge));
      dispatch(setSelectedCustomer(null));

      setCreatedPledgeId(createdPledge.id);
      setCreatedReceiptNo(
        createdPledge.receipt_no || createdPledge.pledge_no || createdPledge.id,
      );
      setIsSubmitting(false);
      setShowSuccessModal(true);

      dispatch(
        addToast({
          type: "success",
          title: "Success",
          message: `Pledge ${
            createdPledge.receipt_no ||
            createdPledge.pledge_no ||
            createdPledge.id
          } created successfully`,
        }),
      );

      // Reset print job status before auto-print
      setPrintJobStatus({
        dotMatrixOffice: { status: "pending", message: "" },
        dotMatrixCustomer: { status: "pending", message: "" },
        barcode: { status: "pending", message: "" },
        whatsapp: { status: "pending", message: "" },
      });

      // Trigger auto-print sequence after modal opens
      triggerAutoPrint(createdPledge.id);
    } catch (error) {
      console.error("Error creating pledge:", error);
      const errors = error.response?.data?.errors;
      let message = error.response?.data?.message || "Failed to create pledge";

      if (errors) {
        const errorMessages = Object.values(errors)
          .flat()
          .slice(0, 3)
          .join(", ");
        message = errorMessages || message;
      }

      dispatch(addToast({ type: "error", title: "Error", message }));
      setIsSubmitting(false);
    }
  };

  // Handle print receipt - Downloads PDF from PrintController
  const handlePrintReceipt = async (copyType = "customer") => {
    if (!createdPledgeId) return;

    const token = getToken();
    if (!token) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Please login again",
        }),
      );
      return;
    }

    setIsPrinting(true);
    try {
      const apiUrl =
        import.meta.env.VITE_API_URL || "http://localhost:8000/api";

      // Call PrintController endpoint (generates actual PDF)
      const response = await fetch(
        `${apiUrl}/print/pledge-receipt/${createdPledgeId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/pdf",
          },
          body: JSON.stringify({ copy_type: copyType }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to generate receipt");
      }

      // Get PDF blob
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // Open in new tab for printing
      window.open(url, "_blank");

      // Cleanup URL after a delay
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);

      dispatch(
        addToast({
          type: "success",
          title: "Receipt Generated",
          message: "PDF opened in new tab. Use Ctrl+P to print.",
        }),
      );
    } catch (error) {
      console.error("Print error:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Print Error",
          message: error.message || "Failed to generate receipt",
        }),
      );
    } finally {
      setIsPrinting(false);
    }
  };

  // Handle WhatsApp - Sends pledge details via WhatsApp
  const handleSendWhatsApp = async () => {
    if (!createdPledgeId) return;

    setIsSendingWhatsApp(true);
    try {
      const response = await pledgeService.sendWhatsApp(createdPledgeId);

      // Check if response indicates success
      if (response.data?.success || response.success) {
        dispatch(
          addToast({
            type: "success",
            title: "WhatsApp Sent",
            message:
              response.data?.message || "Receipt sent to customer via WhatsApp",
          }),
        );
      } else {
        throw new Error(response.data?.message || "Failed to send WhatsApp");
      }
    } catch (error) {
      console.error("WhatsApp error:", error);

      // Check if it's a configuration error
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to send WhatsApp";

      dispatch(
        addToast({
          type: "error",
          title: "WhatsApp Error",
          message: errorMessage,
        }),
      );
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  // Handle printing both Office and Customer copies
  const handlePrintBothCopies = async () => {
    if (!createdPledgeId) return;
    setIsPrinting(true);

    try {
      // Print Office Copy first
      await handlePrintReceipt("office");

      // Small delay then print Customer Copy
      setTimeout(async () => {
        await handlePrintReceipt("customer");
      }, 1000);

      dispatch(
        addToast({
          type: "success",
          title: "Receipts Generated",
          message: "Both Office and Customer copies are ready for printing.",
        }),
      );
    } catch (error) {
      console.error("Print both error:", error);
    } finally {
      setIsPrinting(false);
    }
  };

  // Handle printing barcode sticker (Thermal Printer - AN803)
  // Business Rule: ONE barcode per pledge (transaction-based, not item-based)
  const handlePrintBarcodes = async () => {
    if (!createdPledgeId) return;

    const token = getToken();
    if (!token) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Please login again",
        }),
      );
      return;
    }

    setIsPrinting(true);
    try {
      const apiUrl =
        import.meta.env.VITE_API_URL || "http://localhost:8000/api";

      // Fetch pledge barcode (ONE barcode per pledge)
      const response = await fetch(
        `${apiUrl}/print/barcodes/${createdPledgeId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to generate barcode");
      }

      const data = await response.json();

      if (!data.success || !data.data) {
        dispatch(
          addToast({
            type: "warning",
            title: "No Barcode",
            message: "No barcode data available.",
          }),
        );
        return;
      }

      // Prepare single barcode data for pledge
      const pledgeBarcodeData = {
        barcode_image:
          data.data.barcode_image || data.data.items?.[0]?.image || "",
        barcode:
          data.data.barcode ||
          data.data.pledge_barcode ||
          data.data.receipt_no ||
          data.data.pledge_no,
        total_items: data.data.items?.length || data.data.total_items || 1,
        total_weight:
          data.data.total_weight ||
          data.data.items?.reduce(
            (sum, item) => sum + (parseFloat(item.net_weight) || 0),
            0,
          ) ||
          0,
      };

      // Open barcode print window
      const printWindow = window.open("", "_blank", "width=400,height=600");

      if (!printWindow) {
        dispatch(
          addToast({
            type: "error",
            title: "Popup Blocked",
            message: "Please allow popups for this site to print barcodes.",
          }),
        );
        return;
      }

      // Generate single barcode label HTML
      printWindow.document.write(
        generateBarcodeHTML(
          pledgeBarcodeData,
          data.data.pledge_no || createdReceiptNo,
          data.data.receipt_no || createdReceiptNo,
        ),
      );

      printWindow.document.close();
      printWindow.focus();

      dispatch(
        addToast({
          type: "success",
          title: "Label Ready",
          message: "1 barcode label ready for printing.",
        }),
      );
    } catch (error) {
      console.error("Barcode print error:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Barcode Error",
          message: error.message || "Failed to generate barcode",
        }),
      );
    } finally {
      setIsPrinting(false);
    }
  };
  // Animation variants
  const stepVariants = {
    hidden: { opacity: 0, x: 50 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 },
  };

  // Get vault/box names for display
  const getVaultName = (vaultId) =>
    vaults.find((v) => v.id === vaultId)?.name || `Vault ${vaultId}`;
  const getBoxName = (boxId) => {
    const box = boxes.find((b) => b.id === boxId);
    return box?.name || box?.box_number
      ? `Box ${box.box_number}`
      : `Box ${boxId}`;
  };

  // Calculate available slots count
  const getAvailableSlotsCount = () => {
    return slots.filter((s) => !s.is_occupied).length;
  };

  // Check if slot is assigned in current pledge
  const isSlotAssignedInPledge = (slotId) => {
    return Object.values(itemStorageAssignments).some(
      (a) => a.slotId === slotId,
    );
  };

  return (
    <PageWrapper
      title="New Pledge"
      subtitle="Create a new pledge transaction"
      actions={
        <Button
          variant="outline"
          leftIcon={ArrowLeft}
          onClick={() => navigate("/pledges")}
        >
          Cancel
        </Button>
      }
    >
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;

            return (
              <div key={step.id} className="flex items-center">
                <motion.div
                  className="flex flex-col items-center"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <motion.div
                    className={cn(
                      "w-10 h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center border-2 transition-all",
                      isActive && "border-amber-500 bg-amber-50 text-amber-600",
                      isCompleted &&
                        "border-emerald-500 bg-emerald-500 text-white",
                      !isActive &&
                        !isCompleted &&
                        "border-zinc-300 bg-white text-zinc-400",
                    )}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4 lg:w-5 lg:h-5" />
                    ) : (
                      <Icon className="w-4 h-4 lg:w-5 lg:h-5" />
                    )}
                  </motion.div>
                  <div className="mt-2 text-center">
                    <p
                      className={cn(
                        "text-xs lg:text-sm font-medium",
                        isActive && "text-amber-600",
                        isCompleted && "text-emerald-600",
                        !isActive && !isCompleted && "text-zinc-400",
                      )}
                    >
                      {step.title}
                    </p>
                    <p className="text-[10px] text-zinc-500 hidden lg:block">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "w-6 lg:w-12 xl:w-16 h-0.5 mx-1 lg:mx-2",
                      isCompleted ? "bg-emerald-500" : "bg-zinc-200",
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <Card className="max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {/* Step 1: Customer Selection */}
          {currentStep === 1 && (
            <motion.div
              key="step-1"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="p-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <User className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-800">
                    Customer Information
                  </h3>
                  <p className="text-sm text-zinc-500">
                    Search by IC or select existing customer
                  </p>
                </div>
              </div>

              {/* Customer Search */}
              <div className="flex gap-3 mb-6">
                <div className="flex-1 relative">
                  <Input
                    placeholder="Search by Name, IC, or Phone"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && performSearch()}
                    leftIcon={Search}
                  />
                  {/* Search Results Dropdown */}
                  {showResults && searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {searchResults.map((result) => (
                        <div
                          key={result.id}
                          className="p-3 hover:bg-zinc-50 cursor-pointer border-b border-zinc-100 last:border-0"
                          onClick={() => handleCustomerSelect(result)}
                        >
                          <p className="font-medium text-zinc-800">
                            {result.name}
                          </p>
                          <div className="flex gap-4 text-xs text-zinc-500 mt-1">
                            <span className="flex items-center gap-1">
                              <CreditCard className="w-3 h-3" />
                              {result.ic_number}
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {result.country_code
                                ? `${result.country_code.startsWith("+") ? "" : "+"}${result.country_code} `
                                : ""}
                              {result.phone}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  variant="primary"
                  leftIcon={Search}
                  onClick={() => performSearch()}
                  loading={isSearching}
                >
                  Search
                </Button>
              </div>

              {/* Selected Customer Display */}
              <AnimatePresence>
                {customer && customer.name && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    {/* Customer Info Card */}
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-bold text-xl">
                          {customer.name?.charAt(0) || "?"}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-zinc-800">
                              {customer.name || "Unknown"}
                            </h4>
                            <Badge variant="success">Selected</Badge>
                          </div>
                          <p className="text-sm text-zinc-500 font-mono">
                            {formatIC(
                              customer.ic_number || customer.icNumber || "",
                            )}
                          </p>
                          <p className="text-sm text-zinc-500">
                            {customer.country_code
                              ? `${customer.country_code.startsWith("+") ? "" : "+"}${customer.country_code} `
                              : ""}
                            {formatPhone(customer.phone || "")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-zinc-500">
                            Active Pledges
                          </p>
                          <p className="text-xl font-bold text-zinc-800">
                            {Array.isArray(customer.active_pledges)
                              ? customer.active_pledges.length
                              : customer.total_pledges ||
                                customerPledges.length ||
                                0}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setCustomer(null);
                            setCustomerSearchResult(null);
                            setCustomerPledges([]);
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Customer's Existing Pledges List */}
                    {customerPledges.length > 0 && (
                      <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="w-4 h-4 text-amber-600" />
                          <h4 className="font-semibold text-amber-800">
                            Existing Active Pledges ({customerPledges.length})
                          </h4>
                        </div>

                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {customerPledges.map((pledge) => {
                            const receiptNo =
                              pledge.receipt_no ||
                              pledge.pledge_no ||
                              `PLG-${pledge.id}`;
                            const amount = parseFloat(pledge.loan_amount) || 0;
                            const status = (
                              pledge.status || "active"
                            ).toLowerCase();
                            const dueDate = pledge.due_date
                              ? new Date(pledge.due_date).toLocaleDateString(
                                  "en-MY",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )
                              : "N/A";

                            return (
                              <div
                                key={pledge.id}
                                className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-100 hover:border-amber-300 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                                    <Receipt className="w-4 h-4 text-amber-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-zinc-800 text-sm">
                                      {receiptNo}
                                    </p>
                                    <p className="text-xs text-zinc-500">
                                      Due: {dueDate}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <p className="font-semibold text-zinc-800">
                                      {formatCurrency(amount)}
                                    </p>
                                    <span
                                      className={cn(
                                        "text-xs px-2 py-0.5 rounded-full font-medium",
                                        status === "overdue"
                                          ? "bg-red-100 text-red-700"
                                          : "bg-emerald-100 text-emerald-700",
                                      )}
                                    >
                                      {status === "overdue"
                                        ? "Overdue"
                                        : "Active"}
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(
                                        `/pledges/${pledge.id}`,
                                        "_blank",
                                      );
                                    }}
                                    className="p-1.5 text-zinc-400 hover:text-amber-600 hover:bg-amber-100 rounded transition-colors"
                                    title="View Pledge Details"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Warning if customer has overdue pledges */}
                        {customerPledges.some(
                          (p) => (p.status || "").toLowerCase() === "overdue",
                        ) && (
                          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <p className="text-xs text-red-700">
                              Customer has overdue pledge(s). Please verify
                              before creating new pledge.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}

                {customerSearchResult === "not_found" && !customer && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-amber-50 border border-amber-200 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                      <div className="flex-1">
                        <p className="font-medium text-amber-800">
                          Customer not found
                        </p>
                        <p className="text-sm text-amber-600">
                          "{searchQuery}" is not found
                        </p>
                      </div>
                      <Button
                        variant="accent"
                        size="sm"
                        leftIcon={Plus}
                        onClick={() =>
                          navigate(`/customers/new?search=${searchQuery}`)
                        }
                      >
                        Create New
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Step 2: Items Entry */}
          {currentStep === 2 && (
            <motion.div
              key="step-2"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Package className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-800">
                      Pledge Items
                    </h3>
                    <p className="text-sm text-zinc-500">
                      Add gold items for this pledge (
                      {items.filter((i) => i.category && i.weight).length}/
                      {MAX_PLEDGE_ITEMS} max)
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  leftIcon={Plus}
                  onClick={addItem}
                  disabled={items.length >= MAX_PLEDGE_ITEMS}
                  title={
                    items.length >= MAX_PLEDGE_ITEMS
                      ? "Maximum 4 items allowed"
                      : "Add new item"
                  }
                >
                  Add Item{" "}
                  {items.length >= MAX_PLEDGE_ITEMS &&
                    `(${MAX_PLEDGE_ITEMS}/${MAX_PLEDGE_ITEMS})`}
                </Button>
              </div>

              {/* Items List */}
              <div className="space-y-4">
                {items.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 border border-zinc-200 rounded-xl bg-zinc-50"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-semibold text-zinc-700">
                        Item {index + 1}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeItem(item.id)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                      <Select
                        label="Category"
                        value={item.category}
                        onChange={(e) =>
                          updateItem(item.id, "category", e.target.value)
                        }
                        options={[
                          { value: "", label: "Select..." },
                          ...categoryOptions,
                        ]}
                        required
                      />
                      <Select
                        label="Purity"
                        value={item.purity}
                        onChange={(e) => {
                          const newPurity = e.target.value;
                          updateItem(item.id, "purity", newPurity);
                          const marketPriceForPurity =
                            goldPrices[newPurity] || getMarketPrice(newPurity);
                          updateItem(
                            item.id,
                            "pricePerGram",
                            marketPriceForPurity.toFixed(2),
                          );
                        }}
                        options={dynamicPurityOptions}
                      />
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                          Price/g (RM) <span className="text-amber-500">*</span>
                        </label>
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={item.pricePerGram}
                            onChange={(e) =>
                              updateItem(
                                item.id,
                                "pricePerGram",
                                e.target.value,
                              )
                            }
                            leftIcon={DollarSign}
                            style={{ minWidth: "110px" }}
                          />
                          {item.pricePerGram &&
                            parseFloat(item.pricePerGram) ===
                              (goldPrices[item.purity] ||
                                getMarketPrice(item.purity)) && (
                              <span className="absolute -right-14 top-1/2 -translate-y-1/2 text-[10px] text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded whitespace-nowrap">
                                Market
                              </span>
                            )}
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-1">
                          Market: RM{" "}
                          {(
                            goldPrices[item.purity] ||
                            getMarketPrice(item.purity)
                          ).toFixed(2)}
                        </p>
                      </div>
                      <Input
                        label="Weight (g)"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={item.weight}
                        onChange={(e) =>
                          updateItem(item.id, "weight", e.target.value)
                        }
                        leftIcon={Scale}
                        required
                      />
                      <div className="col-span-2 lg:col-span-2 xl:col-span-2">
                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                          Stone Deduction
                        </label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={item.stoneDeduction}
                            onChange={(e) =>
                              updateItem(
                                item.id,
                                "stoneDeduction",
                                e.target.value,
                              )
                            }
                            className="w-28"
                          />
                          <Select
                            value={item.stoneDeductionType}
                            onChange={(e) =>
                              updateItem(
                                item.id,
                                "stoneDeductionType",
                                e.target.value,
                              )
                            }
                            options={[
                              { value: "amount", label: "RM" },
                              { value: "percentage", label: "%" },
                              { value: "grams", label: "g" },
                            ]}
                            className="w-24"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <Input
                        label="Description / Remarks"
                        placeholder="e.g., 916 Gold Chain with pendant"
                        value={item.description}
                        onChange={(e) =>
                          updateItem(item.id, "description", e.target.value)
                        }
                      />
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                          Item Photo
                        </label>
                        <input
                          ref={(el) => (photoInputRefs.current[item.id] = el)}
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleItemPhoto(e, item.id)}
                          className="hidden"
                        />
                        {item.photo ? (
                          <div className="relative inline-block">
                            <img
                              src={item.photo}
                              alt="Item"
                              className="w-20 h-20 object-cover rounded-lg border border-zinc-200"
                            />
                            <button
                              type="button"
                              onClick={() => updateItem(item.id, "photo", null)}
                              className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              leftIcon={Plus}
                              onClick={() =>
                                photoInputRefs.current[item.id]?.click()
                              }
                            >
                              Upload
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              leftIcon={Camera}
                              onClick={() =>
                                dispatch(openCamera({ contextId: item.id }))
                              }
                            >
                              Camera
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {item.weight && item.category && (
                      <div className="mt-4 pt-4 border-t border-zinc-200 bg-white rounded-lg p-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-zinc-500 block">
                              Price Used
                            </span>
                            <span className="font-semibold text-zinc-800">
                              RM {calculateItemValue(item).priceUsed.toFixed(2)}
                              /g
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block">
                              Gross Value
                            </span>
                            <span className="font-semibold text-zinc-800">
                              {formatCurrency(calculateItemValue(item).gross)}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block">
                              Deduction
                            </span>
                            <span className="font-semibold text-red-600">
                              -{" "}
                              {formatCurrency(
                                calculateItemValue(item).deduction,
                              )}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block">
                              Net Value
                            </span>
                            <span className="font-bold text-emerald-600 text-lg">
                              {formatCurrency(calculateItemValue(item).net)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Total Summary */}
              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-amber-700">Total Items</p>
                    <p className="text-xl font-bold text-zinc-800">
                      {items.filter((i) => i.category && i.weight).length}
                    </p>
                  </div>
                  <div>
                    <p className="text-amber-700">Total Weight</p>
                    <p className="text-xl font-bold text-zinc-800">
                      {totals.totalWeight.toFixed(2)}g
                    </p>
                  </div>
                  <div>
                    <p className="text-amber-700">Gross Value</p>
                    <p className="text-xl font-bold text-zinc-800">
                      {formatCurrency(totals.grossValue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-amber-700">Net Value</p>
                    <p className="text-xl font-bold text-emerald-600">
                      {formatCurrency(totals.netValue)}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Valuation */}
          {currentStep === 3 && (
            <motion.div
              key="step-3"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="p-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Calculator className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-800">
                    Valuation & Loan Amount
                  </h3>
                  <p className="text-sm text-zinc-500">
                    Review calculation and set loan percentage
                  </p>
                </div>
              </div>
              {/* Items Breakdown Table */}
              <div className="border border-zinc-200 rounded-xl overflow-hidden mb-6">
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
                  <h4 className="font-semibold text-amber-800 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Items Breakdown
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-zinc-600">
                          No
                        </th>
                        <th className="text-left px-4 py-3 font-semibold text-zinc-600">
                          Item
                        </th>
                        <th className="text-center px-4 py-3 font-semibold text-zinc-600">
                          Purity
                        </th>
                        <th className="text-right px-4 py-3 font-semibold text-zinc-600">
                          Weight
                        </th>
                        <th className="text-right px-4 py-3 font-semibold text-zinc-600">
                          Price/g
                        </th>
                        <th className="text-right px-4 py-3 font-semibold text-zinc-600">
                          Gross
                        </th>
                        <th className="text-right px-4 py-3 font-semibold text-zinc-600">
                          Deduction
                        </th>
                        <th className="text-right px-4 py-3 font-semibold text-zinc-600">
                          Net Value
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {items
                        .filter((i) => i.category && i.weight)
                        .map((item, idx) => {
                          const calc = calculateItemValue(item);
                          const category = categoryOptions.find(
                            (c) => c.value === item.category,
                          );
                          return (
                            <tr key={item.id} className="hover:bg-zinc-50">
                              <td className="px-4 py-3 text-zinc-500">
                                {idx + 1}
                              </td>
                              <td className="px-4 py-3 font-medium">
                                {category?.label || item.category}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                                  {item.purity}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                {parseFloat(item.weight).toFixed(2)}g
                              </td>
                              <td className="px-4 py-3 text-right">
                                RM {calc.priceUsed.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {formatCurrency(calc.gross)}
                              </td>
                              <td className="px-4 py-3 text-right text-red-600">
                                {calc.deduction > 0
                                  ? `- ${formatCurrency(calc.deduction)}`
                                  : "-"}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                                {formatCurrency(calc.net)}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                    <tfoot className="bg-amber-50 border-t-2 border-amber-200">
                      <tr>
                        <td
                          colSpan="3"
                          className="px-4 py-3 font-bold text-zinc-800"
                        >
                          TOTAL
                        </td>
                        <td className="px-4 py-3 text-right font-bold">
                          {totals.totalWeight.toFixed(2)}g
                        </td>
                        <td className="px-4 py-3"></td>
                        <td className="px-4 py-3 text-right font-bold">
                          {formatCurrency(totals.grossValue)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-red-600">
                          {totals.totalDeduction > 0
                            ? `- ${formatCurrency(totals.totalDeduction)}`
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600 text-lg">
                          {formatCurrency(totals.netValue)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              {/* Loan Percentage Selection */}
              <div className="border border-zinc-200 rounded-xl p-4 mb-6">
                <label className="block text-sm font-semibold text-zinc-700 mb-3">
                  Select Loan Percentage (Margin)
                </label>
                {marginPresets.length > 0 ? (
                  <>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {marginPresets.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setLoanPercentage(preset.value);
                            setUseCustomPercentage(false);
                          }}
                          className={cn(
                            "px-6 py-3 rounded-lg font-bold transition-all text-lg",
                            !useCustomPercentage &&
                              loanPercentage === preset.value
                              ? "bg-amber-500 text-white shadow-lg"
                              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
                          )}
                        >
                          {preset.value}%
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setUseCustomPercentage(true)}
                        className={cn(
                          "px-6 py-3 rounded-lg font-bold transition-all",
                          useCustomPercentage
                            ? "bg-amber-500 text-white shadow-lg"
                            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
                        )}
                      >
                        Custom
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-3">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-800">
                          No Margin Presets Configured
                        </p>
                        <p className="text-sm text-amber-700 mt-1">
                          Please configure margin presets in Settings, or enter
                          a custom percentage below.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setUseCustomPercentage(true)}
                      className="mt-3"
                    >
                      Enter Custom Percentage
                    </Button>
                  </div>
                )}

                {useCustomPercentage && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="flex items-center gap-2"
                  >
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      placeholder="Enter %"
                      value={customPercentage}
                      onChange={(e) => setCustomPercentage(e.target.value)}
                      className="w-32"
                    />
                    <span className="text-zinc-500">%</span>
                  </motion.div>
                )}
              </div>
              {/* Loan Calculation Summary */}
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-200 rounded-xl p-6 mb-6">
                <h4 className="text-lg font-semibold mb-4 flex items-center gap-2 text-amber-800">
                  <Calculator className="w-5 h-5 text-amber-600" />
                  Loan Calculation
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-amber-200">
                    <span className="text-zinc-600">Total Net Value (A)</span>
                    <span className="font-semibold text-lg text-zinc-800">
                      {formatCurrency(totals.netValue)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-amber-200">
                    <span className="text-zinc-600">Loan Percentage (B)</span>
                    <span className="font-semibold text-lg text-zinc-800">
                      {effectivePercentage}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-amber-200">
                    <span className="text-zinc-600">Calculation (A × B)</span>
                    <span className="text-zinc-600">
                      {formatCurrency(totals.netValue)} × {effectivePercentage}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-4 bg-amber-500 -mx-6 px-6 rounded-lg mt-2">
                    <span className="text-white font-semibold text-lg">
                      LOAN AMOUNT
                    </span>
                    <span className="text-3xl font-bold text-white">
                      {formatCurrency(loanAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Interest & Repayment Information - FIXED VERSION */}
              <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 mb-6">
                <h5 className="font-semibold text-blue-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Interest Breakdown
                </h5>

                {/* Scenario Tabs */}
                <div className="flex gap-2 mb-4">
                  {[
                    {
                      id: "standard",
                      label: `Standard (${interestRates.standard}%)`,
                      color: "blue",
                    },
                    {
                      id: "renewed",
                      label: `Renewed (${interestRates.extended}%)`,
                      color: "amber",
                    },
                    {
                      id: "overdue",
                      label: `Overdue (${interestRates.overdue}%)`,
                      color: "red",
                    },
                  ].map((scenario) => (
                    <button
                      key={scenario.id}
                      type="button"
                      onClick={() => setInterestScenario(scenario.id)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-medium transition-all flex-1",
                        interestScenario === scenario.id
                          ? scenario.color === "blue"
                            ? "bg-blue-600 text-white"
                            : scenario.color === "amber"
                              ? "bg-amber-500 text-white"
                              : "bg-red-500 text-white"
                          : "bg-white text-zinc-600 hover:bg-zinc-100",
                      )}
                    >
                      {scenario.label}
                    </button>
                  ))}
                </div>

                {/* Scenario Description */}
                <div className="mb-3 p-2 bg-white rounded-lg border border-blue-100">
                  <p className="text-xs text-zinc-600">
                    {interestScenario === "standard" && (
                      <>
                        <strong className="text-blue-600">
                          Standard Scenario:
                        </strong>{" "}
                        Customer redeems/pays within 6 months. Interest at{" "}
                        {interestRates.standard}% per month.
                      </>
                    )}
                    {interestScenario === "renewed" && (
                      <>
                        <strong className="text-amber-600">
                          Renewed Scenario:
                        </strong>{" "}
                        First 6 months at {interestRates.standard}%, then
                        customer renews - next 6 months at{" "}
                        {interestRates.extended}% per month.
                      </>
                    )}
                    {interestScenario === "overdue" && (
                      <>
                        <strong className="text-red-600">
                          Overdue Scenario:
                        </strong>{" "}
                        First 6 months at {interestRates.standard}%, then
                        overdue without renewal - {interestRates.overdue}% per
                        month applies.
                      </>
                    )}
                  </p>
                </div>

                {/* Monthly Breakdown Table */}
                <div className="bg-white rounded-lg border border-blue-100 overflow-hidden">
                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-zinc-600">
                            Month
                          </th>
                          <th className="px-3 py-2 text-right font-medium text-zinc-600">
                            Rate
                          </th>
                          <th className="px-3 py-2 text-right font-medium text-zinc-600">
                            Interest
                          </th>
                          <th className="px-3 py-2 text-right font-medium text-zinc-600">
                            Cumulative
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {(() => {
                          const rows = [];
                          let cumulative = 0;

                          // FIXED: Show only 6 months for standard, 12 for renewed/overdue
                          const totalMonths =
                            interestScenario === "standard" ? 6 : 12;

                          for (let i = 1; i <= totalMonths; i++) {
                            let ratePercent;
                            let rateColor;

                            if (i <= 6) {
                              // First 6 months ALWAYS at standard rate
                              ratePercent = interestRates.standard;
                              rateColor = "text-blue-600";
                            } else {
                              // After 6 months, rate depends on scenario
                              if (interestScenario === "renewed") {
                                ratePercent = interestRates.extended;
                                rateColor = "text-amber-600";
                              } else if (interestScenario === "overdue") {
                                ratePercent = interestRates.overdue;
                                rateColor = "text-red-600";
                              } else {
                                ratePercent = interestRates.standard;
                                rateColor = "text-blue-600";
                              }
                            }

                            const rate = ratePercent / 100;
                            const monthlyInterest = loanAmount * rate;
                            cumulative += monthlyInterest;

                            const isNewRatePeriod =
                              i > 6 && interestScenario !== "standard";

                            rows.push(
                              <tr
                                key={i}
                                className={cn(
                                  isNewRatePeriod &&
                                    interestScenario === "renewed" &&
                                    "bg-amber-50/50",
                                  isNewRatePeriod &&
                                    interestScenario === "overdue" &&
                                    "bg-red-50/50",
                                  i === 6 &&
                                    interestScenario !== "standard" &&
                                    "border-b-2 border-zinc-300",
                                )}
                              >
                                <td className="px-3 py-2 text-zinc-700">
                                  <div className="flex items-center gap-2">
                                    Month {i}
                                    {i === 6 &&
                                      interestScenario !== "standard" && (
                                        <span className="text-[10px] px-1.5 py-0.5 bg-zinc-200 text-zinc-600 rounded">
                                          Due Date
                                        </span>
                                      )}
                                    {i === 7 &&
                                      interestScenario === "renewed" && (
                                        <span className="text-[10px] px-1.5 py-0.5 bg-amber-200 text-amber-700 rounded">
                                          Renewed
                                        </span>
                                      )}
                                    {i === 7 &&
                                      interestScenario === "overdue" && (
                                        <span className="text-[10px] px-1.5 py-0.5 bg-red-200 text-red-700 rounded">
                                          Overdue
                                        </span>
                                      )}
                                  </div>
                                </td>
                                <td
                                  className={cn(
                                    "px-3 py-2 text-right font-medium",
                                    rateColor,
                                  )}
                                >
                                  {ratePercent.toFixed(2)}%
                                </td>
                                <td className="px-3 py-2 text-right font-medium text-zinc-800">
                                  {formatCurrency(monthlyInterest)}
                                </td>
                                <td
                                  className={cn(
                                    "px-3 py-2 text-right font-bold",
                                    rateColor,
                                  )}
                                >
                                  {formatCurrency(cumulative)}
                                </td>
                              </tr>,
                            );
                          }
                          return rows;
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Summary Cards */}
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {(() => {
                    const standardMonthly =
                      loanAmount * (interestRates.standard / 100);
                    const renewedMonthly =
                      loanAmount * (interestRates.extended / 100);
                    const overdueMonthly =
                      loanAmount * (interestRates.overdue / 100);

                    let monthlyDisplay, sixMonthTotal, twelveMonthTotal;

                    if (interestScenario === "standard") {
                      monthlyDisplay = standardMonthly;
                      sixMonthTotal = standardMonthly * 6;
                      twelveMonthTotal = null;
                    } else if (interestScenario === "renewed") {
                      monthlyDisplay = renewedMonthly;
                      sixMonthTotal = standardMonthly * 6;
                      twelveMonthTotal =
                        standardMonthly * 6 + renewedMonthly * 6;
                    } else {
                      monthlyDisplay = overdueMonthly;
                      sixMonthTotal = standardMonthly * 6;
                      twelveMonthTotal =
                        standardMonthly * 6 + overdueMonthly * 6;
                    }

                    const colorClass =
                      interestScenario === "standard"
                        ? "text-blue-600"
                        : interestScenario === "renewed"
                          ? "text-amber-600"
                          : "text-red-600";

                    return (
                      <>
                        <div className="bg-white rounded-lg p-3 text-center border border-blue-100">
                          <p className="text-xs text-zinc-500">
                            {interestScenario === "standard"
                              ? "Monthly Interest"
                              : "Monthly (After Renewal/Overdue)"}
                          </p>
                          <p className={cn("text-lg font-bold", colorClass)}>
                            {formatCurrency(monthlyDisplay)}
                          </p>
                        </div>
                        <div className="bg-white rounded-lg p-3 text-center border border-blue-100">
                          <p className="text-xs text-zinc-500">
                            {interestScenario === "standard"
                              ? "6 Months Total"
                              : "First 6 Months (Standard)"}
                          </p>
                          <p className="text-lg font-bold text-blue-600">
                            {formatCurrency(sixMonthTotal)}
                          </p>
                        </div>
                        <div className="bg-white rounded-lg p-3 text-center border border-blue-100">
                          <p className="text-xs text-zinc-500">
                            {interestScenario === "standard"
                              ? "If Redeemed"
                              : "12 Months Total"}
                          </p>
                          <p
                            className={cn(
                              "text-lg font-bold",
                              interestScenario === "standard"
                                ? "text-emerald-600"
                                : colorClass,
                            )}
                          >
                            {interestScenario === "standard"
                              ? formatCurrency(sixMonthTotal) + " max"
                              : formatCurrency(twelveMonthTotal)}
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Rate Info */}
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-700 font-semibold mb-1">
                    Interest Rate Rules:
                  </p>
                  <ul className="text-xs text-amber-700 space-y-0.5">
                    <li
                      className={cn(
                        interestScenario === "standard" && "font-bold",
                      )}
                    >
                      • <strong>Standard ({interestRates.standard}%)</strong> -
                      First 6 months / Redemption within term
                    </li>
                    <li
                      className={cn(
                        interestScenario === "renewed" && "font-bold",
                      )}
                    >
                      • <strong>Renewed ({interestRates.extended}%)</strong> -
                      Renewal before due date (months 7-12)
                    </li>
                    <li
                      className={cn(
                        interestScenario === "overdue" && "font-bold",
                      )}
                    >
                      • <strong>Overdue ({interestRates.overdue}%)</strong> -
                      Overdue &gt; 6 months without renewal
                    </li>
                    <li>
                      • After settling overdue, next renewal reverts to{" "}
                      {interestRates.extended}%
                    </li>
                  </ul>
                </div>
              </div>
              {/* Due Date Info */}
              <div className="mt-4 p-4 bg-zinc-100 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-zinc-500" />
                  <div>
                    <p className="text-sm font-medium text-zinc-700">
                      Loan Period
                    </p>
                    <p className="text-xs text-zinc-500">
                      Standard 6 months tenure
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-zinc-500">Due Date</p>
                  <p className="font-bold text-zinc-800">
                    {new Date(
                      Date.now() + 180 * 24 * 60 * 60 * 1000,
                    ).toLocaleDateString("en-MY", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 4: Payout */}
          {currentStep === 4 && (
            <motion.div
              key="step-4"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="p-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-800">
                    Payout Method
                  </h3>
                  <p className="text-sm text-zinc-500">
                    Select how to pay the customer
                  </p>
                </div>
              </div>

              {/* Loan Amount Display */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-6">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-zinc-600 mb-1">
                    <span>Loan Amount</span>
                    <span className="font-semibold">
                      {formatCurrency(loanAmount)}
                    </span>
                  </div>

                  {/* Handling Charge - Recorded separately, NOT deducted from payout */}
                  {parseFloat(handlingCharge) > 0 && (
                    <div className="flex items-center justify-between text-zinc-500 text-sm">
                      <span className="flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        Handling Charge (recorded separately)
                      </span>
                      <span className="text-zinc-500">
                        {formatCurrency(parseFloat(handlingCharge))}
                      </span>
                    </div>
                  )}

                  <div className="border-t border-emerald-200 my-2 pt-2 flex items-center justify-between">
                    <span className="text-emerald-800 font-bold text-lg">
                      Net Payout Amount
                    </span>
                    <span className="text-2xl font-bold text-emerald-600">
                      {formatCurrency(netPayoutAmount)}
                    </span>
                  </div>

                  {/* Business rule note */}
                  <p className="text-xs text-emerald-600 mt-1">
                    * Customer receives full loan amount. Handling charge
                    recorded separately.
                  </p>
                </div>
              </div>

              {/* Payment Method Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-zinc-700 mb-3">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: "cash", label: "Full Cash", icon: Wallet },
                    {
                      value: "transfer",
                      label: "Full Transfer",
                      icon: Building2,
                    },
                    { value: "partial", label: "Partial", icon: RefreshCw },
                  ].map((method) => (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => setPayoutMethod(method.value)}
                      className={cn(
                        "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                        payoutMethod === method.value
                          ? "border-amber-500 bg-amber-50"
                          : "border-zinc-200 hover:border-zinc-300",
                      )}
                    >
                      <method.icon
                        className={cn(
                          "w-6 h-6",
                          payoutMethod === method.value
                            ? "text-amber-600"
                            : "text-zinc-400",
                        )}
                      />
                      <span
                        className={cn(
                          "font-medium",
                          payoutMethod === method.value
                            ? "text-amber-600"
                            : "text-zinc-600",
                        )}
                      >
                        {method.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Details */}
              <div className="space-y-4">
                {(payoutMethod === "cash" || payoutMethod === "partial") && (
                  <Input
                    label="Cash Amount (RM)"
                    type="number"
                    step="0.01"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    disabled={payoutMethod === "cash"}
                    leftIcon={Wallet}
                  />
                )}

                {(payoutMethod === "transfer" ||
                  payoutMethod === "partial") && (
                  <>
                    <Input
                      label="Transfer Amount (RM)"
                      type="number"
                      step="0.01"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      disabled={payoutMethod === "transfer"}
                      leftIcon={Building2}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <Select
                        label="Bank Name"
                        value={bankId}
                        onChange={(e) => setBankId(e.target.value)}
                        options={[
                          { value: "", label: "Select Bank..." },
                          ...backendBanks.map((bank) => ({
                            value: String(bank.id),
                            label: bank.name,
                          })),
                        ]}
                        required
                      />
                      <Input
                        label="Account Number"
                        placeholder="Enter account number"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        required
                      />
                    </div>

                    <Input
                      label="Reference Number (Optional)"
                      placeholder="Transaction reference"
                      value={referenceNo}
                      onChange={(e) => setReferenceNo(e.target.value)}
                    />
                  </>
                )}
              </div>

              {payoutMethod === "partial" && (
                <div className="mt-4 p-3 bg-zinc-50 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Cash + Transfer</span>
                    <span
                      className={cn(
                        "font-medium",
                        Math.abs(
                          (parseFloat(cashAmount) || 0) +
                            (parseFloat(transferAmount) || 0) -
                            loanAmount,
                        ) < 0.01
                          ? "text-emerald-600"
                          : "text-red-600",
                      )}
                    >
                      {formatCurrency(
                        (parseFloat(cashAmount) || 0) +
                          (parseFloat(transferAmount) || 0),
                      )}
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Step 5: Storage Assignment - REAL API DATA ONLY */}
          {currentStep === 5 && (
            <motion.div
              key="step-5"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Archive className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-800">
                      Storage Assignment
                    </h3>
                    <p className="text-sm text-zinc-500">
                      Assign locker/rack location for pledged items
                    </p>
                  </div>
                </div>
                <Button
                  variant="accent"
                  leftIcon={Zap}
                  onClick={handleAutoAssign}
                  disabled={loadingSlots || !selectedBox || slots.length === 0}
                >
                  Auto-Assign All
                </Button>
              </div>

              {/* Error Message */}
              {storageError && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <div>
                    <p className="font-medium text-red-800">{storageError}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={fetchVaults}
                      className="mt-1 text-red-600"
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              )}

              {/* Vault & Box Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                    Select Vault
                  </label>
                  {loadingVaults ? (
                    <div className="flex items-center gap-2 p-3 bg-zinc-50 rounded-lg">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                      <span className="text-sm text-zinc-500">
                        Loading vaults...
                      </span>
                    </div>
                  ) : vaults.length === 0 ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-700">
                        No vaults available. Please create vaults in Settings.
                      </p>
                    </div>
                  ) : (
                    <Select
                      value={selectedVault || ""}
                      onChange={(e) => handleVaultChange(e.target.value)}
                      options={[
                        { value: "", label: "Select Vault..." },
                        ...vaults.map((v) => ({
                          value: v.id,
                          label: v.name || `Vault ${v.code}`,
                        })),
                      ]}
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                    Select Box
                  </label>
                  {loadingBoxes ? (
                    <div className="flex items-center gap-2 p-3 bg-zinc-50 rounded-lg">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                      <span className="text-sm text-zinc-500">
                        Loading boxes...
                      </span>
                    </div>
                  ) : !selectedVault ? (
                    <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg">
                      <p className="text-sm text-zinc-500">
                        Select a vault first
                      </p>
                    </div>
                  ) : boxes.length === 0 ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-700">
                        No boxes in this vault.
                      </p>
                    </div>
                  ) : (
                    <Select
                      value={selectedBox || ""}
                      onChange={(e) => handleBoxChange(e.target.value)}
                      options={[
                        { value: "", label: "Select Box..." },
                        ...boxes.map((b) => ({
                          value: b.id,
                          label: `${b.name || `Box ${b.box_number}`} (${
                            (b.total_slots || 0) - (b.occupied_slots || 0)
                          } available)`,
                        })),
                      ]}
                    />
                  )}
                </div>
              </div>

              {/* Box Summary */}
              {selectedBox && !loadingSlots && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl mb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Box className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="font-semibold text-blue-800">
                          {getBoxName(selectedBox)}
                        </p>
                        <p className="text-sm text-blue-600">
                          {getVaultName(selectedVault)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600">
                        {getAvailableSlotsCount()}
                      </p>
                      <p className="text-xs text-blue-500">Slots Available</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Slot Grid */}
              {selectedBox && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-zinc-700 mb-3">
                    Available Slots (Click to assign)
                  </label>
                  {loadingSlots ? (
                    <div className="flex items-center justify-center p-8 bg-zinc-50 rounded-xl">
                      <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                      <span className="ml-2 text-zinc-500">
                        Loading slots...
                      </span>
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-amber-700">
                        No slots configured for this box.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-10 gap-2 p-4 bg-zinc-50 rounded-xl border border-zinc-200">
                        {slots.map((slot) => {
                          const isAssignedInPledge = isSlotAssignedInPledge(
                            slot.id,
                          );

                          return (
                            <button
                              key={slot.id}
                              type="button"
                              disabled={slot.is_occupied}
                              onClick={() => {
                                // If already assigned in this pledge, unassign it
                                if (isAssignedInPledge) {
                                  const itemId = Object.keys(
                                    itemStorageAssignments,
                                  ).find(
                                    (key) =>
                                      itemStorageAssignments[key].slotId ===
                                      slot.id,
                                  );

                                  if (itemId) {
                                    const newAssignments = {
                                      ...itemStorageAssignments,
                                    };
                                    delete newAssignments[itemId];
                                    setItemStorageAssignments(newAssignments);
                                  }
                                  return;
                                }

                                const validItems = items.filter(
                                  (i) => i.category && i.weight,
                                );
                                const unassignedItem = validItems.find(
                                  (item) => !itemStorageAssignments[item.id],
                                );
                                if (unassignedItem) {
                                  handleSlotAssign(unassignedItem.id, slot);
                                } else {
                                  dispatch(
                                    addToast({
                                      type: "info",
                                      title: "All Items Assigned",
                                      message:
                                        "All items already have storage assigned",
                                    }),
                                  );
                                }
                              }}
                              className={cn(
                                "w-10 h-10 rounded-lg text-xs font-bold transition-all",
                                slot.is_occupied &&
                                  "bg-red-100 text-red-400 cursor-not-allowed",
                                !slot.is_occupied &&
                                  !isAssignedInPledge &&
                                  "bg-emerald-100 text-emerald-600 hover:bg-emerald-200",
                                isAssignedInPledge &&
                                  "bg-amber-500 text-white ring-2 ring-amber-300",
                              )}
                              title={
                                slot.is_occupied
                                  ? "Occupied"
                                  : isAssignedInPledge
                                    ? "Assigned in this pledge"
                                    : "Available - Click to assign"
                              }
                            >
                              {slot.slot_number}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex gap-4 mt-2 text-xs">
                        <div className="flex items-center gap-1">
                          <div className="w-4 h-4 rounded bg-emerald-100 border border-emerald-300" />
                          <span className="text-zinc-500">Available</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-4 h-4 rounded bg-red-100 border border-red-300" />
                          <span className="text-zinc-500">Occupied</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-4 h-4 rounded bg-amber-500" />
                          <span className="text-zinc-500">
                            Assigned (This Pledge)
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Items Storage Assignment List */}
              <div className="border border-zinc-200 rounded-xl overflow-hidden">
                <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-3">
                  <h4 className="font-semibold text-zinc-800 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Item Storage Assignments
                  </h4>
                </div>
                <div className="divide-y divide-zinc-100">
                  {items
                    .filter((i) => i.category && i.weight)
                    .map((item, idx) => {
                      const category = categoryOptions.find(
                        (c) => c.value === item.category,
                      );
                      const assignment = itemStorageAssignments[item.id];

                      return (
                        <div
                          key={item.id}
                          className="p-4 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-sm">
                              {idx + 1}
                            </span>
                            <div>
                              <p className="font-medium text-zinc-800">
                                {category?.label || item.category}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {item.purity} • {item.weight}g
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {assignment ? (
                              <>
                                <div className="text-right">
                                  <p className="font-medium text-emerald-600 flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    Slot {assignment.slotNumber}
                                  </p>
                                  <p className="text-xs text-zinc-500">
                                    {getVaultName(assignment.vaultId)} →{" "}
                                    {getBoxName(assignment.boxId)}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() =>
                                    handleRemoveAssignment(item.id)
                                  }
                                  className="text-red-500 hover:bg-red-50"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </>
                            ) : (
                              <Badge variant="warning">Not Assigned</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Assignment Summary */}
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-amber-600" />
                    <span className="text-sm text-amber-800">
                      Storage assignment is required for all items.
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-amber-700">
                      {Object.keys(itemStorageAssignments).length} /{" "}
                      {items.filter((i) => i.category && i.weight).length}
                    </p>
                    <p className="text-xs text-amber-600">Items Assigned</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 6: Confirm & Sign */}
          {currentStep === 6 && (
            <motion.div
              key="step-6"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="p-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <FileSignature className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-800">
                    Review & Confirm
                  </h3>
                  <p className="text-sm text-zinc-500">
                    Review details and capture signature
                  </p>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-zinc-50 rounded-xl">
                  <h4 className="font-semibold text-zinc-800 mb-3">Customer</h4>
                  <p className="font-medium text-zinc-800">
                    {customer?.name || "Unknown"}
                  </p>
                  <p className="text-sm text-zinc-500 font-mono">
                    {formatIC(customer?.ic_number || customer?.icNumber || "")}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {formatPhone(customer?.phone || "")}
                  </p>
                </div>

                <div className="p-4 bg-zinc-50 rounded-xl">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-semibold text-zinc-800">Items</h4>
                    <div className="text-right text-xs text-zinc-500">
                      <p>Total: {totals.totalWeight.toFixed(2)}g</p>
                      <p className="font-medium text-zinc-700">
                        {formatCurrency(totals.netValue)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {items
                      .filter((i) => i.category && i.weight)
                      .map((item, idx) => {
                        const val = calculateItemValue(item);
                        const category = categoryOptions.find(
                          (c) => c.value === item.category,
                        );
                        const purity = dynamicPurityOptions.find(
                          (p) => p.value === item.purity,
                        );
                        const storage = itemStorageAssignments[item.id];

                        return (
                          <div
                            key={item.id}
                            className="bg-white p-3 rounded-lg border border-zinc-200 shadow-sm"
                          >
                            {/* Header Row */}
                            <div className="flex justify-between items-start mb-1">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-[10px]">
                                  {idx + 1}
                                </span>
                                <p className="font-semibold text-zinc-800 text-sm">
                                  {category?.label || item.category}
                                </p>
                              </div>
                              <p className="text-sm font-bold text-emerald-600">
                                {formatCurrency(val.net)}
                              </p>
                            </div>

                            {/* Details Row */}
                            <div className="flex justify-between items-center text-xs text-zinc-500 ml-7">
                              <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1">
                                  <Scale className="w-3 h-3" />
                                  {parseFloat(item.weight).toFixed(2)}g
                                </span>
                                <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px] font-medium">
                                  {purity?.label || item.purity}
                                </span>
                                <span>RM {val.priceUsed.toFixed(2)}/g</span>
                              </div>
                              {storage && (
                                <span className="flex items-center gap-1 text-blue-600">
                                  <MapPin className="w-3 h-3" />
                                  Slot {storage.slotNumber}
                                </span>
                              )}
                            </div>

                            {/* Description (if exists) */}
                            {item.description && (
                              <p
                                className="text-[10px] text-zinc-400 ml-7 mt-1 line-clamp-1"
                                title={item.description}
                              >
                                {item.description}
                              </p>
                            )}

                            {/* Deduction (if exists) */}
                            {val.deduction > 0 && (
                              <p className="text-[10px] text-red-500 ml-7 mt-0.5">
                                Stone deduction: -
                                {formatCurrency(val.deduction)}
                              </p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>

                <div className="p-4 bg-emerald-50 rounded-xl">
                  <h4 className="font-semibold text-emerald-800 mb-3">
                    Loan Details
                  </h4>
                  <p className="text-2xl font-bold text-emerald-600">
                    {formatCurrency(loanAmount)}
                  </p>
                  <p className="text-sm text-emerald-600">
                    @ {effectivePercentage}% of net value
                  </p>
                </div>

                <div className="p-4 bg-blue-50 rounded-xl">
                  <h4 className="font-semibold text-blue-800 mb-3">Storage</h4>
                  <p className="text-zinc-600">
                    {Object.keys(itemStorageAssignments).length} /{" "}
                    {items.filter((i) => i.category && i.weight).length} items
                    assigned
                  </p>
                  {Object.keys(itemStorageAssignments).length > 0 && (
                    <p className="text-sm text-zinc-500">
                      {getVaultName(
                        Object.values(itemStorageAssignments)[0]?.vaultId,
                      )}{" "}
                      →{" "}
                      {getBoxName(
                        Object.values(itemStorageAssignments)[0]?.boxId,
                      )}
                    </p>
                  )}
                </div>
              </div>

              {/* Signature Pad - ENHANCED */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-zinc-700">
                    Customer Signature{" "}
                    <span className="text-zinc-400 text-xs">(Optional)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {signature && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearSignature}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>

                {/* Show uploaded signature or draw canvas */}
                {signature ? (
                  <div className="border-2 border-emerald-300 rounded-xl p-2 bg-emerald-50">
                    <img
                      src={signature}
                      alt="Signature"
                      className="max-h-24 mx-auto object-contain"
                    />
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-zinc-300 rounded-xl p-2 bg-white">
                    <canvas
                      ref={signatureCanvasRef}
                      width={400}
                      height={100}
                      className="w-full cursor-crosshair touch-none"
                      style={{ maxHeight: "100px" }}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                  </div>
                )}

                {/* Actions Row */}
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-zinc-500">
                    Sign above using mouse or touch
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400">OR</span>
                    <input
                      type="file"
                      id="signature-upload-input"
                      ref={signatureUploadRef}
                      accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                      onChange={handleSignatureUpload}
                      className="hidden"
                    />
                    <label
                      htmlFor="signature-upload-input"
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium border border-zinc-200 rounded-lg bg-white hover:bg-zinc-50 cursor-pointer transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Upload
                    </label>
                  </div>
                </div>
              </div>

              {/* Terms & Conditions Panel */}
              <div className="mb-6">
                <TermsConsentPanel
                  activityType="pledge"
                  onConsentChange={(agreed) => setAgreedToTerms(agreed)}
                />
              </div>

              {/* Due Date Info */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800">
                      Due Date:{" "}
                      {new Date(
                        Date.now() + 180 * 24 * 60 * 60 * 1000,
                      ).toLocaleDateString("en-MY", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    <p className="text-amber-600">
                      6 months from today. Interest at 0.5% per month.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="flex justify-between p-6 border-t border-zinc-200">
          <Button
            variant="outline"
            leftIcon={ArrowLeft}
            onClick={handlePrev}
            disabled={currentStep === 1}
          >
            Previous
          </Button>

          {currentStep < 6 ? (
            <Button
              variant="accent"
              rightIcon={ArrowRight}
              onClick={handleNext}
            >
              Next Step
            </Button>
          ) : (
            <Button
              variant="success"
              leftIcon={Check}
              onClick={handleSubmit}
              loading={isSubmitting}
              disabled={!agreedToTerms}
            >
              Create Pledge
            </Button>
          )}
        </div>
      </Card>

      {/* Success Modal with Auto-Print Status */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          navigate("/pledges");
        }}
        title="Pledge Created Successfully!"
        size="lg"
      >
        <div className="p-6">
          {/* Success Header */}
          <div className="text-center mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3"
            >
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </motion.div>

            <h3 className="text-lg font-bold text-zinc-800">Pledge Created!</h3>
            <p className="text-zinc-500">
              Pledge ID:{" "}
              <span className="font-mono font-bold text-zinc-800">
                {createdReceiptNo}
              </span>
            </p>
          </div>

          {/* Pledge Summary */}
          <div className="p-4 bg-zinc-50 rounded-xl mb-6">
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-zinc-500">Customer</p>
                <p className="font-medium text-zinc-800">
                  {customer?.name || "Customer"}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Loan Amount</p>
                <p className="font-medium text-emerald-600">
                  {formatCurrency(loanAmount)}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Items</p>
                <p className="font-medium text-zinc-800">
                  {items.filter((i) => i.category && i.weight).length} item(s)
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Storage</p>
                <p className="font-medium text-zinc-800">
                  {Object.keys(itemStorageAssignments).length > 0
                    ? `${Object.keys(itemStorageAssignments).length} assigned`
                    : "Not assigned"}
                </p>
              </div>
            </div>
          </div>

          {/* Print Jobs Status */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
              <Printer className="w-4 h-4" />
              Print & Send Status
            </h4>
            <div className="space-y-2">
              {/* Office Copy */}
              <div
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-all",
                  printJobStatus.dotMatrixOffice.status === "success" &&
                    "bg-emerald-50 border-emerald-200",
                  printJobStatus.dotMatrixOffice.status === "failed" &&
                    "bg-red-50 border-red-200",
                  printJobStatus.dotMatrixOffice.status === "running" &&
                    "bg-blue-50 border-blue-200",
                  printJobStatus.dotMatrixOffice.status === "pending" &&
                    "bg-zinc-50 border-zinc-200",
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center",
                      printJobStatus.dotMatrixOffice.status === "success" &&
                        "bg-emerald-100",
                      printJobStatus.dotMatrixOffice.status === "failed" &&
                        "bg-red-100",
                      printJobStatus.dotMatrixOffice.status === "running" &&
                        "bg-blue-100",
                      printJobStatus.dotMatrixOffice.status === "pending" &&
                        "bg-zinc-200",
                    )}
                  >
                    {printJobStatus.dotMatrixOffice.status === "success" && (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    )}
                    {printJobStatus.dotMatrixOffice.status === "failed" && (
                      <X className="w-4 h-4 text-red-600" />
                    )}
                    {printJobStatus.dotMatrixOffice.status === "running" && (
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    )}
                    {printJobStatus.dotMatrixOffice.status === "pending" && (
                      <Clock className="w-4 h-4 text-zinc-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-zinc-800">
                      🖨️ Dot Matrix - Office Copy
                    </p>
                    <p className="text-xs text-zinc-500">
                      {printJobStatus.dotMatrixOffice.message || "Waiting..."}
                    </p>
                  </div>
                </div>
                {printJobStatus.dotMatrixOffice.status === "failed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={RefreshCw}
                    onClick={() => retryPrintJob("dotMatrixOffice")}
                  >
                    Retry
                  </Button>
                )}
              </div>

              {/* Customer Copy */}
              <div
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-all",
                  printJobStatus.dotMatrixCustomer.status === "success" &&
                    "bg-emerald-50 border-emerald-200",
                  printJobStatus.dotMatrixCustomer.status === "failed" &&
                    "bg-red-50 border-red-200",
                  printJobStatus.dotMatrixCustomer.status === "running" &&
                    "bg-blue-50 border-blue-200",
                  printJobStatus.dotMatrixCustomer.status === "pending" &&
                    "bg-zinc-50 border-zinc-200",
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center",
                      printJobStatus.dotMatrixCustomer.status === "success" &&
                        "bg-emerald-100",
                      printJobStatus.dotMatrixCustomer.status === "failed" &&
                        "bg-red-100",
                      printJobStatus.dotMatrixCustomer.status === "running" &&
                        "bg-blue-100",
                      printJobStatus.dotMatrixCustomer.status === "pending" &&
                        "bg-zinc-200",
                    )}
                  >
                    {printJobStatus.dotMatrixCustomer.status === "success" && (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    )}
                    {printJobStatus.dotMatrixCustomer.status === "failed" && (
                      <X className="w-4 h-4 text-red-600" />
                    )}
                    {printJobStatus.dotMatrixCustomer.status === "running" && (
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    )}
                    {printJobStatus.dotMatrixCustomer.status === "pending" && (
                      <Clock className="w-4 h-4 text-zinc-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-zinc-800">
                      🖨️ Dot Matrix - Customer Copy
                    </p>
                    <p className="text-xs text-zinc-500">
                      {printJobStatus.dotMatrixCustomer.message || "Waiting..."}
                    </p>
                  </div>
                </div>
                {printJobStatus.dotMatrixCustomer.status === "failed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={RefreshCw}
                    onClick={() => retryPrintJob("dotMatrixCustomer")}
                  >
                    Retry
                  </Button>
                )}
              </div>

              {/* Barcode Labels */}
              <div
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-all",
                  printJobStatus.barcode.status === "success" &&
                    "bg-emerald-50 border-emerald-200",
                  printJobStatus.barcode.status === "failed" &&
                    "bg-red-50 border-red-200",
                  printJobStatus.barcode.status === "running" &&
                    "bg-blue-50 border-blue-200",
                  printJobStatus.barcode.status === "pending" &&
                    "bg-zinc-50 border-zinc-200",
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center",
                      printJobStatus.barcode.status === "success" &&
                        "bg-emerald-100",
                      printJobStatus.barcode.status === "failed" &&
                        "bg-red-100",
                      printJobStatus.barcode.status === "running" &&
                        "bg-blue-100",
                      printJobStatus.barcode.status === "pending" &&
                        "bg-zinc-200",
                    )}
                  >
                    {printJobStatus.barcode.status === "success" && (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    )}
                    {printJobStatus.barcode.status === "failed" && (
                      <X className="w-4 h-4 text-red-600" />
                    )}
                    {printJobStatus.barcode.status === "running" && (
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    )}
                    {printJobStatus.barcode.status === "pending" && (
                      <Clock className="w-4 h-4 text-zinc-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-zinc-800">
                      🏷️ Barcode Labels (Thermal)
                    </p>
                    <p className="text-xs text-zinc-500">
                      {printJobStatus.barcode.message || "Waiting..."}
                    </p>
                  </div>
                </div>
                {printJobStatus.barcode.status === "failed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={RefreshCw}
                    onClick={() => retryPrintJob("barcode")}
                  >
                    Retry
                  </Button>
                )}
              </div>

              {/* WhatsApp */}
              <div
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-all",
                  printJobStatus.whatsapp.status === "success" &&
                    "bg-emerald-50 border-emerald-200",
                  printJobStatus.whatsapp.status === "failed" &&
                    "bg-red-50 border-red-200",
                  printJobStatus.whatsapp.status === "running" &&
                    "bg-blue-50 border-blue-200",
                  printJobStatus.whatsapp.status === "skipped" &&
                    "bg-gray-50 border-gray-200",
                  printJobStatus.whatsapp.status === "pending" &&
                    "bg-zinc-50 border-zinc-200",
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center",
                      printJobStatus.whatsapp.status === "success" &&
                        "bg-emerald-100",
                      printJobStatus.whatsapp.status === "failed" &&
                        "bg-red-100",
                      printJobStatus.whatsapp.status === "running" &&
                        "bg-blue-100",
                      printJobStatus.whatsapp.status === "skipped" &&
                        "bg-gray-100",
                      printJobStatus.whatsapp.status === "pending" &&
                        "bg-zinc-200",
                    )}
                  >
                    {printJobStatus.whatsapp.status === "success" && (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    )}
                    {printJobStatus.whatsapp.status === "failed" && (
                      <X className="w-4 h-4 text-red-600" />
                    )}
                    {printJobStatus.whatsapp.status === "running" && (
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    )}
                    {printJobStatus.whatsapp.status === "skipped" && (
                      <AlertCircle className="w-4 h-4 text-gray-400" />
                    )}
                    {printJobStatus.whatsapp.status === "pending" && (
                      <Clock className="w-4 h-4 text-zinc-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-zinc-800">
                      📱 WhatsApp Message
                    </p>
                    <p className="text-xs text-zinc-500">
                      {printJobStatus.whatsapp.message || "Waiting..."}
                    </p>
                  </div>
                </div>
                {printJobStatus.whatsapp.status === "failed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={RefreshCw}
                    onClick={() => retryPrintJob("whatsapp")}
                  >
                    Retry
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Manual Print Options (Collapse by default) */}
          <details className="mb-4">
            <summary className="cursor-pointer text-sm font-medium text-zinc-600 hover:text-zinc-800 flex items-center gap-2 py-2">
              <Printer className="w-4 h-4" />
              Manual Print Options
            </summary>
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={Printer}
                  onClick={() => handleDotMatrixPrint("office")}
                  loading={isPrinting}
                  disabled={isPrinting}
                >
                  Office Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={Printer}
                  onClick={() => handleDotMatrixPrint("customer")}
                  loading={isPrinting}
                  disabled={isPrinting}
                >
                  Customer Copy
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={Copy}
                  onClick={handlePrintBothCopies}
                  loading={isPrinting}
                  disabled={isPrinting}
                >
                  PDF Copies
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={Barcode}
                  onClick={handlePrintBarcodes}
                  loading={isPrinting}
                  disabled={isPrinting}
                >
                  Barcodes
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                fullWidth
                leftIcon={MessageSquare}
                onClick={handleSendWhatsApp}
                loading={isSendingWhatsApp}
                disabled={isSendingWhatsApp}
              >
                Send WhatsApp
              </Button>
            </div>
          </details>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="primary"
              fullWidth
              onClick={() => navigate(`/pledges/${createdPledgeId}`)}
            >
              View Pledge
            </Button>
            <Button
              variant="accent"
              fullWidth
              leftIcon={Plus}
              onClick={() => {
                setShowSuccessModal(false);
                setCurrentStep(1);
                setCustomer(null);
                setIcSearch("");
                setCustomerSearchResult(null);
                setCustomerPledges([]);
                setItems([{ ...emptyItem, id: "item-1" }]);
                setItemStorageAssignments({});
                setSelectedVault(null);
                setSelectedBox(null);
                setSlots([]);
                setSignature(null);
                setAgreedToTerms(false);
                setCreatedPledgeId(null);
                setCreatedReceiptNo(null);
                setIsPrinting(false);
                setIsSendingWhatsApp(false);
                // Reset print job status
                setPrintJobStatus({
                  dotMatrixOffice: { status: "pending", message: "" },
                  dotMatrixCustomer: { status: "pending", message: "" },
                  barcode: { status: "pending", message: "" },
                  whatsapp: { status: "pending", message: "" },
                });
                // Clear any captured images from global camera state
                dispatch(clearCapturedImage());
              }}
            >
              New Pledge
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
}
