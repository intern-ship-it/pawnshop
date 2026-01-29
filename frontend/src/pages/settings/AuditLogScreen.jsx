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
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
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
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;

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
            },
          );
        }
      } catch (error) {
        console.error("Error fetching audit logs:", error);
        dispatch(
          addToast({
            type: "error",
            title: "Error",
            message: "Failed to load audit logs",
          }),
        );
      } finally {
        setLoading(false);
      }
    },
    [
      searchQuery,
      moduleFilter,
      actionFilter,
      userFilter,
      dateRange,
      startDate,
      endDate,
      dispatch,
    ],
  );

  // Pagination Handler
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.last_page) {
      fetchLogs(newPage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

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
  }, [
    searchQuery,
    moduleFilter,
    actionFilter,
    userFilter,
    dateRange,
    startDate,
    endDate,
  ]);

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

  // Format relative time - now always shows full timestamp for consistency
  const formatRelativeTime = (timestamp) => {
    return formatTimestamp(timestamp);
  };

  // Open detail modal
  const openDetail = (log) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  // Export logs to CSV
  const handleExport = () => {
    if (logs.length === 0) {
      dispatch(
        addToast({
          type: "warning",
          title: "No Data",
          message: "No logs to export",
        }),
      );
      return;
    }

    const csv = [
      [
        "ID",
        "Timestamp",
        "User",
        "Action",
        "Module",
        "Description",
        "IP Address",
        "Severity",
      ].join(","),
      ...logs.map((log) =>
        [
          log.id,
          `"${formatTimestamp(log.created_at)}"`,
          `"${log.user?.name || "System"}"`,
          log.action,
          log.module,
          `"${(log.description || "").replace(/"/g, '""')}"`,
          log.ip_address || "",
          log.severity || "info",
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_log_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    dispatch(
      addToast({
        type: "success",
        title: "Exported",
        message: `Exported ${logs.length} log entries`,
      }),
    );
  };

  // Print logs
  const handlePrint = () => {
    if (logs.length === 0) {
      dispatch(
        addToast({
          type: "warning",
          title: "No Data",
          message: "No logs to print",
        }),
      );
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Audit Log Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { text-align: center; margin-bottom: 10px; }
          .subtitle { text-align: center; color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f5f5f5; font-weight: bold; }
          tr:nth-child(even) { background-color: #fafafa; }
          .footer { margin-top: 20px; font-size: 11px; color: #666; text-align: center; }
          @media print {
            body { padding: 0; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
          }
        </style>
      </head>
      <body>
        <h1>Audit Log Report</h1>
        <p class="subtitle">Generated on ${new Date().toLocaleString()}</p>
        <table>
          <thead>
            <tr>
              <th>Date/Time</th>
              <th>User</th>
              <th>Action</th>
              <th>Module</th>
              <th>Description</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            ${logs
              .map(
                (log) => `
              <tr>
                <td>${formatTimestamp(log.created_at)}</td>
                <td>${log.user?.name || "System"}</td>
                <td>${log.action}</td>
                <td>${log.module}</td>
                <td>${log.description || "-"}</td>
                <td>${log.ip_address || "-"}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
        <p class="footer">Total: ${logs.length} entries | Printed from PawnSys</p>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Clear filters
  const clearFilters = () => {
    setSearchQuery("");
    setModuleFilter("all");
    setActionFilter("all");
    setUserFilter("all");
    setDateRange("all");
    setStartDate("");
    setEndDate("");
  };

  const hasActiveFilters =
    searchQuery ||
    moduleFilter !== "all" ||
    actionFilter !== "all" ||
    userFilter !== "all" ||
    userFilter !== "all" ||
    dateRange !== "all" ||
    startDate ||
    endDate;

  return (
    <PageWrapper
      title="Audit Log"
      subtitle="View system activity and transaction history"
      actions={
        <div className="flex items-center gap-3">
          <Button variant="outline" leftIcon={Download} onClick={handleExport}>
            Export CSV
          </Button>
          <Button variant="outline" leftIcon={Printer} onClick={handlePrint}>
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

            {/* Date Range Custom Inputs */}
            {dateRange === "custom" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <Input
                  type="date"
                  label="Start Date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <Input
                  type="date"
                  label="End Date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            )}

            {/* Always visible Custom Date inputs if user prefers explicit selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-zinc-100">
              <Input
                type="date"
                label="Start Date (Optional)"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={dateRange !== "all" && dateRange !== "custom"}
              />
              <Input
                type="date"
                label="End Date (Optional)"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={dateRange !== "all" && dateRange !== "custom"}
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
                        action.color === "zinc" && "bg-zinc-100",
                      )}
                    >
                      <ActionIcon
                        className={cn(
                          "w-5 h-5",
                          action.color === "blue" && "text-blue-600",
                          action.color === "emerald" && "text-emerald-600",
                          action.color === "amber" && "text-amber-600",
                          action.color === "red" && "text-red-600",
                          action.color === "zinc" && "text-zinc-600",
                        )}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-1 flex-wrap">
                        <span className="font-medium text-zinc-800">
                          {(() => {
                            const desc = log.description || "";

                            // Match patterns
                            const pledgeMatch = desc.match(/(PLG-[A-Z0-9-]+)/);
                            const amountMatch = desc.match(/(RM[\d,]+\.?\d*)/);
                            const customerMatch =
                              desc.match(/for\s+(.+?)\s+-\s+RM/);

                            if (pledgeMatch || amountMatch || customerMatch) {
                              let parts = [];
                              let lastIndex = 0;

                              // Find all matches and their positions
                              const matches = [];

                              if (pledgeMatch) {
                                matches.push({
                                  start: desc.indexOf(pledgeMatch[1]),
                                  end:
                                    desc.indexOf(pledgeMatch[1]) +
                                    pledgeMatch[1].length,
                                  text: pledgeMatch[1],
                                  type: "pledge",
                                });
                              }

                              if (customerMatch) {
                                const forIndex = desc.indexOf(
                                  "for " + customerMatch[1],
                                );
                                if (forIndex !== -1) {
                                  matches.push({
                                    start: forIndex + 4, // Skip "for "
                                    end: forIndex + 4 + customerMatch[1].length,
                                    text: customerMatch[1],
                                    type: "customer",
                                  });
                                }
                              }

                              if (amountMatch) {
                                matches.push({
                                  start: desc.indexOf(amountMatch[1]),
                                  end:
                                    desc.indexOf(amountMatch[1]) +
                                    amountMatch[1].length,
                                  text: amountMatch[1],
                                  type: "amount",
                                });
                              }

                              // Sort by position
                              matches.sort((a, b) => a.start - b.start);

                              // Build parts array
                              matches.forEach((match, idx) => {
                                // Add text before this match
                                if (match.start > lastIndex) {
                                  parts.push(
                                    <span
                                      key={`text-${idx}`}
                                      className="text-zinc-700"
                                    >
                                      {desc.substring(lastIndex, match.start)}
                                    </span>,
                                  );
                                }

                                // Add the highlighted match
                                if (match.type === "pledge") {
                                  parts.push(
                                    <span
                                      key={`match-${idx}`}
                                      className="font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200"
                                    >
                                      {match.text}
                                    </span>,
                                  );
                                } else if (match.type === "customer") {
                                  parts.push(
                                    <span
                                      key={`match-${idx}`}
                                      className="font-semibold text-amber-700"
                                    >
                                      {match.text}
                                    </span>,
                                  );
                                } else if (match.type === "amount") {
                                  parts.push(
                                    <span
                                      key={`match-${idx}`}
                                      className="font-bold text-emerald-600"
                                    >
                                      {match.text}
                                    </span>,
                                  );
                                }

                                lastIndex = match.end;
                              });

                              // Add remaining text
                              if (lastIndex < desc.length) {
                                parts.push(
                                  <span
                                    key="text-end"
                                    className="text-zinc-700"
                                  >
                                    {desc.substring(lastIndex)}
                                  </span>,
                                );
                              }

                              return parts.length > 0 ? parts : desc;
                            }
                            return desc;
                          })()}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-zinc-500">
                        <span className="flex items-center gap-1.5 bg-zinc-100 px-2 py-0.5 rounded-full">
                          <User className="w-3.5 h-3.5 text-zinc-500" />
                          <span className="font-medium text-zinc-600">
                            {typeof log.user === "object"
                              ? log.user?.name || "Unknown"
                              : log.user || "System"}
                          </span>
                        </span>
                        <Badge
                          variant="secondary"
                          className="text-xs rounded-full"
                        >
                          {module.label}
                        </Badge>
                        <span className="flex items-center gap-1.5 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                          <Clock className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                          <span className="font-medium text-blue-700">
                            {formatRelativeTime(
                              log.created_at || log.timestamp,
                            )}
                          </span>
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

      {/* Pagination Controls */}
      {!loading && logs.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-zinc-500">Showing {logs.length} entries</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.current_page - 1)}
              disabled={pagination.current_page <= 1 || loading}
            >
              Previous
            </Button>
            <span className="text-sm font-medium text-zinc-700 min-w-[80px] text-center">
              Page {pagination.current_page} of {pagination.last_page}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.current_page + 1)}
              disabled={
                pagination.current_page >= pagination.last_page || loading
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}

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
            <div className="flex items-start gap-4 mb-6">
              {(() => {
                const action = actionConfig[selectedLog.action] || {
                  icon: Activity,
                  color: "zinc",
                };
                const ActionIcon = action.icon;
                return (
                  <div
                    className={cn(
                      "w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm",
                      action.color === "blue" &&
                        "bg-gradient-to-br from-blue-100 to-blue-200",
                      action.color === "emerald" &&
                        "bg-gradient-to-br from-emerald-100 to-emerald-200",
                      action.color === "amber" &&
                        "bg-gradient-to-br from-amber-100 to-amber-200",
                      action.color === "red" &&
                        "bg-gradient-to-br from-red-100 to-red-200",
                      action.color === "zinc" &&
                        "bg-gradient-to-br from-zinc-100 to-zinc-200",
                    )}
                  >
                    <ActionIcon
                      className={cn(
                        "w-7 h-7",
                        action.color === "blue" && "text-blue-600",
                        action.color === "emerald" && "text-emerald-600",
                        action.color === "amber" && "text-amber-600",
                        action.color === "red" && "text-red-600",
                        action.color === "zinc" && "text-zinc-600",
                      )}
                    />
                  </div>
                );
              })()}
              <div className="flex-1">
                {/* Parse and highlight description */}
                <p className="font-semibold text-zinc-800 text-lg leading-relaxed">
                  {(() => {
                    const desc = selectedLog.description || "";

                    // Parse common patterns in description
                    // Pattern: "Created pledge PLG-XXX for Customer Name - RMAmount"
                    const pledgeMatch = desc.match(/(PLG-[A-Z0-9-]+)/);
                    const amountMatch = desc.match(/(RM[\d,]+\.?\d*)/);
                    const customerMatch = desc.match(/for\s+(.+?)\s+-\s+RM/);

                    if (pledgeMatch || amountMatch || customerMatch) {
                      let result = desc;
                      let parts = [];
                      let lastIndex = 0;

                      // Find all matches and their positions
                      const matches = [];

                      if (pledgeMatch) {
                        matches.push({
                          start: desc.indexOf(pledgeMatch[1]),
                          end:
                            desc.indexOf(pledgeMatch[1]) +
                            pledgeMatch[1].length,
                          text: pledgeMatch[1],
                          type: "pledge",
                        });
                      }

                      if (customerMatch) {
                        const forIndex = desc.indexOf(
                          "for " + customerMatch[1],
                        );
                        if (forIndex !== -1) {
                          matches.push({
                            start: forIndex + 4, // Skip "for "
                            end: forIndex + 4 + customerMatch[1].length,
                            text: customerMatch[1],
                            type: "customer",
                          });
                        }
                      }

                      if (amountMatch) {
                        matches.push({
                          start: desc.indexOf(amountMatch[1]),
                          end:
                            desc.indexOf(amountMatch[1]) +
                            amountMatch[1].length,
                          text: amountMatch[1],
                          type: "amount",
                        });
                      }

                      // Sort by position
                      matches.sort((a, b) => a.start - b.start);

                      // Build parts array
                      matches.forEach((match, idx) => {
                        // Add text before this match
                        if (match.start > lastIndex) {
                          parts.push(
                            <span key={`text-${idx}`} className="text-zinc-700">
                              {desc.substring(lastIndex, match.start)}
                            </span>,
                          );
                        }

                        // Add the highlighted match
                        if (match.type === "pledge") {
                          parts.push(
                            <span
                              key={`match-${idx}`}
                              className="font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded"
                            >
                              {match.text}
                            </span>,
                          );
                        } else if (match.type === "customer") {
                          parts.push(
                            <span
                              key={`match-${idx}`}
                              className="font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200"
                            >
                              {match.text}
                            </span>,
                          );
                        } else if (match.type === "amount") {
                          parts.push(
                            <span
                              key={`match-${idx}`}
                              className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded"
                            >
                              {match.text}
                            </span>,
                          );
                        }

                        lastIndex = match.end;
                      });

                      // Add remaining text
                      if (lastIndex < desc.length) {
                        parts.push(
                          <span key="text-end" className="text-zinc-700">
                            {desc.substring(lastIndex)}
                          </span>,
                        );
                      }

                      return parts.length > 0 ? parts : desc;
                    }

                    return desc;
                  })()}
                </p>
                <p className="text-sm text-zinc-400 mt-1 font-mono">
                  ID: {selectedLog.id}
                </p>
              </div>
            </div>

            {/* Info Grid - Enhanced with colors and hover animations */}
            <div className="space-y-3 mb-6">
              {/* Timestamp - Blue theme */}
              <motion.div
                className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-xl border border-blue-100 cursor-pointer"
                whileHover={{
                  scale: 1.02,
                  y: -2,
                  boxShadow: "0 8px 25px -5px rgba(59, 130, 246, 0.15)",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-blue-700 font-medium">Timestamp</span>
                </div>
                <span className="font-semibold text-blue-900">
                  {formatTimestamp(
                    selectedLog.created_at || selectedLog.timestamp,
                  )}
                </span>
              </motion.div>

              {/* User - Purple theme */}
              <motion.div
                className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-purple-100/50 rounded-xl border border-purple-100 cursor-pointer"
                whileHover={{
                  scale: 1.02,
                  y: -2,
                  boxShadow: "0 8px 25px -5px rgba(147, 51, 234, 0.15)",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
                    <User className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="text-purple-700 font-medium">User</span>
                </div>
                <span className="font-semibold text-purple-900">
                  {typeof selectedLog.user === "object"
                    ? selectedLog.user?.name || "Unknown"
                    : selectedLog.user || "System"}
                </span>
              </motion.div>

              {/* Email - Indigo theme (if user has email) */}
              {selectedLog.user?.email && (
                <motion.div
                  className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-50 to-indigo-100/50 rounded-xl border border-indigo-100 cursor-pointer"
                  whileHover={{
                    scale: 1.02,
                    y: -2,
                    boxShadow: "0 8px 25px -5px rgba(99, 102, 241, 0.15)",
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-indigo-600" />
                    </div>
                    <span className="text-indigo-700 font-medium">Email</span>
                  </div>
                  <span className="font-semibold text-indigo-900">
                    {selectedLog.user.email}
                  </span>
                </motion.div>
              )}

              {/* Module - Amber theme */}
              <motion.div
                className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-amber-100/50 rounded-xl border border-amber-100 cursor-pointer"
                whileHover={{
                  scale: 1.02,
                  y: -2,
                  boxShadow: "0 8px 25px -5px rgba(245, 158, 11, 0.15)",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Package className="w-4 h-4 text-amber-600" />
                  </div>
                  <span className="text-amber-700 font-medium">Module</span>
                </div>
                <Badge variant="warning" className="text-sm px-3 py-1">
                  {moduleConfig[selectedLog.module]?.label ||
                    selectedLog.module}
                </Badge>
              </motion.div>

              {/* Action - Dynamic color based on action type */}
              <motion.div
                className={cn(
                  "flex items-center justify-between p-4 rounded-xl border cursor-pointer",
                  actionConfig[selectedLog.action]?.color === "emerald" &&
                    "bg-gradient-to-r from-emerald-50 to-emerald-100/50 border-emerald-100",
                  actionConfig[selectedLog.action]?.color === "amber" &&
                    "bg-gradient-to-r from-amber-50 to-amber-100/50 border-amber-100",
                  actionConfig[selectedLog.action]?.color === "red" &&
                    "bg-gradient-to-r from-red-50 to-red-100/50 border-red-100",
                  actionConfig[selectedLog.action]?.color === "blue" &&
                    "bg-gradient-to-r from-blue-50 to-blue-100/50 border-blue-100",
                  (!actionConfig[selectedLog.action]?.color ||
                    actionConfig[selectedLog.action]?.color === "zinc") &&
                    "bg-gradient-to-r from-zinc-50 to-zinc-100/50 border-zinc-200",
                )}
                whileHover={{
                  scale: 1.02,
                  y: -2,
                  boxShadow: "0 8px 25px -5px rgba(16, 185, 129, 0.15)",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center",
                      actionConfig[selectedLog.action]?.color === "emerald" &&
                        "bg-emerald-100",
                      actionConfig[selectedLog.action]?.color === "amber" &&
                        "bg-amber-100",
                      actionConfig[selectedLog.action]?.color === "red" &&
                        "bg-red-100",
                      actionConfig[selectedLog.action]?.color === "blue" &&
                        "bg-blue-100",
                      (!actionConfig[selectedLog.action]?.color ||
                        actionConfig[selectedLog.action]?.color === "zinc") &&
                        "bg-zinc-200",
                    )}
                  >
                    <Activity
                      className={cn(
                        "w-4 h-4",
                        actionConfig[selectedLog.action]?.color === "emerald" &&
                          "text-emerald-600",
                        actionConfig[selectedLog.action]?.color === "amber" &&
                          "text-amber-600",
                        actionConfig[selectedLog.action]?.color === "red" &&
                          "text-red-600",
                        actionConfig[selectedLog.action]?.color === "blue" &&
                          "text-blue-600",
                        (!actionConfig[selectedLog.action]?.color ||
                          actionConfig[selectedLog.action]?.color === "zinc") &&
                          "text-zinc-600",
                      )}
                    />
                  </div>
                  <span
                    className={cn(
                      "font-medium",
                      actionConfig[selectedLog.action]?.color === "emerald" &&
                        "text-emerald-700",
                      actionConfig[selectedLog.action]?.color === "amber" &&
                        "text-amber-700",
                      actionConfig[selectedLog.action]?.color === "red" &&
                        "text-red-700",
                      actionConfig[selectedLog.action]?.color === "blue" &&
                        "text-blue-700",
                      (!actionConfig[selectedLog.action]?.color ||
                        actionConfig[selectedLog.action]?.color === "zinc") &&
                        "text-zinc-700",
                    )}
                  >
                    Action
                  </span>
                </div>
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
                  className="text-sm px-3 py-1"
                >
                  {actionConfig[selectedLog.action]?.label ||
                    selectedLog.action}
                </Badge>
              </motion.div>

              {/* IP Address - Cyan theme */}
              {(selectedLog.ip || selectedLog.ip_address) && (
                <motion.div
                  className="flex items-center justify-between p-4 bg-gradient-to-r from-cyan-50 to-cyan-100/50 rounded-xl border border-cyan-100 cursor-pointer"
                  whileHover={{
                    scale: 1.02,
                    y: -2,
                    boxShadow: "0 8px 25px -5px rgba(6, 182, 212, 0.15)",
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-cyan-100 flex items-center justify-center">
                      <Shield className="w-4 h-4 text-cyan-600" />
                    </div>
                    <span className="text-cyan-700 font-medium">
                      IP Address
                    </span>
                  </div>
                  <span className="font-mono text-sm font-semibold text-cyan-900 bg-cyan-100 px-3 py-1 rounded-lg">
                    {selectedLog.ip || selectedLog.ip_address}
                  </span>
                </motion.div>
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
