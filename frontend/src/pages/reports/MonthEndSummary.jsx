import { useState, useEffect, useMemo } from "react";
import { useAppDispatch } from "@/app/hooks";
import reportService from "@/services/reportService";
import inventoryService from "@/services/inventoryService";
import { useNavigate } from "react-router";
import { addToast } from "@/features/ui/uiSlice";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { Card, Button, Input, Badge } from "@/components/common";
import {
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Package,
  RefreshCw,
  Wallet,
  FileText,
  Printer,
  Download,
  AlertTriangle,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Eye,
  CheckSquare,
  Loader2,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Scale,
  Warehouse,
  PieChart,
  Banknote,
  CreditCard,
} from "lucide-react";

export default function MonthEndSummary() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  // State
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );
  const [reportData, setReportData] = useState(null);
  const [inventorySummary, setInventorySummary] = useState({
    in_storage: 0,
    total_weight: 0,
    total_value: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Stats from report data
  const stats = useMemo(() => {
    if (!reportData?.summary) return null;
    const summary = reportData.summary;
    const pledges = reportData.pledges || {};
    const renewals = reportData.renewals || {};
    const redemptions = reportData.redemptions || {};

    return {
      newPledgesCount: pledges.count || 0,
      newPledgesAmount: pledges.total || 0,
      renewalsCount: renewals.count || 0,
      renewalInterest: renewals.total || 0, // This is interest in PaymentSplitReport
      redemptionsCount: redemptions.count || 0,
      redemptionAmount: redemptions.total || 0,
      cashIn: renewals.cash + redemptions.cash,
      cashOut: pledges.cash, // Cash disbursed for pledges
      netCashFlow: (renewals.cash + redemptions.cash) - (pledges.cash),
      totalTransactionCount: summary.transaction_count || 0,
      cashTotal: summary.cash_total || 0,
      transferTotal: summary.transfer_total || 0,
    };
  }, [reportData]);

  // Date range derived from selectedMonth
  const dateRange = useMemo(() => {
    if (!selectedMonth) return { from: "", to: "" };
    const [year, month] = selectedMonth.split("-").map(Number);
    const from = `${year}-${String(month).padStart(2, "0")}-01`;
    // Last day of the month
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { from, to };
  }, [selectedMonth]);

  // Fetch data on mount and month change
  useEffect(() => {
    fetchMonthEndData();
    fetchInventorySummary();
  }, [selectedMonth]);

  const fetchMonthEndData = async () => {
    setIsLoading(true);
    try {
      // Use payment-split report as it gives the exact stats needed for the dashboard summary
      const response = await reportService.getPaymentSplitReport({
        from_date: dateRange.from,
        to_date: dateRange.to,
      });

      if (response.success && response.data) {
        setReportData(response.data);
      }
    } catch (error) {
      console.error("Error fetching month end data:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: error.message || "Failed to load month end data",
        }),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInventorySummary = async () => {
    try {
      const response = await inventoryService.getSummary();
      if (response?.success && response?.data) {
        setInventorySummary({
          in_storage: response.data.in_storage || 0,
          total_weight: parseFloat(response.data.total_weight) || 0,
          total_value: parseFloat(response.data.total_value) || 0,
          total_gross_value: parseFloat(response.data.total_gross_value) || 0,
        });
      }
    } catch (error) {
      console.error("Error fetching inventory summary:", error);
    }
  };

  // Helper to change month
  const handleMonthChange = (offset) => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    setSelectedMonth(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    );
  };

  // Print summary
  const handlePrint = () => {
    if (!stats) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Month End Summary - ${selectedMonth}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
          h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
          .section h3 { margin-top: 0; border-bottom: 1px solid #eee; padding-bottom: 8px; }
          .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
          .row:last-child { border-bottom: none; }
          .label { color: #666; }
          .value { font-weight: bold; }
          .positive { color: #059669; }
          .negative { color: #dc2626; }
          .total { font-size: 1.2em; background: #f5f5f5; padding: 10px; border-radius: 4px; }
          .signature { margin-top: 40px; display: flex; justify-content: space-between; }
          .signature-line { border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 5px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>Month End Summary</h1>
        <div class="header">
          <div><strong>Month:</strong> ${new Date(
            dateRange.from,
          ).toLocaleDateString("en-MY", {
            year: "numeric",
            month: "long",
          })}</div>
          <div><strong>Period:</strong> ${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}</div>
        </div>

        <div class="section">
          <h3>📊 Monthly Transaction Summary</h3>
          <div class="row"><span class="label">New Pledges (Cash Out)</span><span class="value">${stats.newPledgesCount} txn — ${formatCurrency(stats.newPledgesAmount)}</span></div>
          <div class="row"><span class="label">Redemptions (Cash In)</span><span class="value">${stats.redemptionsCount} txn — ${formatCurrency(stats.redemptionAmount)}</span></div>
          <div class="row"><span class="label">Renewals (Interest In)</span><span class="value">${stats.renewalsCount} txn — ${formatCurrency(stats.renewalInterest)}</span></div>
        </div>

        <div class="section">
          <h3>📦 Live Inventory Status</h3>
          <div class="row"><span class="label">Items in Storage</span><span class="value">${inventorySummary.in_storage} items</span></div>
          <div class="row"><span class="label">Total Weight</span><span class="value">${parseFloat(inventorySummary.total_weight).toFixed(3)}g</span></div>
          <div class="row"><span class="label">Total Loan Value</span><span class="value">${formatCurrency(inventorySummary.total_value)}</span></div>
          <div class="row"><span class="label">Total Market Value (Gross)</span><span class="value">${formatCurrency(inventorySummary.total_gross_value)}</span></div>
        </div>

        <div class="section">
          <h3>💰 Cash Flow Summary</h3>
          <div class="row"><span class="label">Total Cash In (Redemptions + Renewals)</span><span class="value positive">+ ${formatCurrency(stats.cashIn)}</span></div>
          <div class="row"><span class="label">Total Cash Out (Pledges Disbursed)</span><span class="value negative">- ${formatCurrency(stats.cashOut)}</span></div>
          <div class="row total"><span class="label">Net Cash Movement</span><span class="value ${stats.netCashFlow >= 0 ? "positive" : "negative"}">${stats.netCashFlow >= 0 ? "+" : ""}${formatCurrency(stats.netCashFlow)}</span></div>
        </div>

        <div class="section">
          <h3>💳 Payment Methods Breakdown</h3>
          <div class="row"><span class="label">Physical Cash Total</span><span class="value">${formatCurrency(stats.cashTotal)}</span></div>
          <div class="row"><span class="label">Online Transfer Total</span><span class="value">${formatCurrency(stats.transferTotal)}</span></div>
        </div>

        <div class="signature">
          <div class="signature-line">Branch Manager</div>
          <div class="signature-line">Accountant</div>
          <div class="signature-line">Director</div>
        </div>

        <p style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
          Generated on ${new Date().toLocaleString("en-MY")} | PawnSys
        </p>
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
    setIsExporting(true);
    try {
      await reportService.exportReport("payments", "csv", {
        from_date: dateRange.from,
        to_date: dateRange.to,
      });
      dispatch(
        addToast({
          type: "success",
          title: "Export Started",
          message: "Monthly summary export has started",
        }),
      );
    } catch (error) {
      dispatch(
        addToast({
          type: "error",
          title: "Export Failed",
          message: error.message || "Failed to export report",
        }),
      );
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading && !reportData) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">Generating month end summary...</p>
        </div>
      </div>
    );
  }

  return (
    <PageWrapper
      title="Month End Summary"
      subtitle="Monthly business report and financial summary"
      fullWidth={true}
      actions={
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-zinc-100 rounded-lg p-1 border border-zinc-200">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleMonthChange(-1)}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-40 border-none bg-transparent h-8 text-center text-sm font-semibold focus:ring-0"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleMonthChange(1)}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            leftIcon={RefreshCw}
            onClick={fetchMonthEndData}
            loading={isLoading}
          >
            Refresh
          </Button>
          <Button
            variant="outline"
            leftIcon={Printer}
            onClick={handlePrint}
            disabled={!stats}
          >
            Print
          </Button>
          <Button
            variant="outline"
            leftIcon={Download}
            onClick={handleExport}
            loading={isExporting}
            disabled={!stats}
          >
            Export
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Month Banner - Improved to match existing UI */}
        <Card className="p-4 mb-6 border-2 bg-amber-50 border-amber-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center text-zinc-900 shadow-sm">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-zinc-800">
                  {new Date(dateRange.from).toLocaleDateString("en-MY", {
                    month: "long",
                    year: "numeric",
                  })}
                </h2>
                <div className="flex items-center gap-2 text-zinc-500 text-sm">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatDate(dateRange.from)} to {formatDate(dateRange.to)}</span>
                </div>
              </div>
            </div>
            <div className="text-right flex items-center gap-6">
              <div>
                <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-0.5">
                  Transactions
                </p>
                <p className="text-2xl font-black text-zinc-800">
                  {stats?.totalTransactionCount || 0}
                </p>
              </div>
              <div className="h-10 w-px bg-zinc-200" />
              <Badge variant="success" className="h-fit">MONTHLY REPORT</Badge>
            </div>
          </div>
        </Card>

        {/* Stats Cards - Updated to match Day End Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">New Pledges</p>
                <p className="text-2xl font-bold text-zinc-800">
                  {stats?.newPledgesCount || 0}
                </p>
                <p className="text-xs text-blue-600 font-medium">
                  {formatCurrency(stats?.newPledgesAmount || 0)}
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
                  {stats?.renewalsCount || 0}
                </p>
                <p className="text-xs text-amber-600 font-medium">
                  {formatCurrency(stats?.renewalInterest || 0)} interest
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
                  {stats?.redemptionsCount || 0}
                </p>
                <p className="text-xs text-emerald-600 font-medium">
                  {formatCurrency(stats?.redemptionAmount || 0)}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center">
                <Receipt className="w-6 h-6 text-zinc-600" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Net Volume</p>
                <p className="text-2xl font-bold text-zinc-800">
                  {formatCurrency(stats?.cashTotal + stats?.transferTotal || 0)}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                    {Math.round((stats?.cashTotal / (stats?.cashTotal + stats?.transferTotal || 1)) * 100)}% Cash
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Financials */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <h3 className="font-semibold text-zinc-800 mb-6 flex items-center gap-2 text-sm uppercase tracking-wider">
                <Banknote className="w-4 h-4 text-amber-500" />
                Cash Flow Summary
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-emerald-700 uppercase tracking-tight">Financial Inflow</span>
                    <ArrowDownRight className="w-4 h-4 text-emerald-500" />
                  </div>
                  <p className="text-2xl font-bold text-emerald-600">
                    {formatCurrency(stats?.cashIn || 0)}
                  </p>
                  <p className="text-[10px] text-emerald-500 mt-2 font-medium">REDEEM & RENEW</p>
                </div>

                <div className="p-4 rounded-xl bg-red-50 border border-red-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-red-700 uppercase tracking-tight">Financial Outflow</span>
                    <ArrowUpRight className="w-4 h-4 text-red-500" />
                  </div>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(stats?.cashOut || 0)}
                  </p>
                  <p className="text-[10px] text-red-500 mt-2 font-medium">PLEDGE DISBURSED</p>
                </div>

                <div
                  className={cn(
                    "p-4 rounded-xl border shadow-sm",
                    stats?.netCashFlow >= 0
                      ? "bg-blue-50 border-blue-200"
                      : "bg-orange-50 border-orange-200",
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={cn(
                        "text-xs font-semibold uppercase tracking-tight",
                        stats?.netCashFlow >= 0 ? "text-blue-700" : "text-orange-700",
                      )}
                    >
                      Net Cash Flow
                    </span>
                    {stats?.netCashFlow >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-blue-500" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-orange-500" />
                    )}
                  </div>
                  <p
                    className={cn(
                      "text-2xl font-bold",
                      stats?.netCashFlow >= 0 ? "text-blue-600" : "text-orange-600",
                    )}
                  >
                    {stats?.netCashFlow >= 0 ? "+" : ""}
                    {formatCurrency(stats?.netCashFlow || 0)}
                  </p>
                  <p className={cn(
                    "text-[10px] mt-2 font-medium",
                    stats?.netCashFlow >= 0 ? "text-blue-500" : "text-orange-500"
                  )}>MONTHLY VARIANCE</p>
                </div>
              </div>
            </Card>

            {/* Transaction Mix - Using ReportsScreen Styled Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-5 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-none shadow-md">
                <div className="flex justify-between items-start mb-4">
                  <p className="text-emerald-100 text-sm font-medium">Physical Cash Total</p>
                  <Banknote className="w-6 h-6 opacity-40" />
                </div>
                <p className="text-3xl font-bold mb-2">
                  {formatCurrency(stats?.cashTotal || 0)}
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-white h-full" 
                      style={{ width: `${(stats?.cashTotal / (stats?.cashTotal + (stats?.transferTotal || 1))) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-emerald-100 font-bold whitespace-nowrap">
                    {Math.round((stats?.cashTotal / (stats?.cashTotal + (stats?.transferTotal || 0) || 1)) * 100)}%
                  </span>
                </div>
              </Card>

              <Card className="p-5 bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none shadow-md">
                <div className="flex justify-between items-start mb-4">
                  <p className="text-blue-100 text-sm font-medium">Online Transfer Total</p>
                  <CreditCard className="w-6 h-6 opacity-40" />
                </div>
                <p className="text-3xl font-bold mb-2">
                  {formatCurrency(stats?.transferTotal || 0)}
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-white h-full" 
                      style={{ width: `${(stats?.transferTotal / (stats?.cashTotal + (stats?.transferTotal || 1))) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-blue-100 font-bold whitespace-nowrap">
                    {Math.round((stats?.transferTotal / (stats?.cashTotal + (stats?.transferTotal || 0) || 1)) * 100)}%
                  </span>
                </div>
              </Card>
            </div>
          </div>

          {/* Side Info */}
          <div className="space-y-6">
            {/* Inventory Status - Improved visual style */}
            <Card className="overflow-hidden border-zinc-200">
              <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
                <h3 className="font-semibold text-zinc-800 text-sm">LIVE STOCK STATUS</h3>
                <Package className="w-4 h-4 text-zinc-400" />
              </div>
              
              <div className="p-0">
                <div className="p-4 border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Items in Vault</span>
                    <span className="text-sm font-bold text-zinc-900">{inventorySummary.in_storage} units</span>
                  </div>
                </div>

                <div className="p-4 border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Total Net Weight</span>
                    <span className="text-sm font-bold text-zinc-900">{parseFloat(inventorySummary.total_weight).toFixed(3)}g</span>
                  </div>
                </div>

                <div className="p-4 border-b border-zinc-100 bg-amber-50/30 hover:bg-amber-50/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-amber-700 font-semibold">Total Loan Volume</span>
                    <span className="text-sm font-bold text-amber-600">{formatCurrency(inventorySummary.total_value)}</span>
                  </div>
                </div>

                <div className="p-4 bg-blue-50/30 hover:bg-blue-50/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-blue-700 font-semibold">Market Valuation</span>
                    <div className="text-right">
                      <span className="text-sm font-bold text-blue-600 block">{formatCurrency(inventorySummary.total_gross_value)}</span>
                      <span className="text-[9px] text-blue-400">Current Market Price</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-4 border border-zinc-200 bg-white shadow-sm">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center flex-shrink-0">
                  <Info className="w-4 h-4 text-zinc-500" />
                </div>
                <div className="text-[11px] text-zinc-500 leading-relaxed">
                  <p className="font-bold text-zinc-700 mb-1">AGGREGATED DATA NOTICE</p>
                  All figures shown are dynamically calculated from real-time database transactions for the period of <strong>{new Date(dateRange.from).toLocaleDateString("en-MY", { month: "long" })}</strong>.
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
