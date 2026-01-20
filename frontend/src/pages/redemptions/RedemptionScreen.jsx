/**
 * Redemption Screen - Process full payment and release items
 * API Integrated Version
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { setSelectedPledge } from "@/features/pledges/pledgesSlice";
import { addToast } from "@/features/ui/uiSlice";
import { pledgeService, redemptionService, settingsService } from "@/services";
import {
  formatCurrency,
  formatDate,
  formatIC,
  formatPhone,
} from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { Card, Button, Input, Select, Badge, Modal } from "@/components/common";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import {
  DollarSign,
  Search,
  Package,
  User,
  Calendar,
  Clock,
  CreditCard,
  Wallet,
  Building2,
  CheckCircle,
  AlertTriangle,
  Printer,
  MessageSquare,
  Plus,
  ArrowRight,
  Scale,
  TrendingUp,
  Info,
  X,
  Gift,
  ShieldCheck,
  FileCheck,
  Loader2,
  ScanLine,
} from "lucide-react";

export default function RedemptionScreen() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { selectedPledge } = useAppSelector((state) => state.pledges);

  // Search input ref for barcode scanner
  const searchInputRef = useRef(null);

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [pledge, setPledge] = useState(null);
  const [searchResult, setSearchResult] = useState(null);
  const [wasScanned, setWasScanned] = useState(false);

  // Calculation state (from API)
  const [calculation, setCalculation] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [items, setItems] = useState([]);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountReceived, setAmountReceived] = useState("");
  const [cashAmount, setCashAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [banks, setBanks] = useState([]);
  const [bankId, setBankId] = useState("");
  // Verification state
  const [verifiedIC, setVerifiedIC] = useState(false);
  const [verifiedItems, setVerifiedItems] = useState(false);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [redemptionResult, setRedemptionResult] = useState(null);

  // Barcode scanner detection - auto-search when barcode is scanned
  const handleBarcodeScanned = useCallback(
    (barcode) => {
      setSearchQuery(barcode);
      setWasScanned(true);

      dispatch(
        addToast({
          type: "info",
          title: "Barcode Scanned",
          message: `Searching for: ${barcode}`,
        }),
      );

      // Auto-trigger search after a brief delay
      setTimeout(() => {
        handleSearch();
      }, 100);
    },
    [dispatch],
  );

  // Initialize barcode scanner hook
  const { inputRef: barcodeInputRef, isScanning } = useBarcodeScanner({
    onScan: handleBarcodeScanned,
    minLength: 5,
    playSound: true,
  });

  // Merge refs
  const mergeRefs = useCallback(
    (...refs) =>
      (element) => {
        refs.forEach((ref) => {
          if (typeof ref === "function") {
            ref(element);
          } else if (ref) {
            ref.current = element;
          }
        });
      },
    [],
  );

  // Fetch banks on mount
  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const response = await settingsService.getBanks();
        const banksData = response.data?.data || response.data || [];
        setBanks(banksData);
      } catch (error) {
        console.error("Failed to fetch banks:", error);
      }
    };
    fetchBanks();
  }, []);

  // Load pre-selected pledge
  useEffect(() => {
    if (selectedPledge) {
      setPledge(selectedPledge);
      setSearchQuery(selectedPledge.pledgeNo || selectedPledge.id);
      dispatch(setSelectedPledge(null));
      // Fetch calculation for pre-selected pledge
      fetchCalculation(selectedPledge.id);
    }
  }, [selectedPledge, dispatch]);

  // Fetch redemption calculation from API
  const fetchCalculation = async (pledgeId) => {
    setIsCalculating(true);
    try {
      const response = await redemptionService.calculate({
        pledge_id: pledgeId,
      });

      if (response.data?.success !== false) {
        const data = response.data?.data || response.data;
        setCalculation(data.calculation);
        setItems(data.items || []);
      }
    } catch (error) {
      console.error("Failed to calculate redemption:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Failed to calculate redemption amount",
        }),
      );
    } finally {
      setIsCalculating(false);
    }
  };

  // Search for pledge
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      dispatch(
        addToast({
          type: "warning",
          title: "Required",
          message: "Please enter a pledge ID, receipt number, or IC",
        }),
      );
      return;
    }

    setIsSearching(true);
    setSearchResult(null);
    setPledge(null);
    setCalculation(null);
    setItems([]);

    // Helper function to extract pledge number from barcode
    // Barcode format: PLG-HQ-2026-0002-01 (pledge number + item suffix)
    // Pledge format: PLG-HQ-2026-0002
    const extractPledgeNumber = (query) => {
      // Check if it's a barcode with item suffix (ends with -XX where XX is 2 digits)
      const barcodePattern = /^(PLG-[A-Z]+-\d{4}-\d{4})-(\d{2})$/i;
      const match = query.match(barcodePattern);
      if (match) {
        return match[1]; // Return just the pledge number part
      }
      return query; // Return as-is if not a barcode
    };

    const searchWithQuery = async (query) => {
      const response = await pledgeService.getByReceipt(query);
      const data = response.data?.data || response.data;
      return data;
    };

    try {
      let query = searchQuery.trim();
      let data = null;

      // First, try searching with the original query
      try {
        data = await searchWithQuery(query);
      } catch (error) {
        // If search fails and query looks like a barcode, try extracting pledge number
        const pledgeNo = extractPledgeNumber(query);
        if (pledgeNo !== query) {
          console.log(`Barcode detected, trying pledge number: ${pledgeNo}`);
          try {
            data = await searchWithQuery(pledgeNo);
          } catch (innerError) {
            // Both searches failed
            data = null;
          }
        }
      }

      if (data) {
        // Transform API response to frontend format
        const pledgeData = {
          id: data.id,
          pledgeNo: data.pledge_no,
          receiptNo: data.receipt_no,
          customerId: data.customer_id,
          customerName: data.customer?.name || "Unknown",
          customerIC: data.customer?.ic_number || "",
          customerPhone: data.customer?.phone || "",
          totalWeight: parseFloat(data.total_weight) || 0,
          grossValue: parseFloat(data.gross_value) || 0,
          totalDeduction: parseFloat(data.total_deduction) || 0,
          netValue: parseFloat(data.net_value) || 0,
          loanPercentage: parseFloat(data.loan_percentage) || 0,
          loanAmount: parseFloat(data.loan_amount) || 0,
          interestRate: parseFloat(data.interest_rate) || 0.5,
          pledgeDate: data.pledge_date,
          dueDate: data.due_date,
          graceEndDate: data.grace_end_date,
          status: data.status,
          renewalCount: data.renewal_count || 0,
          itemsCount: data.items?.length || 0,
          items: data.items || [],
          createdAt: data.created_at,
        };

        // Check if pledge can be redeemed
        if (pledgeData.status === "active" || pledgeData.status === "overdue") {
          setPledge(pledgeData);
          setSearchResult("found");
          dispatch(
            addToast({
              type: "success",
              title: "Found",
              message: `Pledge ${pledgeData.pledgeNo} loaded`,
            }),
          );

          // Fetch calculation
          fetchCalculation(pledgeData.id);
        } else {
          setSearchResult("invalid");
          dispatch(
            addToast({
              type: "error",
              title: "Invalid Status",
              message: `Pledge is ${pledgeData.status}. Cannot process redemption.`,
            }),
          );
        }
      } else {
        setSearchResult("not_found");
        dispatch(
          addToast({
            type: "error",
            title: "Not Found",
            message: "No pledge found with this ID",
          }),
        );
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchResult("not_found");
      dispatch(
        addToast({
          type: "error",
          title: "Not Found",
          message: "No pledge found with this ID",
        }),
      );
    } finally {
      setIsSearching(false);
    }
  };

  // Process redemption via API
  const handleProcessRedemption = async () => {
    if (!pledge || !calculation) return;

    // Verify checks
    if (!verifiedIC || !verifiedItems) {
      dispatch(
        addToast({
          type: "warning",
          title: "Verification Required",
          message: "Please verify IC and items before processing",
        }),
      );
      return;
    }

    const totalPayableAmount = calculation?.total_payable || 0;

    // Calculate received based on payment method
    let totalReceived = 0;
    if (paymentMethod === "partial") {
      totalReceived =
        (parseFloat(cashAmount) || 0) + (parseFloat(transferAmount) || 0);
    } else {
      totalReceived = parseFloat(amountReceived) || 0;
    }

    if (totalReceived < totalPayableAmount) {
      dispatch(
        addToast({
          type: "error",
          title: "Insufficient",
          message: `Amount must be at least ${formatCurrency(
            totalPayableAmount,
          )}`,
        }),
      );
      return;
    }

    setIsProcessing(true);

    try {
      // Prepare redemption data
      const redemptionData = {
        pledge_id: pledge.id,
        payment_method: paymentMethod,
        cash_amount:
          paymentMethod === "cash"
            ? totalReceived
            : paymentMethod === "partial"
              ? parseFloat(cashAmount) || 0
              : 0,
        transfer_amount:
          paymentMethod === "transfer"
            ? totalReceived
            : paymentMethod === "partial"
              ? parseFloat(transferAmount) || 0
              : 0,
        bank_id: paymentMethod !== "cash" && bankId ? parseInt(bankId) : null,
        reference_no: referenceNo || null,
        terms_accepted: true,
      };

      const response = await redemptionService.create(redemptionData);
      const data = response.data?.data || response.data;

      if (response.data?.success !== false) {
        // Success
        setRedemptionResult({
          redemptionId: data.redemption_no || data.id,
          pledgeId: pledge.pledgeNo,
          customerName: pledge.customerName,
          principal: calculation.principal,
          interest: calculation.total_interest,
          totalPaid: totalPayableAmount,
          change:
            paymentMethod !== "partial"
              ? totalReceived - totalPayableAmount
              : 0,
          items: items,
          paymentMethod,
        });

        setShowSuccessModal(true);

        dispatch(
          addToast({
            type: "success",
            title: "Success",
            message: "Redemption processed successfully. Items released!",
          }),
        );
      } else {
        throw new Error(
          response.data?.message || "Failed to process redemption",
        );
      }
    } catch (error) {
      console.error("Redemption error:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message:
            error.response?.data?.message ||
            error.message ||
            "Failed to process redemption",
        }),
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Get values from calculation
  const principal = calculation?.principal || pledge?.loanAmount || 0;
  const regularInterest = calculation?.regular_interest || 0;
  const overdueInterest = calculation?.overdue_interest || 0;
  const totalInterest = calculation?.total_interest || 0;
  const handlingFee = calculation?.handling_fee || 0;
  const totalPayable = calculation?.total_payable || 0;
  const monthsElapsed = calculation?.months_elapsed || 0;
  const daysOverdue = calculation?.days_overdue || 0;

  // Days since created
  const getDaysSinceCreated = () => {
    if (!pledge?.createdAt) return 0;
    const now = new Date();
    const created = new Date(pledge.createdAt);
    return Math.ceil((now - created) / (1000 * 60 * 60 * 24));
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <PageWrapper
      title="Redemption"
      subtitle="Process full payment and release items"
    >
      <motion.div
        className="max-w-4xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Search Section */}
        <motion.div variants={itemVariants}>
          <Card className="p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Input
                  ref={mergeRefs(barcodeInputRef, searchInputRef)}
                  placeholder="Enter Pledge No, Receipt No, or scan barcode..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setWasScanned(false);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  leftIcon={isScanning ? ScanLine : Search}
                  className={
                    isScanning ? "ring-2 ring-emerald-400 ring-opacity-50" : ""
                  }
                />
                {/* Scanning indicator */}
                {isScanning && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <span className="text-xs text-emerald-600 font-medium animate-pulse">
                      Scanning...
                    </span>
                    <ScanLine className="w-4 h-4 text-emerald-500 animate-pulse" />
                  </div>
                )}
                {/* Scanned badge */}
                {wasScanned && !isScanning && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Badge variant="success" size="sm">
                      <ScanLine className="w-3 h-3 mr-1" />
                      Scanned
                    </Badge>
                  </div>
                )}
              </div>
              <Button
                variant="primary"
                onClick={handleSearch}
                loading={isSearching}
              >
                Search
              </Button>
            </div>

            <AnimatePresence>
              {searchResult === "not_found" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-800">
                        Pledge not found
                      </p>
                      <p className="text-sm text-amber-600">
                        Please check the ID and try again
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {searchResult === "invalid" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <X className="w-5 h-5 text-red-600" />
                    <div>
                      <p className="font-medium text-red-800">
                        Cannot process redemption
                      </p>
                      <p className="text-sm text-red-600">
                        This pledge is not active
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>

        {/* Pledge Details */}
        <AnimatePresence>
          {pledge && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Customer & Pledge Info Card */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-bold text-xl">
                      {pledge.customerName?.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-zinc-800">
                          {pledge.customerName}
                        </h3>
                        <Badge
                          variant={
                            pledge.status === "overdue" ? "error" : "success"
                          }
                        >
                          {pledge.status === "overdue" ? (
                            <>
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Overdue
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Active
                            </>
                          )}
                        </Badge>
                      </div>
                      <p className="text-sm text-zinc-500">
                        {formatIC(pledge.customerIC)} •{" "}
                        {formatPhone(pledge.customerPhone)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-zinc-500">Pledge No</p>
                    <p className="font-mono font-bold text-zinc-800">
                      {pledge.pledgeNo}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-zinc-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="w-4 h-4 text-zinc-400" />
                      <span className="text-xs text-zinc-500">Principal</span>
                    </div>
                    <p className="font-bold text-zinc-800">
                      {formatCurrency(pledge.loanAmount)}
                    </p>
                  </div>
                  <div className="p-3 bg-zinc-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Scale className="w-4 h-4 text-zinc-400" />
                      <span className="text-xs text-zinc-500">
                        Total Weight
                      </span>
                    </div>
                    <p className="font-bold text-zinc-800">
                      {pledge.totalWeight?.toFixed(2)}g
                    </p>
                  </div>
                  <div className="p-3 bg-zinc-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-zinc-400" />
                      <span className="text-xs text-zinc-500">Pledge Date</span>
                    </div>
                    <p className="font-bold text-zinc-800">
                      {formatDate(pledge.pledgeDate)}
                    </p>
                  </div>
                  <div className="p-3 bg-zinc-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-zinc-400" />
                      <span className="text-xs text-zinc-500">Duration</span>
                    </div>
                    <p className="font-bold text-zinc-800">
                      {monthsElapsed} month(s)
                    </p>
                  </div>
                </div>

                {/* Overdue Warning */}
                {daysOverdue > 0 && (
                  <div className="mt-4 p-3 bg-red-50 rounded-lg flex items-center gap-2 text-red-700">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      Overdue by {daysOverdue} days - Late interest applied
                    </span>
                  </div>
                )}
              </Card>

              {/* Items Card */}
              <Card className="p-6">
                <h4 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-500" />
                  Pledged Items ({items.length || pledge.itemsCount})
                  {isCalculating && (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                  )}
                </h4>

                <div className="space-y-3">
                  {(items.length > 0 ? items : pledge.items || []).map(
                    (item, idx) => {
                      const itemPhoto =
                        item.photo || item.photo_url || item.image || null;

                      return (
                        <div
                          key={item.id || idx}
                          className="p-3 bg-zinc-50 rounded-lg flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            {/* Item Photo or Default Icon */}
                            {itemPhoto ? (
                              <img
                                src={itemPhoto}
                                alt={item.description || "Item"}
                                className="w-12 h-12 rounded-lg object-cover border border-zinc-200"
                                onError={(e) => {
                                  e.target.style.display = "none";
                                  e.target.nextSibling.style.display = "flex";
                                }}
                              />
                            ) : null}
                            <div
                              className={cn(
                                "w-12 h-12 bg-amber-100 rounded-lg items-center justify-center",
                                itemPhoto ? "hidden" : "flex",
                              )}
                            >
                              <Package className="w-6 h-6 text-amber-600" />
                            </div>

                            <div>
                              <p className="font-medium text-zinc-800">
                                {item.description ||
                                  item.category?.name ||
                                  item.category_name ||
                                  "Gold Item"}
                              </p>
                              <p className="text-sm text-zinc-500">
                                {item.purity?.code ||
                                  item.purity?.name ||
                                  item.purity_name ||
                                  item.purity}{" "}
                                •{" "}
                                {parseFloat(
                                  item.net_weight || item.netWeight || 0,
                                ).toFixed(2)}
                                g
                              </p>
                              {/* Show barcode/item code if available */}
                              {(item.barcode || item.item_code) && (
                                <p className="text-xs text-zinc-400 font-mono">
                                  {item.barcode || item.item_code}
                                </p>
                              )}

                              {/* Show Location */}
                              <div className="flex items-center gap-1 mt-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded w-fit">
                                <Building2 className="w-3 h-3" />
                                <span>
                                  {/* Try multiple possible location formats from API */}
                                  {item.location_string ||
                                    item.storage_location ||
                                    // Check for nested storage structure
                                    (item.slot?.box?.vault?.name
                                      ? `${item.slot.box.vault.name} → Box ${item.slot.box.box_number} → Slot ${item.slot.slot_number}`
                                      : null) ||
                                    // Check for direct vault/box/slot objects
                                    (item.vault
                                      ? `${item.vault.name || item.vault.code} → Box ${item.box?.box_number} → Slot ${item.slot?.slot_number}`
                                      : null) ||
                                    // Check for flat field names
                                    (item.vault_name
                                      ? `${item.vault_name} → Box ${item.box_number} → Slot ${item.slot_number}`
                                      : null) ||
                                    // Check for slot_id with box relation
                                    (item.slot_id && item.slot
                                      ? `${item.slot.box?.vault?.name || "Vault"} → Box ${item.slot.box?.box_number || "?"} → Slot ${item.slot.slot_number}`
                                      : null) ||
                                    "Not Assigned"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <p className="font-bold text-zinc-800">
                            {formatCurrency(
                              item.net_value || item.netValue || 0,
                            )}
                          </p>
                        </div>
                      );
                    },
                  )}
                </div>
              </Card>

              {/* Calculation Card */}
              <Card className="p-6">
                <h4 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                  Payment Calculation
                  {isCalculating && (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                  )}
                </h4>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">
                      Principal (Loan Amount)
                    </span>
                    <span className="font-medium">
                      {formatCurrency(principal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">
                      Interest ({monthsElapsed} months)
                    </span>
                    <span className="font-medium">
                      {formatCurrency(regularInterest)}
                    </span>
                  </div>
                  {overdueInterest > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Late Interest ({daysOverdue} days)</span>
                      <span className="font-medium">
                        {formatCurrency(overdueInterest)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Handling Fee</span>
                    <span className="font-medium">
                      {formatCurrency(handlingFee)}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-3 border-t border-zinc-200">
                    <span className="text-zinc-800">Total Payable</span>
                    <span className="text-emerald-600">
                      {formatCurrency(totalPayable)}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Verification Card */}
              <Card className="p-6">
                <h4 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  Verification Checklist
                </h4>

                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg cursor-pointer hover:bg-zinc-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={verifiedIC}
                      onChange={(e) => setVerifiedIC(e.target.checked)}
                      className="w-5 h-5 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <p className="font-medium text-zinc-800">IC Verified</p>
                      <p className="text-sm text-zinc-500">
                        Customer IC matches pledge record
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg cursor-pointer hover:bg-zinc-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={verifiedItems}
                      onChange={(e) => setVerifiedItems(e.target.checked)}
                      className="w-5 h-5 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <p className="font-medium text-zinc-800">
                        Items Verified
                      </p>
                      <p className="text-sm text-zinc-500">
                        All items checked and ready for release
                      </p>
                    </div>
                  </label>
                </div>
              </Card>

              {/* Payment Card */}
              <Card className="p-6">
                <h4 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-emerald-500" />
                  Payment Details
                </h4>

                {/* Payment Method */}
                <div className="mb-4">
                  <label className="text-sm text-zinc-600 mb-2 block">
                    Payment Method
                  </label>
                  <div className="flex gap-2">
                    {[
                      { id: "cash", label: "Cash", icon: Wallet },
                      { id: "transfer", label: "Transfer", icon: Building2 },
                      { id: "partial", label: "Partial", icon: CreditCard },
                    ].map((method) => (
                      <button
                        key={method.id}
                        onClick={() => setPaymentMethod(method.id)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border font-medium transition-all",
                          paymentMethod === method.id
                            ? "bg-emerald-500 text-white border-emerald-500"
                            : "bg-white text-zinc-600 border-zinc-200 hover:border-emerald-300",
                        )}
                      >
                        <method.icon className="w-4 h-4" />
                        {method.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount Received - Different UI for partial vs single method */}
                {paymentMethod === "partial" ? (
                  <>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="text-sm text-zinc-600 mb-2 block">
                          Cash Amount (RM)
                        </label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={cashAmount}
                          onChange={(e) => setCashAmount(e.target.value)}
                          leftIcon={Wallet}
                        />
                      </div>
                      <div>
                        <label className="text-sm text-zinc-600 mb-2 block">
                          Transfer Amount (RM)
                        </label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={transferAmount}
                          onChange={(e) => setTransferAmount(e.target.value)}
                          leftIcon={Building2}
                        />
                      </div>
                    </div>
                    {/* Partial Payment Validation */}
                    <div
                      className={cn(
                        "mb-4 p-3 rounded-lg flex justify-between items-center",
                        Math.abs(
                          (parseFloat(cashAmount) || 0) +
                            (parseFloat(transferAmount) || 0) -
                            totalPayable,
                        ) < 0.01
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-700",
                      )}
                    >
                      <span>Cash + Transfer</span>
                      <span className="font-bold">
                        {formatCurrency(
                          (parseFloat(cashAmount) || 0) +
                            (parseFloat(transferAmount) || 0),
                        )}
                        {Math.abs(
                          (parseFloat(cashAmount) || 0) +
                            (parseFloat(transferAmount) || 0) -
                            totalPayable,
                        ) < 0.01
                          ? " ✓"
                          : ` (need ${formatCurrency(totalPayable)})`}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="mb-4">
                    <label className="text-sm text-zinc-600 mb-2 block">
                      Amount Received (RM)
                    </label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                      leftIcon={DollarSign}
                    />
                  </div>
                )}

                {/* Bank Selection & Reference No (for transfer, or partial with transfer amount) */}
                {(paymentMethod === "transfer" ||
                  (paymentMethod === "partial" &&
                    parseFloat(transferAmount) > 0)) && (
                  <>
                    <div className="mb-4">
                      <label className="text-sm text-zinc-600 mb-2 block">
                        Bank
                      </label>
                      <Select
                        value={bankId}
                        onChange={(e) => setBankId(e.target.value)}
                        options={[
                          { value: "", label: "Select Bank..." },
                          ...banks.map((bank) => ({
                            value: String(bank.id),
                            label: bank.name,
                          })),
                        ]}
                      />
                    </div>
                    <div className="mb-4">
                      <label className="text-sm text-zinc-600 mb-2 block">
                        Reference No
                      </label>
                      <Input
                        placeholder="Transfer reference number"
                        value={referenceNo}
                        onChange={(e) => setReferenceNo(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {/* Change - only for non-partial payments */}
                {paymentMethod !== "partial" &&
                  parseFloat(amountReceived) > totalPayable && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg flex justify-between items-center">
                      <span className="text-blue-700">Change</span>
                      <span className="font-bold text-blue-700">
                        {formatCurrency(
                          parseFloat(amountReceived) - totalPayable,
                        )}
                      </span>
                    </div>
                  )}

                {/* Process Button */}
                <Button
                  variant="success"
                  size="lg"
                  fullWidth
                  leftIcon={Gift}
                  onClick={handleProcessRedemption}
                  loading={isProcessing}
                  disabled={
                    isCalculating ||
                    !verifiedIC ||
                    !verifiedItems ||
                    (paymentMethod === "partial"
                      ? Math.abs(
                          (parseFloat(cashAmount) || 0) +
                            (parseFloat(transferAmount) || 0) -
                            totalPayable,
                        ) >= 0.01
                      : !amountReceived ||
                        parseFloat(amountReceived) < totalPayable)
                  }
                >
                  Process Redemption & Release Items -{" "}
                  {formatCurrency(totalPayable)}
                </Button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!pledge && !searchResult && (
          <motion.div variants={itemVariants}>
            <Card className="p-12 text-center">
              <Gift className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-zinc-800 mb-2">
                Process Redemption
              </h3>
              <p className="text-zinc-500 mb-4">
                Search for a pledge to process full payment and release items
              </p>
            </Card>
          </motion.div>
        )}
      </motion.div>

      {/* Success Modal */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => {}}
        title="Redemption Successful!"
        size="md"
      >
        <div className="p-6 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4"
          >
            <Gift className="w-10 h-10 text-emerald-600" />
          </motion.div>

          <h3 className="text-xl font-bold text-zinc-800 mb-2">
            Items Released!
          </h3>
          <p className="text-zinc-500 mb-4">
            ID:{" "}
            <span className="font-mono font-bold">
              {redemptionResult?.redemptionId}
            </span>
          </p>

          <div className="p-4 bg-zinc-50 rounded-xl mb-6 text-left">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Pledge</span>
                <span className="font-medium">
                  {redemptionResult?.pledgeId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Customer</span>
                <span className="font-medium">
                  {redemptionResult?.customerName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Principal</span>
                <span className="font-medium">
                  {formatCurrency(redemptionResult?.principal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Interest</span>
                <span className="font-medium">
                  {formatCurrency(redemptionResult?.interest)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-zinc-200">
                <span className="text-zinc-500">Total Paid</span>
                <span className="font-bold text-emerald-600">
                  {formatCurrency(redemptionResult?.totalPaid)}
                </span>
              </div>
              {redemptionResult?.change > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Change Given</span>
                  <span className="font-medium text-blue-600">
                    {formatCurrency(redemptionResult?.change)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="p-3 bg-green-50 rounded-lg mb-6">
            <div className="flex items-center justify-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">
                {redemptionResult?.items?.length || 0} item(s) released to
                customer
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" fullWidth leftIcon={Printer}>
              Print Receipt
            </Button>
            <Button variant="outline" fullWidth leftIcon={MessageSquare}>
              Send WhatsApp
            </Button>
          </div>

          <div className="flex gap-3 mt-4">
            <Button
              variant="primary"
              fullWidth
              onClick={() => navigate("/pledges")}
            >
              View All Pledges
            </Button>
            <Button
              variant="accent"
              fullWidth
              leftIcon={Plus}
              onClick={() => {
                setShowSuccessModal(false);
                setRedemptionResult(null);
                setSearchQuery("");
                setPledge(null);
                setAmountReceived("");
                setCashAmount("");
                setTransferAmount("");
                setBankId("");
                setReferenceNo("");
                setVerifiedIC(false);
                setVerifiedItems(false);
                setCalculation(null);
                setItems([]);
              }}
            >
              New Redemption
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
}
