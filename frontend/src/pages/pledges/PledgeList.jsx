import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { setPledges, setSelectedPledge } from "@/features/pledges/pledgesSlice";
import { addToast } from "@/features/ui/uiSlice";
import { pledgeService } from "@/services";
import { getToken } from "@/services/api";
import { formatCurrency, formatDate, formatIC } from "@/utils/formatters";
import { getStorageUrl } from "@/utils/helpers";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { Card, Button, Input, Select, Badge, Modal } from "@/components/common";
import PasskeyModal from "@/components/common/PasskeyModal";
import { getReprintReasons } from "@/pages/settings/ReprintReasonsTab";
import { usePermission } from "@/components/auth/PermissionGate";
import {
  Plus,
  Search,
  Filter,
  Package,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  DollarSign,
  Calendar,
  User,
  FileText,
  Download,
  FileDown,
  TrendingUp,
  Scale,
  Loader2,
  Printer,
  ScanLine,
  RotateCcw,
  Copy,
  ChevronDown,
  MessageSquare,
} from "lucide-react";

// Status badge config
const statusConfig = {
  active: { label: "Active", variant: "success", icon: CheckCircle },
  overdue: { label: "Overdue", variant: "error", icon: AlertTriangle },
  redeemed: { label: "Redeemed", variant: "info", icon: DollarSign },
  forfeited: { label: "Forfeited", variant: "warning", icon: XCircle },
  auctioned: { label: "Auctioned", variant: "default", icon: Package },
  cancelled: { label: "Cancelled", variant: "default", icon: XCircle },
};

