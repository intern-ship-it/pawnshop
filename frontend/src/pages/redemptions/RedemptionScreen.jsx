/**
 * Redemption Screen - Process full payment and release items
 * API Integrated Version
 *
 * FIXES APPLIED:
 * - Issue 1: IC search now works + barcode support improved
 * - Issue 2: Partial item redemption with checkboxes
 * - Issue 3: Partial payment "need amount" shows remaining balance, not full amount
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { setSelectedPledge } from "@/features/pledges/pledgesSlice";
import { addToast } from "@/features/ui/uiSlice";
import { pledgeService, redemptionService, settingsService } from "@/services";
import { getToken } from "@/services/api";
import {
  formatCurrency,
  formatDate,
  formatIC,
  formatPhone,
} from "@/utils/formatters";
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
  CheckSquare,
  Square,
  Image as ImageIcon,
} from "lucide-react";

export default function RedemptionScreen() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { selectedPledge } = useAppSelector((state) => state.pledges);

  // Search input ref for barcode scanner
  const searchInputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [pledge, setPledge] = useState(null);
  const [searchResult, setSearchResult] = useState(null);
  const [wasScanned, setWasScanned] = useState(false);
  const [pledgeList, setPledgeList] = useState([]); // List of pledges if multiple found

  // Calculation state (from API)
  const [calculation, setCalculation] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [items, setItems] = useState([]);
  const [allItems, setAllItems] = useState([]); // Issue 2: All items for selection

  // Issue 2: Selected items state for partial redemption
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [isPartialRedemption, setIsPartialRedemption] = useState(false);

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

  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [redemptionResult, setRedemptionResult] = useState(null);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [whatsAppSent, setWhatsAppSent] = useState(false);

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
        handleSearchWithQuery(barcode);
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

  // Issue 1 FIX: Clear selectedPledge on mount WITHOUT loading it
  // This prevents auto-showing previously viewed pledges
  useEffect(() => {
    if (selectedPledge) {
      dispatch(setSelectedPledge(null));
      // DO NOT auto-load the pledge - page should start empty
    }
  }, [dispatch]);

  // Fetch redemption calculation from API
  // Issue 2: Now supports item_ids for partial redemption
  const fetchCalculation = async (pledgeId, itemIds = null) => {
    setIsCalculating(true);
    try {
      const params = { pledge_id: pledgeId };

      // Issue 2: Pass selected item IDs for partial calculation
      if (itemIds && itemIds.length > 0) {
        params.item_ids = itemIds;
      }

      const response = await redemptionService.calculate(params);

      if (response.data?.success !== false) {
        const data = response.data?.data || response.data;
        setCalculation(data.calculation);
        setItems(data.items || []);
        setAllItems(data.all_items || data.items || []);

        // Initialize selection state if first load
        if (!itemIds) {
          const allItemIds = (data.all_items || data.items || []).map(
            (i) => i.id,
          );
          setSelectedItemIds(allItemIds);
          setIsPartialRedemption(false);
        }
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

  // Issue 2: Handle item selection toggle
  const handleItemToggle = (itemId) => {
    setSelectedItemIds((prev) => {
      const newSelection = prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId];

      // Check if this is partial redemption
      const isPartial =
        newSelection.length > 0 && newSelection.length < allItems.length;
      setIsPartialRedemption(isPartial);

      // Recalculate with new selection
      if (newSelection.length > 0 && pledge?.id) {
        fetchCalculation(pledge.id, newSelection);
      }

      return newSelection;
    });
  };

  // Issue 2: Select/deselect all items
  const handleSelectAll = () => {
    if (selectedItemIds.length === allItems.length) {
      // Deselect all - not allowed (must select at least one)
      dispatch(
        addToast({
          type: "warning",
          title: "Selection Required",
          message: "At least one item must be selected",
        }),
      );
    } else {
      // Select all
      const allIds = allItems.map((i) => i.id);
      setSelectedItemIds(allIds);
      setIsPartialRedemption(false);
      fetchCalculation(pledge.id, allIds);
    }
  };

  // Transform API pledge data to frontend format
  const transformPledgeData = (data) => ({
    id: data.id,
    pledgeNo: data.pledge_no,
    receiptNo: data.receipt_no,
    customerId: data.customer_id,
    customerName: data.customer?.name || "Unknown",
    customerIC: data.customer?.ic_number || "",
    customerPhone:
      data.customer?.country_code &&
      data.customer?.phone &&
      !data.customer.phone.startsWith("+")
        ? `${data.customer.country_code} ${data.customer.phone}`
        : data.customer?.phone || "",
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
  });

  // Helper function to extract pledge number from barcode
  const extractPledgeNumber = (query) => {
    // Barcode format: PLG-HQ-2026-0002-01 (pledge number + item suffix)
    const barcodePattern = /^(PLG-[A-Z]+-\d{4}-\d{4})-(\d{2})$/i;
    const match = query.match(barcodePattern);
    if (match) {
      return match[1]; // Return just the pledge number part
    }
    return query;
  };

  // Search with specific query (used by barcode scanner)
  const handleSearchWithQuery = async (query) => {
    if (!query.trim()) return;

    setIsSearching(true);
    setSearchResult(null);
    setPledge(null);
    setCalculation(null);
    setItems([]);
    setPledgeList([]); // Clear previous list

    try {
      // Try direct search first
      let data = null;
      const searchTerm = query.trim();

      try {
        const response = await pledgeService.getByReceipt(searchTerm);
        data = response.data?.data || response.data;
      } catch (error) {
        // If search fails and query looks like a barcode, try extracting pledge number
        const pledgeNo = extractPledgeNumber(searchTerm);
        if (pledgeNo !== searchTerm) {
          console.log(`Barcode detected, trying pledge number: ${pledgeNo}`);
          try {
            const response = await pledgeService.getByReceipt(pledgeNo);
            data = response.data?.data || response.data;
          } catch (innerError) {
            data = null;
          }
        }
      }

      // Helper to check if search term matches customer details
      if (data) {
        const isRedeemable =
          data.status === "active" || data.status === "overdue";
        const cleanSearch = searchTerm.replace(/[-\s]/g, "");
        const cleanIC = data.customer?.ic_number?.replace(/[-\s]/g, "") || "";
        const cleanPhone = data.customer?.phone?.replace(/[-\s]/g, "") || "";

        // If we found an inactive pledge but the search term matches customer IC/Phone,
        // discard this result and let the fallback search find potentially active pledges
        // for this customer.
        if (
          !isRedeemable &&
          (cleanSearch === cleanIC || cleanSearch === cleanPhone)
        ) {
          console.log(
            "Inactive pledge found via IC/Phone match. Falling back to full search.",
          );
          data = null;
        }
        // Force list view if searching by IC/Phone even if we found a valid pledge
        // This ensures users see ALL pledges for a customer, not just the single one returned by `getByReceipt`
        else if (cleanSearch === cleanIC || cleanSearch === cleanPhone) {
          console.log(
            "Customer search detected (IC/Phone match). Forcing full search list.",
          );
          data = null;
        }
      }

      // If specific ID search failed or we forced fallback, try generic search
      if (!data) {
        console.log(
          `Direct search failed/bypassed, trying generic search: ${searchTerm}`,
        );
        try {
          const response = await pledgeService.getAll({
            search: searchTerm,
            per_page: 50,
            status: "active,overdue", // Only get redeemable pledges
            with_items: true, // Include full item data
          });

          console.log("Customer search response:", response);

          // response.data is the array of pledges (interceptor already unwrapped)
          const pledges = response?.data || [];

          if (Array.isArray(pledges) && pledges.length > 0) {
            // Filter to only active/overdue pledges (in case status filter didn't work)
            const redeemablePledges = pledges.filter(
              (p) => p.status === "active" || p.status === "overdue",
            );

            console.log(`Found ${redeemablePledges.length} redeemable pledges`);

            // ALWAYS show list if coming from generic search (unless array is empty)
            if (redeemablePledges.length > 0) {
              setPledgeList(redeemablePledges.map(transformPledgeData));
              setSearchResult("list_found");
              dispatch(
                addToast({
                  type: "success",
                  title: "Pledges Found",
                  message: `Found ${redeemablePledges.length} pledges. Please select one.`,
                }),
              );
              return; // Stop here, let user select from list
            }
          }
        } catch (searchError) {
          console.error("Customer name/IC search failed:", searchError);
        }
      }

      // Single specific result handling (e.g. by Receipt No or Pledge No directly)
      if (data) {
        const pledgeData = transformPledgeData(data);

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
        // If we didn't find specific data AND didn't find a list in the generic search block
        // (because if generic search found list, it would have returned early)
        setSearchResult("not_found");
        dispatch(
          addToast({
            type: "error",
            title: "Not Found",
            message: "No active pledge found with this ID/IC/Name",
          }),
        );
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchResult("not_found");
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Search failed. Please try again.",
        }),
      );
    } finally {
      setIsSearching(false);
    }
  };

  // Search for pledge (Issue 1 FIX: Now supports IC number search)
  const handleSearch = async () => {
    // Clear any pending debounce to avoid double-firing
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (!searchQuery.trim()) {
      dispatch(
        addToast({
          type: "warning",
          title: "Required",
          message:
            "Please enter a pledge ID, receipt number, customer name, IC, or scan barcode",
        }),
      );
      return;
    }

    await handleSearchWithQuery(searchQuery);
  };

  // Debounced search - auto-triggers 500ms after user stops typing
  const debouncedSearch = useCallback((query) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (!query.trim()) return;
    debounceTimerRef.current = setTimeout(() => {
      handleSearchWithQuery(query);
    }, 500);
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

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

    // Issue 2: Check at least one item is selected
    if (selectedItemIds.length === 0) {
      dispatch(
        addToast({
          type: "warning",
          title: "No Items Selected",
          message: "Please select at least one item to redeem",
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
        bank_id:
          (paymentMethod === "transfer" ||
            (paymentMethod === "partial" && parseFloat(transferAmount) > 0)) &&
          bankId
            ? parseInt(bankId)
            : undefined,
        reference_no: referenceNo || undefined,
        terms_accepted: true,
      };

      // Issue 2: Add item_ids for partial redemption
      if (
        isPartialRedemption &&
        selectedItemIds.length > 0 &&
        selectedItemIds.length < allItems.length
      ) {
        redemptionData.item_ids = selectedItemIds;
      }

      // Remove undefined fields
      Object.keys(redemptionData).forEach((key) => {
        if (redemptionData[key] === undefined) {
          delete redemptionData[key];
        }
      });

      const response = await redemptionService.create(redemptionData);
      const data = response.data?.data || response.data;

      if (response.data?.success !== false) {
        // Get redemption data - handle both nested and flat response
        const redemptionInfo = data.redemption || data;

        // Success
        setRedemptionResult({
          id: redemptionInfo.id,
          redemptionId: redemptionInfo.redemption_no || redemptionInfo.id,
          pledgeId: pledge.pledgeNo,
          customerName: pledge.customerName,
          customerPhone: pledge.customerPhone,
          principal: calculation.principal,
          interest: calculation.total_interest,
          totalPaid: totalPayableAmount,
          change:
            paymentMethod !== "partial"
              ? totalReceived - totalPayableAmount
              : 0,
          items: items,
          paymentMethod,
          isPartial: data.is_partial || isPartialRedemption,
          itemsRedeemed: data.items_redeemed || selectedItemIds.length,
          itemsRemaining:
            data.items_remaining || allItems.length - selectedItemIds.length,
        });

        setShowSuccessModal(true);

        const successMsg = isPartialRedemption
          ? `Partial redemption: ${selectedItemIds.length} item(s) released!`
          : "Full redemption processed. All items released!";

        dispatch(
          addToast({
            type: "success",
            title: "Success",
            message: successMsg,
          }),
        );

        // Auto-trigger print and WhatsApp
        setTimeout(() => {
          autoTriggerPostRedemption(redemptionInfo.id);
        }, 500);
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

  // Auto-trigger print and WhatsApp after successful redemption
  const autoTriggerPostRedemption = async (redemptionId) => {
    // Auto-print receipt
    try {
      await handlePrintReceiptAuto(redemptionId);
    } catch (error) {
      console.error("Auto-print failed:", error);
    }

    // Auto-send WhatsApp if customer has phone
    if (pledge?.customerPhone) {
      try {
        await handleSendWhatsAppAuto();
      } catch (error) {
        console.error("Auto-WhatsApp failed:", error);
      }
    }
  };

  // Generate dot matrix print HTML
  const generateDotMatrixHTML = (receiptHtml, termsHtml, copyType) => {
    const copyLabel =
      copyType === "office" ? "SALINAN PEJABAT" : "SALINAN PELANGGAN";

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Resit Tebusan - ${copyType === "office" ? "Office" : "Customer"} Copy</title>
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
        
        .print-controls { 
          background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
          padding: 20px; margin-bottom: 15px; border-radius: 12px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        }
        .step-indicator { display: flex; justify-content: center; gap: 10px; margin-bottom: 15px; }
        .step { padding: 8px 20px; border-radius: 20px; font-weight: bold; font-size: 13px; transition: all 0.3s; }
        .step.active { background: #10b981; color: #fff; }
        .step.completed { background: #10b981; color: #fff; }
        .step.pending { background: #4b5563; color: #9ca3af; }
        
        .btn-row { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
        .print-btn { 
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: #fff; border: none; padding: 14px 30px; font-size: 15px; 
          cursor: pointer; border-radius: 8px; font-weight: bold;
          display: flex; align-items: center; gap: 8px;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .print-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(16,185,129,0.4); }
        .print-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .print-btn.secondary { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); }
        .close-btn { background: #6b7280; color: white; border: none; padding: 14px 20px; font-size: 14px; cursor: pointer; border-radius: 8px; }
        
        .flip-instructions {
          background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
          border: 2px solid #10b981; border-radius: 10px; padding: 15px 20px; margin: 15px 0; text-align: center;
        }
        .flip-instructions h3 { color: #065f46; margin: 0 0 8px 0; font-size: 16px; }
        .flip-instructions p { color: #047857; margin: 5px 0; font-size: 13px; }
        .flip-instructions .icon { font-size: 28px; }
        
        .printer-note { font-size: 11px; color: #9ca3af; margin-top: 12px; text-align: center; }
        .printer-note strong { color: #6ee7b7; }
        
        .page-label { 
          background: linear-gradient(135deg, #059669 0%, #10b981 100%);
          color: white; padding: 10px 15px; font-size: 12px; font-weight: bold;
          display: flex; justify-content: space-between; align-items: center;
        }
        .page-label.terms { background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%); }
        .page-label .badge { background: rgba(255,255,255,0.2); padding: 3px 10px; border-radius: 10px; font-size: 10px; }
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
          <button class="print-btn secondary" id="printBackBtn" onclick="printBack()" disabled>
            🔄 Cetak BELAKANG / Print BACK
          </button>
          <button class="close-btn" onclick="window.close()">✕ Tutup</button>
        </div>
        
        <div class="flip-instructions" id="flipInstructions" style="display: none;">
          <div class="icon">🔄📄</div>
          <h3>PUSING KERTAS / FLIP PAPER</h3>
          <p>1. Keluarkan kertas dari printer / Remove paper from printer</p>
          <p>2. <strong>Pusing kertas</strong> dan masukkan semula / <strong>Flip paper</strong> and reinsert</p>
          <p>3. Klik butang ungu untuk cetak belakang / Click purple button to print back</p>
        </div>
        
        <p class="printer-note">
          Printer: <strong>Epson LQ-310</strong> | Kertas: <strong>A5 Landscape</strong> | Salinan: <strong>${copyLabel}</strong>
        </p>
      </div>
      
      <div class="page" id="frontPage">
        <div class="page-label">
          <span>📄 HALAMAN DEPAN / FRONT - RESIT TEBUSAN</span>
          <span class="badge">${copyLabel}</span>
        </div>
        ${receiptHtml}
      </div>
      
      <div class="page hidden-for-print" id="backPage">
        <div class="page-label terms">
          <span>📋 HALAMAN BELAKANG / BACK - TERMA & SYARAT</span>
          <span class="badge">${copyLabel}</span>
        </div>
        ${termsHtml}
      </div>
      
      <script>
        let currentStep = 1;
        
        function printFront() {
          document.getElementById('frontPage').classList.remove('hidden-for-print');
          document.getElementById('backPage').classList.add('hidden-for-print');
          window.print();
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
            document.getElementById('frontPage').classList.add('hidden-for-print');
            document.getElementById('backPage').classList.remove('hidden-for-print');
          }, 1000);
        }
        
        function printBack() {
          document.getElementById('frontPage').classList.add('hidden-for-print');
          document.getElementById('backPage').classList.remove('hidden-for-print');
          window.print();
          setTimeout(function() {
            document.getElementById('step2-indicator').classList.remove('active');
            document.getElementById('step2-indicator').classList.add('completed');
            document.getElementById('step2-indicator').textContent = '✓ BELAKANG / BACK';
            document.getElementById('printBackBtn').disabled = true;
            document.getElementById('flipInstructions').innerHTML = '<div class="icon">✅</div><h3>SELESAI / COMPLETE</h3><p>Kedua-dua halaman telah dicetak / Both pages have been printed</p>';
          }, 1000);
        }
        
        window.onload = function() { document.getElementById('printFrontBtn').focus(); };
      </script>
    </body>
    </html>`;
  };

  // Auto-print receipt
  // Uses pre-printed data overlay (same as pledge/renewal auto-print)
  const handlePrintReceiptAuto = async (redemptionId) => {
    if (!redemptionId) return;

    setIsPrintingReceipt(true);
    try {
      const token = getToken();
      if (!token) return;

      const apiUrl =
        import.meta.env.VITE_API_URL || "http://localhost:8000/api";

      const response = await fetch(
        `${apiUrl}/print/dot-matrix/pre-printed/redemption/${redemptionId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) return;

      const data = await response.json();
      if (!data.success || !data.data?.front_html) return;

      // Open print window with data overlay for pre-printed form
      const printWindow = window.open("", "_blank", "width=800,height=600");
      if (!printWindow) return;

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Redemption ${redemptionId} - Receipt</title>
          <style>
            @page { size: A5 landscape; margin: 0; }
            body { margin: 0; padding: 0; }
          </style>
        </head>
        <body>
          ${data.data.front_html}
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();

      dispatch(
        addToast({
          type: "success",
          title: "Receipt Ready",
          message: "Redemption receipt sent to printer automatically",
        }),
      );
    } catch (error) {
      console.error("Auto-print error:", error);
    } finally {
      setIsPrintingReceipt(false);
    }
  };

  // Print redemption receipt using pre-printed overlay (manual button)
  const handlePrintReceipt = async () => {
    const redemptionId = redemptionResult?.id || redemptionResult?.redemptionId;

    if (!redemptionId) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Cannot print receipt - redemption ID not found",
        }),
      );
      return;
    }

    setIsPrintingReceipt(true);
    try {
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

      const apiUrl =
        import.meta.env.VITE_API_URL || "http://localhost:8000/api";

      // Use pre-printed overlay endpoint (data only for carbonless forms)
      const response = await fetch(
        `${apiUrl}/print/dot-matrix/pre-printed/redemption/${redemptionId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to generate receipt");
      }

      const data = await response.json();

      if (!data.success || !data.data?.front_html) {
        throw new Error("Invalid response from server");
      }

      // Open print window with data overlay for pre-printed form
      const printWindow = window.open("", "_blank", "width=800,height=600");

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

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Redemption ${redemptionId} - Receipt</title>
          <style>
            @page { size: A5 landscape; margin: 0; }
            body { margin: 0; padding: 0; }
          </style>
        </head>
        <body>
          ${data.data.front_html}
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();

      dispatch(
        addToast({
          type: "success",
          title: "Receipt Ready",
          message: "Redemption receipt sent to printer",
        }),
      );
    } catch (error) {
      console.error("Print receipt error:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message:
            error.response?.data?.message ||
            error.message ||
            "Failed to print receipt",
        }),
      );
    } finally {
      setIsPrintingReceipt(false);
    }
  };

  // Auto-send WhatsApp
  const handleSendWhatsAppAuto = async () => {
    if (!pledge?.id) return;

    setIsSendingWhatsApp(true);
    try {
      const response = await pledgeService.sendWhatsApp(pledge.id);
      if (response.success || response.data?.success) {
        dispatch(
          addToast({
            type: "success",
            title: "WhatsApp Sent",
            message: "Redemption notification sent automatically",
          }),
        );
        setWhatsAppSent(true);
      }
    } catch (error) {
      console.error("Auto-WhatsApp error:", error);
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  // Send WhatsApp notification (manual button)
  const handleSendWhatsApp = async () => {
    if (!pledge?.id) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Pledge information not found",
        }),
      );
      return;
    }

    setIsSendingWhatsApp(true);
    try {
      const response = await pledgeService.sendWhatsApp(pledge.id);

      if (response.success || response.data?.success) {
        dispatch(
          addToast({
            type: "success",
            title: "WhatsApp Sent",
            message: "Redemption notification sent to customer",
          }),
        );
        setWhatsAppSent(true);
      } else {
        throw new Error(response.message || "Failed to send WhatsApp");
      }
    } catch (error) {
      console.error("WhatsApp error:", error);

      const errorMsg =
        error.response?.data?.message || error.message || "Failed to send";

      if (errorMsg.includes("not configured") || errorMsg.includes("401")) {
        dispatch(
          addToast({
            type: "warning",
            title: "WhatsApp Not Configured",
            message: "Set up WhatsApp in Settings → WhatsApp",
          }),
        );
      } else {
        dispatch(
          addToast({
            type: "error",
            title: "Error",
            message: errorMsg,
          }),
        );
      }
    } finally {
      setIsSendingWhatsApp(false);
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
                  placeholder="Enter Pledge No, Receipt No, Customer Name, IC, or scan barcode..."
                  value={searchQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearchQuery(val);
                    setWasScanned(false);
                    debouncedSearch(val);
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
                        No active pledge found
                      </p>
                      <p className="text-sm text-amber-600">
                        Check the ID, IC, or customer name and try again
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

        {/* List of Found Pledges (Multi-result / Customer Search) */}
        <AnimatePresence>
          {!pledge && pledgeList.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-zinc-800">
                  Found {pledgeList.length} Pledges
                </h3>
                <span className="text-sm text-zinc-500">
                  Select a pledge to redeem
                </span>
              </div>

              {pledgeList.map((p) => (
                <Card
                  key={p.id}
                  className="p-4 cursor-pointer hover:border-emerald-500 hover:shadow-md transition-all group"
                  onClick={() => {
                    setPledge(p);
                    setSearchResult("found");
                    fetchCalculation(p.id);
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold">
                        {p.customerName.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-semibold text-zinc-800 group-hover:text-emerald-600 transition-colors">
                          {p.customerName}
                        </h4>
                        <div className="flex items-center gap-2 text-sm text-zinc-500 mt-1">
                          <span className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded text-xs text-zinc-600">
                            {p.pledgeNo}
                          </span>
                          <span>•</span>
                          <span>{p.itemsCount} item(s)</span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-1">
                          {p.customerIC} • {p.customerPhone}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-zinc-800">
                        {formatCurrency(p.loanAmount)}
                      </p>
                      <Badge
                        variant={p.status === "overdue" ? "error" : "success"}
                        size="sm"
                        className="mt-1"
                      >
                        {p.status === "overdue" ? "Overdue" : "Active"}
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

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

              {/* Items Card - Issue 2: Now with checkboxes for partial redemption */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-zinc-800 flex items-center gap-2">
                    <Package className="w-5 h-5 text-emerald-500" />
                    Pledged Items ({allItems.length || pledge.itemsCount})
                    {isCalculating && (
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                    )}
                  </h4>

                  {/* Issue 2: Select All / Partial indicator */}
                  {allItems.length > 1 && (
                    <div className="flex items-center gap-3">
                      {isPartialRedemption && (
                        <Badge variant="warning" size="sm">
                          <Info className="w-3 h-3 mr-1" />
                          Partial: {selectedItemIds.length}/{allItems.length}{" "}
                          items
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSelectAll}
                        className="text-xs"
                      >
                        {selectedItemIds.length === allItems.length ? (
                          <>
                            <CheckSquare className="w-4 h-4 mr-1" />
                            All Selected
                          </>
                        ) : (
                          <>
                            <Square className="w-4 h-4 mr-1" />
                            Select All
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Issue 2: Partial redemption info banner */}
                {isPartialRedemption && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-amber-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-800">
                          Partial Redemption Mode
                        </p>
                        <p className="text-amber-600">
                          Only selected items will be redeemed. Remaining items
                          stay active. Interest calculated proportionally:{" "}
                          {((calculation?.pro_rata_ratio || 1) * 100).toFixed(
                            1,
                          )}
                          % of full amount.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {(allItems.length > 0 ? allItems : pledge.items || []).map(
                    (item, idx) => {
                      const itemPhoto =
                        item.photo || item.photo_url || item.image || null;
                      const isSelected = selectedItemIds.includes(item.id);

                      // Better location display
                      const getLocationDisplay = () => {
                        if (item.location_string) return item.location_string;
                        if (item.vault_id || item.vault) {
                          const vaultCode =
                            item.vault?.code ||
                            item.vault?.name ||
                            `V${item.vault_id}`;
                          const boxNum =
                            item.box?.box_number ||
                            item.box?.name ||
                            (item.box_id ? `B${item.box_id}` : "");
                          const slotNum =
                            item.slot?.slot_number ||
                            (item.slot_id ? `S${item.slot_id}` : "");
                          let location = vaultCode;
                          if (boxNum) location += ` / Box ${boxNum}`;
                          if (slotNum) location += ` / Slot ${slotNum}`;
                          return location;
                        }
                        return null;
                      };

                      const locationDisplay = getLocationDisplay();

                      return (
                        <div
                          key={item.id || idx}
                          onClick={() => item.id && handleItemToggle(item.id)}
                          className={cn(
                            "p-3 rounded-lg flex items-center justify-between cursor-pointer transition-all",
                            isSelected
                              ? "bg-emerald-50 border-2 border-emerald-300"
                              : "bg-zinc-50 border-2 border-transparent hover:border-zinc-200",
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {/* Issue 2: Checkbox for selection */}
                            <div
                              className={cn(
                                "w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors",
                                isSelected
                                  ? "bg-emerald-500 border-emerald-500 text-white"
                                  : "border-zinc-300 bg-white",
                              )}
                            >
                              {isSelected && (
                                <CheckCircle className="w-4 h-4" />
                              )}
                            </div>

                            {/* Issue 2: Item Photo - larger and more prominent */}
                            {itemPhoto ? (
                              <img
                                src={itemPhoto}
                                alt={item.description || "Item"}
                                className="w-16 h-16 rounded-lg object-cover border border-zinc-200"
                                onError={(e) => {
                                  e.target.style.display = "none";
                                  e.target.nextSibling.style.display = "flex";
                                }}
                              />
                            ) : null}
                            <div
                              className={cn(
                                "w-16 h-16 bg-amber-100 rounded-lg items-center justify-center",
                                itemPhoto ? "hidden" : "flex",
                              )}
                            >
                              <ImageIcon className="w-8 h-8 text-amber-400" />
                            </div>

                            <div>
                              <p className="font-medium text-zinc-800">
                                {item.description ||
                                  item.category?.name_en ||
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
                              {(item.barcode || item.item_code) && (
                                <p className="text-xs text-zinc-400 font-mono">
                                  {item.barcode || item.item_code}
                                </p>
                              )}

                              {/* Location Display */}
                              <div
                                className={cn(
                                  "flex items-center gap-1 mt-1 text-xs px-2 py-1 rounded w-fit",
                                  locationDisplay
                                    ? "text-blue-600 bg-blue-50"
                                    : "text-zinc-500 bg-zinc-100",
                                )}
                              >
                                <Building2 className="w-3 h-3" />
                                <span>{locationDisplay || "Not Assigned"}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-zinc-800">
                              {formatCurrency(
                                item.net_value || item.netValue || 0,
                              )}
                            </p>
                            {isSelected && (
                              <Badge
                                variant="success"
                                size="sm"
                                className="mt-1"
                              >
                                Selected
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>

                {/* Issue 2: Selected items summary */}
                {allItems.length > 1 && (
                  <div className="mt-4 pt-4 border-t border-zinc-200">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-zinc-500">
                        Selected: {selectedItemIds.length} of {allItems.length}{" "}
                        items
                      </span>
                      <span className="font-medium text-zinc-800">
                        Value:{" "}
                        {formatCurrency(
                          allItems
                            .filter((item) => selectedItemIds.includes(item.id))
                            .reduce(
                              (sum, item) =>
                                sum +
                                parseFloat(
                                  item.net_value || item.netValue || 0,
                                ),
                              0,
                            ),
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </Card>

              {/* Calculation Card */}
              <Card className="p-6">
                <h4 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                  Payment Calculation
                  {isCalculating && (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                  )}
                  {isPartialRedemption && (
                    <Badge variant="warning" size="sm" className="ml-2">
                      Partial
                    </Badge>
                  )}
                </h4>

                {/* Issue 2: Show partial calculation notice */}
                {isPartialRedemption && calculation?.pro_rata_ratio && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                    <p className="text-amber-800">
                      <strong>Pro-rata calculation:</strong>{" "}
                      {(calculation.pro_rata_ratio * 100).toFixed(1)}% of full
                      loan (
                      {formatCurrency(calculation.selected_net_value || 0)} of{" "}
                      {formatCurrency(calculation.total_net_value || 0)} total
                      value)
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">
                      Principal{" "}
                      {isPartialRedemption ? "(Pro-rata)" : "(Loan Amount)"}
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

                {/* Amount Input - Different for partial vs single method */}
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
                    {/* Issue 3 FIX: Show remaining balance, not full amount */}
                    {(() => {
                      const totalEntered =
                        (parseFloat(cashAmount) || 0) +
                        (parseFloat(transferAmount) || 0);
                      const remaining = Math.max(
                        0,
                        totalPayable - totalEntered,
                      );
                      const isComplete = remaining < 0.01;

                      return (
                        <div
                          className={cn(
                            "mb-4 p-3 rounded-lg flex justify-between items-center",
                            isComplete
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-700",
                          )}
                        >
                          <span>Cash + Transfer</span>
                          <span className="font-bold">
                            {formatCurrency(totalEntered)}
                            {isComplete
                              ? " ✓"
                              : ` (need ${formatCurrency(remaining)} more)`}
                          </span>
                        </div>
                      );
                    })()}
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

                {/* Bank Selection for transfer/partial */}
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

                {/* Terms & Conditions */}
                <div className="mb-6">
                  <TermsConsentPanel
                    activityType="redemption"
                    onConsentChange={(agreed) => setTermsAgreed(agreed)}
                    compact
                  />
                </div>

                {/* Process Button */}
                <Button
                  variant="success"
                  size="lg"
                  fullWidth
                  leftIcon={Gift}
                  onClick={handleProcessRedemption}
                  loading={isProcessing}
                  disabled={
                    !termsAgreed ||
                    isCalculating ||
                    !verifiedIC ||
                    !verifiedItems ||
                    selectedItemIds.length === 0 || // Issue 2: Require at least one item selected
                    (paymentMethod === "partial"
                      ? Math.max(
                          0,
                          totalPayable -
                            (parseFloat(cashAmount) || 0) -
                            (parseFloat(transferAmount) || 0),
                        ) >= 0.01
                      : !amountReceived ||
                        parseFloat(amountReceived) < totalPayable)
                  }
                >
                  {isPartialRedemption
                    ? `Redeem ${selectedItemIds.length} Item(s) - ${formatCurrency(totalPayable)}`
                    : `Process Redemption & Release Items - ${formatCurrency(totalPayable)}`}
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
                Search by Pledge No, Receipt No, or IC number to process
                redemption
              </p>
            </Card>
          </motion.div>
        )}
      </motion.div>

      {/* Success Modal */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          setRedemptionResult(null);
          setSearchQuery("");
          setPledge(null);
          setPledgeList([]); // Clear pledge list
          setAmountReceived("");
          setCashAmount("");
          setTransferAmount("");
          setBankId("");
          setReferenceNo("");
          setVerifiedIC(false);
          setVerifiedItems(false);
          setCalculation(null);
          setItems([]);
          setAllItems([]); // Issue 2: Reset allItems
          setSelectedItemIds([]); // Issue 2: Reset selection
          setIsPartialRedemption(false); // Issue 2: Reset partial flag
          setSearchResult(null);
          setTermsAgreed(false);
          setWhatsAppSent(false);
        }}
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

          {/* Auto-trigger status */}
          <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
            <p>✓ Receipt sent to printer automatically</p>
            {whatsAppSent && <p>✓ WhatsApp notification sent</p>}
          </div>

          {/* Issue 2: Show partial vs full redemption status */}
          <div className="p-3 bg-green-50 rounded-lg mb-6">
            <div className="flex items-center justify-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">
                {redemptionResult?.isPartial ? (
                  <>
                    {redemptionResult?.itemsRedeemed} item(s) released
                    {redemptionResult?.itemsRemaining > 0 && (
                      <span className="text-amber-600 ml-1">
                        ({redemptionResult?.itemsRemaining} remaining in pledge)
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    {redemptionResult?.items?.length ||
                      selectedItemIds.length ||
                      0}{" "}
                    item(s) released to customer
                  </>
                )}
              </span>
            </div>
            {redemptionResult?.isPartial &&
              redemptionResult?.itemsRemaining > 0 && (
                <p className="text-sm text-amber-600 mt-2">
                  ⚠️ Pledge remains active with{" "}
                  {redemptionResult?.itemsRemaining} item(s)
                </p>
              )}
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              fullWidth
              leftIcon={Printer}
              onClick={handlePrintReceipt}
              loading={isPrintingReceipt}
            >
              Reprint Receipt
            </Button>
            <Button
              variant="outline"
              fullWidth
              leftIcon={MessageSquare}
              onClick={handleSendWhatsApp}
              loading={isSendingWhatsApp}
            >
              Resend WhatsApp
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
                setPledgeList([]); // Clear pledge list
                setAmountReceived("");
                setCashAmount("");
                setTransferAmount("");
                setBankId("");
                setReferenceNo("");
                setVerifiedIC(false);
                setVerifiedItems(false);
                setCalculation(null);
                setItems([]);
                setAllItems([]);
                setSelectedItemIds([]);
                setIsPartialRedemption(false);
                setSearchResult(null);
                setWhatsAppSent(false);
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
