import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { useAppDispatch } from "@/app/hooks";
import { setSelectedPledge } from "@/features/pledges/pledgesSlice";
import { addToast } from "@/features/ui/uiSlice";
import { pledgeService } from "@/services";
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
import { Card, Button, Badge, Modal, Input } from "@/components/common";
import {
  ArrowLeft,
  User,
  Package,
  Calendar,
  Clock,
  DollarSign,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Printer,
  MessageSquare,
  MapPin,
  Scale,
  Gem,
  CreditCard,
  Phone,
  FileText,
  Eye,
  Download,
  Trash2,
  Edit,
  QrCode,
  Image,
  X,
  Wallet,
  Building2,
  TrendingUp,
  History,
  AlertCircle,
  Info,
  Loader2,
} from "lucide-react";

// Status config
const statusConfig = {
  active: { label: "Active", color: "emerald", icon: CheckCircle },
  overdue: { label: "Overdue", color: "red", icon: AlertTriangle },
  redeemed: { label: "Redeemed", color: "blue", icon: DollarSign },
  forfeited: { label: "Forfeited", color: "amber", icon: XCircle },
  auctioned: { label: "Auctioned", color: "zinc", icon: Package },
};

// Tabs
const tabs = [
  { id: "overview", label: "Overview", icon: FileText },
  { id: "items", label: "Items", icon: Package },
  { id: "history", label: "History", icon: History },
];

