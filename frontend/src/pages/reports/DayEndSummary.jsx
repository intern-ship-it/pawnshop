import { useState, useEffect, useMemo } from "react";
import { useAppDispatch } from "@/app/hooks";
import dayEndService from "@/services/dayEndService";
import goldPriceService from "@/services/goldPriceService";
import inventoryService from "@/services/inventoryService";
import { settingsService } from "@/services";
import { useNavigate } from "react-router";
import { addToast } from "@/features/ui/uiSlice";
import { formatCurrency } from "@/utils/formatters";
import { getStorageItem, STORAGE_KEYS } from "@/utils/localStorage";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { Card, Button, Input, Badge, Modal } from "@/components/common";
import {
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Package,
  RefreshCw,
  Wallet,
  Gavel,
  Users,
  FileText,
  Printer,
  Download,
  CheckCircle,
  AlertTriangle,
  Lock,
  Unlock,
  Calculator,
  Banknote,
  CreditCard,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  PiggyBank,
  X,
  Check,
  Info,
  Eye,
  CheckSquare,
  Square,
  MessageCircle,
  Send,
  Loader2,
} from "lucide-react";

export default function DayEndSummary() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  // State
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [isClosing, setIsClosing] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [dayStatus, setDayStatus] = useState("open");
  const [dayEndData, setDayEndData] = useState(null);
  const [verificationItems, setVerificationItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

  // Purity breakdown for stock in/out
  const [stockByPurity, setStockByPurity] = useState({
    itemsInByPurity: {},
    itemsOutByPurity: {},
  });

  // Transaction details (individual pledges, redemptions, renewals)
  const [transactionDetails, setTransactionDetails] = useState({
    pledges: [],
    redemptions: [],
    renewals: [],
  });

  // FIX: Daily stats from API (not localStorage)
  const [dailyStats, setDailyStats] = useState({
    newPledgesCount: 0,
    renewalsCount: 0,
    redemptionsCount: 0,
    newPledgesAmount: 0,
    renewalInterest: 0,
    redemptionAmount: 0,
    cashIn: 0,
    cashOut: 0,
    netCashFlow: 0,
    totalItemsAdded: 0,
    totalItemsOut: 0,
    totalWeight: 0,
  });

  // Gold price state
  const [goldPrice, setGoldPrice] = useState(null);

  // Inventory summary state
  const [inventorySummary, setInventorySummary] = useState({
    in_storage: 0,
    total_weight: 0,
    total_value: 0,
  });

  // Cash drawer
  const [cashDrawer, setCashDrawer] = useState({
    openingBalance: 0,
    closingBalance: "",
    notes: "",
  });

  // Payment breakdown (cash vs transfer)
  const [paymentBreakdown, setPaymentBreakdown] = useState({
    pledges: { cash: 0, transfer: 0 },
    renewals: { cash: 0, transfer: 0 },
    redemptions: { cash: 0, transfer: 0 },
  });

  // Fetch data on mount and date change
  useEffect(() => {
    fetchDayEndData();
    fetchGoldPrice();
    fetchInventorySummary();
  }, [selectedDate]);

  // Fetch gold price (mirrors Header.jsx logic)
  const fetchGoldPrice = async () => {
    try {
      // Check if manual price is configured in settings (same as Header)
      const stored = getStorageItem(STORAGE_KEYS.SETTINGS, null);
      const goldSettings = stored?.goldPrice || { source: "api" };

      if (goldSettings.source === "manual") {
        // Use manual price from settings
        const manualPrices = goldSettings.manualPrices || {};
        const price = parseFloat(manualPrices["916"]) || parseFloat(goldSettings.manualPrice) || 0;
        if (price > 0) {
          setGoldPrice(price);
          return;
        }
      }

      // Fetch from API
      const response = await goldPriceService.getDashboardPrices();
      if (response?.success && response?.data) {
        const data = response.data;
        // Try multiple field paths matching goldPriceService response format
        const price =
          data.purity_codes?.["916"] ||
          data.carat?.["916"] ||
          data.price999 ||
          data.purity_codes?.["999"] ||
          data.carat?.["999"] ||
          data.current?.prices?.gold?.per_gram ||
          null;
        setGoldPrice(price);
      }
    } catch (error) {
      console.error('Error fetching gold price:', error);
    }
  };

  // Fetch inventory summary
  const fetchInventorySummary = async () => {
    try {
      const response = await inventoryService.getSummary();
      if (response?.success && response?.data) {
        setInventorySummary({
          in_storage: response.data.in_storage || 0,
          total_weight: parseFloat(response.data.total_weight) || 0,
          total_value: parseFloat(response.data.total_value) || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching inventory summary:', error);
    }
  };

  // FIX: Fetch day end data from API
  const fetchDayEndData = async () => {
    setIsLoading(true);
    try {
      // Check if today
      const isToday = selectedDate === new Date().toISOString().split("T")[0];

      let response;
      if (isToday) {
        // getCurrent() returns { report, stats } with calculated values
        response = await dayEndService.getCurrent();
      } else {
        response = await dayEndService.getByDate(selectedDate);
      }

      if (response.success && response.data) {
        const data = response.data;
        const report = data.report || data;
        const stats = data.stats;

        // Extract purity breakdown from response
        const itemsInByPurity = data.items_in_by_purity || stats?.items_in_by_purity || {};
        const itemsOutByPurity = data.items_out_by_purity || stats?.items_out_by_purity || {};
        setStockByPurity({ itemsInByPurity, itemsOutByPurity });

        // Extract transaction details
        setTransactionDetails({
          pledges: data.pledges_detail || stats?.pledges_detail || [],
          redemptions: data.redemptions_detail || stats?.redemptions_detail || [],
          renewals: data.renewals_detail || stats?.renewals_detail || [],
        });

        // If we have a report (day-end was started)
        if (report && report.id) {
          setDayEndData(report);
          setDayStatus(report.status === "closed" ? "closed" : "open");

          // FIX: Calculate cashIn/cashOut from the amounts
          const newPledgesAmount = parseFloat(report.new_pledges_amount) || 0;
          const renewalInterest = parseFloat(report.renewals_amount) || 0;
          const redemptionAmount = parseFloat(report.redemptions_amount) || 0;

          // Extract payment method breakdown
          setPaymentBreakdown({
            pledges: {
              cash: parseFloat(report.new_pledges_cash) || 0,
              transfer: parseFloat(report.new_pledges_transfer) || 0,
            },
            renewals: {
              cash: parseFloat(report.renewals_cash) || 0,
              transfer: parseFloat(report.renewals_transfer) || 0,
            },
            redemptions: {
              cash: parseFloat(report.redemptions_cash) || 0,
              transfer: parseFloat(report.redemptions_transfer) || 0,
            },
          });

          setDailyStats({
            newPledgesCount: report.new_pledges_count || 0,
            renewalsCount: report.renewals_count || 0,
            redemptionsCount: report.redemptions_count || 0,
            newPledgesAmount: newPledgesAmount,
            renewalInterest: renewalInterest,
            redemptionAmount: redemptionAmount,
            cashIn: renewalInterest + redemptionAmount,
            cashOut: newPledgesAmount,
            netCashFlow: renewalInterest + redemptionAmount - newPledgesAmount,
            totalItemsAdded: report.items_in_count || 0,
            totalItemsOut: report.items_out_count || 0,
            totalWeight: 0,
          });

          setCashDrawer({
            openingBalance: parseFloat(report.opening_balance) || 0,
            closingBalance: report.closing_balance
              ? String(report.closing_balance)
              : "",
            notes: report.notes || "",
          });

          // Fetch verifications
          if (report.id) {
            const verifyResponse = await dayEndService.getVerifications(
              report.id,
            );
            if (verifyResponse.success) {
              const verifications = verifyResponse.data;
              if (Array.isArray(verifications)) {
                setVerificationItems(verifications);
              } else {
                // Flatten grouped verifications
                const flat = [
                  ...(verifications.item_in || []),
                  ...(verifications.item_out || []),
                  ...(verifications.amount || []),
                ];
                setVerificationItems(flat);
              }
            }
          }
        } else if (stats) {
          // No report yet, use calculated stats from backend
          setDayEndData(null);
          setDayStatus("open");

          const newPledgesAmount = parseFloat(stats.pledges?.total) || 0;
          const renewalInterest = parseFloat(stats.renewals?.total) || 0;
          const redemptionAmount = parseFloat(stats.redemptions?.total) || 0;

          // Extract payment method breakdown from stats
          setPaymentBreakdown({
            pledges: {
              cash: parseFloat(stats.pledges?.cash) || 0,
              transfer: parseFloat(stats.pledges?.transfer) || 0,
            },
            renewals: {
              cash: parseFloat(stats.renewals?.cash) || 0,
              transfer: parseFloat(stats.renewals?.transfer) || 0,
            },
            redemptions: {
              cash: parseFloat(stats.redemptions?.cash) || 0,
              transfer: parseFloat(stats.redemptions?.transfer) || 0,
            },
          });

          setDailyStats({
            newPledgesCount: stats.pledges?.count || 0,
            renewalsCount: stats.renewals?.count || 0,
            redemptionsCount: stats.redemptions?.count || 0,
            newPledgesAmount: newPledgesAmount,
            renewalInterest: renewalInterest,
            redemptionAmount: redemptionAmount,
            cashIn: renewalInterest + redemptionAmount,
            cashOut: newPledgesAmount,
            netCashFlow: renewalInterest + redemptionAmount - newPledgesAmount,
            totalItemsAdded: stats.items_in || 0,
            totalItemsOut: stats.items_out || 0,
            totalWeight: 0,
          });

          setCashDrawer({
            openingBalance: 0,
            closingBalance: "",
            notes: "",
          });

          setVerificationItems([]);
        } else {
          // No data at all
          setDayEndData(null);
          setDayStatus("open");
          setDailyStats({
            newPledgesCount: 0,
            renewalsCount: 0,
            redemptionsCount: 0,
            newPledgesAmount: 0,
            renewalInterest: 0,
            redemptionAmount: 0,
            cashIn: 0,
            cashOut: 0,
            netCashFlow: 0,
            totalItemsAdded: 0,
            totalItemsOut: 0,
            totalWeight: 0,
          });
          setVerificationItems([]);
        }
      }
    } catch (error) {
      // Handle 404 (Report not found) - Treat as open day
      if (error.status === 404) {
        setDayEndData(null);
        setDayStatus("open");
        setDailyStats({
          newPledgesCount: 0,
          renewalsCount: 0,
          redemptionsCount: 0,
          newPledgesAmount: 0,
          renewalInterest: 0,
          redemptionAmount: 0,
          cashIn: 0,
          cashOut: 0,
          netCashFlow: 0,
          totalItemsAdded: 0,
          totalItemsOut: 0,
          totalWeight: 0,
        });
        setVerificationItems([]);
        return;
      }

      console.error("Error fetching day end data:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: error.message || "Failed to load day end data",
        }),
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Expected closing balance
  const expectedClosing = useMemo(() => {
    return cashDrawer.openingBalance + dailyStats.cashIn - dailyStats.cashOut;
  }, [cashDrawer.openingBalance, dailyStats.cashIn, dailyStats.cashOut]);

  // Variance
  const variance = useMemo(() => {
    if (!cashDrawer.closingBalance) return 0;
    return parseFloat(cashDrawer.closingBalance) - expectedClosing;
  }, [cashDrawer.closingBalance, expectedClosing]);

  // Handle item verification checkbox
  const handleVerifyItem = async (verificationId, isVerified) => {
    if (!dayEndData?.id) return;

    try {
      const response = await dayEndService.verifyItem(
        dayEndData.id,
        verificationId,
        { is_verified: isVerified },
      );

      if (response.success) {
        setVerificationItems((prev) =>
          prev.map((item) =>
            item.id === verificationId
              ? { ...item, is_verified: isVerified }
              : item,
          ),
        );
        dispatch(
          addToast({
            type: "success",
            title: isVerified ? "Verified" : "Unverified",
            message: `Item ${isVerified ? "verified" : "unverified"} successfully`,
          }),
        );
      }
    } catch (error) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Failed to update verification",
        }),
      );
    }
  };

  // Open/Start day end process
  const handleOpenDayEnd = async () => {
    try {
      const response = await dayEndService.open({
        opening_balance: cashDrawer.openingBalance,
      });

      if (response.success) {
        dispatch(
          addToast({
            type: "success",
            title: "Day End Started",
            message: "Day end process has been initiated",
          }),
        );
        await fetchDayEndData();
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: error.message || "Failed to start day end",
        }),
      );
    }
  };

  // Handle day close
  const handleCloseDay = async () => {
    if (!cashDrawer.closingBalance) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Please enter closing balance",
        }),
      );
      return;
    }

    // Check all items are verified
    const unverifiedItems = verificationItems.filter((v) => !v.is_verified);
    if (unverifiedItems.length > 0) {
      dispatch(
        addToast({
          type: "warning",
          title: "Items Not Verified",
          message: `${unverifiedItems.length} item(s) still need physical verification before closing`,
        }),
      );
      return;
    }

    setIsClosing(true);

    try {
      if (dayEndData?.id) {
        const response = await dayEndService.close(dayEndData.id, {
          closing_balance: parseFloat(cashDrawer.closingBalance),
          notes: cashDrawer.notes,
        });

        if (response.success) {
          setDayStatus("closed");
          setShowCloseModal(false);
          await fetchDayEndData();

          dispatch(
            addToast({
              type: "success",
              title: "Day Closed",
              message: `Day end summary for ${selectedDate} has been saved`,
            }),
          );
        } else {
          throw new Error(response.message || "Failed to close day");
        }
      } else {
        throw new Error("Please start day end process first");
      }
    } catch (error) {
      console.error("Error closing day:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: error.message || "Failed to close day",
        }),
      );
    } finally {
      setIsClosing(false);
    }
  };

  // Print summary — accounting-style ledger (PDF spec compliant)
  const handlePrint = async () => {
    const dateLabel = new Date(selectedDate).toLocaleDateString("en-MY", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Get company info from settings
    const stored = getStorageItem(STORAGE_KEYS.SETTINGS, null);
    const company = stored?.company || {};
    const companyName = company.name || "PawnSys Sdn Bhd";
    const companyLicense = company.license || "";
    const companyAddress = company.address || "";
    const companyPhone = company.phone || "";
    const companyEmail = company.email || "";

    // Fetch logo as base64 so it works in the unauthenticated print window
    const baseUrl = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "http://localhost:8000" : window.location.origin;
    let logoDataUrl = "";
    try {
      const logoRes = await settingsService.getLogo();
      const logoData = logoRes?.data || logoRes;
      const logoUrl = logoData?.logo_url || logoData?.path;
      if (logoUrl) {
        let fullUrl = logoUrl;
        if (!logoUrl.startsWith("http")) {
          fullUrl = baseUrl + (logoUrl.startsWith("/") ? "" : "/") + logoUrl;
        }
        const imgResp = await fetch(fullUrl);
        if (imgResp.ok) {
          const blob = await imgResp.blob();
          logoDataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        }
      }
    } catch (e) {
      console.error("Failed to fetch logo for print:", e);
    }

    // Stock calculations
    const totalItemsIn = dailyStats.totalItemsAdded;
    const totalItemsOut = dailyStats.totalItemsOut;
    const openingStock = inventorySummary.in_storage - totalItemsIn + totalItemsOut;
    const closingStock = inventorySummary.in_storage;

    // Payment breakdown calculations
    const cashIn = paymentBreakdown.renewals.cash + paymentBreakdown.redemptions.cash;
    const cashOut = paymentBreakdown.pledges.cash;
    const transferIn = paymentBreakdown.renewals.transfer + paymentBreakdown.redemptions.transfer;
    const transferOut = paymentBreakdown.pledges.transfer;
    const totalPayIn = cashIn + transferIn;
    const totalPayOut = cashOut + transferOut;

    // Build payment rows dynamically (hide unused methods)
    const paymentRows = [];
    if (cashIn > 0 || cashOut > 0) {
      paymentRows.push(`<tr><td>Cash</td><td class="right">${formatCurrency(cashIn)}</td><td class="right">${formatCurrency(cashOut)}</td></tr>`);
    }
    if (transferIn > 0 || transferOut > 0) {
      paymentRows.push(`<tr><td>Bank Transfer</td><td class="right">${formatCurrency(transferIn)}</td><td class="right">${formatCurrency(transferOut)}</td></tr>`);
    }
    if (paymentRows.length === 0) {
      paymentRows.push(`<tr><td>Cash</td><td class="right">${formatCurrency(0)}</td><td class="right">${formatCurrency(0)}</td></tr>`);
    }

    // Stock In/Out by Purity rows
    const stockInRows = Object.entries(stockByPurity.itemsInByPurity).map(([code, data]) =>
      `<tr><td style="padding-left: 20px; color: #555;">${code} Gold</td><td class="right" style="color: #555;">${data.count} items</td><td class="right" style="color: #555;">${parseFloat(data.weight).toFixed(3)}g</td></tr>`
    ).join('');
    const stockOutRows = Object.entries(stockByPurity.itemsOutByPurity).map(([code, data]) =>
      `<tr><td style="padding-left: 20px; color: #555;">${code} Gold</td><td class="right" style="color: #555;">${data.count} items</td><td class="right" style="color: #555;">${parseFloat(data.weight).toFixed(3)}g</td></tr>`
    ).join('');

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Day End Summary - ${selectedDate}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; padding: 30px 40px; max-width: 780px; margin: 0 auto; color: #1a1a1a; font-size: 13px; line-height: 1.5; -webkit-font-smoothing: antialiased; }
          .company-header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid #1a1a1a; }
          .company-logo { width: 120px; height: 120px; object-fit: contain; flex-shrink: 0; }
          .company-info { flex: 1; }
          .company-name { font-size: 28px; font-weight: 800; margin-bottom: 4px; }
          .company-reg { font-size: 15px; color: #555; margin-bottom: 6px; }
          .company-address { font-size: 14px; color: #333; line-height: 1.6; margin-bottom: 4px; }
          .company-contact { font-size: 14px; color: #333; }
          h1 { text-align: center; font-size: 20px; font-weight: 700; margin-bottom: 4px; letter-spacing: 0.5px; margin-top: 16px; }
          .sub-header { text-align: center; font-size: 12px; color: #555; margin-bottom: 24px; }
          .section { margin-bottom: 24px; }
          .section-title { font-size: 14px; font-weight: 700; border-bottom: 2px solid #1a1a1a; padding-bottom: 4px; margin-bottom: 6px; }
          .section-number { font-weight: 800; color: #92400e; margin-right: 4px; }
          .sub-section-title { font-size: 12px; font-weight: 700; margin-top: 10px; margin-bottom: 4px; color: #333; }
          /* Amber-themed detail tables */
          .detail-table { width: 100%; border-collapse: collapse; margin-top: 2px; font-size: 12px; }
          .detail-table thead th { background: #92400e; color: #fff; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; padding: 8px 10px; text-align: left; border: none; }
          .detail-table thead th.right { text-align: right; }
          .detail-table tbody td { padding: 7px 10px; border-bottom: 1px solid #f3e8d0; font-size: 12px; color: #374151; }
          .detail-table tbody td.right { text-align: right; }
          .detail-table tbody tr:nth-child(even) { background: #fffbeb; }
          .detail-table tbody tr:hover { background: #fef3c7; }
          .subtotal-bar { margin-top: 0; padding: 8px 12px; background: #92400e; color: #fff; font-weight: 600; font-size: 12px; letter-spacing: 0.2px; }
          .no-data { color: #b45309; font-size: 12px; padding: 14px 0; font-style: italic; text-align: center; border: 1px dashed #f59e0b; margin-top: 4px; background: #fffbeb; }
          /* Summary tables */
          table { width: 100%; border-collapse: collapse; }
          table th { text-align: left; font-weight: 700; font-size: 11px; border-bottom: 1px solid #999; padding: 4px 8px 4px 0; color: #333; }
          table th.right, table td.right { text-align: right; }
          table td { padding: 5px 8px 5px 0; border-bottom: 1px solid #e8e8e8; font-size: 13px; }
          table tr:last-child td { border-bottom: none; }
          .total-row td { border-top: 1px solid #333; border-bottom: 2px solid #333 !important; font-weight: 700; padding-top: 6px; padding-bottom: 6px; }
          /* Summary table with amber header */
          .summary-table { width: 100%; border-collapse: collapse; margin-top: 2px; }
          .summary-table thead th { background: #92400e; color: #fff; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; padding: 8px 10px; text-align: left; border: none; }
          .summary-table thead th.right { text-align: right; }
          .summary-table tbody td { padding: 8px 10px; border-bottom: 1px solid #f3e8d0; font-size: 13px; }
          .summary-table tbody td.right { text-align: right; }
          .summary-table tbody tr:nth-child(even) { background: #fffbeb; }
          .positive { color: #0a7d2e; }
          .negative { color: #c0392b; }
          .gold-banner { background: linear-gradient(135deg, #fffbeb, #fef3c7); border: 1px solid #f59e0b; padding: 10px 15px; margin-bottom: 22px; display: flex; justify-content: space-between; align-items: center; border-radius: 4px; }
          .gold-banner .gold-label { font-weight: 600; color: #92400e; font-size: 13px; }
          .gold-banner .gold-value { font-size: 15px; font-weight: 700; color: #b45309; }
          .net-cash-box { background: #f8f9fa; border: 2px solid #333; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
          .net-cash-label { font-size: 16px; font-weight: 700; }
          .net-cash-value { font-size: 20px; font-weight: 800; }
          .signature-area { margin-top: 50px; display: flex; justify-content: space-around; padding: 0 40px; }
          .signature-block { text-align: center; width: 180px; }
          .signature-line { border-top: 1px solid #333; padding-top: 6px; font-size: 12px; font-weight: 600; }
          .footer { text-align: center; margin-top: 30px; color: #999; font-size: 10px; }
          @media print {
            body { padding: 15px 25px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
            .detail-table tbody tr:hover { background: inherit; }
            .detail-table tbody tr:nth-child(even) { background: #fffbeb !important; }
            .detail-table thead th { background: #92400e !important; color: #fff !important; }
            .summary-table thead th { background: #92400e !important; color: #fff !important; }
            .summary-table tbody tr:nth-child(even) { background: #fffbeb !important; }
            .subtotal-bar { background: #92400e !important; color: #fff !important; }
            .gold-banner { background: linear-gradient(135deg, #fffbeb, #fef3c7) !important; }
            .no-data { background: #fffbeb !important; }
          }
        </style>
      </head>
      <body>
        <!-- Company Header -->
        <div class="company-header">
          ${logoDataUrl ? `<img class="company-logo" src="${logoDataUrl}" alt="Logo" />` : ""}
          <div class="company-info">
            <div class="company-name">${companyName}</div>
            ${companyLicense ? `<div class="company-reg">(${companyLicense})</div>` : ""}
            ${companyAddress ? `<div class="company-address">${companyAddress}</div>` : ""}
            ${companyEmail ? `<div class="company-contact">Email : ${companyEmail}</div>` : ""}
            ${companyPhone ? `<div class="company-contact">Tel : ${companyPhone}</div>` : ""}
          </div>
        </div>

        <h1>Day End Summary</h1>
        <div class="sub-header">Date: ${dateLabel} &nbsp;&nbsp;|&nbsp;&nbsp; Status: ${dayStatus === "closed" ? "CLOSED" : "OPEN"}</div>

        <div class="gold-banner">
          <span class="gold-label">Gold Value (per gram)</span>
          <span class="gold-value">${goldPrice ? `RM ${parseFloat(goldPrice).toFixed(2)}/g` : "N/A"}</span>
        </div>

        <!-- 1. New Pledges (Cash Out) Detail -->
        <div class="section">
          <div class="section-title"><span class="section-number">1.</span> New Pledges (Cash Out)</div>
          ${transactionDetails.pledges.length > 0 ? `
          <table class="detail-table">
            <thead><tr><th>Ref No</th><th>Customer</th><th>Item Type</th><th class="right">No. of Items</th><th class="right">Weight (g)</th><th class="right">Amount</th></tr></thead>
            <tbody>
              ${transactionDetails.pledges.map(p => `<tr><td>${p.ref_no}</td><td>${p.customer}</td><td>${p.item_type || 'Gold Item'}</td><td class="right">${p.item_count} ${p.item_count === 1 ? 'item' : 'items'}</td><td class="right">${parseFloat(p.weight).toFixed(1)}g</td><td class="right">${formatCurrency(p.amount)}</td></tr>`).join('')}
            </tbody>
          </table>
          <div class="subtotal-bar">
            Subtotal: ${transactionDetails.pledges.length} pax | ${transactionDetails.pledges.reduce((sum, p) => sum + p.item_count, 0)} items | ${formatCurrency(transactionDetails.pledges.reduce((sum, p) => sum + p.amount, 0))}
          </div>
          ` : '<div class="no-data">No new pledges today</div>'}
        </div>

        <!-- 2. Redemptions Detail -->
        <div class="section">
          <div class="section-title"><span class="section-number">2.</span> Redemptions</div>
          ${transactionDetails.redemptions.length > 0 ? `
          <table class="detail-table">
            <thead><tr><th>Ref No</th><th>Customer</th><th class="right">No. of Items</th><th class="right">Weight (g)</th><th class="right">Principal</th><th class="right">Interest</th><th class="right">Total Paid</th></tr></thead>
            <tbody>
              ${transactionDetails.redemptions.map(r => `<tr><td>${r.ref_no}</td><td>${r.customer}</td><td class="right">${r.item_count} ${r.item_count === 1 ? 'item' : 'items'}</td><td class="right">${parseFloat(r.weight).toFixed(1)}g</td><td class="right">${formatCurrency(r.principal)}</td><td class="right">${formatCurrency(r.interest)}</td><td class="right">${formatCurrency(r.total_paid)}</td></tr>`).join('')}
            </tbody>
          </table>
          <div class="subtotal-bar">
            Subtotal: ${transactionDetails.redemptions.length} pax | ${transactionDetails.redemptions.reduce((sum, r) => sum + r.item_count, 0)} items | ${formatCurrency(transactionDetails.redemptions.reduce((sum, r) => sum + r.total_paid, 0))}
          </div>
          ` : '<div class="no-data">No redemptions today</div>'}
        </div>

        <!-- 3. Renewals Detail -->
        <div class="section">
          <div class="section-title"><span class="section-number">3.</span> Renewals</div>
          ${transactionDetails.renewals.length > 0 ? `
          <table class="detail-table">
            <thead><tr><th>Ref No</th><th>Customer</th><th class="right">No. of Items</th><th class="right">Weight (g)</th><th class="right">Interest Paid</th><th class="right">Extension Period</th></tr></thead>
            <tbody>
              ${transactionDetails.renewals.map(r => `<tr><td>${r.ref_no}</td><td>${r.customer}</td><td class="right">${r.item_count} ${r.item_count === 1 ? 'item' : 'items'}</td><td class="right">${parseFloat(r.weight).toFixed(1)}g</td><td class="right">${formatCurrency(r.interest_paid)}</td><td class="right">+${r.extension_months} months</td></tr>`).join('')}
            </tbody>
          </table>
          <div class="subtotal-bar">
            Subtotal: ${transactionDetails.renewals.length} pax | ${transactionDetails.renewals.reduce((sum, r) => sum + r.item_count, 0)} ${transactionDetails.renewals.reduce((sum, r) => sum + r.item_count, 0) === 1 ? 'item' : 'items'} | ${formatCurrency(transactionDetails.renewals.reduce((sum, r) => sum + r.interest_paid, 0))}
          </div>
          ` : '<div class="no-data">No renewals today</div>'}
        </div>

        <!-- 4. Transaction Summary -->
        <div class="section">
          <div class="section-title"><span class="section-number">4.</span> Transaction Summary</div>
          <table class="summary-table">
            <thead><tr><th>Type</th><th class="right">Pax</th><th class="right">Items</th><th class="right">Amount</th></tr></thead>
            <tbody>
              <tr><td>New Pledges</td><td class="right">${dailyStats.newPledgesCount}</td><td class="right">${totalItemsIn} items</td><td class="right">${formatCurrency(dailyStats.newPledgesAmount)}</td></tr>
              <tr><td>Redemptions</td><td class="right">${dailyStats.redemptionsCount}</td><td class="right">${totalItemsOut} items</td><td class="right">${formatCurrency(dailyStats.redemptionAmount)}</td></tr>
              <tr><td>Renewals</td><td class="right">${dailyStats.renewalsCount}</td><td class="right">-</td><td class="right">${formatCurrency(dailyStats.renewalInterest)}</td></tr>
            </tbody>
          </table>
        </div>

        <!-- 5. Stock Movement with Opening/Closing Stock and Purity breakdown -->
        <div class="section">
          <div class="section-title"><span class="section-number">5.</span> Stock Movement</div>
          <table class="summary-table">
            <thead><tr><th>Category</th><th class="right">Items</th><th class="right">Weight (g)</th></tr></thead>
            <tbody><tr><td><strong>Opening Stock</strong></td><td class="right"><strong>${openingStock} items</strong></td><td class="right">-</td></tr></tbody>
          </table>
          <div class="sub-section-title">Stock In (Items Received)</div>
          <table class="detail-table">
            <thead><tr><th>Purity</th><th class="right">Items</th><th class="right">Weight (g)</th></tr></thead>
            <tbody>
              ${stockInRows || '<tr><td colspan="3" style="color:#b45309; text-align:center; font-style:italic;">No items received</td></tr>'}
              <tr style="border-top: 2px solid #92400e;"><td><strong>Total Stock In</strong></td><td class="right"><strong>${totalItemsIn} items</strong></td><td class="right">-</td></tr>
            </tbody>
          </table>
          <div class="sub-section-title">Stock Out (Items Released)</div>
          <table class="detail-table">
            <thead><tr><th>Purity</th><th class="right">Items</th><th class="right">Weight (g)</th></tr></thead>
            <tbody>
              ${stockOutRows || '<tr><td colspan="3" style="color:#b45309; text-align:center; font-style:italic;">No items released</td></tr>'}
              <tr style="border-top: 2px solid #92400e;"><td><strong>Total Stock Out</strong></td><td class="right"><strong>${totalItemsOut} items</strong></td><td class="right">-</td></tr>
            </tbody>
          </table>
          <table class="summary-table" style="margin-top: 10px;">
            <thead><tr><th>Closing Stock</th><th class="right">Items</th><th class="right">Weight (g)</th></tr></thead>
            <tbody><tr><td><strong>Total</strong></td><td class="right"><strong>${closingStock} items</strong></td><td class="right"><strong>${parseFloat(inventorySummary.total_weight).toFixed(3)}g</strong></td></tr></tbody>
          </table>
        </div>

        <!-- 6. Cash Flow (no opening balance - clean version) -->
        <div class="section">
          <div class="section-title"><span class="section-number">6.</span> Cash Flow</div>
          <table class="summary-table">
            <thead><tr><th>Description</th><th class="right">Amount</th></tr></thead>
            <tbody>
              <tr><td>Cash In (Received)</td><td class="right positive">+ ${formatCurrency(dailyStats.cashIn)}</td></tr>
              <tr><td>Cash Out (Disbursed)</td><td class="right negative">- ${formatCurrency(dailyStats.cashOut)}</td></tr>
              <tr style="border-top: 2px solid #92400e;"><td><strong>Net Cash Flow</strong></td><td class="right ${dailyStats.netCashFlow >= 0 ? "positive" : "negative"}"><strong>${dailyStats.netCashFlow >= 0 ? "+" : ""}${formatCurrency(dailyStats.netCashFlow)}</strong></td></tr>
            </tbody>
          </table>
        </div>

        <!-- 7. Payment Breakdown (dynamic - hide unused methods) -->
        <div class="section">
          <div class="section-title"><span class="section-number">7.</span> Payment Breakdown</div>
          <table class="summary-table">
            <thead><tr><th>Payment Method</th><th class="right">Cash In</th><th class="right">Cash Out</th></tr></thead>
            <tbody>
              ${paymentRows.join("")}
              <tr style="border-top: 2px solid #92400e;"><td><strong>Total</strong></td><td class="right"><strong>${formatCurrency(totalPayIn)}</strong></td><td class="right"><strong>${formatCurrency(totalPayOut)}</strong></td></tr>
            </tbody>
          </table>
        </div>

        <!-- 8. Net Cash Movement -->
        <div class="section">
          <div class="section-title"><span class="section-number">8.</span> Net Cash Movement</div>
          <div class="net-cash-box" style="background: linear-gradient(135deg, #fffbeb, #fef3c7); border: 2px solid #92400e;">
            <span class="net-cash-label" style="color: #92400e;">Net Cash Movement</span>
            <span class="net-cash-value ${dailyStats.netCashFlow >= 0 ? "positive" : "negative"}">${dailyStats.netCashFlow >= 0 ? "+" : ""}${formatCurrency(dailyStats.netCashFlow)}</span>
          </div>
        </div>

        ${cashDrawer.notes ? `<div class="section"><div class="section-title">Notes</div><p style="padding: 5px 0; font-size: 13px;">${cashDrawer.notes}</p></div>` : ""}

        <div class="signature-area">
          <div class="signature-block"><div class="signature-line">Prepared By</div></div>
          <div class="signature-block"><div class="signature-line">Verified By</div></div>
        </div>

        <div class="footer">Generated on ${new Date().toLocaleString("en-MY")} | PawnSys</div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  // Handle export
  const handleExport = async () => {
    try {
      await dayEndService.export(selectedDate);
      dispatch(
        addToast({
          type: "success",
          title: "Export Started",
          message: "Report download has started",
        }),
      );
    } catch (error) {
      dispatch(
        addToast({
          type: "error",
          title: "Export Failed",
          message: "Failed to export report",
        }),
      );
    }
  };

  // Send WhatsApp summary
  const handleSendWhatsApp = async () => {
    if (!dayEndData?.id) return;

    setIsSendingWhatsApp(true);
    try {
      const response = await dayEndService.sendWhatsApp(dayEndData.id);
      if (response.success) {
        dispatch(
          addToast({
            type: "success",
            title: "WhatsApp Sent",
            message: "Day end summary sent via WhatsApp",
          }),
        );
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      dispatch(
        addToast({
          type: "error",
          title: "WhatsApp Failed",
          message: error.message || "Failed to send WhatsApp",
        }),
      );
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">Loading day end data...</p>
        </div>
      </div>
    );
  }

  return (
    <PageWrapper
      title="Day End Summary"
      subtitle="Daily closing report and cash reconciliation"
      fullWidth={true}
      actions={
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-44"
          />
          <Button
            variant="outline"
            leftIcon={RefreshCw}
            onClick={fetchDayEndData}
          >
            Refresh
          </Button>
          <Button variant="outline" leftIcon={Printer} onClick={handlePrint}>
            Print
          </Button>
          <Button variant="outline" leftIcon={Download} onClick={handleExport}>
            Export
          </Button>
        </div>
      }
    >
      {/* Status Banner */}
      <Card
        className={cn(
          "p-4 mb-6 border-2",
          dayStatus === "closed"
            ? "bg-emerald-50 border-emerald-200"
            : "bg-amber-50 border-amber-200",
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {dayStatus === "closed" ? (
              <Lock className="w-6 h-6 text-emerald-600" />
            ) : (
              <Unlock className="w-6 h-6 text-amber-600" />
            )}
            <div>
              <p className="font-semibold text-zinc-800">
                {new Date(selectedDate).toLocaleDateString("en-MY", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <p
                className={cn(
                  "text-sm",
                  dayStatus === "closed"
                    ? "text-emerald-600"
                    : "text-amber-600",
                )}
              >
                {dayStatus === "closed"
                  ? "Day Closed"
                  : "Day Open - Transactions Active"}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {dayStatus === "open" ? (
              <>
                {!dayEndData && (
                  <Button
                    variant="outline"
                    leftIcon={FileText}
                    onClick={handleOpenDayEnd}
                  >
                    Start Day End
                  </Button>
                )}
                <Button
                  variant="accent"
                  leftIcon={Lock}
                  onClick={() => setShowCloseModal(true)}
                  disabled={!dayEndData}
                >
                  Close Day
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  leftIcon={MessageCircle}
                  onClick={handleSendWhatsApp}
                  loading={isSendingWhatsApp}
                >
                  Send WhatsApp
                </Button>
                <Button
                  variant="outline"
                  leftIcon={Printer}
                  onClick={handlePrint}
                >
                  Print Report
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <FileText className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">New Pledges</p>
              <p className="text-2xl font-bold text-zinc-800">
                {dailyStats.newPledgesCount}
              </p>
              <p className="text-xs text-amber-600 font-medium">
                {formatCurrency(dailyStats.newPledgesAmount)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Renewals</p>
              <p className="text-2xl font-bold text-zinc-800">
                {dailyStats.renewalsCount}
              </p>
              <p className="text-xs text-amber-600 font-medium">
                {formatCurrency(dailyStats.renewalInterest)} interest
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Redemptions</p>
              <p className="text-2xl font-bold text-zinc-800">
                {dailyStats.redemptionsCount}
              </p>
              <p className="text-xs text-emerald-600 font-medium">
                {formatCurrency(dailyStats.redemptionAmount)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
              <Package className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Stock In / Out</p>
              <p className="text-2xl font-bold text-zinc-800">
                {dailyStats.totalItemsAdded}
                <span className="text-base text-zinc-400 font-normal"> / </span>
                <span className="text-lg text-red-500">{dailyStats.totalItemsOut}</span>
              </p>
              <p className="text-xs text-purple-600 font-medium">
                {inventorySummary.in_storage} in storage ({parseFloat(inventorySummary.total_weight).toFixed(1)}g)
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cash Flow Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cash Flow */}
          <Card className="p-6">
            <h3 className="font-semibold text-zinc-800 mb-6 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-500" />
              Cash Flow Summary
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Cash In */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-amber-700">Cash In</span>
                  <ArrowDownRight className="w-5 h-5 text-amber-500" />
                </div>
                <p className="text-2xl font-bold text-amber-700">
                  {formatCurrency(dailyStats.cashIn)}
                </p>
                <div className="mt-3 pt-3 border-t border-amber-200/60 space-y-1.5 text-xs text-amber-600">
                  <div className="flex justify-between">
                    <span>Interest</span>
                    <span className="font-semibold">{formatCurrency(dailyStats.renewalInterest)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Redemptions</span>
                    <span className="font-semibold">{formatCurrency(dailyStats.redemptionAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Cash Out */}
              <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-red-700">Cash Out</span>
                  <ArrowUpRight className="w-5 h-5 text-red-500" />
                </div>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(dailyStats.cashOut)}
                </p>
                <div className="mt-3 space-y-1 text-xs text-red-600">
                  <div className="flex justify-between">
                    <span>New Loans</span>
                    <span>{formatCurrency(dailyStats.newPledgesAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Net Flow */}
              <div
                className={cn(
                  "p-4 rounded-xl border",
                  dailyStats.netCashFlow >= 0
                    ? "bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200"
                    : "bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200",
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      dailyStats.netCashFlow >= 0
                        ? "text-amber-700"
                        : "text-orange-700",
                    )}
                  >
                    Net Flow
                  </span>
                  {dailyStats.netCashFlow >= 0 ? (
                    <TrendingUp className="w-5 h-5 text-amber-500" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-orange-500" />
                  )}
                </div>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    dailyStats.netCashFlow >= 0
                      ? "text-amber-700"
                      : "text-orange-700",
                  )}
                >
                  {dailyStats.netCashFlow >= 0 ? "+" : ""}
                  {formatCurrency(dailyStats.netCashFlow)}
                </p>
              </div>
            </div>
          </Card>

          {/* Stock Movement by Purity */}
          <Card className="p-6">
            <h3 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-500" />
              Stock Movement by Purity
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Stock In by Purity */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-emerald-700">Stock In (Received)</span>
                  <Badge variant="success">{dailyStats.totalItemsAdded} items</Badge>
                </div>
                {Object.keys(stockByPurity.itemsInByPurity).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(stockByPurity.itemsInByPurity).map(([code, data]) => (
                      <div key={code} className="flex items-center justify-between p-2.5 bg-white/60 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">{code}</span>
                          <span className="text-sm font-medium text-zinc-700">Purity {code}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-emerald-700">{data.count} items</p>
                          <p className="text-xs text-emerald-600">{parseFloat(data.weight).toFixed(3)}g</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-emerald-600/60 text-center py-3">No items received today</p>
                )}
              </div>

              {/* Stock Out by Purity */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-red-50 to-red-100/50 border border-red-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-red-700">Stock Out (Released)</span>
                  <Badge variant="error">{dailyStats.totalItemsOut} items</Badge>
                </div>
                {Object.keys(stockByPurity.itemsOutByPurity).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(stockByPurity.itemsOutByPurity).map(([code, data]) => (
                      <div key={code} className="flex items-center justify-between p-2.5 bg-white/60 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-xs font-bold text-red-700">{code}</span>
                          <span className="text-sm font-medium text-zinc-700">Purity {code}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-red-700">{data.count} items</p>
                          <p className="text-xs text-red-600">{parseFloat(data.weight).toFixed(3)}g</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-red-600/60 text-center py-3">No items released today</p>
                )}
              </div>
            </div>
          </Card>

          {/* Transaction Breakdown */}
          <Card className="p-6">
            <h3 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-amber-500" />
              Transaction Breakdown
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="text-left p-3 text-xs font-semibold text-zinc-500 uppercase">
                      Type
                    </th>
                    <th className="text-center p-3 text-xs font-semibold text-zinc-500 uppercase">
                      Count
                    </th>
                    <th className="text-right p-3 text-xs font-semibold text-zinc-500 uppercase">
                      Amount
                    </th>
                    <th className="text-center p-3 text-xs font-semibold text-zinc-500 uppercase">
                      Direction
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  <tr className="hover:bg-zinc-50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-500" />
                        <span>New Pledges</span>
                      </div>
                    </td>
                    <td className="p-3 text-center font-medium">
                      {dailyStats.newPledgesCount}
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {formatCurrency(dailyStats.newPledgesAmount)}
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant="error">Cash Out</Badge>
                    </td>
                  </tr>
                  <tr className="hover:bg-zinc-50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-amber-500" />
                        <span>Renewals (Interest)</span>
                      </div>
                    </td>
                    <td className="p-3 text-center font-medium">
                      {dailyStats.renewalsCount}
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {formatCurrency(dailyStats.renewalInterest)}
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant="success">Cash In</Badge>
                    </td>
                  </tr>
                  <tr className="hover:bg-zinc-50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-emerald-500" />
                        <span>Redemptions</span>
                      </div>
                    </td>
                    <td className="p-3 text-center font-medium">
                      {dailyStats.redemptionsCount}
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {formatCurrency(dailyStats.redemptionAmount)}
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant="success">Cash In</Badge>
                    </td>
                  </tr>
                </tbody>
                <tfoot className="bg-zinc-100 font-semibold">
                  <tr>
                    <td className="p-3">Total</td>
                    <td className="p-3 text-center">
                      {dailyStats.newPledgesCount +
                        dailyStats.renewalsCount +
                        dailyStats.redemptionsCount}
                    </td>
                    <td className="p-3 text-right">
                      {formatCurrency(dailyStats.cashIn + dailyStats.cashOut)}
                    </td>
                    <td className="p-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* Item Verification Section */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-zinc-800 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-amber-500" />
                Item Verification
              </h3>
              <Badge
                variant={
                  verificationItems.length === 0 ||
                  verificationItems.every((v) => v.is_verified)
                    ? "success"
                    : "warning"
                }
              >
                {verificationItems.filter((v) => v.is_verified).length} /{" "}
                {verificationItems.length} Verified
              </Badge>
            </div>

            {verificationItems.length > 0 ? (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {verificationItems.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-all",
                      item.is_verified
                        ? "bg-amber-50 border-amber-200"
                        : "bg-zinc-50 border-zinc-200",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {/* Verification Checkbox */}
                      <button
                        onClick={() =>
                          handleVerifyItem(item.id, !item.is_verified)
                        }
                        className={cn(
                          "w-6 h-6 rounded border-2 flex items-center justify-center transition-all",
                          item.is_verified
                            ? "bg-amber-500 border-amber-500 text-white"
                            : "border-zinc-300 hover:border-amber-500",
                        )}
                      >
                        {item.is_verified && <Check className="w-4 h-4" />}
                      </button>

                      {/* Item Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-xs font-medium px-2 py-0.5 rounded",
                              item.verification_type === "item_in"
                                ? "bg-amber-100 text-amber-700"
                                : item.verification_type === "item_out"
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-zinc-100 text-zinc-700",
                            )}
                          >
                            {item.verification_type === "item_in"
                              ? "IN"
                              : item.verification_type === "item_out"
                                ? "OUT"
                                : "AMT"}
                          </span>
                          <span className="font-medium text-zinc-800">
                            {item.item_description || item.reference_no}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-500">
                          {item.related_type} #{item.related_id}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Amount */}
                      <div className="text-right">
                        <p className="font-semibold text-zinc-800">
                          {formatCurrency(item.expected_amount || 0)}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {item.verification_type}
                        </p>
                      </div>

                      {/* View Button */}
                      {item.related_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (item.related_type === "Pledge") {
                              navigate(`/pledges/${item.related_id}`);
                            }
                          }}
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-400">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No items to verify today</p>
                {!dayEndData && (
                  <p className="text-sm mt-2">
                    Click "Start Day End" to generate verification items
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Cash Drawer Section */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold text-zinc-800 mb-6 flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-amber-500" />
              Cash Drawer
            </h3>

            <div className="space-y-4">
              {/* Transactions */}
              <div className="p-4 bg-zinc-50 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-amber-600">+ Cash In</span>
                  <span className="font-medium text-amber-600">
                    {formatCurrency(dailyStats.cashIn)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-red-600">- Cash Out</span>
                  <span className="font-medium text-red-600">
                    {formatCurrency(dailyStats.cashOut)}
                  </span>
                </div>
              </div>

              {/* Expected Closing */}
              <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-amber-700">
                    Expected Closing
                  </span>
                  <span className="text-xl font-bold text-amber-700">
                    {formatCurrency(expectedClosing)}
                  </span>
                </div>
              </div>

              {/* Actual Closing Input */}
              {dayStatus === "open" && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">
                    Actual Closing Balance
                  </label>
                  <Input
                    type="number"
                    placeholder="Enter actual cash count"
                    value={cashDrawer.closingBalance}
                    onChange={(e) =>
                      setCashDrawer({
                        ...cashDrawer,
                        closingBalance: e.target.value,
                      })
                    }
                    leftIcon={Banknote}
                  />
                </div>
              )}

              {/* Variance */}
              {cashDrawer.closingBalance && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "p-4 rounded-xl",
                    variance === 0
                      ? "bg-emerald-50 border border-emerald-200"
                      : "bg-red-50 border border-red-200",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {variance === 0 ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                      )}
                      <span
                        className={cn(
                          "text-sm font-medium",
                          variance === 0 ? "text-emerald-700" : "text-red-700",
                        )}
                      >
                        {variance === 0 ? "Balanced" : "Variance"}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "text-lg font-bold",
                        variance === 0 ? "text-emerald-600" : "text-red-600",
                      )}
                    >
                      {variance >= 0 ? "+" : ""}
                      {formatCurrency(variance)}
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Notes */}
              {dayStatus === "open" && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                    rows={3}
                    placeholder="Any remarks for today..."
                    value={cashDrawer.notes}
                    onChange={(e) =>
                      setCashDrawer({ ...cashDrawer, notes: e.target.value })
                    }
                  />
                </div>
              )}
            </div>
          </Card>

          {/* Quick Info */}
          <Card className="p-4 bg-amber-50/50 border-amber-200">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Day End Process</p>
                <ol className="list-decimal list-inside mt-2 space-y-1 text-xs text-amber-700">
                  <li>Click "Start Day End"</li>
                  <li>Review all transactions</li>
                  <li>Verify items physically</li>
                  <li>Count physical cash</li>
                  <li>Enter closing balance</li>
                  <li>Click "Close Day"</li>
                </ol>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Close Day Modal */}
      <Modal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        title="Close Day"
        size="md"
      >
        <div className="p-5">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center p-4 bg-zinc-50 rounded-xl">
              <p className="text-2xl font-bold text-zinc-800">
                {dailyStats.newPledgesCount +
                  dailyStats.renewalsCount +
                  dailyStats.redemptionsCount}
              </p>
              <p className="text-xs text-zinc-500">Total Transactions</p>
            </div>
            <div
              className={cn(
                "text-center p-4 rounded-xl",
                variance === 0 ? "bg-emerald-50" : "bg-red-50",
              )}
            >
              <p
                className={cn(
                  "text-2xl font-bold",
                  variance === 0 ? "text-emerald-600" : "text-red-600",
                )}
              >
                {variance === 0 ? "Balanced" : formatCurrency(variance)}
              </p>
              <p className="text-xs text-zinc-500">Cash Variance</p>
            </div>
          </div>

          {/* Warning if items not verified */}
          {verificationItems.length > 0 &&
            verificationItems.some((v) => !v.is_verified) && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">
                      Items Pending Verification
                    </p>
                    <p className="text-sm text-amber-600 mt-1">
                      {verificationItems.filter((v) => !v.is_verified).length}{" "}
                      of {verificationItems.length} items still need physical
                      verification before closing.
                    </p>
                  </div>
                </div>
              </div>
            )}

          {/* Warning if variance */}
          {variance !== 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">
                    Cash Variance Detected
                  </p>
                  <p className="text-sm text-red-600 mt-1">
                    There is a {formatCurrency(Math.abs(variance))}{" "}
                    {variance > 0 ? "surplus" : "shortage"}. Please verify your
                    cash count before closing.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Confirmation */}
          <p className="text-sm text-zinc-600 mb-6">
            Are you sure you want to close the day? This will lock all
            transactions for {selectedDate}.
          </p>

          <div className="flex gap-3">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setShowCloseModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              fullWidth
              leftIcon={Lock}
              onClick={handleCloseDay}
              loading={isClosing}
            >
              Close Day
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
}
