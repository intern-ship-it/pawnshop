/**
 * Dashboard Page - Connected to Laravel API
 * Displays real-time data from backend
 *
 * UPDATED: Added Payment Split bar inside each summary card (Pledges/Renewals/Redemptions)
 */

import { useEffect, useState } from "react";
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
import GoldPriceCard from "@/components/dashboard/GoldPriceCard";
import EnhancedStatsCard from "@/components/dashboard/EnhancedStatsCard";
import EnhancedPaymentSplitCard from "@/components/dashboard/EnhancedPaymentSplitCard";
import EnhancedSummaryCard from "@/components/dashboard/EnhancedSummaryCard";

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
        size === "lg" && "mt-4 pt-4",
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

  // Get gold price settings from localStorage
  const [goldPriceSettings, setGoldPriceSettings] = useState(() => {
    try {
      const stored = localStorage.getItem("pawnsys_settings");
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed?.goldPrice || { source: "api", manualPrice: 0 };
      }
    } catch (e) {}
    return { source: "api", manualPrice: 0 };
  });

  // Local gold prices state (for manual mode)
  const [localGoldPrices, setLocalGoldPrices] = useState(null);

  // Get dashboard state from Redux (connected to API)
  const {
    summary,
    todayStats,
    paymentSplit,
    dueReminders,
    overduePledges,
    goldPrices: apiGoldPrices,
    loading,
    error,
    lastFetched,
  } = useAppSelector((state) => state.dashboard);

  // Compute effective gold prices (manual or API)
  const goldPrices = localGoldPrices || apiGoldPrices;

  // Listen for settings updates
  useEffect(() => {
    const handleSettingsUpdate = (event) => {
      if (event.detail?.goldPrice) {
        const newSettings = event.detail.goldPrice;
        setGoldPriceSettings(newSettings);

        // If manual mode, calculate prices locally
        if (newSettings.source === "manual" && newSettings.manualPrice > 0) {
          const price999 = parseFloat(newSettings.manualPrice);
          setLocalGoldPrices({
            price_999: price999,
            price_916: price999 * 0.916,
            price_875: price999 * 0.875,
            price_750: price999 * 0.75,
            price_585: price999 * 0.585,
            price_375: price999 * 0.375,
            source: "manual",
            price_date: new Date().toISOString().split("T")[0],
          });
        } else {
          // API mode - clear local prices, use API data
          setLocalGoldPrices(null);
        }
      }
    };

    window.addEventListener("settingsUpdated", handleSettingsUpdate);
    return () =>
      window.removeEventListener("settingsUpdated", handleSettingsUpdate);
  }, []);

  // On mount, check if manual mode is active
  useEffect(() => {
    if (
      goldPriceSettings.source === "manual" &&
      goldPriceSettings.manualPrice > 0
    ) {
      const price999 = parseFloat(goldPriceSettings.manualPrice);
      setLocalGoldPrices({
        price_999: price999,
        price_916: price999 * 0.916,
        price_875: price999 * 0.875,
        price_750: price999 * 0.75,
        price_585: price999 * 0.585,
        price_375: price999 * 0.375,
        source: "manual",
        price_date: new Date().toISOString().split("T")[0],
      });
    }
  }, []);

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
          <h1 className="text-2xl font-bold bg-gradient-to-r from-zinc-800 to-zinc-600 bg-clip-text text-transparent">
            Dashboard Overview
          </h1>
          <p className="text-zinc-600 mt-1 font-medium">
            Welcome back,{" "}
            <span className="text-amber-600">{user?.name || "User"}</span>!
            Here's your business summary for today.
          </p>
          {lastFetched && (
            <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1.5 bg-amber-50 px-2.5 py-1 rounded-full w-fit">
              <Clock className="w-3 h-3 text-amber-500" />
              <span>Last updated:</span>
              <span className="font-medium text-amber-600">
                {new Date(lastFetched).toLocaleTimeString()}
              </span>
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
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg font-medium hover:from-amber-600 hover:to-amber-700 transition-all shadow-lg shadow-amber-500/25"
          >
            <Plus className="w-4 h-4" />
            New Pledge
          </button>
          <button
            onClick={() => navigate("/renewals")}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-amber-300 text-amber-700 rounded-lg font-medium hover:bg-amber-50 transition-colors"
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

      {/* Stats Cards Row - ENHANCED with animations and donut charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Pledges */}
        <EnhancedStatsCard
          title="Today's New Pledges"
          value={stats.todayPledges.count}
          subtitle="items"
          amount={stats.todayPledges.amount}
          icon={Plus}
          trend={summary?.monthlyGrowth || 0}
          trendValue={stats.todayPledges.trend}
          accentColor="zinc"
          cash={stats.todayPledges.cash}
          transfer={stats.todayPledges.transfer}
          showPaymentSplit={true}
          onClick={() => navigate("/pledges")}
        />

        {/* Renewals */}
        <EnhancedStatsCard
          title="Renewal Collected"
          value={formatCurrency(stats.renewals.amount)}
          subtitle={`${stats.renewals.transactions} transactions today`}
          icon={RefreshCw}
          accentColor="amber"
          cash={stats.renewals.cash}
          transfer={stats.renewals.transfer}
          showPaymentSplit={true}
          onClick={() => navigate("/renewals")}
        />

        {/* Redemptions */}
        <EnhancedStatsCard
          title="Redemption Count"
          value={stats.redemptions.count}
          subtitle="items"
          amount={stats.redemptions.amount}
          icon={Wallet}
          accentColor="emerald"
          cash={stats.redemptions.cash}
          transfer={stats.redemptions.transfer}
          showPaymentSplit={true}
          onClick={() => navigate("/redemptions")}
        />

        {/* Overdue Alerts */}
        <EnhancedStatsCard
          title="Overdue Alerts"
          value={stats.overdue.count}
          subtitle="items"
          amount={summary?.overdueAmount || 0}
          icon={AlertTriangle}
          accentColor="red"
          linkText="View overdue items →"
          onClick={() => navigate("/pledges?status=overdue")}
        />
      </div>

      {/* Enhanced Payment Split Card - with circular progress rings */}
      <EnhancedPaymentSplitCard
        cashAmount={stats.paymentSplit.cashAmount}
        transferAmount={stats.paymentSplit.transferAmount}
      />

      {/* Summary Cards - ENHANCED with animated counting */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <EnhancedSummaryCard
          title="Total Active Pledges"
          value={summary?.totalPledges || 0}
          icon={Package}
          preset="light"
          delay={0}
        />

        <EnhancedSummaryCard
          title="Total Outstanding"
          value={summary?.totalOutstanding || 0}
          icon={Banknote}
          preset="amber"
          isCurrency={true}
          delay={100}
        />

        <EnhancedSummaryCard
          title="Monthly Revenue"
          value={summary?.monthlyRevenue || 0}
          icon={TrendingUp}
          preset="emerald"
          isCurrency={true}
          delay={200}
        />

        <EnhancedSummaryCard
          title="Total Customers"
          value={summary?.totalCustomers || 0}
          icon={Users}
          preset="blue"
          delay={300}
        />
      </div>

      {/* Gold Prices + Due Reminders Row - DATA FROM API */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gold Prices - Clickable Card with Interactive Chart */}
        <GoldPriceCard goldPrices={goldPrices} goldPrice={goldPrice} />

        {/* Due Reminders - DATA FROM API */}
        <div className="bg-gradient-to-br from-white via-white to-amber-50/40 rounded-xl border border-zinc-200 p-5 shadow-sm lg:col-span-2 relative overflow-hidden">
          {/* Subtle warm accent */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-100/30 rounded-full blur-3xl" />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg text-zinc-800">Due Reminders</h3>
              <button
                onClick={() => navigate("/pledges?status=active")}
                className="text-sm text-amber-600 hover:text-amber-700 font-semibold flex items-center gap-1 hover:gap-2 transition-all"
              >
                View all <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {upcomingDue.length > 0 ? (
              <div className="space-y-3">
                {upcomingDue.map((pledge, idx) => (
                  <div
                    key={pledge.id || idx}
                    className="flex items-center justify-between p-3 bg-amber-50/50 hover:bg-amber-100/50 rounded-lg transition-colors cursor-pointer border border-amber-100/50"
                    onClick={() => navigate(`/pledges/${pledge.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-3 h-3 rounded-full",
                          pledge.urgency === "1 day"
                            ? "bg-red-500"
                            : pledge.urgency === "3 days"
                              ? "bg-amber-500"
                              : "bg-blue-500",
                        )}
                      ></div>
                      <div>
                        <p className="font-bold text-zinc-800">
                          {pledge.pledge_no || pledge.pledgeNo}
                        </p>
                        <p className="text-sm text-zinc-500 font-medium">
                          {pledge.customer?.name || pledge.customerName}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-zinc-800">
                        {formatCurrency(pledge.loan_amount || pledge.amount)}
                      </p>
                      <p
                        className={cn(
                          "text-xs font-medium",
                          pledge.urgency === "1 day"
                            ? "text-red-500"
                            : pledge.urgency === "3 days"
                              ? "text-amber-500"
                              : "text-blue-500",
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
    </div>
  );
}
