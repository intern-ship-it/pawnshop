/**
 * Reports Screen - From/To Date Filter + All Report Types
 * API Integrated Version
 */

import { useState, useEffect, useMemo } from "react";
import { useAppDispatch } from "@/app/hooks";
import { addToast } from "@/features/ui/uiSlice";
import reportService from "@/services/reportService";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { Card, Button, Select, Badge, Input, Modal } from "@/components/common";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Package,
  DollarSign,
  Calendar,
  Download,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertTriangle,
  PieChart,
  Activity,
  Scale,
  Gem,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  CreditCard,
  Warehouse,
  UserPlus,
  Receipt,
  Loader2,
  ChevronRight,
  Filter,
  X,
  Search,
  Eye,
} from "lucide-react";

// Report Categories with sub-reports
const reportCategories = [
  {
    id: "overview",
    label: "Overview",
    icon: BarChart3,
    description: "Business summary & analytics",
  },
  {
    id: "pledges",
    label: "Pledge Reports",
    icon: Package,
    description: "Pledge listing & summary",
    subReports: ["new_pledges", "pledge_listing", "pledge_summary"],
  },
  {
    id: "renewals",
    label: "Renewal Reports",
    icon: RefreshCw,
    description: "Renewals & interest collected",
    subReports: ["daily_renewals", "monthly_renewals", "interest_collected"],
  },
  {
    id: "redemptions",
    label: "Redemption Reports",
    icon: CheckCircle,
    description: "Redemptions & collections",
    subReports: [
      "daily_redemptions",
      "monthly_redemptions",
      "amount_collected",
    ],
  },
  {
    id: "outstanding",
    label: "Outstanding/Overdue",
    icon: AlertTriangle,
    description: "Due & overdue pledges",
    subReports: ["due_list", "overdue_list", "total_outstanding"],
  },
  {
    id: "payments",
    label: "Payment Split",
    icon: CreditCard,
    description: "Cash vs online transfer",
  },
  {
    id: "inventory",
    label: "Inventory Reports",
    icon: Warehouse,
    description: "Items, purity, weight/value",
  },
  {
    id: "customers",
    label: "Customer Reports",
    icon: Users,
    description: "Customer activity & history",
    subReports: ["new_customers", "customer_activity", "pledge_history"],
  },
  {
    id: "transactions",
    label: "Transaction Reports",
    icon: Activity,
    description: "All transactions by date/type",
  },
  {
    id: "reprints",
    label: "Reprint Charges",
    icon: Receipt,
    description: "Receipt reprints & charges",
  },
];

// Date presets
const datePresets = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
];