export default function PledgeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // State
  const [pledge, setPledge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showRackModal, setShowRackModal] = useState(false);
  const [rackLocation, setRackLocation] = useState("");
  const [interestBreakdown, setInterestBreakdown] = useState(null);

  // Fetch pledge from API
  useEffect(() => {
    const fetchPledge = async () => {
      try {
        setLoading(true);
        const response = await pledgeService.getById(id);
        const responseData = response.data?.data || response.data;

        // Backend returns { pledge: {...}, interest_breakdown: [...], ... }
        const data = responseData?.pledge || responseData;

        // Transform API response to frontend format
        const transformedPledge = {
          id: data.id,
          pledgeNo: data.pledge_no,
          receiptNo: data.receipt_no,
          customerId: data.customer_id,
          customerName: data.customer?.name || "Unknown",
          customerIC: data.customer?.ic_number || "",
          customerPhone: (data.customer?.phone || "").startsWith("+")
            ? data.customer?.phone || ""
            : data.customer?.country_code
              ? `${data.customer.country_code.startsWith("+") ? "" : "+"}${data.customer.country_code} ${data.customer?.phone || ""}`
              : data.customer?.phone || "",
          customerAddress: data.customer?.address || "",
          totalWeight: parseFloat(data.total_weight) || 0,
          grossValue: parseFloat(data.gross_value) || 0,
          totalDeduction: parseFloat(data.total_deduction) || 0,
          netValue: parseFloat(data.net_value) || 0,
          loanPercentage: parseFloat(data.loan_percentage) || 0,
          loanAmount: parseFloat(data.loan_amount) || 0,
          handlingFee: parseFloat(data.handling_fee) || 0,
          payoutAmount: parseFloat(data.payout_amount) || 0,
          interestRate: parseFloat(data.interest_rate) || 0.5,
          interestRateExtended: parseFloat(data.interest_rate_extended) || 1.5,
          interestRateOverdue: parseFloat(data.interest_rate_overdue) || 2.0,
          pledgeDate: data.pledge_date,
          dueDate: data.due_date,
          graceEndDate: data.grace_end_date,
          status: data.status,
          renewalCount: data.renewal_count || 0,
          goldPrice999: parseFloat(data.gold_price_999) || 0,
          goldPrice916: parseFloat(data.gold_price_916) || 0,
          goldPrice875: parseFloat(data.gold_price_875) || 0,
          goldPrice750: parseFloat(data.gold_price_750) || 0,
          items: (data.items || []).map((item) => ({
            id: item.id,
            itemNo: item.item_no,
            barcode: item.barcode,
            category:
              item.category?.name_en || item.category?.name || "Unknown",
            categoryMs: item.category?.name_ms || "",
            purity: item.purity?.code || "",
            purityName: item.purity?.name || "",
            grossWeight: parseFloat(item.gross_weight) || 0,
            netWeight: parseFloat(item.net_weight) || 0,
            stoneDeductionType: item.stone_deduction_type,
            stoneDeductionValue: parseFloat(item.stone_deduction_value) || 0,
            pricePerGram: parseFloat(item.price_per_gram) || 0,
            grossValue: parseFloat(item.gross_value) || 0,
            deductionAmount: parseFloat(item.deduction_amount) || 0,
            netValue: parseFloat(item.net_value) || 0,
            description: item.description || "",
            photo: item.photo,
            vaultId: item.vault_id,
            boxId: item.box_id,
            slotId: item.slot_id,
            location:
              item.location_string ||
              (item.vault
                ? `${item.vault.code} / Box ${item.box?.box_number} / Slot ${item.slot?.slot_number}`
                : "Not Assigned"),
          })),
          payments: (data.payments || []).map((payment) => ({
            id: payment.id,
            totalAmount: parseFloat(payment.total_amount) || 0,
            cashAmount: parseFloat(payment.cash_amount) || 0,
            transferAmount: parseFloat(payment.transfer_amount) || 0,
            bankName: payment.bank?.name || "",
            referenceNo: payment.reference_no,
            paymentMethod: payment.payment_method,
            paymentDate: payment.payment_date,
          })),
          renewals: (data.renewals || []).map((renewal) => ({
            id: renewal.id,
            renewalNo: renewal.renewal_no,
            renewalDate: renewal.created_at,
            previousDueDate: renewal.previous_due_date,
            newDueDate: renewal.new_due_date,
            interestAmount: parseFloat(renewal.interest_amount) || 0,
            totalAmount: parseFloat(renewal.total_amount) || 0,
            renewalMonths: renewal.renewal_months || 1,
            paymentMethod: renewal.payment_method,
          })),
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          createdBy: data.created_by_user?.name || "",
        };

        setPledge(transformedPledge);
        dispatch(setSelectedPledge(transformedPledge));

        // Use interest breakdown from response if available
        if (responseData?.interest_breakdown) {
          setInterestBreakdown(responseData.interest_breakdown);
        } else {
          // Fetch interest breakdown separately as fallback
          try {
            const interestResponse =
              await pledgeService.getInterestBreakdown(id);
            setInterestBreakdown(
              interestResponse.data?.data || interestResponse.data,
            );
          } catch (err) {
            console.log("Interest breakdown not available");
          }
        }
      } catch (error) {
        console.error("Error fetching pledge:", error);
        dispatch(
          addToast({
            type: "error",
            title: "Error",
            message: error.response?.data?.message || "Failed to load pledge",
          }),
        );
        setPledge(null);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchPledge();
    }
  }, [id, dispatch]);

  // Calculate interest (fallback if API doesn't provide)
  const calculateInterest = () => {
    if (!pledge) return { months: 0, rate: 0, amount: 0, total: 0 };

    const createdDate = new Date(pledge.pledgeDate || pledge.createdAt);
    const now = new Date();
    const months = Math.max(
      1,
      Math.ceil((now - createdDate) / (1000 * 60 * 60 * 24 * 30)),
    );

    let totalInterest = 0;
    for (let i = 1; i <= months; i++) {
      const rate = i <= 6 ? pledge.interestRate : pledge.interestRateExtended;
      totalInterest += pledge.loanAmount * (rate / 100);
    }

    return {
      principal: pledge.loanAmount,
      interest: totalInterest,
      total: pledge.loanAmount + totalInterest,
      months,
      rate: months <= 6 ? pledge.interestRate : pledge.interestRateExtended,
    };
  };

  const interest = calculateInterest();

  // Handle print - downloads PDF from PrintController
  const handlePrint = async (copyType = "customer") => {
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
        import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

      const response = await fetch(
        `${apiUrl}/print/pledge-receipt/${pledge.id}`,
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

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      window.open(url, "_blank");

      setTimeout(() => window.URL.revokeObjectURL(url), 60000);

      dispatch(
        addToast({
          type: "success",
          title: "Receipt Generated",
          message: "PDF opened in new tab",
        }),
      );
    } catch (error) {
      console.error("Print error:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Print Failed",
          message: error.message || "Failed to generate receipt",
        }),
      );
    }
  };

  // Handle Styled Print (Dot Receipt) - opens HTML print window
  const handleStyledPrint = async (copyType = "customer") => {
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
        import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

      const response = await fetch(
        `${apiUrl}/print/dot-matrix/pledge-receipt/${pledge.id}`,
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

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to generate receipt");
      }

      const receiptHtml = data.data?.receipt_text || "";
      const termsHtml = data.data?.terms_text || "";

      // Open print window with styled receipt
      const printWindow = window.open("", "_blank", "width=950,height=750");
      if (!printWindow) {
        dispatch(
          addToast({
            type: "error",
            title: "Popup Blocked",
            message: "Please allow popups to print",
          }),
        );
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Resit Pajak Gadai - ${pledge.receiptNo}</title>
          <style>
            @page { size: A5 landscape; margin: 5mm; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .print-controls { display: none !important; }
              .page-break { page-break-before: always; }
              .preview-container { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
              .page-label { display: none !important; }
            }
            
            body { margin: 0; padding: 0; background: #e5e7eb; font-family: Arial, sans-serif; }
            
            .print-controls {
              background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
              padding: 15px 20px; text-align: center; position: sticky; top: 0; z-index: 100;
            }
            .print-btn {
              background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
              color: white; border: none; padding: 12px 25px; font-size: 14px;
              cursor: pointer; border-radius: 8px; font-weight: bold; margin: 0 5px;
            }
            .print-btn:hover { transform: translateY(-1px); }
            .print-btn.green { background: linear-gradient(135deg, #059669 0%, #047857 100%); }
            .close-btn {
              background: #6b7280; color: white; border: none; padding: 12px 20px;
              font-size: 14px; cursor: pointer; border-radius: 8px; margin-left: 10px;
            }
            .printer-note { font-size: 12px; color: #9ca3af; margin-top: 10px; }
            
            .preview-container {
              max-width: 210mm; margin: 20px auto; background: white;
              box-shadow: 0 4px 20px rgba(0,0,0,0.15); border-radius: 8px; overflow: hidden;
            }
            .page-label {
              background: linear-gradient(135deg, #1a4a7a 0%, #2563eb 100%);
              color: white; padding: 8px 15px; font-size: 12px; font-weight: bold;
            }
            .page-label.terms { background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%); }
          </style>
        </head>
        <body>
          <div class="print-controls">
            <button class="print-btn" onclick="window.print()">🖨️ Cetak / Print</button>
            <button class="print-btn green" onclick="window.print()">📄 Print Both Pages</button>
            <button class="close-btn" onclick="window.close()">✕ Tutup / Close</button>
            <p class="printer-note">Pilih printer: <strong>Any Printer</strong> | Saiz kertas: <strong>A5 Landscape</strong></p>
          </div>
          
          <div class="preview-container">
            <div class="page-label">📄 HALAMAN 1: RESIT / PAGE 1: RECEIPT</div>
            ${receiptHtml}
          </div>
          
          ${
            termsHtml
              ? `
          <div class="preview-container page-break" style="margin-top: 20px;">
            <div class="page-label terms">📋 HALAMAN 2: TERMA & SYARAT / PAGE 2: TERMS</div>
            ${termsHtml}
          </div>
          `
              : ""
          }
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();

      dispatch(
        addToast({
          type: "success",
          title: "Receipt Generated",
          message: `Styled ${copyType} receipt opened`,
        }),
      );
    } catch (error) {
      console.error("Styled print error:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Print Failed",
          message: error.message || "Failed to generate styled receipt",
        }),
      );
    }
  };

  // Handle WhatsApp
  const handleWhatsApp = async () => {
    try {
      const response = await pledgeService.sendWhatsApp(pledge.id);

      // Check for success from the response
      if (response.success === false || response.data?.success === false) {
        throw new Error(
          response.message ||
            response.data?.message ||
            "Failed to send WhatsApp",
        );
      }

      dispatch(
        addToast({
          type: "success",
          title: "WhatsApp",
          message: "Sent to customer",
        }),
      );
    } catch (error) {
      console.error("WhatsApp error:", error);

      // Extract the actual error message from response
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to send WhatsApp";

      // Check if it's a configuration issue
      if (
        errorMsg.includes("not configured") ||
        errorMsg.includes("not setup")
      ) {
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
    }
  };

  // Get days until due
  const getDaysUntilDue = () => {
    if (!pledge?.dueDate) return 0;
    const now = new Date();
    const due = new Date(pledge.dueDate);
    return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  };

  // Loading state
  if (loading) {
    return (
      <PageWrapper title="Pledge Details">
        <Card className="p-8">
          <div className="flex items-center justify-center gap-3 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading pledge details...</span>
          </div>
        </Card>
      </PageWrapper>
    );
  }

  // Not found state
  if (!pledge) {
    return (
      <PageWrapper title="Pledge Not Found">
        <Card className="p-8 text-center">
          <Package className="w-16 h-16 mx-auto mb-4 text-zinc-300" />
          <h2 className="text-xl font-semibold text-zinc-700 mb-2">
            Pledge Not Found
          </h2>
          <p className="text-zinc-500 mb-4">
            The pledge you're looking for doesn't exist.
          </p>
          <Button variant="primary" onClick={() => navigate("/pledges")}>
            Back to Pledges
          </Button>
        </Card>
      </PageWrapper>
    );
  }

  const status = statusConfig[pledge.status] || statusConfig.active;
  const StatusIcon = status.icon;
  const daysUntilDue = getDaysUntilDue();

  return (
    <PageWrapper
      title={
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate("/pledges")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span>Pledge {pledge.receiptNo}</span>
        </div>
      }
      actions={
        <div className="flex items-center gap-2">
          <div className="relative group">
            <Button
              variant="outline"
              leftIcon={Printer}
              onClick={() => handlePrint("customer")}
            >
              Print
            </Button>
            {/* Dropdown for print options */}
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-zinc-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <button
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-amber-50 rounded-t-lg flex items-center gap-2"
                onClick={() => handleStyledPrint("customer")}
              >
                <span>🧾</span> Customer Copy
              </button>
              <button
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-amber-50 rounded-b-lg flex items-center gap-2"
                onClick={() => handleStyledPrint("office")}
              >
                <span>🧾</span> Office Copy
              </button>
            </div>
          </div>
          <Button
            variant="outline"
            leftIcon={MessageSquare}
            onClick={handleWhatsApp}
          >
            WhatsApp
          </Button>
          {(pledge.status === "active" || pledge.status === "overdue") && (
            <>
              <Button
                variant="primary"
                leftIcon={RefreshCw}
                onClick={() => navigate("/renewals")}
              >
                Renew
              </Button>
              <Button
                variant="accent"
                leftIcon={DollarSign}
                onClick={() => navigate("/redemptions")}
              >
                Redeem
              </Button>
            </>
          )}
        </div>
      }
    >
      {/* Header Card */}
      <Card className="p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "w-16 h-16 rounded-xl flex items-center justify-center",
                `bg-${status.color}-100`,
              )}
            >
              <StatusIcon
                className={cn("w-8 h-8", `text-${status.color}-600`)}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-zinc-800">
                  {pledge.receiptNo}
                </h2>
                <Badge
                  variant={
                    status.color === "emerald"
                      ? "success"
                      : status.color === "red"
                        ? "error"
                        : "default"
                  }
                >
                  {status.label}
                </Badge>
              </div>
              <p className="text-zinc-500">
                Created {formatDate(pledge.pledgeDate || pledge.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-sm text-zinc-500">Loan Amount</p>
              <p className="text-2xl font-bold text-amber-600">
                {formatCurrency(pledge.loanAmount)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-zinc-500">Due Date</p>
              <p className="text-lg font-semibold text-zinc-800">
                {formatDate(pledge.dueDate)}
              </p>
              {pledge.status === "active" && (
                <p
                  className={cn(
                    "text-xs",
                    daysUntilDue <= 7
                      ? "text-red-500"
                      : daysUntilDue <= 30
                        ? "text-amber-500"
                        : "text-zinc-400",
                  )}
                >
                  {daysUntilDue > 0
                    ? `${daysUntilDue} days left`
                    : daysUntilDue === 0
                      ? "Due today"
                      : `${Math.abs(daysUntilDue)} days overdue`}
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-zinc-200 pb-2">
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                activeTab === tab.id
                  ? "bg-amber-100 text-amber-700"
                  : "text-zinc-500 hover:bg-zinc-100",
              )}
            >
              <TabIcon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "overview" && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Customer Info */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-zinc-400" />
                Customer
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                    <span className="text-lg font-semibold text-amber-600">
                      {pledge.customerName?.charAt(0) || "?"}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-800">
                      {pledge.customerName}
                    </p>
                    <p className="text-sm text-zinc-500 font-mono">
                      {formatIC(pledge.customerIC)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-zinc-600">
                  <Phone className="w-4 h-4 text-zinc-400" />
                  {formatPhone(pledge.customerPhone)}
                </div>
                {pledge.customerAddress && (
                  <div className="flex items-start gap-2 text-zinc-600">
                    <MapPin className="w-4 h-4 text-zinc-400 mt-0.5" />
                    <span className="text-sm">{pledge.customerAddress}</span>
                  </div>
                )}
              </div>
            </Card>

            {/* Loan Summary */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-zinc-400" />
                Loan Summary
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Principal</span>
                  <span className="font-semibold">
                    {formatCurrency(pledge.loanAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Interest Rate</span>
                  <span className="font-semibold">
                    {pledge.interestRate}% / month
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Current Interest</span>
                  <span className="font-semibold text-amber-600">
                    {formatCurrency(interest.interest)}
                  </span>
                </div>
                <div className="border-t border-zinc-200 pt-3 flex justify-between">
                  <span className="font-semibold text-zinc-700">
                    Total Payable
                  </span>
                  <span className="font-bold text-lg text-emerald-600">
                    {formatCurrency(interest.total)}
                  </span>
                </div>
              </div>
            </Card>

            {/* Item Summary */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                <Scale className="w-5 h-5 text-zinc-400" />
                Item Summary
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Total Items</span>
                  <span className="font-semibold">
                    {pledge.items?.length || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Total Weight</span>
                  <span className="font-semibold">
                    {pledge.totalWeight?.toFixed(3)}g
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Gross Value</span>
                  <span className="font-semibold">
                    {formatCurrency(pledge.grossValue)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Deductions</span>
                  <span className="font-semibold text-red-500">
                    -{formatCurrency(pledge.totalDeduction)}
                  </span>
                </div>
                <div className="border-t border-zinc-200 pt-3 flex justify-between">
                  <span className="font-semibold text-zinc-700">Net Value</span>
                  <span className="font-bold text-emerald-600">
                    {formatCurrency(pledge.netValue)}
                  </span>
                </div>
              </div>
            </Card>

            {/* Pledge Charges */}
            <Card className="p-6 lg:col-span-3">
              <h3 className="text-lg font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-zinc-400" />
                Pledge Charges & Payout
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-sm text-blue-600 font-medium">
                    Loan Amount
                  </p>
                  <p className="text-xl font-bold text-blue-700">
                    {formatCurrency(pledge.loanAmount)}
                  </p>
                  <p className="text-xs text-blue-500 mt-1">
                    {pledge.loanPercentage}% of Net Value
                  </p>
                </div>
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
                  <p className="text-sm text-amber-600 font-medium">
                    Handling Fee
                  </p>
                  <p className="text-xl font-bold text-amber-700">
                    {formatCurrency(pledge.handlingFee)}
                  </p>
                  <p className="text-xs text-amber-500 mt-1">Service charge</p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                  <p className="text-sm text-emerald-600 font-medium">
                    Payout Amount
                  </p>
                  <p className="text-xl font-bold text-emerald-700">
                    {formatCurrency(
                      pledge.payoutAmount ||
                        pledge.loanAmount - pledge.handlingFee,
                    )}
                  </p>
                  <p className="text-xs text-emerald-500 mt-1">
                    Amount paid to customer
                  </p>
                </div>
                <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-200">
                  <p className="text-sm text-zinc-600 font-medium">
                    Interest Rate
                  </p>
                  <p className="text-xl font-bold text-zinc-700">
                    {pledge.interestRate}%
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Per month (first 6 months)
                  </p>
                </div>
              </div>
            </Card>

            {/* Gold Prices Used */}
            <Card className="p-6 lg:col-span-3">
              <h3 className="text-lg font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-zinc-400" />
                Gold Prices at Time of Pledge
              </h3>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: "999 (24K)", value: pledge.goldPrice999 },
                  { label: "916 (22K)", value: pledge.goldPrice916 },
                  { label: "875 (21K)", value: pledge.goldPrice875 },
                  { label: "750 (18K)", value: pledge.goldPrice750 },
                ].map((price) => (
                  <div
                    key={price.label}
                    className="text-center p-3 bg-zinc-50 rounded-lg"
                  >
                    <p className="text-sm text-zinc-500">{price.label}</p>
                    <p className="font-semibold text-zinc-800">
                      {formatCurrency(price.value)}/g
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {activeTab === "items" && (
          <motion.div
            key="items"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50">
                      <th className="text-left p-4 text-sm font-semibold text-zinc-600">
                        #
                      </th>
                      <th className="text-left p-4 text-sm font-semibold text-zinc-600">
                        Item
                      </th>
                      <th className="text-left p-4 text-sm font-semibold text-zinc-600">
                        Purity
                      </th>
                      <th className="text-right p-4 text-sm font-semibold text-zinc-600">
                        Weight
                      </th>
                      <th className="text-right p-4 text-sm font-semibold text-zinc-600">
                        Value
                      </th>
                      <th className="text-left p-4 text-sm font-semibold text-zinc-600">
                        Location
                      </th>
                      <th className="text-left p-4 text-sm font-semibold text-zinc-600">
                        Barcode
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pledge.items?.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="p-8 text-center text-zinc-500"
                        >
                          No items found
                        </td>
                      </tr>
                    ) : (
                      pledge.items?.map((item, idx) => (
                        <tr
                          key={item.id}
                          className="border-b border-zinc-100 hover:bg-zinc-50"
                        >
                          <td className="p-4 text-zinc-500">{idx + 1}</td>
                          <td className="p-4">
                            <div
                              className={cn(
                                "flex items-center gap-3",
                                item.photo && "cursor-pointer group",
                              )}
                              onClick={() => {
                                if (item.photo) {
                                  // Handle photo URL - prefix with storage URL if needed
                                  const photoUrl = item.photo.startsWith("http")
                                    ? item.photo
                                    : `${import.meta.env.VITE_API_URL?.replace(
                                        "/api",
                                        "",
                                      )}/storage/${item.photo}`;
                                  setSelectedImage(photoUrl);
                                  setShowImageModal(true);
                                }
                              }}
                            >
                              {item.photo ? (
                                <div className="relative">
                                  <img
                                    src={
                                      item.photo.startsWith("http")
                                        ? item.photo
                                        : `${import.meta.env.VITE_API_URL?.replace(
                                            "/api",
                                            "",
                                          )}/storage/${item.photo}`
                                    }
                                    alt={item.category}
                                    className="w-12 h-12 rounded-lg object-cover border border-zinc-200 group-hover:border-amber-400 transition-colors"
                                    onError={(e) => {
                                      e.target.style.display = "none";
                                      e.target.nextSibling.style.display =
                                        "flex";
                                    }}
                                  />
                                  <div className="w-12 h-12 rounded-lg bg-zinc-100 items-center justify-center hidden">
                                    <Gem className="w-6 h-6 text-zinc-400" />
                                  </div>
                                  <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Eye className="w-4 h-4 text-white" />
                                  </div>
                                </div>
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-zinc-100 flex items-center justify-center border border-zinc-200">
                                  <Gem className="w-6 h-6 text-zinc-400" />
                                </div>
                              )}
                              <div>
                                <p
                                  className={cn(
                                    "font-medium text-zinc-800",
                                    item.photo &&
                                      "group-hover:text-amber-600 transition-colors",
                                  )}
                                >
                                  {item.category}
                                  {item.photo && (
                                    <Image className="w-3 h-3 inline-block ml-1 text-zinc-400 group-hover:text-amber-500" />
                                  )}
                                </p>
                                <p className="text-xs text-zinc-500">
                                  {item.description}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge variant="default">{item.purity}</Badge>
                          </td>
                          <td className="p-4 text-right">
                            <p className="font-medium">
                              {item.netWeight?.toFixed(3)}g
                            </p>
                            <p className="text-xs text-zinc-500">
                              Gross: {item.grossWeight?.toFixed(3)}g
                            </p>
                          </td>
                          <td className="p-4 text-right">
                            <p className="font-semibold text-zinc-800">
                              {formatCurrency(item.netValue)}
                            </p>
                            <p className="text-xs text-zinc-500">
                              @{formatCurrency(item.pricePerGram)}/g
                            </p>
                          </td>
                          <td className="p-4">
                            <p className="text-sm text-zinc-600">
                              {item.location || "Not Assigned"}
                            </p>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <QrCode className="w-4 h-4 text-zinc-400" />
                              <span className="text-sm font-mono">
                                {item.barcode || item.itemNo}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>
        )}

        {activeTab === "history" && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-zinc-800 mb-4">
                Transaction History
              </h3>

              {/* Timeline */}
              <div className="space-y-4">
                {/* Pledge Created */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="w-px h-full bg-zinc-200" />
                  </div>
                  <div className="pb-6">
                    <p className="font-semibold text-zinc-800">
                      Pledge Created
                    </p>
                    <p className="text-sm text-zinc-500">
                      {formatDate(pledge.pledgeDate || pledge.createdAt)}
                    </p>
                    <p className="text-sm text-zinc-600 mt-1">
                      Loan amount: {formatCurrency(pledge.loanAmount)} (
                      {pledge.items?.length || 0} items)
                    </p>
                    {pledge.createdBy && (
                      <p className="text-xs text-zinc-400">
                        By: {pledge.createdBy}
                      </p>
                    )}
                  </div>
                </div>

                {/* Payment Info */}
                {pledge.payments?.length > 0 &&
                  pledge.payments.map((payment, idx) => (
                    <div key={idx} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <CreditCard className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="w-px h-full bg-zinc-200" />
                      </div>
                      <div className="pb-6">
                        <p className="font-semibold text-zinc-800">
                          Payout - {payment.paymentMethod}
                        </p>
                        <p className="text-sm text-zinc-500">
                          {formatDate(payment.paymentDate)}
                        </p>
                        <div className="text-sm text-zinc-600 mt-1">
                          {payment.cashAmount > 0 && (
                            <p>Cash: {formatCurrency(payment.cashAmount)}</p>
                          )}
                          {payment.transferAmount > 0 && (
                            <p>
                              Transfer: {formatCurrency(payment.transferAmount)}{" "}
                              ({payment.bankName})
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                {/* Renewals - show each renewal with date */}
                {pledge.renewals?.length > 0
                  ? pledge.renewals.map((renewal, idx) => (
                      <div key={renewal.id || idx} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                            <RefreshCw className="w-5 h-5 text-amber-600" />
                          </div>
                          <div className="w-px h-full bg-zinc-200" />
                        </div>
                        <div className="pb-6">
                          <p className="font-semibold text-zinc-800">
                            Renewal #{idx + 1}
                            {renewal.renewalNo && (
                              <span className="ml-2 text-xs font-mono text-zinc-400">
                                ({renewal.renewalNo})
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-zinc-500">
                            {formatDate(renewal.renewalDate)}
                          </p>
                          <div className="text-sm text-zinc-600 mt-1">
                            <p>Extended for {renewal.renewalMonths} month(s)</p>
                            <p>
                              Interest paid:{" "}
                              {formatCurrency(renewal.interestAmount)}
                            </p>
                            <p className="text-amber-600">
                              New due date: {formatDate(renewal.newDueDate)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  : pledge.renewalCount > 0 && (
                      <div className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                            <RefreshCw className="w-5 h-5 text-amber-600" />
                          </div>
                        </div>
                        <div>
                          <p className="font-semibold text-zinc-800">
                            Renewed {pledge.renewalCount} time(s)
                          </p>
                        </div>
                      </div>
                    )}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Modal */}
      <Modal
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        title="Item Photo"
        size="xl"
      >
        <div className="flex flex-col items-center">
          {selectedImage && (
            <>
              <img
                src={selectedImage}
                alt="Item"
                className="max-w-full max-h-[70vh] rounded-lg object-contain"
                onError={(e) => {
                  e.target.src =
                    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2NjY2NjYyIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxyZWN0IHg9IjMiIHk9IjMiIHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgcng9IjIiIHJ5PSIyIi8+PGNpcmNsZSBjeD0iOC41IiBjeT0iOC41IiByPSIxLjUiLz48cG9seWxpbmUgcG9pbnRzPSIyMSAxNSAxNiAxMCA1IDIxIi8+PC9zdmc+";
                }}
              />
              <div className="mt-4 flex gap-3">
                <a
                  href={selectedImage}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Image
                </a>
                <Button
                  variant="outline"
                  onClick={() => window.open(selectedImage, "_blank")}
                  leftIcon={Eye}
                >
                  Open Full Size
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </PageWrapper>
  );
}
