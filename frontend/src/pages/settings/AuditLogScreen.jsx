import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAppDispatch } from "@/app/hooks";
import { addToast } from "@/features/ui/uiSlice";
import auditService from "@/services/auditService";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { Card, Button, Input, Select, Badge, Modal } from "@/components/common";
import {
  FileText,
  Search,
  Filter,
  Download,
  Printer,
  Calendar,
  User,
  Clock,
  Activity,
  Eye,
  Edit,
  Trash2,
  Plus,
  LogIn,
  LogOut,
  DollarSign,
  Package,
  RefreshCw,
  Wallet,
  Gavel,
  Settings,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
} from "lucide-react";

// Action types with icons and colors
const actionConfig = {
  // Auth
  login: { label: "Login", icon: LogIn, color: "blue", category: "auth" },
  logout: { label: "Logout", icon: LogOut, color: "zinc", category: "auth" },

  // CRUD
  create: { label: "Create", icon: Plus, color: "emerald", category: "data" },
  update: { label: "Update", icon: Edit, color: "amber", category: "data" },
  delete: { label: "Delete", icon: Trash2, color: "red", category: "data" },
  view: { label: "View", icon: Eye, color: "zinc", category: "data" },

  // Transactions
  pledge_create: {
    label: "New Pledge",
    icon: Plus,
    color: "emerald",
    category: "transaction",
  },
  pledge_update: {
    label: "Update Pledge",
    icon: Edit,
    color: "amber",
    category: "transaction",
  },
  renewal: {
    label: "Renewal",
    icon: RefreshCw,
    color: "blue",
    category: "transaction",
  },
  redemption: {
    label: "Redemption",
    icon: Wallet,
    color: "emerald",
    category: "transaction",
  },
  forfeit: {
    label: "Forfeit",
    icon: XCircle,
    color: "red",
    category: "transaction",
  },
  auction: {
    label: "Auction Sale",
    icon: Gavel,
    color: "amber",
    category: "transaction",
  },

  // System
  settings_change: {
    label: "Settings Change",
    icon: Settings,
    color: "zinc",
    category: "system",
  },
  override: {
    label: "Manual Override",
    icon: AlertTriangle,
    color: "amber",
    category: "system",
  },
  approval: {
    label: "Approval",
    icon: CheckCircle,
    color: "emerald",
    category: "system",
  },
  rejection: {
    label: "Rejection",
    icon: XCircle,
    color: "red",
    category: "system",
  },
};

// Module types
const moduleConfig = {
  auth: { label: "Authentication", color: "blue" },
  customer: { label: "Customer", color: "emerald" },
  pledge: { label: "Pledge", color: "amber" },
  renewal: { label: "Renewal", color: "blue" },
  redemption: { label: "Redemption", color: "emerald" },
  inventory: { label: "Inventory", color: "zinc" },
  auction: { label: "Auction", color: "amber" },
  settings: { label: "Settings", color: "zinc" },
  user: { label: "User", color: "blue" },
};

