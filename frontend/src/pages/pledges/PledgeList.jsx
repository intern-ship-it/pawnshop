import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { setPledges, setSelectedPledge } from "@/features/pledges/pledgesSlice";
import { addToast } from "@/features/ui/uiSlice";
import { pledgeService } from "@/services";
import { getToken } from "@/services/api";
import { formatCurrency, formatDate, formatIC } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { Card, Button, Input, Select, Badge, Modal } from "@/components/common";
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
  TrendingUp,
  Scale,
  Loader2,
  Printer,
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

  // Cancel Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingPledge, setCancellingPledge] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelNotes, setCancelNotes] = useState("");
  const [cancelling, setCancelling] = useState(false);

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

      const response = await pledgeService.getAll();
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
              📄 Pre-Printed Form with Data - ${pledgeNo}
            </p>
            <p style="margin-bottom: 15px; font-size: 14px; color: #856404;">
              This shows the data overlay on a pre-printed form template
            </p>
            <button class="print-btn" onclick="window.print()">🖨️ Print</button>
            <button class="print-btn close-btn" onclick="window.close()">✖ Close</button>
          </div>
          
          <div class="print-container">
            ${frontHtml}
          </div>

          ${
            backHtml
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

  // Handle dot matrix print receipt
  const handleDotPrint = async (pledgeId, e) => {
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

    setDotPrintingId(pledgeId);

    try {
      const apiUrl =
        import.meta.env.VITE_API_URL || "http://localhost:8000/api";
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

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to generate dot matrix receipt",
        );
      }

      // Extract receipt and terms HTML from JSON response
      const receiptHtml = data.data?.receipt_text || "";
      const termsHtml = data.data?.terms_text || "";
      const pledgeNo = data.data?.pledge_no || "";

      if (!receiptHtml) {
        throw new Error("No receipt content received");
      }

      // Open styled print window with print controls
      const printWindow = window.open("", "_blank", "width=950,height=800");
      if (!printWindow) {
        dispatch(
          addToast({
            type: "error",
            title: "Popup Blocked",
            message: "Please allow popups to print receipts",
          }),
        );
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Resit Pajak Gadai - ${pledgeNo}</title>
          <style>
            @page { size: A5 landscape; margin: 3mm; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .print-controls { display: none !important; }
              .preview-container.hidden-for-print { display: none !important; }
              .page-label { display: none !important; }
            }
            
            * { box-sizing: border-box; }
            body { margin: 0; padding: 0; background: #1f2937; font-family: Arial, sans-serif; min-height: 100vh; }
            
            .print-controls {
              background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
              padding: 20px; 
              margin: 10px;
              border-radius: 12px;
              box-shadow: 0 4px 15px rgba(0,0,0,0.3);
              text-align: center;
            }
            .print-controls h2 { color: white; margin: 0 0 10px 0; font-size: 16px; }
            .print-controls p { color: rgba(255,255,255,0.7); margin: 5px 0; font-size: 12px; }
            
            .btn-row { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
            .print-btn {
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: #fff; border: none; padding: 14px 30px; font-size: 15px;
              cursor: pointer; border-radius: 8px; font-weight: bold;
              display: flex; align-items: center; gap: 8px;
              transition: transform 0.2s, box-shadow 0.2s;
            }
            .print-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(16,185,129,0.4); }
            .print-btn.secondary {
              background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
            }
            .close-btn {
              background: #6b7280; color: white; border: none; padding: 14px 20px;
              font-size: 14px; cursor: pointer; border-radius: 8px;
            }
            
            .info-note {
              background: rgba(16, 185, 129, 0.2);
              border: 1px solid rgba(16, 185, 129, 0.5);
              border-radius: 8px;
              padding: 10px 15px;
              margin-top: 12px;
              color: #a7f3d0;
              font-size: 12px;
            }
            
            .printer-note { font-size: 11px; color: #9ca3af; margin-top: 12px; text-align: center; }
            .printer-note strong { color: #fbbf24; }
            
            .preview-container {
              max-width: 210mm; margin: 15px auto; background: white;
              box-shadow: 0 4px 20px rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden;
            }
            .preview-container.hidden-for-print { display: none; }
            .page-label {
              background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
              color: white; padding: 10px 15px; font-size: 12px; font-weight: bold;
              display: flex; justify-content: space-between; align-items: center;
            }
            .page-label.terms { background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%); }
            .page-label .badge { background: rgba(255,255,255,0.2); padding: 3px 10px; border-radius: 10px; font-size: 10px; }
          </style>
        </head>
        <body>
          <div class="print-controls">
            <h2>📄 Cetak Resit DEPAN Sahaja / Print FRONT Only</h2>
            <p>Kertas dengan Terma & Syarat sudah dicetak sebelum ini</p>
            <p>Paper with Terms & Conditions already pre-printed</p>
            
            <div class="btn-row">
              <button class="print-btn" onclick="printFront()">
                🖨️ Cetak DEPAN / Print FRONT
              </button>
              ${
                termsHtml
                  ? `
              <button class="print-btn secondary" onclick="toggleTerms()">
                📋 Tunjuk Terma / Show Terms
              </button>
              `
                  : ""
              }
              <button class="close-btn" onclick="window.close()">✕ Tutup / Close</button>
            </div>
            
            <div class="info-note">
              💡 <strong>Tip:</strong> Gunakan kertas yang sudah dicetak Terma & Syarat di belakang.
              <br>Use paper already printed with Terms & Conditions on the back.
            </div>
            
            <p class="printer-note">
              Printer: <strong>Epson LQ-310</strong> | Kertas: <strong>A5 Landscape</strong> | Salinan: <strong>SALINAN PELANGGAN</strong>
            </p>
          </div>
          
          <div class="preview-container" id="frontPage">
            <div class="page-label">
              <span>📄 HALAMAN DEPAN / FRONT - RESIT PAJAK GADAI</span>
              <span class="badge">SALINAN PELANGGAN</span>
            </div>
            ${receiptHtml}
          </div>
          
          ${
            termsHtml
              ? `
          <div class="preview-container hidden-for-print" id="backPage">
            <div class="page-label terms">
              <span>📋 HALAMAN BELAKANG / BACK - TERMA & SYARAT (Tersembunyi / Hidden)</span>
              <span class="badge">SALINAN PELANGGAN</span>
            </div>
            ${termsHtml}
          </div>
          `
              : ""
          }
          
          <script>
            function printFront() {
              document.getElementById('frontPage').classList.remove('hidden-for-print');
              if (document.getElementById('backPage')) {
                document.getElementById('backPage').classList.add('hidden-for-print');
              }
              window.print();
            }
            
            function toggleTerms() {
              const backPage = document.getElementById('backPage');
              if (backPage) {
                backPage.classList.toggle('hidden-for-print');
                const btn = event.target;
                if (backPage.classList.contains('hidden-for-print')) {
                  btn.textContent = '📋 Tunjuk Terma / Show Terms';
                } else {
                  btn.textContent = '📋 Sembunyi Terma / Hide Terms';
                }
              }
            }
            
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
          message: "Dot matrix receipt generated",
        }),
      );
    } catch (error) {
      console.error("Dot print error:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: error.message || "Failed to print dot matrix receipt",
        }),
      );
    } finally {
      setDotPrintingId(null);
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
    link.download = `pledges-export-${
      new Date().toISOString().split("T")[0]
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
            message: `Pledge ${
              cancellingPledge.pledgeNo || cancellingPledge.receiptNo
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
          pledge.receiptNo?.toLowerCase().includes(query);
        const matchName = pledge.customerName?.toLowerCase().includes(query);
        const matchIC = pledge.customerIC
          ?.replace(/[-\s]/g, "")
          .includes(query.replace(/[-\s]/g, ""));
        if (!matchId && !matchName && !matchIC) return false;
      }

      // Status filter
      if (statusFilter !== "all" && pledge.status !== statusFilter)
        return false;

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
              placeholder="Search by ticket #, customer name, or IC..."
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
              { value: "forfeited", label: "Forfeited" },
              { value: "cancelled", label: "Cancelled" },
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
                  TICKET #
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
                          <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center">
                            <User className="w-4 h-4 text-zinc-500" />
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
                              onClick={(e) => handlePrint(pledge.id, e)}
                              title="Print Pre-Printed Form with Data"
                            >
                              {printingId === pledge.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <FileText className="w-4 h-4" />
                              )}
                            </Button>
                          )}

                          {/* Dot Matrix Print Button */}
                          {canPrint && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={dotPrintingId === pledge.id}
                              onClick={(e) => handleDotPrint(pledge.id, e)}
                              title="Print Dot Matrix Receipt"
                              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            >
                              {dotPrintingId === pledge.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Printer className="w-4 h-4" />
                              )}
                            </Button>
                          )}

                          {/* Cancel Button - Only for active pledges with no renewals */}
                          {canDelete &&
                            pledge.status === "active" &&
                            pledge.renewalCount === 0 && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={(e) => openCancelModal(pledge, e)}
                                title="Cancel Pledge"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <XCircle className="w-4 h-4" />
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
    </PageWrapper>
  );
}
