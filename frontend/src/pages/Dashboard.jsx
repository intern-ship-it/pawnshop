/**
 * Dashboard Page - Connected to Laravel API
 * Displays real-time data from backend
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
  Scale,
  Lock,
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
      trend:
        summary?.monthlyGrowth > 0
          ? `+${summary?.monthlyGrowth}%`
          : `${summary?.monthlyGrowth || 0}%`,
    },
    renewals: {
      amount: todayStats?.renewals?.amount || 0,
      transactions: todayStats?.renewals?.count || 0,
    },
    redemptions: {
      count: todayStats?.redemptions?.count || 0,
      amount: todayStats?.redemptions?.amount || 0,
    },
    paymentSplit: {
      cash: paymentSplit?.cash?.percentage || 0,
      online: paymentSplit?.transfer?.percentage || 0,
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

  // Stock alerts (placeholder - would come from API)
  const stockAlerts = [
    {
      id: 1,
      type: "Weight Discrepancy",
      icon: Scale,
      description: "Item #G-1002 weight recorded as 5.2g vs expected 5.5g.",
      severity: "critical",
    },
    {
      id: 2,
      type: "Pending Safe Audit",
      icon: Lock,
      description: "Daily safe audit not completed.",
      severity: "warning",
    },
  ];

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

      {/* Stats Cards Row - DATA FROM API */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Today's Pledges */}
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
        </div>

        {/* Renewals */}
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
        </div>

        {/* Redemptions */}
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
        </div>

        {/* Payment Split */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-sm text-zinc-500 mb-3">Payment Split</p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-sm text-zinc-600">
                Cash {stats.paymentSplit.cash}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-400"></div>
              <span className="text-sm text-zinc-600">
                Online {stats.paymentSplit.online}%
              </span>
            </div>
          </div>
          <div className="mt-2 h-2 bg-zinc-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${stats.paymentSplit.cash}%` }}
            ></div>
          </div>
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

      {/* Stock Alerts */}
      <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-zinc-800">Stock Alerts</h3>
          <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">
            {stockAlerts.filter((a) => a.severity === "critical").length}{" "}
            Critical
          </span>
        </div>

        <div className="space-y-3">
          {stockAlerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                "flex items-start gap-4 p-4 rounded-lg",
                alert.severity === "critical"
                  ? "bg-red-50 border border-red-100"
                  : "bg-amber-50 border border-amber-100"
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  alert.severity === "critical" ? "bg-red-100" : "bg-amber-100"
                )}
              >
                <alert.icon
                  className={cn(
                    "w-5 h-5",
                    alert.severity === "critical"
                      ? "text-red-600"
                      : "text-amber-600"
                  )}
                />
              </div>
              <div className="flex-1">
                <p
                  className={cn(
                    "font-medium",
                    alert.severity === "critical"
                      ? "text-red-800"
                      : "text-amber-800"
                  )}
                >
                  {alert.type}
                </p>
                <p
                  className={cn(
                    "text-sm mt-1",
                    alert.severity === "critical"
                      ? "text-red-600"
                      : "text-amber-600"
                  )}
                >
                  {alert.description}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium rounded-lg",
                    alert.severity === "critical"
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-amber-600 text-white hover:bg-amber-700"
                  )}
                >
                  {alert.severity === "critical"
                    ? "Investigate"
                    : "Start Audit"}
                </button>
                <button className="px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg">
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