export default function AuditLogScreen() {
  const dispatch = useAppDispatch();

  // State
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    transactions: 0,
    overrides: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    total: 0,
  });

  // Filter options from API
  const [filterOptions, setFilterOptions] = useState({
    modules: [],
    actions: [],
    users: [],
  });

  // Detail modal
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Fetch logs from API
  const fetchLogs = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = {
          page,
          per_page: 50,
        };

        if (searchQuery) params.search = searchQuery;
        if (moduleFilter !== "all") params.module = moduleFilter;
        if (actionFilter !== "all") params.action = actionFilter;
        if (userFilter !== "all") params.user_id = userFilter;
        if (dateRange !== "all") params.date_range = dateRange;

        const response = await auditService.getLogs(params);

        // Handle both wrapped {success, data: {logs, stats}} and unwrapped {logs, stats} formats
        const responseData = response.data || response;
        const logsData = responseData.logs;

        if (logsData) {
          setLogs(logsData?.data || []);
          setPagination({
            current_page: logsData?.current_page || 1,
            last_page: logsData?.last_page || 1,
            total: logsData?.total || 0,
          });
          setStats(
            responseData.stats || {
              total: 0,
              today: 0,
              transactions: 0,
              overrides: 0,
            }
          );
        }
      } catch (error) {
        console.error("Error fetching audit logs:", error);
        dispatch(
          addToast({
            type: "error",
            title: "Error",
            message: "Failed to load audit logs",
          })
        );
      } finally {
        setLoading(false);
      }
    },
    [searchQuery, moduleFilter, actionFilter, userFilter, dateRange, dispatch]
  );

  // Fetch filter options
  const fetchOptions = useCallback(async () => {
    try {
      const response = await auditService.getOptions();
      if (response.success && response.data) {
        setFilterOptions(response.data);
      }
    } catch (error) {
      console.error("Error fetching filter options:", error);
    }
  }, []);

  // Track if initial load is done
  const isInitialMount = useRef(true);

  // Load data on mount - only once
  useEffect(() => {
    fetchLogs();
    fetchOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload when filters change (debounced) - skip initial render
  useEffect(() => {
    // Skip the first render since we already call fetchLogs in the mount effect
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const debounce = setTimeout(() => {
      fetchLogs();
    }, 500);
    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, moduleFilter, actionFilter, userFilter, dateRange]);

  // Get unique users for filter - from API options
  const uniqueUsers = useMemo(() => {
    return filterOptions.users || [];
  }, [filterOptions]);

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-MY", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Format relative time
  const formatRelativeTime = (timestamp) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatTimestamp(timestamp);
  };

  // Open detail modal
  const openDetail = (log) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  // Export logs
  const handleExport = () => {
    const csv = [
      [
        "ID",
        "Timestamp",
        "User",
        "Action",
        "Module",
        "Description",
        "Details",
      ].join(","),
      ...filteredLogs.map((log) =>
        [
          log.id,
          log.timestamp,
          log.user,
          log.action,
          log.module,
          `"${log.description}"`,
          `"${JSON.stringify(log.details).replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_log_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  // Clear filters
  const clearFilters = () => {
    setSearchQuery("");
    setModuleFilter("all");
    setActionFilter("all");
    setUserFilter("all");
    setDateRange("all");
  };

  const hasActiveFilters =
    searchQuery ||
    moduleFilter !== "all" ||
    actionFilter !== "all" ||
    userFilter !== "all" ||
    dateRange !== "all";

  return (
    <PageWrapper
      title="Audit Log"
      subtitle="View system activity and transaction history"
      actions={
        <div className="flex items-center gap-3">
          <Button variant="outline" leftIcon={Download} onClick={handleExport}>
            Export CSV
          </Button>
          <Button variant="outline" leftIcon={Printer}>
            Print
          </Button>
        </div>
      }
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Total Logs</p>
              <p className="text-xl font-bold text-zinc-800">{stats.total}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Today</p>
              <p className="text-xl font-bold text-emerald-600">
                {stats.today}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Transactions</p>
              <p className="text-xl font-bold text-amber-600">
                {stats.transactions}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Overrides</p>
              <p className="text-xl font-bold text-red-600">
                {stats.overrides}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={Search}
            />
          </div>

          <Select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            options={[
              { value: "all", label: "All Time" },
              { value: "today", label: "Today" },
              { value: "week", label: "This Week" },
              { value: "month", label: "This Month" },
            ]}
            className="w-36"
          />

          <Button
            variant="outline"
            leftIcon={Filter}
            onClick={() => setShowFilters(!showFilters)}
            className={cn(showFilters && "bg-zinc-100")}
          >
            Filters
            {hasActiveFilters && (
              <span className="ml-2 w-5 h-5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center">
                !
              </span>
            )}
          </Button>

          {hasActiveFilters && (
            <Button variant="outline" onClick={clearFilters}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-4 pt-4 border-t border-zinc-200"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select
                label="Module"
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                options={[
                  { value: "all", label: "All Modules" },
                  ...Object.entries(moduleConfig).map(([key, val]) => ({
                    value: key,
                    label: val.label,
                  })),
                ]}
              />

              <Select
                label="Action"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                options={[
                  { value: "all", label: "All Actions" },
                  ...Object.entries(actionConfig).map(([key, val]) => ({
                    value: key,
                    label: val.label,
                  })),
                ]}
              />

              <Select
                label="User"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                options={[
                  { value: "all", label: "All Users" },
                  ...uniqueUsers.map((user) => ({
                    value: user.id,
                    label: user.name,
                  })),
                ]}
              />
            </div>
          </motion.div>
        )}
      </Card>

      {/* Results Count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-zinc-500">
          Showing <strong>{logs.length}</strong> of {pagination.total} logs
          {loading && <Loader2 className="w-4 h-4 ml-2 inline animate-spin" />}
        </p>
      </div>

      {/* Log List */}
      <Card className="overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="p-12 text-center">
            <Loader2 className="w-16 h-16 text-zinc-300 mx-auto mb-4 animate-spin" />
            <p className="text-zinc-500">Loading audit logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-zinc-800 mb-2">
              No Logs Found
            </h3>
            <p className="text-zinc-500">No audit logs recorded yet</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {logs.map((log, index) => {
              const action = actionConfig[log.action] || {
                label: log.action,
                icon: Activity,
                color: "zinc",
              };
              const module = moduleConfig[log.module] || {
                label: log.module,
                color: "zinc",
              };
              const ActionIcon = action.icon;

              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(index * 0.02, 0.5) }}
                  className="p-4 hover:bg-zinc-50 cursor-pointer transition-colors"
                  onClick={() => openDetail(log)}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                        action.color === "blue" && "bg-blue-100",
                        action.color === "emerald" && "bg-emerald-100",
                        action.color === "amber" && "bg-amber-100",
                        action.color === "red" && "bg-red-100",
                        action.color === "zinc" && "bg-zinc-100"
                      )}
                    >
                      <ActionIcon
                        className={cn(
                          "w-5 h-5",
                          action.color === "blue" && "text-blue-600",
                          action.color === "emerald" && "text-emerald-600",
                          action.color === "amber" && "text-amber-600",
                          action.color === "red" && "text-red-600",
                          action.color === "zinc" && "text-zinc-600"
                        )}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-zinc-800">
                          {log.description}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-zinc-500">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {log.user?.name || log.user || "System"}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {module.label}
                        </Badge>
                        <span className="text-zinc-400">•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatRelativeTime(log.created_at || log.timestamp)}
                        </span>
                      </div>
                    </div>

                    {/* Action Badge */}
                    <Badge
                      variant={
                        action.color === "emerald"
                          ? "success"
                          : action.color === "amber"
                            ? "warning"
                            : action.color === "red"
                              ? "error"
                              : action.color === "blue"
                                ? "info"
                                : "secondary"
                      }
                    >
                      {action.label}
                    </Badge>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Log Details"
        size="md"
      >
        {selectedLog && (
          <div className="p-5">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              {(() => {
                const action = actionConfig[selectedLog.action] || {
                  icon: Activity,
                  color: "zinc",
                };
                const ActionIcon = action.icon;
                return (
                  <div
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      action.color === "blue" && "bg-blue-100",
                      action.color === "emerald" && "bg-emerald-100",
                      action.color === "amber" && "bg-amber-100",
                      action.color === "red" && "bg-red-100",
                      action.color === "zinc" && "bg-zinc-100"
                    )}
                  >
                    <ActionIcon
                      className={cn(
                        "w-6 h-6",
                        action.color === "blue" && "text-blue-600",
                        action.color === "emerald" && "text-emerald-600",
                        action.color === "amber" && "text-amber-600",
                        action.color === "red" && "text-red-600",
                        action.color === "zinc" && "text-zinc-600"
                      )}
                    />
                  </div>
                );
              })()}
              <div>
                <p className="font-semibold text-zinc-800">
                  {selectedLog.description}
                </p>
                <p className="text-sm text-zinc-500">{selectedLog.id}</p>
              </div>
            </div>

            {/* Info Grid */}
            <div className="space-y-3 mb-6">
              <div className="flex justify-between p-3 bg-zinc-50 rounded-lg">
                <span className="text-zinc-500">Timestamp</span>
                <span className="font-medium">
                  {formatTimestamp(selectedLog.timestamp)}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-zinc-50 rounded-lg">
                <span className="text-zinc-500">User</span>
                <span className="font-medium">{selectedLog.user}</span>
              </div>
              <div className="flex justify-between p-3 bg-zinc-50 rounded-lg">
                <span className="text-zinc-500">Module</span>
                <Badge variant="secondary">
                  {moduleConfig[selectedLog.module]?.label ||
                    selectedLog.module}
                </Badge>
              </div>
              <div className="flex justify-between p-3 bg-zinc-50 rounded-lg">
                <span className="text-zinc-500">Action</span>
                <Badge
                  variant={
                    actionConfig[selectedLog.action]?.color === "emerald"
                      ? "success"
                      : actionConfig[selectedLog.action]?.color === "amber"
                        ? "warning"
                        : actionConfig[selectedLog.action]?.color === "red"
                          ? "error"
                          : "info"
                  }
                >
                  {actionConfig[selectedLog.action]?.label ||
                    selectedLog.action}
                </Badge>
              </div>
              {selectedLog.ip && (
                <div className="flex justify-between p-3 bg-zinc-50 rounded-lg">
                  <span className="text-zinc-500">IP Address</span>
                  <span className="font-mono text-sm">{selectedLog.ip}</span>
                </div>
              )}
            </div>

            {/* Details */}
            {selectedLog.details &&
              Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-zinc-700 mb-2">
                    Additional Details
                  </p>
                  <div className="bg-zinc-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-sm text-emerald-400 font-mono">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

            <div className="mt-6">
              <Button
                variant="outline"
                fullWidth
                onClick={() => setShowDetailModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PageWrapper>
  );
}