export default function ReportsScreen() {
  const dispatch = useAppDispatch();

  // State
  const [activeReport, setActiveReport] = useState("overview");
  const [datePreset, setDatePreset] = useState("this_month");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showDateModal, setShowDateModal] = useState(false);

  // Data State
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Initialize dates based on preset
  useEffect(() => {
    // Helper to format date as YYYY-MM-DD in local timezone
    const formatLocalDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const now = new Date();
    const today = formatLocalDate(now);

    switch (datePreset) {
      case "today":
        setFromDate(today);
        setToDate(today);
        break;
      case "yesterday":
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        setFromDate(formatLocalDate(yesterday));
        setToDate(formatLocalDate(yesterday));
        break;
      case "this_week":
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        setFromDate(formatLocalDate(weekStart));
        setToDate(today);
        break;
      case "last_week":
        const lastWeekEnd = new Date(now);
        lastWeekEnd.setDate(lastWeekEnd.getDate() - lastWeekEnd.getDay() - 1);
        const lastWeekStart = new Date(lastWeekEnd);
        lastWeekStart.setDate(lastWeekStart.getDate() - 6);
        setFromDate(formatLocalDate(lastWeekStart));
        setToDate(formatLocalDate(lastWeekEnd));
        break;
      case "this_month":
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        setFromDate(formatLocalDate(monthStart));
        setToDate(today);
        break;
      case "last_month":
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        const lastMonthStart = new Date(
          now.getFullYear(),
          now.getMonth() - 1,
          1,
        );
        setFromDate(formatLocalDate(lastMonthStart));
        setToDate(formatLocalDate(lastMonthEnd));
        break;
      case "this_year":
        const yearStart = new Date(now.getFullYear(), 0, 1);
        setFromDate(formatLocalDate(yearStart));
        setToDate(today);
        break;
      case "custom":
        // Keep current dates, open modal
        setShowDateModal(true);
        break;
    }
  }, [datePreset]);

  // Fetch report data when report type or dates change
  useEffect(() => {
    if (fromDate && toDate) {
      fetchReportData();
    }
  }, [activeReport, fromDate, toDate]);

  const fetchReportData = async () => {
    setIsLoading(true);
    try {
      const params = { from_date: fromDate, to_date: toDate };
      let response;

      switch (activeReport) {
        case "overview":
          // Fetch multiple reports for overview - handle failures gracefully
          try {
            const results = await Promise.all([
              reportService
                .getPledgesReport(params)
                .catch(() => ({ success: false, data: null })),
              reportService
                .getRenewalsReport(params)
                .catch(() => ({ success: false, data: null })),
              reportService
                .getRedemptionsReport(params)
                .catch(() => ({ success: false, data: null })),
              reportService
                .getOutstandingReport()
                .catch(() => ({ success: false, data: null })),
              reportService
                .getOverdueReport()
                .catch(() => ({ success: false, data: null })),
              reportService
                .getInventoryReport()
                .catch(() => ({ success: false, data: null })),
            ]);

            response = {
              success: true,
              data: {
                pledges: results[0]?.data || null,
                renewals: results[1]?.data || null,
                redemptions: results[2]?.data || null,
                outstanding: results[3]?.data || null,
                overdue: results[4]?.data || null,
                inventory: results[5]?.data || null,
              },
            };
          } catch (err) {
            console.error("Overview fetch error:", err);
            response = { success: false };
          }
          break;
        case "pledges":
          response = await reportService.getPledgesReport(params);
          break;
        case "renewals":
          response = await reportService.getRenewalsReport(params);
          break;
        case "redemptions":
          response = await reportService.getRedemptionsReport(params);
          break;
        case "outstanding":
          response = await reportService.getOutstandingReport();
          break;
        case "payments":
          response = await reportService.getPaymentSplitReport(params);
          break;
        case "inventory":
          response = await reportService.getInventoryReport();
          break;
        case "customers":
          response = await reportService.getCustomersReport(params);
          break;
        case "transactions":
          response = await reportService.getTransactionsReport(params);
          break;
        case "reprints":
          response = await reportService.getReprintsReport(params);
          break;
        default:
          response = { success: false };
      }

      if (response.success) {
        setReportData(response.data);
      }
    } catch (error) {
      console.error("Error fetching report:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Failed to load report data",
        }),
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle export
  const handleExport = async (format = "csv") => {
    setIsExporting(true);
    try {
      const response = await reportService.exportReport(activeReport, format, {
        from_date: fromDate,
        to_date: toDate,
      });

      if (response.success) {
        dispatch(
          addToast({
            type: "success",
            title: "Export Started",
            message: `${activeReport} report export initiated`,
          }),
        );
      }
    } catch (error) {
      dispatch(
        addToast({
          type: "error",
          title: "Export Failed",
          message: error.message,
        }),
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Format date range display
  const getDateRangeDisplay = () => {
    if (!fromDate || !toDate) return "Select Date Range";
    if (fromDate === toDate) return formatDate(fromDate);
    return `${formatDate(fromDate)} - ${formatDate(toDate)}`;
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
      title="Reports"
      subtitle="Generate and export business reports"
      actions={
        <div className="flex items-center gap-3">
          {/* Date Range Display */}
          <div className="flex items-center gap-2 bg-zinc-100 px-3 py-2 rounded-lg">
            <Calendar className="w-4 h-4 text-zinc-500" />
            <span className="text-sm font-medium text-zinc-700">
              {getDateRangeDisplay()}
            </span>
          </div>

          {/* Export Buttons */}
          <Button
            variant="outline"
            leftIcon={Download}
            onClick={() => handleExport("csv")}
            loading={isExporting}
          >
            Export CSV
          </Button>
        </div>
      }
    >
      <div className="flex gap-6">
        {/* Left Sidebar - Report Types */}
        <div className="w-64 flex-shrink-0">
          <Card className="p-4 sticky top-4">
            {/* Date Filter Section */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Date Range
              </h3>
              <Select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value)}
                options={datePresets}
                className="mb-3"
              />

              {/* From/To Date Inputs */}
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">
                    From Date
                  </label>
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(e) => {
                      setFromDate(e.target.value);
                      setDatePreset("custom");
                    }}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">
                    To Date
                  </label>
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(e) => {
                      setToDate(e.target.value);
                      setDatePreset("custom");
                    }}
                    className="text-sm"
                  />
                </div>
              </div>

              <Button
                variant="accent"
                size="sm"
                fullWidth
                className="mt-3"
                onClick={fetchReportData}
                leftIcon={RefreshCw}
              >
                Refresh Report
              </Button>
            </div>

            {/* Report Types Menu */}
            <h3 className="text-sm font-semibold text-zinc-700 mb-3">
              Report Types
            </h3>
            <nav className="space-y-1">
              {reportCategories.map((category) => {
                const Icon = category.icon;
                const isActive = activeReport === category.id;
                return (
                  <button
                    key={category.id}
                    onClick={() => setActiveReport(category.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all",
                      isActive
                        ? "bg-amber-100 text-amber-800 font-medium"
                        : "text-zinc-600 hover:bg-zinc-100",
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4",
                        isActive ? "text-amber-600" : "text-zinc-400",
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{category.label}</p>
                    </div>
                    {isActive && (
                      <ChevronRight className="w-4 h-4 text-amber-500" />
                    )}
                  </button>
                );
              })}
            </nav>
          </Card>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
                <p className="text-zinc-500">Loading report data...</p>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {/* Overview Report */}
              {activeReport === "overview" && (
                <motion.div
                  key="overview"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  className="space-y-6"
                >
                  <OverviewReport data={reportData} />
                </motion.div>
              )}

              {/* Pledges Report */}
              {activeReport === "pledges" && (
                <motion.div
                  key="pledges"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                >
                  <PledgesReport data={reportData} />
                </motion.div>
              )}

              {/* Renewals Report */}
              {activeReport === "renewals" && (
                <motion.div
                  key="renewals"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                >
                  <RenewalsReport data={reportData} />
                </motion.div>
              )}

              {/* Redemptions Report */}
              {activeReport === "redemptions" && (
                <motion.div
                  key="redemptions"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                >
                  <RedemptionsReport data={reportData} />
                </motion.div>
              )}

              {/* Outstanding Report */}
              {activeReport === "outstanding" && (
                <motion.div
                  key="outstanding"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                >
                  <OutstandingReport data={reportData} />
                </motion.div>
              )}

              {/* Payment Split Report */}
              {activeReport === "payments" && (
                <motion.div
                  key="payments"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                >
                  <PaymentSplitReport data={reportData} />
                </motion.div>
              )}

              {/* Inventory Report */}
              {activeReport === "inventory" && (
                <motion.div
                  key="inventory"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                >
                  <InventoryReport data={reportData} />
                </motion.div>
              )}

              {/* Customers Report */}
              {activeReport === "customers" && (
                <motion.div
                  key="customers"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                >
                  <CustomersReport data={reportData} />
                </motion.div>
              )}

              {/* Transactions Report */}
              {activeReport === "transactions" && (
                <motion.div
                  key="transactions"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                >
                  <TransactionsReport data={reportData} />
                </motion.div>
              )}

              {/* Reprints Report */}
              {activeReport === "reprints" && (
                <motion.div
                  key="reprints"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                >
                  <ReprintsReport data={reportData} />
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}

// ============================================================
// REPORT COMPONENTS
// ============================================================

// Overview Report
function OverviewReport({ data }) {
  if (!data) return <EmptyState message="No data available" />;

  const pledgesSummary = data.pledges?.summary || {};
  const renewalsSummary = data.renewals?.summary || {};
  const redemptionsSummary = data.redemptions?.summary || {};
  const outstandingSummary = data.outstanding?.summary || {};
  const inventorySummary = data.inventory?.summary || {};

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <Package className="w-8 h-8 mb-3 opacity-80" />
          <p className="text-emerald-100 text-sm">New Pledges</p>
          <p className="text-2xl font-bold">
            {pledgesSummary.total_pledges || 0}
          </p>
          <p className="text-emerald-200 text-sm mt-1">
            {formatCurrency(pledgesSummary.total_loan_amount || 0)}
          </p>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <RefreshCw className="w-8 h-8 mb-3 opacity-80" />
          <p className="text-blue-100 text-sm">Renewals</p>
          <p className="text-2xl font-bold">
            {renewalsSummary.total_renewals || 0}
          </p>
          <p className="text-blue-200 text-sm mt-1">
            {formatCurrency(renewalsSummary.total_interest || 0)} interest
          </p>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CheckCircle className="w-8 h-8 mb-3 opacity-80" />
          <p className="text-purple-100 text-sm">Redemptions</p>
          <p className="text-2xl font-bold">
            {redemptionsSummary.total_redemptions || 0}
          </p>
          <p className="text-purple-200 text-sm mt-1">
            {formatCurrency(redemptionsSummary.total_collected || 0)} collected
          </p>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <AlertTriangle className="w-8 h-8 mb-3 opacity-80" />
          <p className="text-amber-100 text-sm">Outstanding</p>
          <p className="text-2xl font-bold">
            {outstandingSummary.total_pledges || 0}
          </p>
          <p className="text-amber-200 text-sm mt-1">
            {formatCurrency(outstandingSummary.total_outstanding || 0)}
          </p>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Outstanding Portfolio */}
        <Card className="p-5">
          <h3 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-amber-500" />
            Outstanding Portfolio
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
              <span className="text-zinc-700">Active Pledges</span>
              <span className="font-semibold text-emerald-600">
                {outstandingSummary.active_count || 0}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
              <span className="text-zinc-700">Overdue Pledges</span>
              <span className="font-semibold text-red-600">
                {outstandingSummary.overdue_count || 0}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg border-t-2 border-amber-300">
              <span className="font-medium text-zinc-800">
                Total Outstanding
              </span>
              <span className="font-bold text-amber-600">
                {formatCurrency(outstandingSummary.total_outstanding || 0)}
              </span>
            </div>
          </div>
        </Card>

        {/* Inventory Summary */}
        <Card className="p-5">
          <h3 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
            <Warehouse className="w-5 h-5 text-amber-500" />
            Inventory Summary
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-zinc-50 rounded-lg">
              <Package className="w-6 h-6 text-zinc-400 mx-auto mb-2" />
              <p className="text-xl font-bold text-zinc-800">
                {typeof inventorySummary.total_items === "object"
                  ? inventorySummary.total_items?.count || 0
                  : inventorySummary.total_items || inventorySummary.count || 0}
              </p>
              <p className="text-xs text-zinc-500">Items</p>
            </div>
            <div className="text-center p-3 bg-zinc-50 rounded-lg">
              <Scale className="w-6 h-6 text-amber-500 mx-auto mb-2" />
              <p className="text-xl font-bold text-zinc-800">
                {typeof inventorySummary.total_weight === "object"
                  ? inventorySummary.total_weight?.total_weight || 0
                  : inventorySummary.total_weight || 0}
                g
              </p>
              <p className="text-xs text-zinc-500">Weight</p>
            </div>
            <div className="text-center p-3 bg-zinc-50 rounded-lg">
              <DollarSign className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
              <p className="text-lg font-bold text-emerald-600 break-words">
                {formatCurrency(
                  typeof inventorySummary.total_value === "object"
                    ? inventorySummary.total_value?.total_value || 0
                    : inventorySummary.total_value || 0,
                )}
              </p>
              <p className="text-xs text-zinc-500">Value</p>
            </div>
          </div>

          {/* By Purity */}
          {inventorySummary.by_purity && (
            <div className="mt-4 pt-4 border-t border-zinc-200">
              <p className="text-sm font-medium text-zinc-600 mb-2">
                By Purity
              </p>
              <div className="space-y-2">
                {(Array.isArray(inventorySummary.by_purity)
                  ? inventorySummary.by_purity
                  : Object.entries(inventorySummary.by_purity).map(
                      ([k, v]) => ({ name: k, ...v }),
                    )
                ).map((item, idx) => {
                  const label = item.purity || item.name || "Unknown";
                  const weight = item.weight || item.total_weight || 0;
                  return (
                    <div
                      key={label || idx}
                      className="flex justify-between text-sm"
                    >
                      <span className="text-zinc-600">{label}</span>
                      <span className="font-medium">{weight}g</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Transaction Breakdown */}
      <Card className="p-5">
        <h3 className="font-semibold text-zinc-800 mb-4">
          Transaction Breakdown
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
            <div className="flex items-center gap-3">
              <ArrowUpRight className="w-5 h-5 text-red-500" />
              <span className="text-zinc-700">New Pledges (Cash Out)</span>
            </div>
            <span className="font-semibold text-red-600">
              -{formatCurrency(pledgesSummary.total_loan_amount || 0)}
            </span>
          </div>
          <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
            <div className="flex items-center gap-3">
              <ArrowDownRight className="w-5 h-5 text-emerald-500" />
              <span className="text-zinc-700">Redemptions (Cash In)</span>
            </div>
            <span className="font-semibold text-emerald-600">
              +{formatCurrency(redemptionsSummary.total_collected || 0)}
            </span>
          </div>
          <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-blue-500" />
              <span className="text-zinc-700">Renewals (Interest In)</span>
            </div>
            <span className="font-semibold text-blue-600">
              +{formatCurrency(renewalsSummary.total_interest || 0)}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Pledges Report
function PledgesReport({ data }) {
  if (!data) return <EmptyState message="No pledge data available" />;

  const summary = data.summary || {};
  const pledges = data.pledges || [];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-zinc-500">Total Pledges</p>
          <p className="text-2xl font-bold text-zinc-800">
            {summary.total_pledges || 0}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-zinc-500">Total Loan Amount</p>
          <p className="text-2xl font-bold text-emerald-600">
            {formatCurrency(summary.total_loan_amount || 0)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-zinc-500">Average Loan</p>
          <p className="text-2xl font-bold text-blue-600">
            {formatCurrency(summary.average_loan || 0)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-zinc-500">Unique Customers</p>
          <p className="text-2xl font-bold text-amber-600">
            {summary.unique_customers || 0}
          </p>
        </Card>
      </div>

      {/* Pledges Table */}
      <Card>
        <div className="p-4 border-b border-zinc-200">
          <h3 className="font-semibold text-zinc-800">Pledge Listing</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-50">
              <tr>
                <th className="text-left p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Pledge No
                </th>
                <th className="text-left p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Customer
                </th>
                <th className="text-left p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Items
                </th>
                <th className="text-right p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Loan Amount
                </th>
                <th className="text-left p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Date
                </th>
                <th className="text-center p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {pledges.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-500">
                    No pledges found for selected date range
                  </td>
                </tr>
              ) : (
                pledges.map((pledge) => (
                  <tr key={pledge.id} className="hover:bg-zinc-50">
                    <td className="p-3 font-medium">{pledge.pledge_no}</td>
                    <td className="p-3">
                      {pledge.customer?.name || "Unknown"}
                    </td>
                    <td className="p-3">
                      {pledge.items_count || pledge.items?.length || 0}
                    </td>
                    <td className="p-3 text-right font-medium">
                      {formatCurrency(pledge.loan_amount)}
                    </td>
                    <td className="p-3 text-sm">
                      {formatDate(pledge.pledge_date || pledge.created_at)}
                    </td>
                    <td className="p-3 text-center">
                      <Badge
                        variant={
                          pledge.status === "active"
                            ? "success"
                            : pledge.status === "overdue"
                              ? "error"
                              : pledge.status === "redeemed"
                                ? "info"
                                : "default"
                        }
                      >
                        {pledge.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// Renewals Report
function RenewalsReport({ data }) {
  if (!data) return <EmptyState message="No renewal data available" />;

  const summary = data.summary || {};
  const renewals = data.renewals || [];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-zinc-500">Total Renewals</p>
          <p className="text-2xl font-bold text-zinc-800">
            {summary.total_renewals || 0}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-zinc-500">Interest Collected</p>
          <p className="text-2xl font-bold text-emerald-600">
            {formatCurrency(summary.total_interest || 0)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-zinc-500">Average Interest</p>
          <p className="text-2xl font-bold text-blue-600">
            {formatCurrency(summary.average_interest || 0)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-zinc-500">Total Payable</p>
          <p className="text-2xl font-bold text-amber-600">
            {formatCurrency(summary.total_payable || 0)}
          </p>
        </Card>
      </div>

      {/* Renewals Table */}
      <Card>
        <div className="p-4 border-b border-zinc-200">
          <h3 className="font-semibold text-zinc-800">Renewal Listing</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-50">
              <tr>
                <th className="text-left p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Pledge No
                </th>
                <th className="text-left p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Customer
                </th>
                <th className="text-right p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Interest
                </th>
                <th className="text-right p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Total Paid
                </th>
                <th className="text-left p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {renewals.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-500">
                    No renewals found for selected date range
                  </td>
                </tr>
              ) : (
                renewals.map((renewal) => (
                  <tr key={renewal.id} className="hover:bg-zinc-50">
                    <td className="p-3 font-medium">
                      {renewal.pledge?.pledge_no || "-"}
                    </td>
                    <td className="p-3">
                      {renewal.pledge?.customer?.name || "Unknown"}
                    </td>
                    <td className="p-3 text-right">
                      {formatCurrency(renewal.interest_amount)}
                    </td>
                    <td className="p-3 text-right font-medium">
                      {formatCurrency(renewal.total_payable)}
                    </td>
                    <td className="p-3 text-sm">
                      {formatDate(renewal.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// Redemptions Report
function RedemptionsReport({ data }) {
  if (!data) return <EmptyState message="No redemption data available" />;

  const summary = data.summary || {};
  const redemptions = data.redemptions || [];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-zinc-500">Total Redemptions</p>
          <p className="text-2xl font-bold text-zinc-800">
            {summary.total_redemptions || 0}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-zinc-500">Principal Returned</p>
          <p className="text-2xl font-bold text-emerald-600">
            {formatCurrency(summary.total_principal || 0)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-zinc-500">Interest Collected</p>
          <p className="text-2xl font-bold text-blue-600">
            {formatCurrency(summary.total_interest || 0)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-zinc-500">Total Collected</p>
          <p className="text-2xl font-bold text-amber-600">
            {formatCurrency(summary.total_collected || 0)}
          </p>
        </Card>
      </div>

      {/* Redemptions Table */}
      <Card>
        <div className="p-4 border-b border-zinc-200">
          <h3 className="font-semibold text-zinc-800">Redemption Listing</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-50">
              <tr>
                <th className="text-left p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Pledge No
                </th>
                <th className="text-left p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Customer
                </th>
                <th className="text-right p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Principal
                </th>
                <th className="text-right p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Interest
                </th>
                <th className="text-right p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Total Paid
                </th>
                <th className="text-left p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {redemptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-500">
                    No redemptions found for selected date range
                  </td>
                </tr>
              ) : (
                redemptions.map((redemption) => (
                  <tr key={redemption.id} className="hover:bg-zinc-50">
                    <td className="p-3 font-medium">
                      {redemption.pledge?.pledge_no || "-"}
                    </td>
                    <td className="p-3">
                      {redemption.pledge?.customer?.name || "Unknown"}
                    </td>
                    <td className="p-3 text-right">
                      {formatCurrency(redemption.principal_amount)}
                    </td>
                    <td className="p-3 text-right">
                      {formatCurrency(redemption.interest_amount)}
                    </td>
                    <td className="p-3 text-right font-medium">
                      {formatCurrency(redemption.total_payable)}
                    </td>
                    <td className="p-3 text-sm">
                      {formatDate(redemption.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// Outstanding Report
function OutstandingReport({ data }) {
  if (!data) return <EmptyState message="No outstanding data available" />;

  const summary = data.summary || {};
  const pledges = data.pledges || [];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-zinc-500">Total Outstanding</p>
          <p className="text-2xl font-bold text-zinc-800">
            {summary.total_pledges || 0}
          </p>
        </Card>
        <Card className="p-4 border-l-4 border-emerald-500">
          <p className="text-sm text-zinc-500">Active</p>
          <p className="text-2xl font-bold text-emerald-600">
            {summary.active_count || 0}
          </p>
        </Card>
        <Card className="p-4 border-l-4 border-red-500">
          <p className="text-sm text-zinc-500">Overdue</p>
          <p className="text-2xl font-bold text-red-600">
            {summary.overdue_count || 0}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-zinc-500">Total Value</p>
          <p className="text-2xl font-bold text-amber-600">
            {formatCurrency(summary.total_outstanding || 0)}
          </p>
        </Card>
      </div>

      {/* Outstanding Table */}
      <Card>
        <div className="p-4 border-b border-zinc-200">
          <h3 className="font-semibold text-zinc-800">Outstanding Pledges</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-50">
              <tr>
                <th className="text-left p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Pledge No
                </th>
                <th className="text-left p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Customer
                </th>
                <th className="text-right p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Loan Amount
                </th>
                <th className="text-left p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Due Date
                </th>
                <th className="text-center p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Days
                </th>
                <th className="text-center p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {pledges.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-500">
                    No outstanding pledges
                  </td>
                </tr>
              ) : (
                pledges.map((pledge) => (
                  <tr key={pledge.id} className="hover:bg-zinc-50">
                    <td className="p-3 font-medium">{pledge.pledge_no}</td>
                    <td className="p-3">
                      {pledge.customer?.name || "Unknown"}
                    </td>
                    <td className="p-3 text-right font-medium">
                      {formatCurrency(pledge.loan_amount)}
                    </td>
                    <td className="p-3 text-sm">
                      {formatDate(pledge.due_date)}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={cn(
                          "font-medium",
                          pledge.days_overdue > 0
                            ? "text-red-600"
                            : "text-zinc-600",
                        )}
                      >
                        {pledge.days_overdue > 0
                          ? `+${pledge.days_overdue}`
                          : pledge.days_remaining || 0}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <Badge
                        variant={
                          pledge.status === "overdue" ? "error" : "success"
                        }
                      >
                        {pledge.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// Payment Split Report
function PaymentSplitReport({ data }) {
  if (!data) return <EmptyState message="No payment data available" />;

  const summary = data.summary || {};

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <DollarSign className="w-8 h-8 mb-3 opacity-80" />
          <p className="text-emerald-100 text-sm">Cash Payments</p>
          <p className="text-2xl font-bold">
            {formatCurrency(summary.cash_total || 0)}
          </p>
          <p className="text-emerald-200 text-sm mt-1">
            {(summary.cash_percentage ?? 0) > 0
              ? `${summary.cash_percentage}%`
              : summary.cash_total > 0
                ? "< 0.01%"
                : "0%"}
          </p>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CreditCard className="w-8 h-8 mb-3 opacity-80" />
          <p className="text-blue-100 text-sm">Online Transfer</p>
          <p className="text-2xl font-bold">
            {formatCurrency(summary.transfer_total || 0)}
          </p>
          <p className="text-blue-200 text-sm mt-1">
            {(summary.transfer_percentage ?? 0) > 0
              ? `${summary.transfer_percentage}%`
              : summary.transfer_total > 0
                ? "< 0.01%"
                : "0%"}
          </p>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <Activity className="w-8 h-8 mb-3 opacity-80" />
          <p className="text-amber-100 text-sm">Total Payments</p>
          <p className="text-2xl font-bold">
            {formatCurrency(summary.total || 0)}
          </p>
          <p className="text-amber-200 text-sm mt-1">
            {summary.transaction_count || 0} transactions
          </p>
        </Card>
      </div>

      {/* Breakdown by Type */}
      <Card className="p-5">
        <h3 className="font-semibold text-zinc-800 mb-4">
          Payment Breakdown by Transaction Type
        </h3>
        <div className="space-y-4">
          {["pledges", "renewals", "redemptions"].map((type) => {
            const typeData = data[type] || {};
            return (
              <div key={type} className="p-4 bg-zinc-50 rounded-lg">
                <h4 className="font-medium text-zinc-700 capitalize mb-3">
                  {type}
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-zinc-500">Cash</p>
                    <p className="font-semibold">
                      {formatCurrency(typeData.cash || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Transfer</p>
                    <p className="font-semibold">
                      {formatCurrency(typeData.transfer || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Total</p>
                    <p className="font-semibold">
                      {formatCurrency(typeData.total || 0)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// Inventory Report
function InventoryReport({ data }) {
  if (!data) return <EmptyState message="No inventory data available" />;

  const summary = data.summary || {};
  const byPurity = summary.by_purity || data.by_purity || [];
  const byCategory = summary.by_category || data.by_category || [];

  // Helper to safely get numeric value (handles objects and primitives)
  const getValue = (val, key = null) => {
    if (val === null || val === undefined) return 0;
    if (typeof val === "object" && key) return val[key] || 0;
    if (typeof val === "object") return val.count || val.total || 0;
    return val;
  };

  const totalItems =
    getValue(summary.total_items) || getValue(summary, "count") || 0;
  const totalWeight =
    getValue(summary.total_weight) || getValue(summary, "total_weight") || 0;
  const totalValue =
    getValue(summary.total_value) || getValue(summary, "total_value") || 0;
  const activePledges = getValue(summary.active_pledges) || 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-zinc-500">Total Items</p>
          <p className="text-2xl font-bold text-zinc-800">{totalItems}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-zinc-500">Total Weight</p>
          <p className="text-2xl font-bold text-amber-600">{totalWeight}g</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-zinc-500">Total Value</p>
          <p className="text-2xl font-bold text-emerald-600">
            {formatCurrency(totalValue)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-zinc-500">Active Pledges</p>
          <p className="text-2xl font-bold text-blue-600">{activePledges}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Purity */}
        <Card className="p-5">
          <h3 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
            <Gem className="w-5 h-5 text-amber-500" />
            By Purity
          </h3>
          <div className="space-y-3">
            {!byPurity || byPurity.length === 0 ? (
              <p className="text-zinc-500 text-sm">No data available</p>
            ) : (
              (Array.isArray(byPurity)
                ? byPurity
                : Object.entries(byPurity).map(([k, v]) => ({
                    purity: k,
                    ...v,
                  }))
              ).map((item, idx) => (
                <div
                  key={item.purity || item.name || idx}
                  className="flex justify-between items-center p-3 bg-zinc-50 rounded-lg"
                >
                  <span className="font-medium text-zinc-700">
                    {item.purity || item.name || "Unknown"}
                  </span>
                  <div className="text-right">
                    <p className="font-semibold">
                      {getValue(item.weight) ||
                        getValue(item.total_weight) ||
                        getValue(item, "total_weight")}
                      g
                    </p>
                    <p className="text-xs text-zinc-500">
                      {getValue(item.count) || getValue(item, "count")} items
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* By Category */}
        <Card className="p-5">
          <h3 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-500" />
            By Category
          </h3>
          <div className="space-y-3">
            {!byCategory || byCategory.length === 0 ? (
              <p className="text-zinc-500 text-sm">No data available</p>
            ) : (
              (Array.isArray(byCategory)
                ? byCategory
                : Object.entries(byCategory).map(([k, v]) => ({
                    category: k,
                    ...v,
                  }))
              ).map((item, idx) => (
                <div
                  key={item.category || item.name || idx}
                  className="flex justify-between items-center p-3 bg-zinc-50 rounded-lg"
                >
                  <span className="font-medium text-zinc-700">
                    {item.category || item.name || "Unknown"}
                  </span>
                  <div className="text-right">
                    <p className="font-semibold">
                      {getValue(item.count) || getValue(item, "count")} items
                    </p>
                    <p className="text-xs text-zinc-500">
                      {getValue(item.weight) ||
                        getValue(item.total_weight) ||
                        getValue(item, "total_weight")}
                      g
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// Customers Report
function CustomersReport({ data }) {
  if (!data) return <EmptyState message="No customer data available" />;

  const summary = data.summary || {};
  const customers = data.customers || [];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-zinc-500">Total Customers</p>
          <p className="text-2xl font-bold text-zinc-800">
            {summary.total_customers || 0}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-zinc-500">With Active Pledges</p>
          <p className="text-2xl font-bold text-emerald-600">
            {summary.with_active_pledges || 0}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-zinc-500">Blacklisted</p>
          <p className="text-2xl font-bold text-red-600">
            {summary.blacklisted || 0}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-zinc-500">Total Loan Amount</p>
          <p className="text-2xl font-bold text-amber-600">
            {formatCurrency(summary.total_loan_amount || 0)}
          </p>
        </Card>
      </div>

      {/* Customers Table */}
      <Card>
        <div className="p-4 border-b border-zinc-200">
          <h3 className="font-semibold text-zinc-800">Customer Listing</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-50">
              <tr>
                <th className="text-left p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Name
                </th>
                <th className="text-left p-3 text-xs font-semibold text-zinc-500 uppercase">
                  IC Number
                </th>
                <th className="text-left p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Phone
                </th>
                <th className="text-center p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Active Pledges
                </th>
                <th className="text-right p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Total Loan
                </th>
                <th className="text-center p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-500">
                    No customers found
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-zinc-50">
                    <td className="p-3 font-medium">{customer.name}</td>
                    <td className="p-3">{customer.ic_number}</td>
                    <td className="p-3">{customer.phone}</td>
                    <td className="p-3 text-center">
                      {customer.active_pledges_count || 0}
                    </td>
                    <td className="p-3 text-right font-medium">
                      {formatCurrency(customer.total_loan_amount || 0)}
                    </td>
                    <td className="p-3 text-center">
                      <Badge
                        variant={customer.is_blacklisted ? "error" : "success"}
                      >
                        {customer.is_blacklisted ? "Blacklisted" : "Active"}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// Transactions Report
function TransactionsReport({ data }) {
  if (!data) return <EmptyState message="No transaction data available" />;

  const { pledges, renewals, redemptions } = data;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 border-l-4 border-emerald-500">
          <p className="text-sm text-zinc-500">Pledges</p>
          <p className="text-2xl font-bold text-emerald-600">
            {pledges?.count || 0}
          </p>
          <p className="text-sm text-zinc-400">
            {formatCurrency(pledges?.total || 0)}
          </p>
        </Card>
        <Card className="p-4 border-l-4 border-blue-500">
          <p className="text-sm text-zinc-500">Renewals</p>
          <p className="text-2xl font-bold text-blue-600">
            {renewals?.count || 0}
          </p>
          <p className="text-sm text-zinc-400">
            {formatCurrency(renewals?.total || 0)}
          </p>
        </Card>
        <Card className="p-4 border-l-4 border-purple-500">
          <p className="text-sm text-zinc-500">Redemptions</p>
          <p className="text-2xl font-bold text-purple-600">
            {redemptions?.count || 0}
          </p>
          <p className="text-sm text-zinc-400">
            {formatCurrency(redemptions?.total || 0)}
          </p>
        </Card>
      </div>

      {/* Transaction Tables */}
      {pledges?.items?.length > 0 && (
        <Card>
          <div className="p-4 border-b border-zinc-200 bg-emerald-50">
            <h3 className="font-semibold text-emerald-800">New Pledges</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="text-left p-3 text-xs font-semibold text-zinc-500">
                    Time
                  </th>
                  <th className="text-left p-3 text-xs font-semibold text-zinc-500">
                    Pledge No
                  </th>
                  <th className="text-left p-3 text-xs font-semibold text-zinc-500">
                    Customer
                  </th>
                  <th className="text-right p-3 text-xs font-semibold text-zinc-500">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {pledges.items.map((item) => (
                  <tr key={item.id}>
                    <td className="p-3 text-sm">
                      {formatDate(item.created_at, "time")}
                    </td>
                    <td className="p-3 font-medium">{item.pledge_no}</td>
                    <td className="p-3">{item.customer?.name}</td>
                    <td className="p-3 text-right font-medium">
                      {formatCurrency(item.loan_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {renewals?.items?.length > 0 && (
        <Card>
          <div className="p-4 border-b border-zinc-200 bg-blue-50">
            <h3 className="font-semibold text-blue-800">Renewals</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="text-left p-3 text-xs font-semibold text-zinc-500">
                    Time
                  </th>
                  <th className="text-left p-3 text-xs font-semibold text-zinc-500">
                    Pledge No
                  </th>
                  <th className="text-left p-3 text-xs font-semibold text-zinc-500">
                    Customer
                  </th>
                  <th className="text-right p-3 text-xs font-semibold text-zinc-500">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {renewals.items.map((item) => (
                  <tr key={item.id}>
                    <td className="p-3 text-sm">
                      {formatDate(item.created_at, "time")}
                    </td>
                    <td className="p-3 font-medium">
                      {item.pledge?.pledge_no}
                    </td>
                    <td className="p-3">{item.pledge?.customer?.name}</td>
                    <td className="p-3 text-right font-medium">
                      {formatCurrency(item.total_payable)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {redemptions?.items?.length > 0 && (
        <Card>
          <div className="p-4 border-b border-zinc-200 bg-purple-50">
            <h3 className="font-semibold text-purple-800">Redemptions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="text-left p-3 text-xs font-semibold text-zinc-500">
                    Time
                  </th>
                  <th className="text-left p-3 text-xs font-semibold text-zinc-500">
                    Pledge No
                  </th>
                  <th className="text-left p-3 text-xs font-semibold text-zinc-500">
                    Customer
                  </th>
                  <th className="text-right p-3 text-xs font-semibold text-zinc-500">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {redemptions.items.map((item) => (
                  <tr key={item.id}>
                    <td className="p-3 text-sm">
                      {formatDate(item.created_at, "time")}
                    </td>
                    <td className="p-3 font-medium">
                      {item.pledge?.pledge_no}
                    </td>
                    <td className="p-3">{item.pledge?.customer?.name}</td>
                    <td className="p-3 text-right font-medium">
                      {formatCurrency(item.total_payable)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// Reprints Report
function ReprintsReport({ data }) {
  if (!data) return <EmptyState message="No reprint data available" />;

  const summary = data.summary || {};
  const reprints = data.reprints || [];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-zinc-500">Total Reprints</p>
          <p className="text-2xl font-bold text-zinc-800">
            {summary.total_reprints || 0}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-zinc-500">Total Charges</p>
          <p className="text-2xl font-bold text-amber-600">
            {formatCurrency(summary.total_charges || 0)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-zinc-500">Paid</p>
          <p className="text-2xl font-bold text-emerald-600">
            {formatCurrency(summary.paid || 0)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-zinc-500">Unpaid</p>
          <p className="text-2xl font-bold text-red-600">
            {formatCurrency(summary.unpaid || 0)}
          </p>
        </Card>
      </div>

      {/* Reprints Table */}
      <Card>
        <div className="p-4 border-b border-zinc-200">
          <h3 className="font-semibold text-zinc-800">Reprint History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-50">
              <tr>
                <th className="text-left p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Date/Time
                </th>
                <th className="text-left p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Receipt No
                </th>
                <th className="text-left p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Pledge No
                </th>
                <th className="text-left p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Printed By
                </th>
                <th className="text-right p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Charge
                </th>
                <th className="text-center p-3 text-xs font-semibold text-zinc-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {reprints.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-500">
                    No reprints found for selected date range
                  </td>
                </tr>
              ) : (
                reprints.map((reprint) => (
                  <tr key={reprint.id} className="hover:bg-zinc-50">
                    <td className="p-3 text-sm">
                      {formatDate(reprint.printed_at)}
                    </td>
                    <td className="p-3 font-medium">
                      {reprint.pledge?.receipt_no || "-"}
                    </td>
                    <td className="p-3">{reprint.pledge?.pledge_no || "-"}</td>
                    <td className="p-3">
                      {reprint.printed_by?.name || "Unknown"}
                    </td>
                    <td className="p-3 text-right font-medium">
                      {formatCurrency(reprint.charge_amount || 0)}
                    </td>
                    <td className="p-3 text-center">
                      <Badge
                        variant={reprint.charge_paid ? "success" : "warning"}
                      >
                        {reprint.charge_paid ? "Paid" : "Unpaid"}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// Empty State Component
function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center h-96 text-center">
      <FileText className="w-16 h-16 text-zinc-200 mb-4" />
      <p className="text-zinc-500">{message}</p>
      <p className="text-sm text-zinc-400 mt-1">
        Try selecting a different date range or report type
      </p>
    </div>
  );
}
