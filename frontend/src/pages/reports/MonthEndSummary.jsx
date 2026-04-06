import { useState, useEffect, useMemo } from "react";
import { useAppDispatch } from "@/app/hooks";
import reportService from "@/services/reportService";
import inventoryService from "@/services/inventoryService";
import { useNavigate } from "react-router";
import { addToast } from "@/features/ui/uiSlice";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { Card, Button, Input, Badge } from "@/components/common";
import {
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  Package,
  RefreshCw,
  Wallet,
  FileText,
  Printer,
  Download,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Banknote,
  CreditCard,
  Scale,
  BarChart3,
  ShieldCheck,
  Layers,
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
      renewalInterest: renewals.total || 0,
      redemptionsCount: redemptions.count || 0,
      redemptionAmount: redemptions.total || 0,
      cashIn: renewals.cash + redemptions.cash,
      cashOut: pledges.cash,
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
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { from, to };
  }, [selectedMonth]);

  useEffect(() => {
    fetchMonthEndData();
    fetchInventorySummary();
  }, [selectedMonth]);

  const fetchMonthEndData = async () => {
    setIsLoading(true);
    try {
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

  const handleMonthChange = (offset) => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    setSelectedMonth(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    );
  };

  // Print summary — accounting-style ledger
  const handlePrint = () => {
    if (!stats) return;

    const monthLabel = new Date(dateRange.from).toLocaleDateString("en-MY", {
      year: "numeric",
      month: "long",
    });

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Month End Summary - ${selectedMonth}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Arial', 'Helvetica Neue', sans-serif;
            padding: 30px 40px;
            max-width: 780px;
            margin: 0 auto;
            color: #1a1a1a;
            font-size: 13px;
            line-height: 1.5;
          }
          h1 {
            text-align: center;
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 4px;
            letter-spacing: 0.5px;
          }
          .sub-header {
            text-align: center;
            font-size: 12px;
            color: #555;
            margin-bottom: 24px;
          }
          .section {
            margin-bottom: 22px;
          }
          .section-title {
            font-size: 14px;
            font-weight: 700;
            border-bottom: 2px solid #1a1a1a;
            padding-bottom: 4px;
            margin-bottom: 6px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          table th {
            text-align: left;
            font-weight: 700;
            font-size: 11px;
            border-bottom: 1px solid #999;
            padding: 4px 8px 4px 0;
            color: #333;
          }
          table th.right, table td.right {
            text-align: right;
          }
          table td {
            padding: 5px 8px 5px 0;
            border-bottom: 1px solid #e8e8e8;
            font-size: 13px;
          }
          table tr:last-child td {
            border-bottom: none;
          }
          .total-row td {
            border-top: 1px solid #333;
            border-bottom: 2px solid #333 !important;
            font-weight: 700;
            padding-top: 6px;
            padding-bottom: 6px;
          }
          .positive { color: #0a7d2e; }
          .negative { color: #c0392b; }
          .signature-area {
            margin-top: 50px;
            display: flex;
            justify-content: space-between;
            padding: 0 20px;
          }
          .signature-block {
            text-align: center;
            width: 160px;
          }
          .signature-line {
            border-top: 1px solid #333;
            padding-top: 6px;
            font-size: 12px;
            font-weight: 600;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #999;
            font-size: 10px;
          }
          @media print {
            body { padding: 15px 25px; }
          }
        </style>
      </head>
      <body>
        <h1>Month End Summary</h1>
        <div class="sub-header">
          Month: ${monthLabel} &nbsp;&nbsp;|&nbsp;&nbsp; Period: ${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}
        </div>

        <div class="section">
          <div class="section-title">Monthly Transaction Summary</div>
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th class="right">Count</th>
                <th class="right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>New Pledges (Cash Out)</td>
                <td class="right">${stats.newPledgesCount} txn</td>
                <td class="right">${formatCurrency(stats.newPledgesAmount)}</td>
              </tr>
              <tr>
                <td>Redemptions (Cash In)</td>
                <td class="right">${stats.redemptionsCount} txn</td>
                <td class="right">${formatCurrency(stats.redemptionAmount)}</td>
              </tr>
              <tr>
                <td>Renewals (Interest In)</td>
                <td class="right">${stats.renewalsCount} txn</td>
                <td class="right">${formatCurrency(stats.renewalInterest)}</td>
              </tr>
              <tr class="total-row">
                <td>Total</td>
                <td class="right">${stats.totalTransactionCount} txn</td>
                <td class="right">${formatCurrency(stats.newPledgesAmount + stats.redemptionAmount + stats.renewalInterest)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="section">
          <div class="section-title">Live Inventory Status</div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th class="right">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Items in Storage</td>
                <td class="right">${inventorySummary.in_storage} items</td>
              </tr>
              <tr>
                <td>Total Weight</td>
                <td class="right">${parseFloat(inventorySummary.total_weight).toFixed(3)}g</td>
              </tr>
              <tr>
                <td>Total Loan Value</td>
                <td class="right">${formatCurrency(inventorySummary.total_value)}</td>
              </tr>
              <tr>
                <td>Total Market Value (Gross)</td>
                <td class="right">${formatCurrency(inventorySummary.total_gross_value)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="section">
          <div class="section-title">Cash Flow Summary</div>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th class="right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Total Cash In (Redemptions + Renewals)</td>
                <td class="right positive">+ ${formatCurrency(stats.cashIn)}</td>
              </tr>
              <tr>
                <td>Total Cash Out (Pledges Disbursed)</td>
                <td class="right negative">- ${formatCurrency(stats.cashOut)}</td>
              </tr>
              <tr class="total-row">
                <td>Net Cash Movement</td>
                <td class="right ${stats.netCashFlow >= 0 ? "positive" : "negative"}">${stats.netCashFlow >= 0 ? "+" : ""}${formatCurrency(stats.netCashFlow)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="section">
          <div class="section-title">Payment Methods Breakdown</div>
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th class="right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Physical Cash Total</td>
                <td class="right">${formatCurrency(stats.cashTotal)}</td>
              </tr>
              <tr>
                <td>Online Transfer Total</td>
                <td class="right">${formatCurrency(stats.transferTotal)}</td>
              </tr>
              <tr class="total-row">
                <td>Grand Total</td>
                <td class="right">${formatCurrency(stats.cashTotal + stats.transferTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="signature-area">
          <div class="signature-block">
            <div class="signature-line">Branch Manager</div>
          </div>
          <div class="signature-block">
            <div class="signature-line">Accountant</div>
          </div>
          <div class="signature-block">
            <div class="signature-line">Director</div>
          </div>
        </div>

        <div class="footer">
          Generated on ${new Date().toLocaleString("en-MY")} | PawnSys
        </div>
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

  // Derived calculations
  const totalVolume = (stats?.cashTotal || 0) + (stats?.transferTotal || 0);
  const cashPercent = totalVolume > 0 ? Math.round((stats?.cashTotal / totalVolume) * 100) : 0;
  const transferPercent = totalVolume > 0 ? 100 - cashPercent : 0;
  const pledgeToRedeemRatio = stats?.redemptionsCount > 0
    ? (stats.newPledgesCount / stats.redemptionsCount).toFixed(2)
    : "N/A";

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
        {/* Executive Banner */}
        <Card className="overflow-hidden border-2 border-amber-200 shadow-lg">
          <div className="bg-gradient-to-r from-amber-50 via-amber-100/80 to-amber-50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <Calendar className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">
                    {new Date(dateRange.from).toLocaleDateString("en-MY", {
                      month: "long",
                      year: "numeric",
                    })}
                  </h2>
                  <div className="flex items-center gap-2 text-zinc-500 text-sm mt-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Reporting Period: {formatDate(dateRange.from)} to {formatDate(dateRange.to)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-[0.2em]">
                    Total Transactions
                  </p>
                  <p className="text-3xl font-black text-zinc-800 tabular-nums">
                    {stats?.totalTransactionCount || 0}
                  </p>
                </div>
                <div className="h-12 w-px bg-amber-300" />
                <div className="text-right">
                  <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-[0.2em]">
                    Total Volume
                  </p>
                  <p className="text-xl font-bold text-amber-700 tabular-nums">
                    {formatCurrency(totalVolume)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card className="p-4 hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
              <div className="flex items-center justify-between mb-2">
                <FileText className="w-5 h-5 text-blue-500" />
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">PLEDGE</span>
              </div>
              <p className="text-2xl font-black text-zinc-900 tabular-nums">{stats?.newPledgesCount || 0}</p>
              <p className="text-xs text-zinc-500 mt-1">{formatCurrency(stats?.newPledgesAmount || 0)}</p>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="p-4 hover:shadow-md transition-shadow border-l-4 border-l-amber-500">
              <div className="flex items-center justify-between mb-2">
                <RefreshCw className="w-5 h-5 text-amber-500" />
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">RENEW</span>
              </div>
              <p className="text-2xl font-black text-zinc-900 tabular-nums">{stats?.renewalsCount || 0}</p>
              <p className="text-xs text-zinc-500 mt-1">{formatCurrency(stats?.renewalInterest || 0)} interest</p>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="p-4 hover:shadow-md transition-shadow border-l-4 border-l-emerald-500">
              <div className="flex items-center justify-between mb-2">
                <Wallet className="w-5 h-5 text-emerald-500" />
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">REDEEM</span>
              </div>
              <p className="text-2xl font-black text-zinc-900 tabular-nums">{stats?.redemptionsCount || 0}</p>
              <p className="text-xs text-zinc-500 mt-1">{formatCurrency(stats?.redemptionAmount || 0)}</p>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="p-4 hover:shadow-md transition-shadow border-l-4 border-l-violet-500">
              <div className="flex items-center justify-between mb-2">
                <BarChart3 className="w-5 h-5 text-violet-500" />
                <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">RATIO</span>
              </div>
              <p className="text-2xl font-black text-zinc-900 tabular-nums">{pledgeToRedeemRatio}</p>
              <p className="text-xs text-zinc-500 mt-1">Pledge : Redeem</p>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card className={cn(
              "p-4 hover:shadow-md transition-shadow border-l-4",
              stats?.netCashFlow >= 0 ? "border-l-emerald-500" : "border-l-red-500"
            )}>
              <div className="flex items-center justify-between mb-2">
                {stats?.netCashFlow >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-500" />
                )}
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded",
                  stats?.netCashFlow >= 0 ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"
                )}>NET</span>
              </div>
              <p className={cn(
                "text-lg font-black tabular-nums",
                stats?.netCashFlow >= 0 ? "text-emerald-700" : "text-red-600"
              )}>
                {stats?.netCashFlow >= 0 ? "+" : ""}{formatCurrency(stats?.netCashFlow || 0)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">Net Cash Flow</p>
            </Card>
          </motion.div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - 2 cols */}
          <div className="lg:col-span-2 space-y-6">

            {/* Transaction Breakdown Table */}
            <Card className="overflow-hidden">
              <div className="px-6 py-4 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
                <h3 className="font-semibold text-zinc-800 flex items-center gap-2 text-sm uppercase tracking-wider">
                  <Receipt className="w-4 h-4 text-amber-500" />
                  Transaction Breakdown
                </h3>
                <Badge variant="outline" className="text-[10px]">
                  {stats?.totalTransactionCount || 0} TOTAL
                </Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-zinc-50/50">
                    <tr>
                      <th className="text-left p-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Type</th>
                      <th className="text-center p-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Count</th>
                      <th className="text-right p-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Amount</th>
                      <th className="text-center p-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Direction</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    <tr className="hover:bg-zinc-50/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                            <FileText className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <span className="font-medium text-zinc-800">New Pledges</span>
                            <p className="text-[11px] text-zinc-400">Loan disbursement</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-lg font-bold text-zinc-800">{stats?.newPledgesCount || 0}</span>
                      </td>
                      <td className="p-4 text-right font-semibold text-zinc-800 tabular-nums">
                        {formatCurrency(stats?.newPledgesAmount || 0)}
                      </td>
                      <td className="p-4 text-center">
                        <Badge variant="error">Cash Out</Badge>
                      </td>
                    </tr>
                    <tr className="hover:bg-zinc-50/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                            <RefreshCw className="w-4 h-4 text-amber-600" />
                          </div>
                          <div>
                            <span className="font-medium text-zinc-800">Renewals</span>
                            <p className="text-[11px] text-zinc-400">Interest collection</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-lg font-bold text-zinc-800">{stats?.renewalsCount || 0}</span>
                      </td>
                      <td className="p-4 text-right font-semibold text-zinc-800 tabular-nums">
                        {formatCurrency(stats?.renewalInterest || 0)}
                      </td>
                      <td className="p-4 text-center">
                        <Badge variant="success">Cash In</Badge>
                      </td>
                    </tr>
                    <tr className="hover:bg-zinc-50/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                            <Wallet className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div>
                            <span className="font-medium text-zinc-800">Redemptions</span>
                            <p className="text-[11px] text-zinc-400">Loan repayment</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-lg font-bold text-zinc-800">{stats?.redemptionsCount || 0}</span>
                      </td>
                      <td className="p-4 text-right font-semibold text-zinc-800 tabular-nums">
                        {formatCurrency(stats?.redemptionAmount || 0)}
                      </td>
                      <td className="p-4 text-center">
                        <Badge variant="success">Cash In</Badge>
                      </td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-zinc-100/80 font-semibold border-t-2 border-zinc-300">
                    <tr>
                      <td className="p-4 font-bold text-zinc-900">Monthly Total</td>
                      <td className="p-4 text-center font-bold text-zinc-900">{stats?.totalTransactionCount || 0}</td>
                      <td className="p-4 text-right font-bold text-zinc-900 tabular-nums">
                        {formatCurrency((stats?.newPledgesAmount || 0) + (stats?.redemptionAmount || 0) + (stats?.renewalInterest || 0))}
                      </td>
                      <td className="p-4"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>

            {/* Cash Flow Analysis */}
            <Card className="p-6">
              <h3 className="font-semibold text-zinc-800 mb-6 flex items-center gap-2 text-sm uppercase tracking-wider">
                <Banknote className="w-4 h-4 text-amber-500" />
                Cash Flow Analysis
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Inflow</span>
                    <div className="w-8 h-8 rounded-full bg-emerald-200/60 flex items-center justify-center">
                      <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-emerald-700 tabular-nums">
                    {formatCurrency(stats?.cashIn || 0)}
                  </p>
                  <div className="mt-3 pt-3 border-t border-emerald-200/60 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-emerald-600">Redemptions</span>
                      <span className="font-semibold text-emerald-700 tabular-nums">{formatCurrency(stats?.redemptionAmount || 0)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-emerald-600">Interest</span>
                      <span className="font-semibold text-emerald-700 tabular-nums">{formatCurrency(stats?.renewalInterest || 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-gradient-to-br from-red-50 to-red-100/50 border border-red-200">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-red-700 uppercase tracking-wider">Outflow</span>
                    <div className="w-8 h-8 rounded-full bg-red-200/60 flex items-center justify-center">
                      <ArrowUpRight className="w-4 h-4 text-red-600" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-red-700 tabular-nums">
                    {formatCurrency(stats?.cashOut || 0)}
                  </p>
                  <div className="mt-3 pt-3 border-t border-red-200/60 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-red-600">Pledges Disbursed</span>
                      <span className="font-semibold text-red-700 tabular-nums">{formatCurrency(stats?.newPledgesAmount || 0)}</span>
                    </div>
                  </div>
                </div>

                <div className={cn(
                  "p-5 rounded-2xl border",
                  stats?.netCashFlow >= 0
                    ? "bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200"
                    : "bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200",
                )}>
                  <div className="flex items-center justify-between mb-4">
                    <span className={cn(
                      "text-xs font-bold uppercase tracking-wider",
                      stats?.netCashFlow >= 0 ? "text-amber-700" : "text-orange-700",
                    )}>Net Movement</span>
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center",
                      stats?.netCashFlow >= 0 ? "bg-amber-200/60" : "bg-orange-200/60",
                    )}>
                      {stats?.netCashFlow >= 0 ? (
                        <TrendingUp className="w-4 h-4 text-amber-600" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-orange-600" />
                      )}
                    </div>
                  </div>
                  <p className={cn(
                    "text-2xl font-black tabular-nums",
                    stats?.netCashFlow >= 0 ? "text-amber-700" : "text-orange-700",
                  )}>
                    {stats?.netCashFlow >= 0 ? "+" : ""}{formatCurrency(stats?.netCashFlow || 0)}
                  </p>
                  <p className={cn(
                    "text-[10px] mt-3 font-semibold uppercase tracking-wider",
                    stats?.netCashFlow >= 0 ? "text-amber-500" : "text-orange-500",
                  )}>
                    {stats?.netCashFlow >= 0 ? "Positive Cash Position" : "Net Cash Deficit"}
                  </p>
                </div>
              </div>
            </Card>

            {/* Payment Methods */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="overflow-hidden border-amber-200">
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-5">
                  <div className="flex justify-between items-start mb-5">
                    <div>
                      <p className="text-amber-600 text-xs font-semibold uppercase tracking-wider">Physical Cash</p>
                      <p className="text-3xl font-black mt-1 tabular-nums text-zinc-900">
                        {formatCurrency(stats?.cashTotal || 0)}
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-amber-200/60 flex items-center justify-center">
                      <Banknote className="w-5 h-5 text-amber-600" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-amber-200/50 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${cashPercent}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-amber-700">{cashPercent}%</span>
                  </div>
                </div>
              </Card>

              <Card className="overflow-hidden border-zinc-200">
                <div className="bg-gradient-to-br from-zinc-50 to-zinc-100 p-5">
                  <div className="flex justify-between items-start mb-5">
                    <div>
                      <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Online Transfer</p>
                      <p className="text-3xl font-black mt-1 tabular-nums text-zinc-900">
                        {formatCurrency(stats?.transferTotal || 0)}
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-zinc-200/60 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-zinc-500" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-zinc-200/50 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-zinc-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${transferPercent}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-zinc-600">{transferPercent}%</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">

            {/* Vault Inventory */}
            <Card className="overflow-hidden border-amber-200">
              <div className="px-5 py-4 bg-gradient-to-r from-amber-100 to-amber-50 border-b border-amber-200 flex items-center justify-between">
                <h3 className="font-semibold text-zinc-800 text-sm tracking-wide flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  Vault Inventory
                </h3>
                <Package className="w-4 h-4 text-amber-400" />
              </div>

              <div className="divide-y divide-zinc-100">
                <div className="p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center">
                      <Layers className="w-4 h-4 text-zinc-500" />
                    </div>
                    <span className="text-sm text-zinc-600">Items in Vault</span>
                  </div>
                  <span className="text-sm font-bold text-zinc-900 tabular-nums">{inventorySummary.in_storage}</span>
                </div>

                <div className="p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center">
                      <Scale className="w-4 h-4 text-zinc-500" />
                    </div>
                    <span className="text-sm text-zinc-600">Total Weight</span>
                  </div>
                  <span className="text-sm font-bold text-zinc-900 tabular-nums">{parseFloat(inventorySummary.total_weight).toFixed(3)}g</span>
                </div>

                <div className="p-4 flex items-center justify-between bg-amber-50/40 hover:bg-amber-50/70 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                      <Banknote className="w-4 h-4 text-amber-600" />
                    </div>
                    <span className="text-sm font-semibold text-amber-800">Loan Exposure</span>
                  </div>
                  <span className="text-sm font-bold text-amber-700 tabular-nums">{formatCurrency(inventorySummary.total_value)}</span>
                </div>

                <div className="p-4 flex items-center justify-between bg-amber-50/30 hover:bg-amber-50/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-amber-800 block">Market Value</span>
                      <span className="text-[10px] text-amber-400">Gross valuation</span>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-amber-700 tabular-nums">{formatCurrency(inventorySummary.total_gross_value)}</span>
                </div>
              </div>
            </Card>

            {/* Monthly Highlights */}
            <Card className="overflow-hidden">
              <div className="px-5 py-4 bg-gradient-to-r from-amber-500 to-amber-600 flex items-center justify-between">
                <h3 className="font-semibold text-zinc-900 text-sm tracking-wide flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Monthly Highlights
                </h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                  <span className="text-xs text-zinc-500 font-medium">Avg. Pledge Size</span>
                  <span className="text-sm font-bold text-zinc-900 tabular-nums">
                    {stats?.newPledgesCount > 0
                      ? formatCurrency(stats.newPledgesAmount / stats.newPledgesCount)
                      : "RM 0.00"}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                  <span className="text-xs text-zinc-500 font-medium">Avg. Redemption</span>
                  <span className="text-sm font-bold text-zinc-900 tabular-nums">
                    {stats?.redemptionsCount > 0
                      ? formatCurrency(stats.redemptionAmount / stats.redemptionsCount)
                      : "RM 0.00"}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                  <span className="text-xs text-zinc-500 font-medium">Interest Earned</span>
                  <span className="text-sm font-bold text-amber-700 tabular-nums">
                    {formatCurrency(stats?.renewalInterest || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                  <span className="text-xs text-zinc-500 font-medium">Cash vs Transfer</span>
                  <span className="text-sm font-bold text-zinc-900">
                    {cashPercent}% / {transferPercent}%
                  </span>
                </div>
              </div>
            </Card>

            {/* Report Notice */}
            <Card className="p-4 border border-zinc-200 bg-zinc-50/50">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center flex-shrink-0">
                  <Info className="w-4 h-4 text-zinc-500" />
                </div>
                <div className="text-[11px] text-zinc-500 leading-relaxed">
                  <p className="font-bold text-zinc-700 mb-1">REPORT DATA</p>
                  All figures are dynamically calculated from real-time transaction data for <strong>{new Date(dateRange.from).toLocaleDateString("en-MY", { month: "long", year: "numeric" })}</strong>. Values update automatically as transactions are processed.
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
