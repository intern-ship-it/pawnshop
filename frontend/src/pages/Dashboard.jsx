/**
 * Dashboard Page - Connected to Laravel API
 * Displays real-time data from backend
 *
 * UPDATED: Added Payment Split bar inside each summary card (Pledges/Renewals/Redemptions)
 */

import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAppSelector, useAppDispatch } from "@/app/hooks";
import {
  fetchAllDashboardData,
  fetchDashboardSummary,
  fetchTodayStats,
  fetchPaymentSplit,
  fetchDueReminders,
  fetchOverduePledges,
  fetchGoldPrices,
} from "@/features/dashboard/dashboardSlice";
import { formatCurrency } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import {
  Plus,
  RefreshCw,
  Wallet,
  CreditCard,
  AlertTriangle,
  ArrowRight,
  Loader2,
  TrendingUp,
  TrendingDown,
  Users,
  Package,
  Clock,
  CheckCircle,
  Calendar,
  Banknote,
  Building2,
} from "lucide-react";

// Payment Split Mini Bar Component
const PaymentSplitBar = ({
  cash = 0,
  transfer = 0,
  cashAmount = 0,
  transferAmount = 0,
  size = "sm",
}) => {
  const total = cash + transfer;
  const cashPercent = total > 0 ? Math.round((cash / total) * 100) : 0;
  const transferPercent = total > 0 ? 100 - cashPercent : 0;

  return (
    <div
      className={cn(
        "mt-3 pt-3 border-t border-zinc-100",
        size === "lg" && "mt-4 pt-4"
      )}
    >
      <div className="flex items-center justify-between text-xs mb-1.5">
        <div className="flex items-center gap-1.5">
          <Banknote className="w-3 h-3 text-emerald-500" />
          <span className="text-zinc-500">Cash</span>
          <span className="font-semibold text-zinc-700">{cashPercent}%</span>
          {cashAmount > 0 && (
            <span className="text-zinc-400">
              ({formatCurrency(cashAmount)})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Building2 className="w-3 h-3 text-blue-500" />
          <span className="text-zinc-500">Transfer</span>
          <span className="font-semibold text-zinc-700">
            {transferPercent}%
          </span>
          {transferAmount > 0 && (
            <span className="text-zinc-400">
              ({formatCurrency(transferAmount)})
            </span>
          )}
        </div>
      </div>
      <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden flex">
        <div
          className="h-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${cashPercent}%` }}
        />
        <div
          className="h-full bg-blue-500 transition-all duration-500"
          style={{ width: `${transferPercent}%` }}
        />
      </div>
    </div>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user, role } = useAppSelector((state) => state.auth);
  const { goldPrice } = useAppSelector((state) => state.ui);

  // Get dashboard state from Redux (connected to API)
  const {
    summary,
    todayStats,
    paymentSplit,
    dueReminders,
    overduePledges,
    goldPrices,
    loading,
    error,
    lastFetched,
  } = useAppSelector((state) => state.dashboard);

  // Fetch dashboard data on mount
  useEffect(() => {
    dispatch(fetchAllDashboardData());
  }, [dispatch]);

  // Refresh data handler
  const handleRefresh = () => {
    dispatch(fetchAllDashboardData());
  };

  // Calculate stats from API data (NOT hardcoded!)
  const stats = {
    todayPledges: {
      count: todayStats?.newPledges?.count || 0,
      amount: todayStats?.newPledges?.amount || 0,
      cash: todayStats?.newPledges?.cash || 0,
      transfer: todayStats?.newPledges?.transfer || 0,
      trend:
        summary?.monthlyGrowth > 0
          ? `+${summary?.monthlyGrowth}%`
          : `${summary?.monthlyGrowth || 0}%`,
    },
    renewals: {
      amount: todayStats?.renewals?.amount || 0,
      transactions: todayStats?.renewals?.count || 0,
      cash: todayStats?.renewals?.cash || 0,
      transfer: todayStats?.renewals?.transfer || 0,
    },
    redemptions: {
      count: todayStats?.redemptions?.count || 0,
      amount: todayStats?.redemptions?.amount || 0,
      cash: todayStats?.redemptions?.cash || 0,
      transfer: todayStats?.redemptions?.transfer || 0,
    },
    paymentSplit: {
      cash: paymentSplit?.cash?.percentage || 0,
      online: paymentSplit?.transfer?.percentage || 0,
      cashAmount: paymentSplit?.cash?.amount || 0,
      transferAmount: paymentSplit?.transfer?.amount || 0,
    },
    overdue: {
      count: dueReminders?.overdue?.length || summary?.totalOverdue || 0,
    },
  };

  // Due reminders for alerts section
  const upcomingDue = [
    ...(dueReminders?.oneDay || []).map((p) => ({ ...p, urgency: "1 day" })),
    ...(dueReminders?.threeDays || []).map((p) => ({
      ...p,
      urgency: "3 days",
    })),
    ...(dueReminders?.sevenDays || []).map((p) => ({
      ...p,
      urgency: "7 days",
    })),
  ].slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Page Title + Quick Actions */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-800">
            Dashboard Overview
          </h1>
          <p className="text-zinc-500 mt-1">
            Welcome back, {user?.name || "User"}! Here's your business summary
            for today.
          </p>
          {lastFetched && (
            <p className="text-xs text-zinc-400 mt-1">
              Last updated: {new Date(lastFetched).toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-zinc-600 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            {loading ? "Loading..." : "Refresh"}
          </button>
          <button
            onClick={() => navigate("/pledges/new")}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white rounded-lg font-medium hover:bg-zinc-800 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Pledge
          </button>
          <button
            onClick={() => navigate("/renewals")}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-amber-200 text-amber-700 rounded-lg font-medium hover:bg-amber-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-amber-500" />
            Renew
          </button>
          <button
            onClick={() => navigate("/redemptions")}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-zinc-200 text-zinc-700 rounded-lg font-medium hover:bg-zinc-50 transition-colors"
          >
            <Wallet className="w-4 h-4 text-zinc-500" />
            Redeem
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <p className="text-red-700">{error}</p>
          <button
            onClick={handleRefresh}
            className="ml-auto text-red-600 hover:text-red-800 text-sm font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && !lastFetched && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          <span className="ml-3 text-zinc-600">Loading dashboard data...</span>
        </div>
      )}

      {/* Stats Cards Row - DATA FROM API with Payment Split in each card */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Pledges - WITH PAYMENT SPLIT */}
        <div
          onClick={() => navigate("/pledges")}
          className="bg-white rounded-xl border border-zinc-200 border-l-4 border-l-zinc-900 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center group-hover:bg-zinc-200 transition-colors">
              <Plus className="w-5 h-5 text-zinc-600" />
            </div>
            <span
              className={cn(
                "text-xs font-bold px-2 py-0.5 rounded-full",
                summary?.monthlyGrowth >= 0
                  ? "text-emerald-600 bg-emerald-50"
                  : "text-red-600 bg-red-50"
              )}
            >
              {stats.todayPledges.trend}
            </span>
          </div>
          <p className="text-sm text-zinc-500 mb-1">Today's New Pledges</p>
          <p className="text-2xl font-bold text-zinc-900">
            {stats.todayPledges.count}{" "}
            <span className="text-sm font-normal text-zinc-400">items</span>
          </p>
          <p className="text-sm font-semibold text-zinc-700 mt-1">
            {formatCurrency(stats.todayPledges.amount)}
          </p>

          {/* Payment Split Bar for Pledges */}
          <PaymentSplitBar
            cash={stats.todayPledges.cash}
            transfer={stats.todayPledges.transfer}
            cashAmount={stats.todayPledges.cash}
            transferAmount={stats.todayPledges.transfer}
          />
        </div>

        {/* Renewals - WITH PAYMENT SPLIT */}
        <div
          onClick={() => navigate("/renewals")}
          className="bg-white rounded-xl border border-zinc-200 border-l-4 border-l-amber-500 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
              <RefreshCw className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <p className="text-sm text-zinc-500 mb-1">Renewal Collected</p>
          <p className="text-2xl font-bold text-zinc-900">
            {formatCurrency(stats.renewals.amount)}
          </p>
          <p className="text-sm text-zinc-500 mt-1">
            {stats.renewals.transactions} transactions today
          </p>

          {/* Payment Split Bar for Renewals */}
          <PaymentSplitBar
            cash={stats.renewals.cash}
            transfer={stats.renewals.transfer}
            cashAmount={stats.renewals.cash}
            transferAmount={stats.renewals.transfer}
          />
        </div>

        {/* Redemptions - WITH PAYMENT SPLIT */}
        <div
          onClick={() => navigate("/redemptions")}
          className="bg-white rounded-xl border border-zinc-200 border-l-4 border-l-emerald-500 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
              <Wallet className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <p className="text-sm text-zinc-500 mb-1">Redemption Count</p>
          <p className="text-2xl font-bold text-zinc-900">
            {stats.redemptions.count}{" "}
            <span className="text-sm font-normal text-zinc-400">items</span>
          </p>
          <p className="text-sm font-semibold text-emerald-600 mt-1">
            {formatCurrency(stats.redemptions.amount)}
          </p>

          {/* Payment Split Bar for Redemptions */}
          <PaymentSplitBar
            cash={stats.redemptions.cash}
            transfer={stats.redemptions.transfer}
            cashAmount={stats.redemptions.cash}
            transferAmount={stats.redemptions.transfer}
          />
        </div>

        {/* Overdue Alerts */}
        <div
          onClick={() => navigate("/pledges?status=overdue")}
          className="bg-white rounded-xl border border-zinc-200 border-l-4 border-l-red-500 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center group-hover:bg-red-100 transition-colors">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <p className="text-sm text-zinc-500 mb-1">Overdue Alerts</p>
          <p className="text-2xl font-bold text-red-600">
            {stats.overdue.count}{" "}
            <span className="text-sm font-normal text-zinc-400">items</span>
          </p>
          <p className="text-sm text-red-500 mt-1 flex items-center gap-1 group-hover:underline">
            View overdue items <ArrowRight className="w-3 h-3" />
          </p>

          {/* Total Overdue Amount (if available) */}
          <div className="mt-3 pt-3 border-t border-zinc-100">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">Total Outstanding</span>
              <span className="font-semibold text-red-600">
                {formatCurrency(summary?.overdueAmount || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Overall Payment Split Card - Kept for total overview */}
      <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-800">
                Today's Total Payment Split
              </h3>
              <p className="text-xs text-zinc-500">All transactions combined</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-zinc-800">
              {formatCurrency(
                stats.paymentSplit.cashAmount +
                  stats.paymentSplit.transferAmount
              )}
            </p>
            <p className="text-xs text-zinc-500">Total collected</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-emerald-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Banknote className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700">Cash</span>
            </div>
            <p className="text-xl font-bold text-emerald-700">
              {formatCurrency(stats.paymentSplit.cashAmount)}
            </p>
            <p className="text-xs text-emerald-600">
              {stats.paymentSplit.cash}% of total
            </p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700">
                Online Transfer
              </span>
            </div>
            <p className="text-xl font-bold text-blue-700">
              {formatCurrency(stats.paymentSplit.transferAmount)}
            </p>
            <p className="text-xs text-blue-600">
              {stats.paymentSplit.online}% of total
            </p>
          </div>
        </div>

        <div className="h-3 bg-zinc-100 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${stats.paymentSplit.cash}%` }}
          />
          <div
            className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: `${stats.paymentSplit.online}%` }}
          />
        </div>
      </div>

      {/* Summary Cards - DATA FROM API */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-xl p-5 text-white">
          <div className="flex items-center gap-3 mb-3">
            <Package className="w-5 h-5 text-amber-400" />
            <span className="text-zinc-400 text-sm">Total Active Pledges</span>
          </div>
          <p className="text-3xl font-bold">{summary?.totalPledges || 0}</p>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-5 text-white">
          <div className="flex items-center gap-3 mb-3">
            <Banknote className="w-5 h-5 text-amber-100" />
            <span className="text-amber-100 text-sm">Total Outstanding</span>
          </div>
          <p className="text-3xl font-bold">
            {formatCurrency(summary?.totalOutstanding || 0)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white">
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="w-5 h-5 text-emerald-100" />
            <span className="text-emerald-100 text-sm">Monthly Revenue</span>
          </div>
          <p className="text-3xl font-bold">
            {formatCurrency(summary?.monthlyRevenue || 0)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
          <div className="flex items-center gap-3 mb-3">
            <Users className="w-5 h-5 text-blue-100" />
            <span className="text-blue-100 text-sm">Total Customers</span>
          </div>
          <p className="text-3xl font-bold">{summary?.totalCustomers || 0}</p>
        </div>
      </div>

      {/* Gold Prices + Due Reminders Row - DATA FROM API */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gold Prices */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-zinc-800">Gold Prices (RM/g)</h3>
            {goldPrices?.updated_at && (
              <span className="text-xs text-zinc-400">
                Updated: {new Date(goldPrices.updated_at).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-xs text-amber-600 font-medium">999 (24K)</p>
              <p className="text-lg font-bold text-amber-700">
                {formatCurrency(
                  goldPrices?.price_999 || goldPrice?.price999 || 305.5
                )}
              </p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-xs text-amber-600 font-medium">916 (22K)</p>
              <p className="text-lg font-bold text-amber-700">
                {formatCurrency(
                  goldPrices?.price_916 || goldPrice?.price916 || 280.25
                )}
              </p>
            </div>
            <div className="bg-zinc-50 rounded-lg p-3">
              <p className="text-xs text-zinc-500 font-medium">875 (21K)</p>
              <p className="text-lg font-bold text-zinc-700">
                {formatCurrency(
                  goldPrices?.price_875 || goldPrice?.price875 || 267.3
                )}
              </p>
            </div>
            <div className="bg-zinc-50 rounded-lg p-3">
              <p className="text-xs text-zinc-500 font-medium">750 (18K)</p>
              <p className="text-lg font-bold text-zinc-700">
                {formatCurrency(
                  goldPrices?.price_750 || goldPrice?.price750 || 229.15
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Due Reminders - DATA FROM API */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-zinc-800">Due Reminders</h3>
            <button
              onClick={() => navigate("/pledges?status=active")}
              className="text-sm text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {upcomingDue.length > 0 ? (
            <div className="space-y-3">
              {upcomingDue.map((pledge, idx) => (
                <div
                  key={pledge.id || idx}
                  className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                  onClick={() => navigate(`/pledges/${pledge.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        pledge.urgency === "1 day"
                          ? "bg-red-500"
                          : pledge.urgency === "3 days"
                          ? "bg-amber-500"
                          : "bg-blue-500"
                      )}
                    ></div>
                    <div>
                      <p className="font-medium text-zinc-800">
                        {pledge.pledge_no || pledge.pledgeNo}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {pledge.customer?.name || pledge.customerName}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-zinc-800">
                      {formatCurrency(pledge.loan_amount || pledge.amount)}
                    </p>
                    <p
                      className={cn(
                        "text-xs font-medium",
                        pledge.urgency === "1 day"
                          ? "text-red-500"
                          : pledge.urgency === "3 days"
                          ? "text-amber-500"
                          : "text-blue-500"
                      )}
                    >
                      Due in {pledge.urgency}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-zinc-400">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No upcoming due dates</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