export default function PledgeList() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { pledges } = useAppSelector((state) => state.pledges);

  // Permission checks
  const canCreate = usePermission("pledges.create");
  const canPrint = usePermission("pledges.print");
  const canDelete = usePermission("pledges.delete");

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [printingId, setPrintingId] = useState(null);
  const [dotPrintingId, setDotPrintingId] = useState(null);
  const [pdfDownloadingId, setPdfDownloadingId] = useState(null);
  const [printingBarcodeId, setPrintingBarcodeId] = useState(null);
  const [reprintingId, setReprintingId] = useState(null);

  // Passkey Modal State
  const [passkeyModalOpen, setPasskeyModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  // Cancel Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingPledge, setCancellingPledge] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelNotes, setCancelNotes] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Reprint Reason Modal State
  const [showReprintReasonModal, setShowReprintReasonModal] = useState(false);
  const [reprintReasonPledge, setReprintReasonPledge] = useState(null);
  const [reprintReason, setReprintReason] = useState("");
  const [customReprintReason, setCustomReprintReason] = useState("");
  const [reprintReasons, setReprintReasons] = useState([]);

  // Predefined cancellation reasons
  const cancelReasons = [
    "Customer requested cancellation",
    "Error in calculation",
    "Duplicate entry",
    "Items not as described",
    "Customer did not complete transaction",
    "Other",
  ];

  // Fetch pledges from API
  const fetchPledges = async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await pledgeService.getAll({ per_page: 9999 });
      const data = response.data?.data || response.data || [];

      // Transform snake_case to camelCase and add computed fields
      const transformedPledges = data.map((pledge) => ({
        id: pledge.id,
        pledgeNo: pledge.pledge_no,
        receiptNo: pledge.receipt_no,
        customerId: pledge.customer_id,
        customerName: pledge.customer?.name || "Unknown",
        customerIC: pledge.customer?.ic_number || "",
        customerPhone: pledge.customer?.phone || "",
        customerPhoto: pledge.customer?.selfie_photo || null,
        totalWeight: parseFloat(pledge.total_weight) || 0,
        grossValue: parseFloat(pledge.gross_value) || 0,
        totalDeduction: parseFloat(pledge.total_deduction) || 0,
        netValue: parseFloat(pledge.net_value) || 0,
        loanPercentage: parseFloat(pledge.loan_percentage) || 0,
        loanAmount: parseFloat(pledge.loan_amount) || 0,
        interestRate: parseFloat(pledge.interest_rate) || 0.5,
        pledgeDate: pledge.pledge_date,
        dueDate: pledge.due_date,
        graceEndDate: pledge.grace_end_date,
        status: pledge.status,
        renewalCount: pledge.renewal_count || 0,
        latestRenewalId: pledge.renewals?.[0]?.id || null,
        latestRedemptionId: pledge.redemption?.[0]?.id || null,
        latestRedemptionNo: pledge.redemption?.[0]?.redemption_no || null,
        itemsCount: pledge.items?.length || pledge.items_count || 0,
        items: pledge.items || [],
        createdAt: pledge.created_at,
        updatedAt: pledge.updated_at,
      }));

      dispatch(setPledges(transformedPledges));
    } catch (error) {
      console.error("Error fetching pledges:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Failed to load pledges",
        }),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load pledges on mount
  useEffect(() => {
    fetchPledges();
  }, []);

  const handleActionWithPasskey = (type, payload, e) => {
    if (e) e.stopPropagation();
    setPendingAction({ type, payload });
    setPasskeyModalOpen(true);
  };

  const executePendingAction = async () => {
    if (!pendingAction) return;
    const { type, payload } = pendingAction;

    switch (type) {
      case 'print':
        handlePrint(payload.id);
        break;
      case 'reprint':
        handleReprint(payload.id);
        break;
      case 'barcode':
        // Show reprint reason modal instead of printing directly
        await handleReprintBarcodeClick(payload.pledge);
        break;
      case 'download':
        handleDownloadPdf(payload.pledge);
        break;
    }

    // Reset state after execution
    setPendingAction(null);
  };

  // Handle print pre-printed form with data
  const handlePrint = async (pledgeId, e) => {
    if (e) e.stopPropagation();

    // Get token using the helper function
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

    setPrintingId(pledgeId);

    try {
      const apiUrl =
        import.meta.env.VITE_API_URL || "http://localhost:8000/api";
      const response = await fetch(
        `${apiUrl}/print/dot-matrix/pre-printed-with-form/pledge/${pledgeId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to generate pre-printed form");
      }

      const frontHtml = data.data.front_html || "";
      let backHtml = data.data.back_html || "";
      // Strip @page styles from backHtml to prevent overriding global margins
      backHtml = backHtml.replace(/@page\s*\{[^}]*\}/gi, "");

      const pledgeNo = data.data.pledge_no || "N/A";

      // Create print window
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        throw new Error("Please allow popups to print");
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Pre-Printed Form - ${pledgeNo}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Courier New', Courier, monospace;
              background: #f5f5f5;
              padding: 20px;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 20px;
            }
            
            .print-container {
              width: 210mm;
              max-width: 210mm;
              background: white;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
              margin: 0;
              padding: 0;
              overflow: hidden;
            }
            
            .print-actions {
              width: 100%;
              max-width: 210mm;
              text-align: center;
              padding: 15px;
              background: #fff3cd;
              border: 1px solid #ffc107;
              border-radius: 4px;
            }
            
            .print-btn {
              background: #28a745;
              color: white;
              border: none;
              padding: 10px 30px;
              font-size: 16px;
              border-radius: 4px;
              cursor: pointer;
              margin: 0 5px;
            }
            
            .print-btn:hover {
              background: #218838;
            }
            
            .close-btn {
              background: #dc3545;
            }
            
            .close-btn:hover {
              background: #c82333;
            }
            
            @media print {
              body {
                background: white;
                padding: 0;
                display: block;
              }
              
              .print-container {
                box-shadow: none;
                margin: 0;
              }
              
              .print-actions {
                display: none;
              }
            }
            
            @page {
              size: A5 landscape;
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div class="print-actions">
           <p style="margin-bottom: 10px; font-weight: bold; color: #856404;">
  📄 HP Print - A5 - ${pledgeNo}
</p>
<p style="margin-bottom: 15px; font-size: 14px; color: #856404;">
  A5 Pre-Printed Form Template + Data Overlay (Landscape)
</p>
            <button class="print-btn" onclick="window.print()">🖨️ Print</button>
            <button class="print-btn close-btn" onclick="window.close()">✖ Close</button>
          </div>
          
          <div class="print-container">
            ${frontHtml}
          </div>

          ${backHtml
          ? `<div class="print-container" style="margin-top: 20px;">
                  ${backHtml}
                 </div>`
          : ""
        }
          
          <script>
            window.onload = function() { 
              document.querySelector('.print-btn').focus(); 
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
          title: "Success",
          message: "Pre-printed form with data generated",
        }),
      );
    } catch (error) {
      console.error("Print error:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: error.message || "Failed to generate pre-printed form",
        }),
      );
    } finally {
      setPrintingId(null);
    }
  };

  // Handle print pre-printed form with data (REPRINT)
  const handleReprint = async (pledgeId, e) => {
    if (e) e.stopPropagation();

    // Get token using the helper function
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

    setReprintingId(pledgeId);

    try {
      const apiUrl =
        import.meta.env.VITE_API_URL || "http://localhost:8000/api";
      const response = await fetch(
        `${apiUrl}/print/dot-matrix/pre-printed-with-form/pledge/${pledgeId}/reprint`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to generate pre-printed reprint form");
      }

      const frontHtml = data.data.front_html || "";
      let backHtml = data.data.back_html || "";
      // Strip @page styles from backHtml to prevent overriding global margins
      backHtml = backHtml.replace(/@page\s*\{[^}]*\}/gi, "");

      const pledgeNo = data.data.pledge_no || "N/A";

      // Create print window
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        throw new Error("Please allow popups to print");
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Pre-Printed Form (REPRINT) - ${pledgeNo}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Courier New', Courier, monospace;
              background: #f5f5f5;
              padding: 20px;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 20px;
            }
            
            .print-container {
              width: 210mm;
              max-width: 210mm;
              background: white;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
              margin: 0;
              padding: 0;
              overflow: hidden;
            }
            
            .print-actions {
              width: 100%;
              max-width: 210mm;
              text-align: center;
              padding: 15px;
              background: #f8d7da;
              border: 1px solid #f5c6cb;
              border-radius: 4px;
            }
            
            .print-btn {
              background: #28a745;
              color: white;
              border: none;
              padding: 10px 30px;
              font-size: 16px;
              border-radius: 4px;
              cursor: pointer;
              margin: 0 5px;
            }
            
            .print-btn:hover {
              background: #218838;
            }
            
            .close-btn {
              background: #dc3545;
            }
            
            .close-btn:hover {
              background: #c82333;
            }
            
            @media print {
              body {
                background: white;
                padding: 0;
                display: block;
              }
              
              .print-container {
                box-shadow: none;
                margin: 0;
              }
              
              .print-actions {
                display: none;
              }
            }
            
            @page {
              size: A5 landscape;
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div class="print-actions">
           <p style="margin-bottom: 10px; font-weight: bold; color: #721c24;">
  📄 HP Print - A5 - ${pledgeNo} (REPRINT)
</p>
<p style="margin-bottom: 15px; font-size: 14px; color: #721c24;">
  A5 Pre-Printed Form Template + Data Overlay (REPRINT)
</p>
            <button class="print-btn" onclick="window.print()">🖨️ Print</button>
            <button class="print-btn close-btn" onclick="window.close()">✖ Close</button>
          </div>
          
          <div class="print-container">
            ${frontHtml}
          </div>

          ${backHtml
          ? `<div class="print-container" style="margin-top: 20px;">
                  ${backHtml}
                 </div>`
          : ""
        }
          
          <script>
            window.onload = function() { 
              document.querySelector('.print-btn').focus(); 
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
          title: "Success",
          message: "Pre-printed reprint form generated",
        }),
      );
    } catch (error) {
      console.error("Print error:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: error.message || "Failed to generate pre-printed reprint form",
        }),
      );
    } finally {
      setReprintingId(null);
    }
  };

  // Handle dot matrix print receipt
  const handleDotPrint = async (pledge, e) => {
    if (e) e.stopPropagation();

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

    setDotPrintingId(pledge.id);

    try {
      const apiUrl =
        import.meta.env.VITE_API_URL || "http://localhost:8000/api";

      // Detect type and build the correct endpoint
      // Uses data-only overlay (2-copy A4 portrait) for pre-printed paper
      let printUrl;
      let docType;
      if (pledge.status === "redeemed" && pledge.latestRedemptionId) {
        printUrl = `${apiUrl}/print/dot-matrix/pre-printed/redemption/${pledge.latestRedemptionId}`;
        docType = "Redemption";
      } else if (pledge.renewalCount > 0 && pledge.latestRenewalId) {
        printUrl = `${apiUrl}/print/dot-matrix/pre-printed/renewal/${pledge.latestRenewalId}`;
        docType = "Renewal";
      } else {
        printUrl = `${apiUrl}/print/dot-matrix/pre-printed-a4/pledge/${pledge.id}`;
        docType = "Pledge";
      }

      const response = await fetch(printUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || `Failed to generate ${docType} print`,
        );
      }

      const frontHtml = data.data.front_html || "";
      let backHtml = data.data.back_html || "";
      backHtml = backHtml.replace(/@page\s*\{[^}]*\}/gi, "");
      const pledgeNo = data.data.pledge_no || data.data.receipt_no || pledge.receiptNo || "N/A";

      // Create print window
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        throw new Error("Please allow popups to print");
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>${docType} - ${pledgeNo}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Courier New', Courier, monospace;
              background: #f5f5f5;
              padding: 20px;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 20px;
            }
            .print-container {
              width: 210mm;
              max-width: 210mm;
              background: white;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
              margin: 0;
              padding: 0;
              overflow: hidden;
            }
            .print-actions {
              width: 100%;
              max-width: 210mm;
              text-align: center;
              padding: 15px;
              background: #fff3cd;
              border: 1px solid #ffc107;
              border-radius: 4px;
            }
            .print-btn {
              background: #28a745;
              color: white;
              border: none;
              padding: 10px 30px;
              font-size: 16px;
              border-radius: 4px;
              cursor: pointer;
              margin: 0 5px;
            }
            .print-btn:hover { background: #218838; }
            .close-btn { background: #dc3545; }
            .close-btn:hover { background: #c82333; }
            @media print {
              body { background: white; padding: 0; display: block; }
              .print-container { box-shadow: none; margin: 0; }
              .print-actions { display: none; }
            }
            @page { size: A4 portrait; margin: 0; }
          </style>
        </head>
        <body>
          <div class="print-actions">
          <p style="margin-bottom: 10px; font-weight: bold; color: #856404;">
  📄 EPSON - A4 — ${docType} Data Overlay (Portrait) - ${pledgeNo}
</p>
<p style="margin-bottom: 15px; font-size: 14px; color: #856404;">
  A4 Data Overlay (Portrait) — prints 2 copies on pre-printed paper
</p>
            <button class="print-btn" onclick="window.print()">🖨️ Print</button>
            <button class="print-btn close-btn" onclick="window.close()">✖ Close</button>
          </div>
          
          <div class="print-container">
            ${frontHtml}
          </div>

          ${backHtml
          ? `<div class="print-container" style="margin-top: 20px;">
                  ${backHtml}
                 </div>`
          : ""
        }
          
          <script>
            window.onload = function() { 
              document.querySelector('.print-btn').focus(); 
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
          title: "Success",
          message: `${docType} receipt generated (A4 Portrait)`,
        }),
      );
    } catch (error) {
      console.error("Dot print error:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: error.message || "Failed to print receipt",
        }),
      );
    } finally {
      setDotPrintingId(null);
    }
  };

  // Open reprint reason modal before printing barcode
  const handleReprintBarcodeClick = async (pledge, e) => {
    if (e) e.stopPropagation();
    setReprintReasonPledge(pledge);

    // getReprintReasons is an async function, we must await it
    const reasons = await getReprintReasons();
    setReprintReasons(reasons || []);

    setReprintReason("");
    setCustomReprintReason("");
    setShowReprintReasonModal(true);
  };

  // Handle barcode print with reason
  const handlePrintBarcode = async (pledge, e, reasonText = "") => {
    if (e) e.stopPropagation();
    const token = getToken();
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

    if (!token) {
      dispatch(addToast({ type: "error", title: "Error", message: "Please login again" }));
      return;
    }

    setPrintingBarcodeId(pledge.id);
    try {
      const response = await fetch(`${apiUrl}/print/barcodes/${pledge.id}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const barcodeImage = data.data.items?.[0]?.image || "";
          const totalWeight = data.data.items?.reduce(
            (sum, item) => sum + (parseFloat(item.net_weight) || 0),
            0,
          ) || 0;
          const storageLocation = data.data.storage_location || data.data.items?.[0]?.storage_location || "";
          const totalItemsNum = parseInt(data.data.total_items || data.data.items?.length || pledge.itemsCount || pledge.items?.length) || 1;
          const displayCategory = totalItemsNum >= 2 ? `${totalItemsNum} ITEMS` : (data.data.items?.[0]?.category || pledge.items?.[0]?.category?.name_en || "ITEM");
          const rawRemark = reasonText || "REPRINT";
          let badgeText = "REPRINT";
          let commentToDisplay = rawRemark;

          if (rawRemark.toUpperCase().includes("RELOCAT")) {
            badgeText = "RELOCATED";
            commentToDisplay = rawRemark.replace(/^RELOCATED:?\s*/i, "").trim();
          } else if (rawRemark.toUpperCase() === "REPRINT") {
            commentToDisplay = "";
          }
          
          const remarkText = commentToDisplay;
          const pledgeNo = data.data.pledge_no || pledge.pledgeNo;

          const barcodeWindow = window.open("", "_blank", "width=400,height=600");
          if (barcodeWindow) {
            barcodeWindow.document.write(`
              <!DOCTYPE html>
              <html>
              <head>
                <title>Barcode Label - ${pledgeNo}</title>
                <style>
                  @page { size: 50mm 50mm; margin: 0 !important; }
                  @media print {
                    html, body { width: 50mm !important; height: 50mm !important; margin: 0 !important; padding: 0 !important; }
                    .controls { display: none !important; }
                    .labels-wrapper { width: 50mm !important; margin: 0 !important; box-shadow: none !important; }
                  }
                  * { margin: 0; padding: 0; box-sizing: border-box; }
                  body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
                  .labels-wrapper { width: 50mm; margin: 0 auto; background: white; box-shadow: 0 2px 10px rgba(0,0,0,0.2); }
                  .label { 
                    width: 50mm; height: 50mm; padding: 4mm 4mm 4mm 4mm; background: white; 
                    display: flex; flex-direction: column; justify-content: center; overflow: hidden; border-bottom: 1px dashed #ccc;
                  }
                  .header-row { display: flex; justify-content: space-between; align-items: center; border-bottom: 0.3mm solid #333; padding-bottom: 1mm; margin-bottom: 1mm; }
                  .pledge-no { font-size: 8pt; font-weight: bold; }
                  .reprint-badge { 
                    display: block; text-align: center; font-size: 7.5pt; font-weight: 900; 
                    color: #000; letter-spacing: 1px; text-transform: uppercase; padding-top: 1mm;
                  }
                  .remark-line { 
                    text-align: center; font-size: 8pt; font-weight: bold; text-transform: uppercase; 
                    color: #000; width: 100%; border-top: 0.1mm dashed #ccc; padding-top: 1mm; margin-top: 0.5mm;
                  }
                  .category { font-size: 7pt; font-weight: 600; text-transform: uppercase; color: #333; }
                  .barcode-section { text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 1mm 2mm; width: 100%; }
                  .barcode-img { max-width: 36mm; width: 36mm; height: 14mm; object-fit: contain; margin: 0 auto; }
                  .footer-row { padding-top: 1mm; padding-bottom: 0.5mm; font-size: 7.5pt; font-weight: bold; flex-direction: column; text-align: center; display: flex; justify-content: center; align-items: center; width: 100%; }
                  .storage-loc { font-weight: 600; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; width: 100%; }
                </style>
              </head>
              <body>
                <div class="labels-wrapper">
                  <div class="label">
                    <div class="header-row">
                      <span class="pledge-no">${pledgeNo}</span>
                      <span class="category">${displayCategory}</span>
                    </div>
                    <div class="barcode-section">
                      ${barcodeImage ? `<img class="barcode-img" src="${barcodeImage}" alt="barcode" onerror="this.style.display='none'" />` : ""}
                    </div>
                    <div class="footer-row">
                      ${storageLocation ? `<div class="storage-loc">${storageLocation}</div>` : `<div>${data.data.purity || "916"}</div>`}
                      <div>${parseFloat(totalWeight).toFixed(2)}g</div>
                    </div>
                    <div class="reprint-badge">${badgeText}</div>
                    ${remarkText ? `<div class="remark-line">${remarkText}</div>` : ""}
                  </div>
                </div>
                <script>
                  window.onload = function() { window.print(); };
                  window.onafterprint = function() { window.close(); };
                <\/script>
              </body>
              </html>
            `);
            barcodeWindow.document.close();
          } else {
            dispatch(
              addToast({
                type: "warning",
                title: "Popup Blocked",
                message: "Please allow popups for this site to print.",
              }),
            );
          }
        } else {
          throw new Error("Invalid barcode data from server");
        }
      } else {
        throw new Error("Failed to fetch barcode sticker");
      }
    } catch (error) {
      console.error("Barcode sticker print error:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: error.message || "Failed to generate barcode sticker",
        }),
      );
    } finally {
      setPrintingBarcodeId(null);
    }
  };

  // Handle PDF download - downloads pre-printed A5 PDF directly
  const handleDownloadPdf = async (pledge, e) => {
    if (e) e.stopPropagation();
    const token = getToken();
    if (!token) {
      dispatch(addToast({ type: "error", title: "Error", message: "Please login again" }));
      return;
    }

    setPdfDownloadingId(pledge.id);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

      // Determine the correct PDF endpoint based on pledge status
      let pdfUrl;
      let filename;
      if (pledge.status === "redeemed" && pledge.latestRedemptionId) {
        pdfUrl = `${apiUrl}/print/pdf/redemption/${pledge.latestRedemptionId}`;
        filename = `Redemption-Receipt-${pledge.receiptNo || pledge.latestRedemptionId}.pdf`;
      } else if (pledge.renewalCount > 0 && pledge.latestRenewalId) {
        pdfUrl = `${apiUrl}/print/pdf/renewal/${pledge.latestRenewalId}`;
        filename = `Renewal-Receipt-${pledge.receiptNo || pledge.latestRenewalId}.pdf`;
      } else {
        pdfUrl = `${apiUrl}/print/pdf/pledge/${pledge.id}`;
        filename = `Receipt-${pledge.receiptNo || pledge.id}.pdf`;
      }

      // Include filename in URL path so browser uses it for download
      const downloadUrl = `${pdfUrl}/${filename}?token=${encodeURIComponent(token)}`;
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = downloadUrl;
      document.body.appendChild(iframe);
      setTimeout(() => { try { document.body.removeChild(iframe); } catch (e) { } }, 60000);

      dispatch(addToast({ type: "success", title: "Downloaded", message: "PDF download started" }));
    } catch (error) {
      console.error("PDF download error:", error);
      dispatch(addToast({ type: "error", title: "Error", message: error.message || "Failed to download PDF" }));
    } finally {
      setPdfDownloadingId(null);
    }
  };

  // Handle export to CSV
  const handleExport = () => {
    if (filteredPledges.length === 0) {
      dispatch(
        addToast({
          type: "warning",
          title: "No Data",
          message: "No pledges to export",
        }),
      );
      return;
    }

    // CSV headers
    const headers = [
      "Receipt No",
      "Pledge No",
      "Customer Name",
      "IC Number",
      "Phone",
      "Items",
      "Total Weight (g)",
      "Gross Value (RM)",
      "Deductions (RM)",
      "Net Value (RM)",
      "Loan %",
      "Loan Amount (RM)",
      "Interest Rate (%)",
      "Pledge Date",
      "Due Date",
      "Status",
      "Renewals",
    ];

    // CSV rows
    const rows = filteredPledges.map((pledge) => [
      pledge.receiptNo || pledge.pledgeNo,
      pledge.pledgeNo,
      pledge.customerName,
      pledge.customerIC,
      pledge.customerPhone,
      pledge.itemsCount,
      pledge.totalWeight.toFixed(3),
      pledge.grossValue.toFixed(2),
      pledge.totalDeduction.toFixed(2),
      pledge.netValue.toFixed(2),
      pledge.loanPercentage,
      pledge.loanAmount.toFixed(2),
      pledge.interestRate,
      pledge.pledgeDate,
      pledge.dueDate,
      pledge.status,
      pledge.renewalCount,
    ]);

    // Build CSV content
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((cell) => {
            // Escape cells containing commas or quotes
            const cellStr = String(cell ?? "");
            if (
              cellStr.includes(",") ||
              cellStr.includes('"') ||
              cellStr.includes("\n")
            ) {
              return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
          })
          .join(","),
      ),
    ].join("\n");

    // Create and download file
    const blob = new Blob(["\ufeff" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pledges-export-${new Date().toISOString().split("T")[0]
      }.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    dispatch(
      addToast({
        type: "success",
        title: "Exported",
        message: `${filteredPledges.length} pledges exported to CSV`,
      }),
    );
  };

  // Handle cancel pledge - Opens modal
  const openCancelModal = (pledge, e) => {
    if (e) e.stopPropagation();
    setCancellingPledge(pledge);
    setCancelReason("");
    setCancelNotes("");
    setShowCancelModal(true);
  };

  // Confirm cancellation with reason
  const handleConfirmCancel = async () => {
    if (!cancelReason) {
      dispatch(
        addToast({
          type: "error",
          title: "Required",
          message: "Please select a cancellation reason",
        }),
      );
      return;
    }

    setCancelling(true);

    try {
      const reasonText =
        cancelReason === "Other" && cancelNotes
          ? `Other: ${cancelNotes}`
          : cancelReason;

      const response = await pledgeService.cancel(cancellingPledge.id, {
        reason: reasonText,
        notes: cancelNotes,
      });

      if (response.success) {
        dispatch(
          addToast({
            type: "success",
            title: "Cancelled",
            message: `Pledge ${cancellingPledge.pledgeNo || cancellingPledge.receiptNo
              } has been cancelled`,
          }),
        );
        setShowCancelModal(false);
        setCancellingPledge(null);
        fetchPledges(true); // Refresh the list
      } else {
        throw new Error(response.message || "Failed to cancel");
      }
    } catch (error) {
      console.error("Cancel error:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: error.message || "Failed to cancel pledge",
        }),
      );
    } finally {
      setCancelling(false);
    }
  };
  // Calculate stats
  const stats = {
    total: pledges.length,
    active: pledges.filter((p) => p.status === "active").length,
    overdue: pledges.filter((p) => p.status === "overdue").length,
    totalValue: pledges
      .filter((p) => p.status === "active" || p.status === "overdue")
      .reduce((sum, p) => sum + (p.loanAmount || 0), 0),
    redeemed: pledges.filter((p) => p.status === "redeemed").length,
  };

  // Filter and sort pledges
  const filteredPledges = pledges
    .filter((pledge) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchId =
          pledge.pledgeNo?.toLowerCase().includes(query) ||
          pledge.receiptNo?.toLowerCase().includes(query) ||
          pledge.latestRedemptionNo?.toLowerCase().includes(query);
        const matchName = pledge.customerName?.toLowerCase().includes(query);
        const matchIC = pledge.customerIC
          ?.replace(/[-\s]/g, "")
          .includes(query.replace(/[-\s]/g, ""));
        if (!matchId && !matchName && !matchIC) return false;
      }

      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "due_soon") {
          if (pledge.status !== "active") return false;
          const due = new Date(pledge.dueDate);
          const now = new Date();
          const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
          if (diffDays > 7 || diffDays < 0) return false;
        } else if (pledge.status !== statusFilter) {
          return false;
        }
      }

      // Date filter (From/To)
      if (dateFrom || dateTo) {
        const pledgeDate = new Date(pledge.pledgeDate || pledge.createdAt);
        pledgeDate.setHours(0, 0, 0, 0);

        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (pledgeDate < fromDate) return false;
        }

        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          if (pledgeDate > toDate) return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt) - new Date(a.createdAt);
        case "oldest":
          return new Date(a.createdAt) - new Date(b.createdAt);
        case "amount-high":
          return (b.loanAmount || 0) - (a.loanAmount || 0);
        case "amount-low":
          return (a.loanAmount || 0) - (b.loanAmount || 0);
        case "due-soon":
          return new Date(a.dueDate) - new Date(b.dueDate);
        default:
          return 0;
      }
    });

  // Calculate days until due
  const getDaysUntilDue = (dueDate) => {
    const now = new Date();
    const due = new Date(dueDate);
    return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
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
      title="All Pledges"
      subtitle="View and manage all pledge tickets"
      actions={
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            leftIcon={RefreshCw}
            onClick={() => fetchPledges(true)}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
          <Button variant="outline" leftIcon={Download} onClick={handleExport}>
            Export
          </Button>
          {canCreate && (
            <Button
              variant="accent"
              leftIcon={Plus}
              onClick={() => navigate("/pledges/new")}
            >
              New Pledge
            </Button>
          )}
        </div>
      }
    >
      {/* Stats Cards */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-zinc-100">
                <Package className="w-5 h-5 text-zinc-600" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Total Pledges</p>
                <p className="text-xl font-bold text-zinc-800">{stats.total}</p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Active</p>
                <p className="text-xl font-bold text-emerald-600">
                  {stats.active}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Overdue</p>
                <p className="text-xl font-bold text-red-600">
                  {stats.overdue}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} className="col-span-2">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <DollarSign className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Total Outstanding</p>
                <p className="text-xl font-bold text-amber-600">
                  {formatCurrency(stats.totalValue)}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[250px]">
            <Input
              placeholder="Search by ticket , customer name, or IC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={Search}
            />
          </div>

          {/* Status Filter */}
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "all", label: "All Status" },
              { value: "active", label: "Active" },
              { value: "overdue", label: "Overdue" },
              { value: "redeemed", label: "Redeemed" },
              { value: "due_soon", label: "7 Days" },
              // { value: "forfeited", label: "Forfeited" },
              // { value: "cancelled", label: "Cancelled" },
            ]}
            className="w-40"
          />

          {/* Date Filter - From/To */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-zinc-400" />
            <span className="text-sm text-zinc-500">From:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <span className="text-sm text-zinc-500">To:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            {(dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                <XCircle className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Sort */}
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            options={[
              { value: "newest", label: "Newest First" },
              { value: "oldest", label: "Oldest First" },
              { value: "amount-high", label: "Amount: High to Low" },
              { value: "amount-low", label: "Amount: Low to High" },
              { value: "due-soon", label: "Due Soon" },
            ]}
            className="w-44"
          />
        </div>
      </Card>

      {/* Pledges Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="text-left p-4 text-sm font-semibold text-zinc-600">
                  TICKET
                </th>
                <th className="text-left p-4 text-sm font-semibold text-zinc-600">
                  CUSTOMER
                </th>
                <th className="text-left p-4 text-sm font-semibold text-zinc-600">
                  ITEMS
                </th>
                <th className="text-right p-4 text-sm font-semibold text-zinc-600">
                  LOAN AMOUNT
                </th>
                <th className="text-left p-4 text-sm font-semibold text-zinc-600">
                  DUE DATE
                </th>
                <th className="text-left p-4 text-sm font-semibold text-zinc-600">
                  STATUS
                </th>
                <th className="text-center p-4 text-sm font-semibold text-zinc-600">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center">
                    <div className="flex items-center justify-center gap-2 text-zinc-500">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Loading pledges...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredPledges.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-zinc-500">
                    <Package className="w-12 h-12 mx-auto mb-2 text-zinc-300" />
                    <p>No pledges found</p>
                    <Button
                      variant="link"
                      className="mt-2"
                      onClick={() => navigate("/pledges/new")}
                    >
                      Create your first pledge
                    </Button>
                  </td>
                </tr>
              ) : (
                filteredPledges.map((pledge) => {
                  const statusConf =
                    statusConfig[pledge.status] || statusConfig.active;
                  const StatusIcon = statusConf.icon;
                  const daysUntilDue = getDaysUntilDue(pledge.dueDate);

                  return (
                    <tr
                      key={pledge.id}
                      className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/pledges/${pledge.id}`)}
                    >
                      {/* Ticket # */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-amber-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-800">
                              {pledge.receiptNo}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {formatDate(
                                pledge.pledgeDate || pledge.createdAt,
                              )}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {pledge.customerPhoto ? (
                            <img
                              src={getStorageUrl(pledge.customerPhoto)}
                              alt={pledge.customerName}
                              className="w-8 h-8 rounded-full object-cover border border-zinc-200"
                              onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex'; }}
                            />
                          ) : null}
                          <div
                            className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-sm"
                            style={{ display: pledge.customerPhoto ? 'none' : 'flex' }}
                          >
                            {pledge.customerName?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="font-medium text-zinc-800">
                              {pledge.customerName}
                            </p>
                            <p className="text-xs text-zinc-500 font-mono">
                              {formatIC(pledge.customerIC)}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Items */}
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Scale className="w-4 h-4 text-zinc-400" />
                          <span className="text-zinc-600">
                            {pledge.itemsCount || pledge.items?.length || 0}{" "}
                            items
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500">
                          ({pledge.totalWeight?.toFixed(3) || "0.000"}g)
                        </p>
                      </td>

                      {/* Loan Amount */}
                      <td className="p-4 text-right">
                        <span className="font-semibold text-zinc-800">
                          {formatCurrency(pledge.loanAmount)}
                        </span>
                      </td>

                      {/* Due Date */}
                      <td className="p-4">
                        <span className="text-zinc-600 text-sm">
                          {formatDate(pledge.dueDate)}
                        </span>
                        {pledge.status === "active" && (
                          <p
                            className={cn(
                              "text-xs mt-0.5",
                              daysUntilDue <= 7
                                ? "text-red-500"
                                : daysUntilDue <= 30
                                  ? "text-amber-500"
                                  : "text-zinc-400",
                            )}
                          >
                            {daysUntilDue > 0
                              ? `${daysUntilDue} days left`
                              : "Due today"}
                          </p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <Badge variant={statusConf.variant}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusConf.label}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1">
                          {/* View Button */}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/pledges/${pledge.id}`);
                            }}
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>

                          {/* Print Pre-Printed Form with Data */}
                          {canPrint && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={printingId === pledge.id}
                              onClick={(e) => handleActionWithPasskey('print', { id: pledge.id }, e)}
                              title="A5 Landscape — Pre-Printed Form with Data"
                            >
                              {printingId === pledge.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <FileText className="w-4 h-4" />
                              )}
                            </Button>
                          )}

                          {/* Reprint - Pre-Printed Form with Data */}
                          {canPrint && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={reprintingId === pledge.id}
                              onClick={(e) => handleActionWithPasskey('reprint', { id: pledge.id }, e)}
                              title="A5 Landscape — Pre-Printed Form Reprint"
                              className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                            >
                              {reprintingId === pledge.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                          )}

                          {/* Reprint Barcode Button */}
                          {canPrint && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={printingBarcodeId === pledge.id}
                              onClick={(e) => handleActionWithPasskey('barcode', { pledge }, e)}
                              title="Reprint Barcode Sticker"
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            >
                              {printingBarcodeId === pledge.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RotateCcw className="w-4 h-4" />
                              )}
                            </Button>
                          )}

                          {/* PDF Download Button */}
                          {canPrint && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={pdfDownloadingId === pledge.id}
                              onClick={(e) => handleActionWithPasskey('download', { pledge }, e)}
                              title="Download PDF Receipt (A5 Landscape)"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              {pdfDownloadingId === pledge.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <FileDown className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Info */}
        {!loading && filteredPledges.length > 0 && (
          <div className="p-4 border-t border-zinc-200 flex items-center justify-between">
            <p className="text-sm text-zinc-500">
              Showing {filteredPledges.length} of {pledges.length} pledges
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
      {/* Cancel Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => {
          setShowCancelModal(false);
          setCancellingPledge(null);
        }}
        title="Cancel Pledge"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">
              Are you sure you want to cancel pledge{" "}
              {cancellingPledge?.receiptNo || cancellingPledge?.pledgeNo}?
            </p>
            <p className="text-red-600 text-sm mt-1">
              This action will mark the pledge as cancelled and release the
              storage slot. This cannot be undone.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Reason for Cancellation <span className="text-red-500">*</span>
            </label>
            <select
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="">Select a reason...</option>
              {cancelReasons.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </div>

          {(cancelReason === "Other" || cancelReason) && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                {cancelReason === "Other"
                  ? "Please specify (required)"
                  : "Additional Notes (optional)"}
              </label>
              <textarea
                value={cancelNotes}
                onChange={(e) => setCancelNotes(e.target.value)}
                rows={3}
                placeholder={
                  cancelReason === "Other"
                    ? "Please provide details..."
                    : "Any additional notes..."
                }
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setShowCancelModal(false);
                setCancellingPledge(null);
              }}
            >
              Keep Pledge
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmCancel}
              disabled={
                !cancelReason ||
                (cancelReason === "Other" && !cancelNotes) ||
                cancelling
              }
              leftIcon={cancelling ? Loader2 : XCircle}
              className={cancelling ? "[&_svg]:animate-spin" : ""}
            >
              {cancelling ? "Cancelling..." : "Confirm Cancel"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Passkey Modal */}
      <PasskeyModal
        isOpen={passkeyModalOpen}
        onClose={() => {
          setPasskeyModalOpen(false);
          setPendingAction(null);
        }}
        onSuccess={executePendingAction}
        title="Verification Required"
        message="Please enter your 6-digit passkey to authorize this action."
      />

      {/* Reprint Reason Modal */}
      <Modal
        isOpen={showReprintReasonModal}
        onClose={() => setShowReprintReasonModal(false)}
        title="Reprint Barcode – Select Reason"
        size="md"
      >
        <div className="space-y-5">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <RotateCcw className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">
                Why are you reprinting this barcode?
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                The reason will be printed on the barcode sticker.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              Select Reason
            </label>
            <div className="relative">
              <select
                value={reprintReason}
                onChange={(e) => {
                  setReprintReason(e.target.value);
                  if (e.target.value !== "__custom__") setCustomReprintReason("");
                }}
                className="w-full px-3 py-2.5 border border-zinc-300 rounded-lg bg-white text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 appearance-none cursor-pointer"
              >
                <option value="">— Choose a reason —</option>
                {reprintReasons.map((r) => (
                  <option key={r.id} value={r.reason}>{r.reason}</option>
                ))}
                <option value="__custom__">✏️ Enter Custom Reason...</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            </div>
          </div>

          {reprintReason === "__custom__" && (
            <div>
              <label className="flex justify-between text-sm font-medium text-zinc-700 mb-1.5">
                <span>Custom Reason</span>
                <span className={cn("text-xs", customReprintReason.length >= 20 ? "text-red-500" : "text-zinc-400")}>
                  {customReprintReason.length}/20
                </span>
              </label>
              <Input
                value={customReprintReason}
                onChange={(e) => setCustomReprintReason(e.target.value)}
                placeholder="Enter your custom reason..."
                autoFocus
                maxLength={25}
              />
              <p className="text-xs text-zinc-500 mt-1">Max 25 characters</p>
            </div>
          )}

          {((reprintReason && reprintReason !== "__custom__") || customReprintReason) && (
            <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg">
              <p className="text-xs text-zinc-500 mb-1">Will be printed on sticker:</p>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-bold text-zinc-800 uppercase">
                  {reprintReason === "__custom__" ? customReprintReason : (reprintReason || "-")}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" fullWidth onClick={() => setShowReprintReasonModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              leftIcon={RotateCcw}
              className="bg-red-600 hover:bg-red-700"
              loading={printingBarcodeId === reprintReasonPledge?.id}
              disabled={
                (!reprintReason || (reprintReason === "__custom__" && !customReprintReason.trim())) ||
                printingBarcodeId === reprintReasonPledge?.id
              }
              onClick={() => {
                const reasonText = reprintReason === "__custom__" ? customReprintReason.trim() : reprintReason;
                setShowReprintReasonModal(false);
                if (reprintReasonPledge) handlePrintBarcode(reprintReasonPledge, null, reasonText);
              }}
            >
              Reprint Barcode
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
}
