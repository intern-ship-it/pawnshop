/**
 * Renewal Screen - Process interest payment and extend pledge period
 * API Integrated Version
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { setSelectedPledge } from "@/features/pledges/pledgesSlice";
import { addToast } from "@/features/ui/uiSlice";
import { pledgeService, renewalService } from "@/services";
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
import {
  RefreshCw,
  Search,
  Package,
  User,
  Calendar,
  Clock,
  DollarSign,
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
  Loader2,
} from "lucide-react";

export default function RenewalScreen() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { selectedPledge } = useAppSelector((state) => state.pledges);

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [pledge, setPledge] = useState(null);
  const [searchResult, setSearchResult] = useState(null);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountReceived, setAmountReceived] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [bankId, setBankId] = useState("");

  // Extension state
  const [extensionMonths, setExtensionMonths] = useState(1);

  // Calculation state (from API)
  const [calculation, setCalculation] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [renewalResult, setRenewalResult] = useState(null);

  // Load pre-selected pledge
  useEffect(() => {
    if (selectedPledge) {
      setPledge(selectedPledge);
      setSearchQuery(selectedPledge.pledgeNo || selectedPledge.id);
      dispatch(setSelectedPledge(null));
      // Calculate interest for pre-selected pledge
      fetchCalculation(selectedPledge.id, extensionMonths);
    }
  }, [selectedPledge, dispatch]);

  // Fetch calculation when pledge or months change
  useEffect(() => {
    if (pledge?.id) {
      fetchCalculation(pledge.id, extensionMonths);
    }
  }, [extensionMonths]);

  // Fetch interest calculation from API
  const fetchCalculation = async (pledgeId, months) => {
    setIsCalculating(true);
    try {
      const response = await renewalService.calculate({
        pledge_id: pledgeId,
        renewal_months: months,
      });

      if (response.data?.success !== false) {
        const data = response.data?.data || response.data;
        setCalculation(data);
      }
    } catch (error) {
      console.error("Failed to calculate renewal:", error);
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
        })
      );
      return;
    }

    setIsSearching(true);
    setSearchResult(null);
    setPledge(null);
    setCalculation(null);

    try {
      // Try searching by receipt number first
      const response = await pledgeService.getByReceipt(searchQuery.trim());
      const data = response.data?.data || response.data;

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

        // Check if pledge can be renewed
        if (pledgeData.status === "active" || pledgeData.status === "overdue") {
          setPledge(pledgeData);
          setSearchResult("found");
          dispatch(
            addToast({
              type: "success",
              title: "Found",
              message: `Pledge ${pledgeData.pledgeNo} loaded`,
            })
          );

          // Fetch calculation
          fetchCalculation(pledgeData.id, extensionMonths);
        } else {
          setSearchResult("invalid");
          dispatch(
            addToast({
              type: "error",
              title: "Invalid Status",
              message: `Pledge is ${pledgeData.status}. Cannot process renewal.`,
            })
          );
        }
      } else {
        setSearchResult("not_found");
        dispatch(
          addToast({
            type: "error",
            title: "Not Found",
            message: "No pledge found with this ID",
          })
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
        })
      );
    } finally {
      setIsSearching(false);
    }
  };

  // Process renewal via API
  const handleProcessRenewal = async () => {
    if (!pledge || !calculation) return;

    const received = parseFloat(amountReceived) || 0;
    const totalPayable = calculation?.calculation?.total_payable || 0;

    if (received < totalPayable) {
      dispatch(
        addToast({
          type: "error",
          title: "Insufficient",
          message: `Amount must be at least ${formatCurrency(totalPayable)}`,
        })
      );
      return;
    }

    setIsProcessing(true);

    try {
      // Prepare renewal data
      const renewalData = {
        pledge_id: pledge.id,
        renewal_months: extensionMonths,
        payment_method: paymentMethod,
        cash_amount:
          paymentMethod === "cash" || paymentMethod === "partial"
            ? received
            : 0,
        transfer_amount:
          paymentMethod === "transfer" || paymentMethod === "partial"
            ? received
            : 0,
        bank_id: paymentMethod !== "cash" && bankId ? parseInt(bankId) : null,
        reference_no: referenceNo || null,
        terms_accepted: true,
      };

      const response = await renewalService.create(renewalData);
      const data = response.data?.data || response.data;

      if (response.data?.success !== false) {
        // Success
        setRenewalResult({
          renewalId: data.renewal_no || data.id,
          pledgeId: pledge.pledgeNo,
          customerName: pledge.customerName,
          amountPaid: totalPayable,
          change: received - totalPayable,
          newDueDate: data.new_due_date || calculation?.renewal?.new_due_date,
          extensionMonths,
        });

        setShowSuccessModal(true);

        dispatch(
          addToast({
            type: "success",
            title: "Success",
            message: "Renewal processed successfully",
          })
        );
      } else {
        throw new Error(response.data?.message || "Failed to process renewal");
      }
    } catch (error) {
      console.error("Renewal error:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message:
            error.response?.data?.message ||
            error.message ||
            "Failed to process renewal",
        })
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Get values from calculation
  const interestAmount = calculation?.calculation?.interest_amount || 0;
  const handlingFee = calculation?.calculation?.handling_fee || 0;
  const totalPayable = calculation?.calculation?.total_payable || 0;
  const interestBreakdown = calculation?.calculation?.interest_breakdown || [];
  const newDueDate = calculation?.renewal?.new_due_date;

  // Days until due
  const getDaysUntilDue = () => {
    if (!pledge?.dueDate) return 0;
    const now = new Date();
    const due = new Date(pledge.dueDate);
    if (isNaN(due.getTime())) return 0;
    return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  };

  const daysUntilDue = getDaysUntilDue();

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
      title="Renewal"
      subtitle="Process interest payment and extend pledge period"
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
              <div className="flex-1">
                <Input
                  placeholder="Enter Pledge No, Receipt No, or IC Number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  leftIcon={Search}
                />
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
                        Cannot process renewal
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
              {/* Pledge Info Card */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-bold text-xl">
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
                      <span className="text-xs text-zinc-500">Loan Amount</span>
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
                      <span className="text-xs text-zinc-500">Due Date</span>
                    </div>
                    <p
                      className={cn(
                        "font-bold",
                        daysUntilDue < 0
                          ? "text-red-600"
                          : daysUntilDue <= 7
                          ? "text-amber-600"
                          : "text-zinc-800"
                      )}
                    >
                      {formatDate(pledge.dueDate)}
                    </p>
                  </div>
                  <div className="p-3 bg-zinc-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <RefreshCw className="w-4 h-4 text-zinc-400" />
                      <span className="text-xs text-zinc-500">Renewals</span>
                    </div>
                    <p className="font-bold text-zinc-800">
                      {pledge.renewalCount || 0} times
                    </p>
                  </div>
                </div>

                {/* Days status */}
                {daysUntilDue !== 0 && (
                  <div
                    className={cn(
                      "mt-4 p-3 rounded-lg flex items-center gap-2",
                      daysUntilDue < 0
                        ? "bg-red-50 text-red-700"
                        : daysUntilDue <= 7
                        ? "bg-amber-50 text-amber-700"
                        : "bg-green-50 text-green-700"
                    )}
                  >
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {daysUntilDue < 0
                        ? `Overdue by ${Math.abs(daysUntilDue)} days`
                        : `${daysUntilDue} days until due`}
                    </span>
                  </div>
                )}
              </Card>

              {/* Interest Calculation Card */}
              <Card className="p-6">
                <h4 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-amber-500" />
                  Interest Calculation
                  {isCalculating && (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                  )}
                </h4>

                {/* Extension Period Selection */}
                <div className="mb-4">
                  <label className="text-sm text-zinc-600 mb-2 block">
                    Extension Period
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5, 6].map((months) => (
                      <button
                        key={months}
                        onClick={() => setExtensionMonths(months)}
                        className={cn(
                          "px-4 py-2 rounded-lg border font-medium transition-all",
                          extensionMonths === months
                            ? "bg-amber-500 text-white border-amber-500"
                            : "bg-white text-zinc-600 border-zinc-200 hover:border-amber-300"
                        )}
                      >
                        {months}M
                      </button>
                    ))}
                  </div>
                </div>

                {/* Interest Breakdown */}
                {interestBreakdown.length > 0 && (
                  <div className="mb-4 p-4 bg-zinc-50 rounded-lg">
                    <p className="text-sm font-medium text-zinc-700 mb-2">
                      Interest Breakdown
                    </p>
                    <div className="space-y-1">
                      {interestBreakdown.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-zinc-500">
                            Month {item.month} ({item.rate}%)
                          </span>
                          <span className="font-medium">
                            {formatCurrency(item.interest)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Summary */}
                <div className="space-y-2 border-t border-zinc-200 pt-4">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Interest Amount</span>
                    <span className="font-medium">
                      {formatCurrency(interestAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Handling Fee</span>
                    <span className="font-medium">
                      {formatCurrency(handlingFee)}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-zinc-200">
                    <span className="text-zinc-800">Total Payable</span>
                    <span className="text-amber-600">
                      {formatCurrency(totalPayable)}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Payment Card */}
              <Card className="p-6">
                <h4 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-amber-500" />
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
                            ? "bg-amber-500 text-white border-amber-500"
                            : "bg-white text-zinc-600 border-zinc-200 hover:border-amber-300"
                        )}
                      >
                        <method.icon className="w-4 h-4" />
                        {method.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount Received */}
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

                {/* Reference No (for transfer) */}
                {paymentMethod !== "cash" && (
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
                )}

                {/* Change */}
                {parseFloat(amountReceived) > totalPayable && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg flex justify-between items-center">
                    <span className="text-blue-700">Change</span>
                    <span className="font-bold text-blue-700">
                      {formatCurrency(
                        parseFloat(amountReceived) - totalPayable
                      )}
                    </span>
                  </div>
                )}

                {/* New Due Date Preview */}
                <div className="mb-6 p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm text-green-700">
                        New Due Date (after renewal)
                      </p>
                      <p className="font-bold text-green-800">
                        {newDueDate ? formatDate(newDueDate) : "Calculating..."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Process Button */}
                <Button
                  variant="success"
                  size="lg"
                  fullWidth
                  leftIcon={CheckCircle}
                  onClick={handleProcessRenewal}
                  loading={isProcessing}
                  disabled={
                    !amountReceived ||
                    parseFloat(amountReceived) < totalPayable ||
                    isCalculating
                  }
                >
                  Process Renewal - {formatCurrency(totalPayable)}
                </Button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!pledge && !searchResult && (
          <motion.div variants={itemVariants}>
            <Card className="p-12 text-center">
              <RefreshCw className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-zinc-800 mb-2">
                Process Renewal
              </h3>
              <p className="text-zinc-500 mb-4">
                Search for a pledge to process interest payment and extend the
                period
              </p>
            </Card>
          </motion.div>
        )}
      </motion.div>

      {/* Success Modal */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => {}}
        title="Renewal Successful!"
        size="md"
      >
        <div className="p-6 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4"
          >
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </motion.div>

          <h3 className="text-xl font-bold text-zinc-800 mb-2">
            Renewal Processed!
          </h3>
          <p className="text-zinc-500 mb-4">
            ID:{" "}
            <span className="font-mono font-bold">
              {renewalResult?.renewalId}
            </span>
          </p>

          <div className="p-4 bg-zinc-50 rounded-xl mb-6 text-left">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Pledge</span>
                <span className="font-medium">{renewalResult?.pledgeId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Customer</span>
                <span className="font-medium">
                  {renewalResult?.customerName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Amount Paid</span>
                <span className="font-medium text-emerald-600">
                  {formatCurrency(renewalResult?.amountPaid)}
                </span>
              </div>
              {renewalResult?.change > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Change Given</span>
                  <span className="font-medium text-blue-600">
                    {formatCurrency(renewalResult?.change)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-zinc-200">
                <span className="text-zinc-500">New Due Date</span>
                <span className="font-bold text-zinc-800">
                  {renewalResult?.newDueDate
                    ? formatDate(renewalResult.newDueDate)
                    : "N/A"}
                </span>
              </div>
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
              onClick={() => navigate(`/pledges/${pledge?.id}`)}
            >
              View Pledge
            </Button>
            <Button
              variant="accent"
              fullWidth
              leftIcon={Plus}
              onClick={() => {
                setShowSuccessModal(false);
                setRenewalResult(null);
                setSearchQuery("");
                setPledge(null);
                setAmountReceived("");
                setExtensionMonths(1);
                setCalculation(null);
              }}
            >
              New Renewal
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
}
